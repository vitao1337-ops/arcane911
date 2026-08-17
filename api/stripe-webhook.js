import { CheckoutError, fulfillStripeCheckoutSession } from "../server/checkout-core.js";
import {
  PaymentLedgerError,
  registerPaymentEntitlement,
} from "../server/payment-ledger.js";
import { StripeWebhookError, verifyStripeWebhook } from "../server/stripe-webhook.js";

export const config = {
  api: { bodyParser: false },
  maxDuration: 15,
};

const fulfilledEvents = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

function sendJson(response, status, payload) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
  return response.status(status).json(payload);
}

async function rawRequestBody(request) {
  if (Buffer.isBuffer(request.rawBody)) return request.rawBody;
  if (typeof request.rawBody === "string") return Buffer.from(request.rawBody, "utf8");
  if (Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === "string") return Buffer.from(request.body, "utf8");

  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > 1_000_000) throw new StripeWebhookError("invalid_webhook_payload", 400);
      chunks.push(buffer);
    }
  } catch (error) {
    if (error instanceof StripeWebhookError) throw error;
    throw new StripeWebhookError("invalid_webhook_payload", 400);
  }
  return Buffer.concat(chunks);
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "method_not_allowed" });
  }

  try {
    const rawBody = await rawRequestBody(request);
    const signature = request.headers?.["stripe-signature"];
    const event = verifyStripeWebhook(rawBody, signature);

    if (!fulfilledEvents.has(event.type)) {
      console.info("stripe_webhook_ignored", {
        eventId: String(event.id).slice(0, 120),
        eventType: String(event.type).slice(0, 120),
      });
      return sendJson(response, 200, { received: true });
    }

    const sessionId = String(event.data.object?.id ?? "");
    const result = await fulfillStripeCheckoutSession(sessionId);
    await registerPaymentEntitlement(result.entitlement);
    console.info("stripe_webhook_fulfilled", {
      eventId: String(event.id).slice(0, 120),
      eventType: String(event.type).slice(0, 120),
      orderId: result.entitlement.orderId,
      productId: result.entitlement.productId,
    });
    return sendJson(response, 200, { received: true });
  } catch (error) {
    const known = error instanceof StripeWebhookError
      || error instanceof CheckoutError
      || error instanceof PaymentLedgerError;
    const status = known ? Number(error.status) || 400 : 503;
    const code = known ? String(error.code ?? error.message) : "webhook_unavailable";
    console.error("stripe_webhook_failed", {
      type: code.slice(0, 100),
      status,
    });
    return sendJson(response, status, { error: code });
  }
}
