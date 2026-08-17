import {
  CheckoutError,
  checkoutProductAllowsConsumedAccess,
  checkoutErrorPayload,
  checkoutProductNeedsLedger,
  verifyStripeCheckout,
} from "../server/checkout-core.js";
import {
  PaymentLedgerError,
  registerPaymentEntitlement,
} from "../server/payment-ledger.js";

function sendJson(response, status, payload) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
  return response.status(status).json(payload);
}

function parseBody(request) {
  const body = request.body && typeof request.body === "object"
    ? request.body
    : typeof request.body === "string" ? JSON.parse(request.body) : null;
  if (!body || Array.isArray(body) || JSON.stringify(body).length > 12_000) {
    throw new Error("invalid_payload");
  }
  return body;
}

function originIsAllowed(request) {
  const origin = String(request.headers.origin ?? "").trim();
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const host = String(request.headers["x-forwarded-host"] ?? request.headers.host ?? "")
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

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "method_not_allowed" });
  }
  if (!originIsAllowed(request)) return sendJson(response, 403, { error: "origin_not_allowed" });

  let body;
  try {
    body = parseBody(request);
  } catch {
    return sendJson(response, 400, { error: "invalid_payload" });
  }

  try {
    const result = await verifyStripeCheckout(body);
    if (checkoutProductNeedsLedger(result.entitlement.productId)) {
      try {
        const ledger = await registerPaymentEntitlement(result.entitlement);
        const reusableContentAccess = ledger.state === "consumed"
          && checkoutProductAllowsConsumedAccess(result.entitlement.productId);
        if (ledger.state !== "active" && !reusableContentAccess) {
          throw new CheckoutError("payment_credit_unavailable", 409);
        }
        result.entitlement.state = ledger.state;
        result.entitlement.creditAvailable = ledger.state === "active";
      } catch (error) {
        if (error instanceof CheckoutError) throw error;
        if (error instanceof PaymentLedgerError) {
          throw new CheckoutError(error.code, error.status);
        }
        throw error;
      }
    }
    console.info("checkout_payment_verified", {
      productId: result.entitlement.productId,
      orderId: result.entitlement.orderId,
    });
    return sendJson(response, 200, result);
  } catch (error) {
    const failure = checkoutErrorPayload(error);
    console.warn("checkout_payment_not_verified", {
      productId: String(body.productId ?? "").slice(0, 80),
      orderId: String(body.orderId ?? "").slice(0, 120),
      type: failure.body.error,
      status: failure.status,
    });
    return sendJson(response, failure.status, failure.body);
  }
}
