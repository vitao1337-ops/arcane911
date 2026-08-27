import test from "node:test";
import assert from "node:assert/strict";
import {
  createMercadoPagoPayment,
  prepareMercadoPagoCheckout,
  verifyMercadoPagoPayment,
} from "../server/checkout-core.js";

const TEST_MP_ACCESS_TOKEN = `${["APP", "USR"].join("_")}-arcane911-test-access-token-123456789`;

const env = Object.freeze({
  MERCADOPAGO_ACCESS_TOKEN: TEST_MP_ACCESS_TOKEN,
  VITE_COMPLETE_READING_PRICE_CENTS: "1999",
});

const order = Object.freeze({
  orderId: "order-1234567890abcdef",
  productId: "arcane911-leitura-profunda",
  readingId: "reading-1234567890",
  readingSlug: "",
  offerContext: "",
  questionNumber: 0,
  parentSessionId: "",
  returnPath: "/tiragem-completa",
});

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

function approvedPixPayment() {
  return {
    id: 12345678901,
    status: "approved",
    status_detail: "accredited",
    currency_id: "BRL",
    transaction_amount: 19.99,
    external_reference: order.orderId,
    payment_method_id: "pix",
    payment_type_id: "bank_transfer",
    live_mode: false,
    date_approved: "2026-08-27T05:00:00.000Z",
    metadata: {
      product_id: order.productId,
      product_kind: "complete_reading",
      order_id: order.orderId,
      reading_id: order.readingId,
      reading_slug: "",
      offer_context: "",
      question_number: "0",
      parent_payment_id: "",
    },
    point_of_interaction: {
      transaction_data: {
        qr_code: "00020101021226890014br.gov.bcb.pix",
        qr_code_base64: "YWJj",
        ticket_url: "https://www.mercadopago.com.br/payments/123",
      },
    },
  };
}

test("pré-voo leva apenas ao checkout interno do Arcane", async () => {
  const result = await prepareMercadoPagoCheckout(order, {
    env,
    origin: "https://arcane911.vercel.app",
    fetchImplementation: async () => { throw new Error("provider should not be called"); },
  });
  assert.equal(result.provider, "mercadopago");
  assert.equal(result.checkoutUrl, "https://arcane911.vercel.app/pagamento");
});

test("Pix usa preço do catálogo, idempotência e metadata técnica", async () => {
  const calls = [];
  const result = await createMercadoPagoPayment({
    ...order,
    paymentData: {
      payment_method_id: "pix",
      payer: { email: "cliente@example.com", identification: { type: "CPF", number: "12345678909" } },
      transaction_amount: 0.01,
    },
  }, {
    env,
    fetchImplementation: async (url, options) => {
      calls.push({ url: String(url), options });
      return jsonResponse(approvedPixPayment());
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.mercadopago.com/v1/payments");
  assert.ok(calls[0].options.headers["X-Idempotency-Key"]);
  const sent = JSON.parse(calls[0].options.body);
  assert.equal(sent.transaction_amount, 19.99);
  assert.equal(sent.external_reference, order.orderId);
  assert.equal(sent.payment_method_id, "pix");
  assert.equal(sent.metadata.reading_id, order.readingId);
  assert.equal(result.paymentId, "mp-12345678901");
  assert.equal(result.entitlement.sessionId, "mp-12345678901");
});

test("confirmação consulta o Mercado Pago e rejeita valor divergente", async () => {
  const ok = await verifyMercadoPagoPayment({ ...order, paymentId: "mp-12345678901" }, {
    env,
    fetchImplementation: async () => jsonResponse(approvedPixPayment()),
  });
  assert.equal(ok.paid, true);

  await assert.rejects(
    verifyMercadoPagoPayment({ ...order, paymentId: "mp-12345678901" }, {
      env,
      fetchImplementation: async () => jsonResponse({ ...approvedPixPayment(), transaction_amount: 1 }),
    }),
    (error) => error?.code === "payment_mismatch",
  );
});

test("cartão só passa quando o método consultado é credit_card", async () => {
  const calls = [];
  const cardPayment = {
    ...approvedPixPayment(),
    id: 12345678902,
    payment_method_id: "visa",
    payment_type_id: "credit_card",
  };

  const result = await createMercadoPagoPayment({
    ...order,
    paymentData: {
      payment_method_id: "visa",
      token: "card-token-created-by-brick",
      installments: 1,
      issuer_id: "25",
      payer: { email: "cliente@example.com", identification: { type: "CPF", number: "12345678909" } },
    },
  }, {
    env,
    fetchImplementation: async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).endsWith("/v1/payment_methods")) {
        return jsonResponse([{ id: "visa", payment_type_id: "credit_card" }]);
      }
      return jsonResponse(cardPayment);
    },
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, "https://api.mercadopago.com/v1/payments");
  const sent = JSON.parse(calls[1].options.body);
  assert.equal(sent.transaction_amount, 19.99);
  assert.equal(sent.payment_method_id, "visa");
  assert.equal(sent.token, "card-token-created-by-brick");
  assert.equal(sent.installments, 1);
  assert.equal(result.paymentType, "credit_card");
  assert.equal(result.entitlement.sessionId, "mp-12345678902");
});
