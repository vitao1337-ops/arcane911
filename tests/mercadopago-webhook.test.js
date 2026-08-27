import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { verifyMercadoPagoWebhookSignature } from "../api/mercadopago-webhook.js";

const secret = "arcane911-webhook-test-secret";
const dataId = "ABC123456789";
const requestId = "request-webhook-123456";
const ts = "1787809000";

function signedRequest(signatureDataId = dataId) {
  const normalized = signatureDataId.toLowerCase();
  const manifest = `id:${normalized};request-id:${requestId};ts:${ts};`;
  const signature = createHmac("sha256", secret).update(manifest).digest("hex");
  return {
    headers: {
      "x-request-id": requestId,
      "x-signature": `ts=${ts},v1=${signature}`,
    },
  };
}

test("webhook Mercado Pago valida HMAC com data.id normalizado", () => {
  assert.doesNotThrow(() => verifyMercadoPagoWebhookSignature(signedRequest(), dataId, secret));
});

test("webhook Mercado Pago rejeita assinatura adulterada", () => {
  const request = signedRequest();
  const [prefix, signature] = request.headers["x-signature"].split("v1=");
  const flipped = `${signature[0] === "0" ? "1" : "0"}${signature.slice(1)}`;
  request.headers["x-signature"] = `${prefix}v1=${flipped}`;
  assert.throws(
    () => verifyMercadoPagoWebhookSignature(request, dataId, secret),
    (error) => error?.code === "invalid_webhook_signature" && error?.status === 401,
  );
});
