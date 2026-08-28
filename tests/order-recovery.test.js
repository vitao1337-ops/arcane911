import assert from "node:assert/strict";
import test from "node:test";
import handler from "../api/order-status.js";

const env = {
  SUPABASE_URL: "https://arcane-ledger.supabase.co",
  SUPABASE_SECRET_KEY: ["sb", "secret", "arcane911", "recovery", "1234567890"].join("_"),
};

function mockResponse() {
  return {
    statusCode: 0,
    payload: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

function request(orderId, ip) {
  return {
    method: "POST",
    body: { orderId },
    headers: {
      origin: "https://arcane911.vercel.app",
      host: "arcane911.vercel.app",
      "x-forwarded-for": ip,
    },
    socket: {},
  };
}

async function withEnvironment(operation) {
  const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  try {
    return await operation();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function ledgerResult(orderId, overrides = {}) {
  return {
    found: true,
    sessionId: "mp-12345678906",
    orderId,
    productId: "arcane911-leitura-profunda",
    readingId: "reading-recovery-123456",
    readingSlug: "",
    offerContext: "",
    questionNumber: 0,
    amountTotal: 1999,
    currency: "brl",
    livemode: false,
    state: "active",
    verifiedAt: "2026-08-17T12:00:00.000Z",
    ...overrides,
  };
}

test("código do pedido restaura autorização e consulta o conteúdo privado", async () => {
  await withEnvironment(async () => {
    const orderId = "order-recovery-complete-123456";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, options) => {
      if (_url.endsWith('arcane911_read_paid_content')) return { ok: true, status: 200, json: async () => ({ authorized: true, results: [] }) };
      assert.deepEqual(JSON.parse(options.body), { p_order_id: orderId });
      return { ok: true, status: 200, async json() { return ledgerResult(orderId); } };
    };
    try {
      const result = mockResponse();
      await handler(request(orderId, "198.51.100.210"), result);
      assert.equal(result.statusCode, 200);
      assert.equal(result.payload.entitlement.creditAvailable, true);
      assert.equal(JSON.stringify(result.payload).includes("question"), true);
      assert.equal(Object.keys(result.payload.entitlement).some((key) => ["questionText", "cards", "answer"].includes(key)), false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("conteúdo pago continua autorizado, mas crédito de IA consumido não renasce", async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const completeOrder = "order-recovery-consumed-123456";
    globalThis.fetch = async (url) => url.endsWith('arcane911_read_paid_content')
      ? { ok: true, status: 200, json: async () => ({ authorized: true, results: [] }) } : ({
      ok: true,
      status: 200,
      async json() { return ledgerResult(completeOrder, { state: "consumed" }); },
    });
    try {
      const completeResult = mockResponse();
      await handler(request(completeOrder, "198.51.100.211"), completeResult);
      assert.equal(completeResult.statusCode, 200);
      assert.equal(completeResult.payload.entitlement.creditAvailable, false);

      const agentOrder = "order-recovery-agent-123456";
      globalThis.fetch = async (url) => url.endsWith('arcane911_read_paid_content')
      ? { ok: true, status: 200, json: async () => ({ authorized: true, results: [] }) } : ({
        ok: true,
        status: 200,
        async json() {
          return ledgerResult(agentOrder, {
            state: "consumed",
            productId: "agent911-pergunta",
            questionNumber: 1,
            amountTotal: 500,
          });
        },
      });
      const agentResult = mockResponse();
      await handler(request(agentOrder, "198.51.100.212"), agentResult);
      assert.equal(agentResult.statusCode, 409);
      assert.equal(agentResult.payload.error, "payment_credit_unavailable");

      const astralOrder = "order-recovery-astral-123456";
      globalThis.fetch = async (url) => url.endsWith('arcane911_read_paid_content')
      ? { ok: true, status: 200, json: async () => ({ authorized: true, results: [] }) } : ({
        ok: true,
        status: 200,
        async json() {
          return ledgerResult(astralOrder, {
            state: "consumed",
            productId: "astro911-documento-completo",
            readingId: "astro-v1-recoveryfingerprint",
            offerContext: "astral_document",
            amountTotal: 2990,
          });
        },
      });
      const astralResult = mockResponse();
      await handler(request(astralOrder, "198.51.100.213"), astralResult);
      assert.equal(astralResult.statusCode, 200);
      assert.equal(astralResult.payload.entitlement.creditAvailable, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
