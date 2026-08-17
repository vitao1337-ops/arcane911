import assert from "node:assert/strict";
import test from "node:test";
import createCheckoutHandler from "../api/checkout.js";
import verifyCheckoutHandler from "../api/checkout-session.js";

function mockResponse() {
  const headers = new Map();
  return {
    statusCode: 0,
    payload: null,
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
    headers,
  };
}

function request(body) {
  return {
    method: "POST",
    body,
    headers: {
      origin: "https://arcane911.vercel.app",
      host: "arcane911.vercel.app",
    },
  };
}

function paidQuestionOrder() {
  return {
    orderId: "order-agent-ledger-test-0001",
    productId: "agent911-pergunta",
    readingId: "2026-08-17T00:00:00.000Z",
    questionNumber: 1,
    parentSessionId: "cs_test_parent1234567890",
    returnPath: "/tiragem-completa",
  };
}

async function withEnvironment(values, operation) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await operation();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("checkout de produto com IA falha antes de cobrar quando o ledger não está configurado", async () => {
  await withEnvironment({
    STRIPE_WEBHOOK_SECRET: "whsec_checkout_api_test_123456",
    SUPABASE_URL: undefined,
    SUPABASE_SECRET_KEY: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
  }, async () => {
    let externalCalls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { externalCalls += 1; };
    try {
      const response = mockResponse();
      await createCheckoutHandler(request(paidQuestionOrder()), response);
      assert.equal(response.statusCode, 503);
      assert.equal(response.payload.error, "payment_ledger_not_configured");
      assert.equal(externalCalls, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("schema ausente falha no pré-voo antes de qualquer chamada Stripe", async () => {
  await withEnvironment({
    STRIPE_SECRET_KEY: "sk_test_x",
    STRIPE_WEBHOOK_SECRET: "whsec_checkout_api_test_123456",
    SUPABASE_URL: "https://arcane-ledger.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret_arcane911_checkout_api_123456",
  }, async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url) => {
      calls.push(url);
      return {
        ok: false,
        status: 404,
        async json() { return { code: "PGRST202" }; },
      };
    };
    try {
      const response = mockResponse();
      await createCheckoutHandler(request(paidQuestionOrder()), response);
      assert.equal(response.statusCode, 503);
      assert.equal(response.payload.error, "payment_ledger_not_ready");
      assert.equal(calls.length, 1);
      assert.equal(calls.some((url) => url.includes("api.stripe.com")), false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("pré-voo pronto segue para validação da Ferradura e criação do Stripe", async () => {
  await withEnvironment({
    STRIPE_SECRET_KEY: "sk_test_x",
    STRIPE_WEBHOOK_SECRET: "whsec_checkout_api_test_123456",
    SUPABASE_URL: "https://arcane-ledger.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret_arcane911_checkout_api_123456",
  }, async () => {
    const originalFetch = globalThis.fetch;
    const order = paidQuestionOrder();
    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith("arcane911_payment_ledger_health")) {
        return { ok: true, status: 200, async json() { return { ready: true, version: 2 }; } };
      }
      if (url.endsWith(order.parentSessionId)) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              id: order.parentSessionId,
              status: "complete",
              payment_status: "paid",
              currency: "brl",
              amount_total: 1999,
              metadata: {
                product_id: "arcane911-leitura-profunda",
                reading_id: order.readingId,
              },
            };
          },
        };
      }
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            id: "cs_test_newquestion123456",
            url: "https://checkout.stripe.com/c/pay/cs_test_newquestion123456",
          };
        },
      };
    };
    try {
      const response = mockResponse();
      await createCheckoutHandler(request(order), response);
      assert.equal(response.statusCode, 200);
      assert.equal(response.payload.productId, order.productId);
      assert.equal(calls.length, 3);
      assert.match(calls[0].url, /arcane911_payment_ledger_health$/u);
      assert.equal(calls[1].url.endsWith(order.parentSessionId), true);
      assert.equal(calls[2].url, "https://api.stripe.com/v1/checkout/sessions");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("confirmação Stripe registra o crédito no ledger antes de devolvê-lo ao navegador", async () => {
  await withEnvironment({
    STRIPE_SECRET_KEY: "sk_test_x",
    STRIPE_WEBHOOK_SECRET: "whsec_checkout_api_test_123456",
    SUPABASE_URL: "https://arcane-ledger.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret_arcane911_checkout_api_123456",
  }, async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    const order = paidQuestionOrder();
    const sessionId = "cs_test_questionledger123456";
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      if (url.includes("api.stripe.com")) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              id: sessionId,
              status: "complete",
              payment_status: "paid",
              currency: "brl",
              amount_total: 500,
              payment_intent: "pi_questionledger123456",
              livemode: false,
              client_reference_id: order.orderId,
              metadata: {
                product_id: order.productId,
                order_id: order.orderId,
                reading_id: order.readingId,
                question_number: "1",
                parent_session_id: order.parentSessionId,
              },
            };
          },
        };
      }
      return {
        ok: true,
        status: 200,
        async json() { return { registered: true, state: "active" }; },
      };
    };

    try {
      const response = mockResponse();
      await verifyCheckoutHandler(request({ ...order, sessionId }), response);
      assert.equal(response.statusCode, 200);
      assert.equal(response.payload.paid, true);
      assert.equal(calls.length, 2);
      assert.match(calls[1].url, /arcane911_register_entitlement$/u);
      const ledgerBody = JSON.parse(calls[1].options.body);
      assert.equal(ledgerBody.p_stripe_session_id, sessionId);
      assert.equal(ledgerBody.p_question_number, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("reapresentar uma sessão já consumida não recria crédito no navegador", async () => {
  await withEnvironment({
    STRIPE_SECRET_KEY: "sk_test_x",
    STRIPE_WEBHOOK_SECRET: "whsec_checkout_api_test_123456",
    SUPABASE_URL: "https://arcane-ledger.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret_arcane911_checkout_api_123456",
  }, async () => {
    const originalFetch = globalThis.fetch;
    const order = paidQuestionOrder();
    const sessionId = "cs_test_questionledger123456";
    globalThis.fetch = async (url) => {
      if (url.includes("api.stripe.com")) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              id: sessionId,
              status: "complete",
              payment_status: "paid",
              currency: "brl",
              amount_total: 500,
              payment_intent: "pi_questionledger123456",
              livemode: false,
              client_reference_id: order.orderId,
              metadata: {
                product_id: order.productId,
                order_id: order.orderId,
                reading_id: order.readingId,
                question_number: "1",
                parent_session_id: order.parentSessionId,
              },
            };
          },
        };
      }
      return {
        ok: true,
        status: 200,
        async json() { return { registered: true, state: "consumed" }; },
      };
    };

    try {
      const response = mockResponse();
      await verifyCheckoutHandler(request({ ...order, sessionId }), response);
      assert.equal(response.statusCode, 409);
      assert.equal(response.payload.error, "payment_credit_unavailable");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
