import { createHmac, timingSafeEqual } from "node:crypto";
import { CheckoutError, checkoutErrorPayload, fulfillMercadoPagoPayment } from "../server/checkout-core.js";
import {
  PaymentLedgerError,
  getAstralOrderForReview,
  registerPaymentEntitlement,
  revokePaymentEntitlement,
} from "../server/payment-ledger.js";
import { notifyAstralReviewer } from "../server/astral-delivery.js";

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

export function isMercadoPagoPanelTest(request, dataId = webhookDataId(request)) {
  const body = request?.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  return String(dataId ?? "").trim().toLowerCase() === "123456"
    && body.live_mode === false
    && String(body.type ?? "").trim() === "payment"
    && String(body.action ?? "").trim() === "payment.updated";
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

    // O testador de Webhooks do Mercado Pago envia o pagamento ficticio 123456.
    // Ele serve apenas para validar a entrega da notificacao e nao existe na API
    // /v1/payments, portanto deve ser reconhecido sem tentar fazer fulfillment.
    if (isMercadoPagoPanelTest(request, dataId)) {
      console.info("mercadopago_webhook_panel_test_acknowledged", { paymentId: dataId });
      return sendJson(response, 200, { received: true, test: true });
    }

    if (type && type !== "payment") return sendJson(response, 200, { received: true, ignored: true });

    const result = await fulfillMercadoPagoPayment(dataId);
    if (result.revoked) {
      await revokePaymentEntitlement(result.sessionId, result.reason);
      return sendJson(response, 200, { received: true, revoked: true });
    }
    await registerPaymentEntitlement(result.entitlement);
    if (result.entitlement.offerContext === "astral_document") {
      try {
        const queued = await getAstralOrderForReview(result.entitlement.orderId);
        if (queued?.found) await notifyAstralReviewer(queued.order);
      } catch (notificationError) {
        console.warn("astral_reviewer_notification_failed", {
          orderId: result.entitlement.orderId,
          type: notificationError?.code || "notification_unavailable",
        });
      }
    }
    console.info("mercadopago_webhook_fulfilled", {
      paymentId: result.entitlement.sessionId,
      orderId: result.entitlement.orderId,
      productId: result.entitlement.productId,
    });
    return sendJson(response, 200, { received: true });
  } catch (error) {
    if (error instanceof PaymentLedgerError && error.code === 'payment_revoked') {
      return sendJson(response, 200, { received: true, revoked: true });
    }
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
