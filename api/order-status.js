import {
  checkoutProductAllowsConsumedAccess,
  CheckoutError,
} from "../server/checkout-core.js";
import {
  findPaymentEntitlementByOrder,
  PaymentLedgerError,
} from "../server/payment-ledger.js";

const recoveryBuckets = globalThis.__arcane911RecoveryBuckets ?? new Map();
globalThis.__arcane911RecoveryBuckets = recoveryBuckets;

function sendJson(response, status, payload, headers = {}) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
  Object.entries(headers).forEach(([key, value]) => response.setHeader(key, value));
  return response.status(status).json(payload);
}

function originIsAllowed(request) {
  const origin = String(request.headers?.origin ?? "").trim();
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const host = String(request.headers?.["x-forwarded-host"] ?? request.headers?.host ?? "")
      .split(",")[0]
      .trim();
    if (originUrl.host === host) return true;
    return String(process.env.ARCANE911_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .includes(originUrl.origin);
  } catch {
    return false;
  }
}

function requestIp(request) {
  return String(request.headers?.["x-forwarded-for"] ?? request.socket?.remoteAddress ?? "unknown")
    .split(",")[0]
    .trim()
    .slice(0, 100);
}

function consumeRecoveryRate(ip, now = Date.now()) {
  const windowMs = 10 * 60 * 1_000;
  const existing = recoveryBuckets.get(ip);
  const bucket = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : existing;
  bucket.count += 1;
  recoveryBuckets.set(ip, bucket);
  for (const [key, value] of recoveryBuckets.entries()) {
    if (value.resetAt <= now) recoveryBuckets.delete(key);
  }
  while (recoveryBuckets.size > 2_000) {
    recoveryBuckets.delete(recoveryBuckets.keys().next().value);
  }
  return {
    allowed: bucket.count <= 12,
    remaining: Math.max(0, 12 - bucket.count),
    resetAt: bucket.resetAt,
  };
}

function parseBody(request) {
  const body = request.body && typeof request.body === "object"
    ? request.body
    : typeof request.body === "string" ? JSON.parse(request.body) : null;
  if (!body || Array.isArray(body) || JSON.stringify(body).length > 2_000) {
    throw new CheckoutError("invalid_payload", 400);
  }
  return body;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "method_not_allowed" });
  }
  if (!originIsAllowed(request)) return sendJson(response, 403, { error: "origin_not_allowed" });

  const rate = consumeRecoveryRate(requestIp(request));
  const rateHeaders = {
    "X-RateLimit-Limit": "12",
    "X-RateLimit-Remaining": String(rate.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rate.resetAt / 1_000)),
  };
  if (!rate.allowed) {
    return sendJson(response, 429, { error: "rate_limit" }, {
      ...rateHeaders,
      "Retry-After": String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1_000))),
    });
  }

  try {
    const body = parseBody(request);
    const entitlement = await findPaymentEntitlementByOrder(body.orderId);
    if (!entitlement) return sendJson(response, 404, { error: "purchase_not_found" }, rateHeaders);
    if (entitlement.state === "processing") {
      return sendJson(response, 409, { error: "purchase_processing" }, rateHeaders);
    }
    const allowsConsumedAccess = checkoutProductAllowsConsumedAccess(entitlement.productId);
    if (entitlement.state === "consumed" && !allowsConsumedAccess) {
      return sendJson(response, 409, { error: "payment_credit_unavailable" }, rateHeaders);
    }

    console.info("purchase_recovery_completed", {
      orderId: entitlement.orderId,
      productId: entitlement.productId,
      state: entitlement.state,
    });
    return sendJson(response, 200, {
      entitlement: {
        ...entitlement,
        creditAvailable: entitlement.state === "active",
      },
    }, rateHeaders);
  } catch (error) {
    const known = error instanceof CheckoutError || error instanceof PaymentLedgerError;
    const status = known ? Number(error.status) || 400 : 503;
    const code = known ? String(error.code ?? error.message) : "payment_ledger_unavailable";
    return sendJson(response, status, { error: code }, rateHeaders);
  }
}
