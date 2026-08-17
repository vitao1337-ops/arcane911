import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TOLERANCE_SECONDS = 300;

export class StripeWebhookError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = "StripeWebhookError";
    this.code = code;
    this.status = status;
  }
}

function webhookSecret(env = process.env) {
  const secret = String(env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  if (!/^whsec_[A-Za-z0-9_/-]{16,220}$/u.test(secret)) {
    throw new StripeWebhookError("webhook_not_configured", 503);
  }
  return secret;
}

export function stripeWebhookConfigured(env = process.env) {
  try {
    webhookSecret(env);
    return true;
  } catch {
    return false;
  }
}

function signatureParts(headerValue) {
  const values = String(headerValue ?? "")
    .split(",")
    .map((part) => part.trim().split("=", 2))
    .filter(([key, value]) => key && value);
  const timestamp = Number(values.find(([key]) => key === "t")?.[1]);
  const signatures = values
    .filter(([key]) => key === "v1")
    .map(([, value]) => value)
    .filter((value) => /^[a-f0-9]{64}$/iu.test(value));
  if (!Number.isInteger(timestamp) || timestamp <= 0 || !signatures.length) {
    throw new StripeWebhookError("invalid_webhook_signature", 400);
  }
  return { timestamp, signatures };
}

function constantTimeHexMatch(expectedHex, receivedHex) {
  const expected = Buffer.from(expectedHex, "hex");
  const received = Buffer.from(receivedHex, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function verifyStripeWebhook(rawBodyValue, signatureHeader, {
  env = process.env,
  nowSeconds = Math.floor(Date.now() / 1_000),
} = {}) {
  const rawBody = Buffer.isBuffer(rawBodyValue)
    ? rawBodyValue.toString("utf8")
    : String(rawBodyValue ?? "");
  if (!rawBody || Buffer.byteLength(rawBody, "utf8") > 1_000_000) {
    throw new StripeWebhookError("invalid_webhook_payload", 400);
  }

  const { timestamp, signatures } = signatureParts(signatureHeader);
  const configuredTolerance = Number(env.STRIPE_WEBHOOK_TOLERANCE_SECONDS);
  const toleranceSeconds = Number.isFinite(configuredTolerance)
    ? Math.min(900, Math.max(30, Math.floor(configuredTolerance)))
    : DEFAULT_TOLERANCE_SECONDS;
  if (Math.abs(Number(nowSeconds) - timestamp) > toleranceSeconds) {
    throw new StripeWebhookError("stale_webhook_signature", 400);
  }

  const expected = createHmac("sha256", webhookSecret(env))
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  if (!signatures.some((signature) => constantTimeHexMatch(expected, signature))) {
    throw new StripeWebhookError("invalid_webhook_signature", 400);
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    throw new StripeWebhookError("invalid_webhook_payload", 400);
  }
  if (!/^evt_[A-Za-z0-9]{8,220}$/u.test(String(event?.id ?? ""))
      || typeof event?.type !== "string"
      || !event?.data?.object) {
    throw new StripeWebhookError("invalid_webhook_payload", 400);
  }
  return event;
}
