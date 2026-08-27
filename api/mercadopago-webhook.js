import { createHmac, timingSafeEqual } from "node:crypto";
import { CheckoutError, checkoutErrorPayload, fulfillMercadoPagoPayment } from "../server/checkout-core.js";
import { PaymentLedgerError, registerPaymentEntitlement } from "../server/payment-ledger.js";

function sendJson(response, status, payload) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
  return response.status(status).json(payload);
}

function parseSignature(value) {
  const parts = Object.fromEntries(String(value ?? "").split(",").map((part) => part.trim().split("=", 2)));
  return { ts: String(parts.ts ?? "").trim(), v1: String(parts.v1 ?? "").trim().toLowerCase() };
}

function webhookSecret() {
  const secret = String(process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "").trim();
  if (secret.length < 16) throw new CheckoutError("webhook_not_configured", 503);
  return secret;
}

function webhookDataId(request) {
  return String(
    request.query?.["data.id"]
      ?? request.query?.data_id
      ?? request.body?.data?.id
      ?? request.body?.id
      ?? "",
  ).trim().toLowerCase();
}

export function verifyMercadoPagoWebhookSignature(request, dataId, secretOverride = "") {
  const { ts, v1 } = parseSignature(request.headers?.["x-signature"]);
  const requestId = String(request.headers?.["x-request-id"] ?? "").trim();
  const normalizedDataId = String(dataId ?? "").trim().toLowerCase();
  const secret = String(secretOverride ?? "").trim() || webhookSecret();
  if (!ts || !/^[0-9a-f]{64}$/u.test(v1) || !requestId || !normalizedDataId || secret.length < 16) {
    throw new CheckoutError("invalid_webhook_signature", 401);
  }
  const manifest = `id:${normalizedDataId};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const receivedBuffer = Buffer.from(v1, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) {
    throw new CheckoutError("invalid_webhook_signature", 401);
  }
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "method_not_allowed" });
  }

  const type = String(request.body?.type ?? request.query?.type ?? "").trim();
  const dataId = webhookDataId(request);
  try {
    verifyMercadoPagoWebhookSignature(request, dataId);
    if (type && type !== "payment") return sendJson(response, 200, { received: true, ignored: true });

    const result = await fulfillMercadoPagoPayment(dataId);
    await registerPaymentEntitlement(result.entitlement);
    console.info("mercadopago_webhook_fulfilled", {
      paymentId: result.entitlement.sessionId,
      orderId: result.entitlement.orderId,
      productId: result.entitlement.productId,
    });
    return sendJson(response, 200, { received: true });
  } catch (error) {
    if (error instanceof CheckoutError && error.code === "payment_not_confirmed") {
      return sendJson(response, 200, { received: true, pending: true });
    }
    const known = error instanceof CheckoutError || error instanceof PaymentLedgerError;
    const failure = known
      ? checkoutErrorPayload(error instanceof CheckoutError ? error : new CheckoutError(error.code, error.status))
      : { status: 503, body: { error: "webhook_unavailable" } };
    console.error("mercadopago_webhook_failed", { type: failure.body.error, status: failure.status });
    return sendJson(response, failure.status, failure.body);
  }
}
