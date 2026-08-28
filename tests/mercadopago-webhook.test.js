import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import handler, { isMercadoPagoPanelTest, verifyMercadoPagoWebhookSignature } from "../api/mercadopago-webhook.js";

const secret = "arcane911-webhook-test-secret";
const dataId = "ABC123456789";
const requestId = "request-webhook-123456";
const ts = "1787809000";

function signedRequest(signatureDataId = dataId, body = undefined) {
  const normalized = signatureDataId.toLowerCase();
  const manifest = `id:${normalized};request-id:${requestId};ts:${ts};`;
  const signature = createHmac("sha256", secret).update(manifest).digest("hex");
  return {
    method: "POST",
    query: {},
    body,
    headers: {
      "x-request-id": requestId,
      "x-signature": `ts=${ts},v1=${signature}`,
    },
  };
}

function responseRecorder() {
  const state = { status: 0, body: null, headers: {} };
  return {
    state,
    setHeader(name, value) {
      state.headers[name] = value;
    },
    status(value) {
      state.status = value;
      return this;
    },
    json(value) {
      state.body = value;
      return value;
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

test("reconhece somente o evento ficticio do testador de Webhooks", () => {
  const request = signedRequest("123456", {
    action: "payment.updated",
    api_version: "v1",
    data: { id: "123456" },
    date_created: "2021-11-01T02:02:02Z",
    id: "123456",
    live_mode: false,
    type: "payment",
    user_id: 272838021,
  });
  assert.equal(isMercadoPagoPanelTest(request, "123456"), true);
  assert.equal(isMercadoPagoPanelTest({ ...request, body: { ...request.body, live_mode: true } }, "123456"), false);
  assert.equal(isMercadoPagoPanelTest(request, "999999"), false);
});

test("testador do Mercado Pago recebe 200 sem consultar pagamento ficticio", async () => {
  const originalSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;
  try {
    const request = signedRequest("123456", {
      action: "payment.updated",
      api_version: "v1",
      data: { id: "123456" },
      date_created: "2021-11-01T02:02:02Z",
      id: "123456",
      live_mode: false,
      type: "payment",
      user_id: 272838021,
    });
    const response = responseRecorder();
    await handler(request, response);
    assert.equal(response.state.status, 200);
    assert.deepEqual(response.state.body, { received: true, test: true });
  } finally {
    if (originalSecret === undefined) delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    else process.env.MERCADOPAGO_WEBHOOK_SECRET = originalSecret;
  }
});
