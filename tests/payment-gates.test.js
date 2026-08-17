import assert from "node:assert/strict";
import test from "node:test";
import agentHandler, { resetAgent911RuntimeStateForTests } from "../api/agent-911.js";
import astroHandler, { resetAstro911RuntimeStateForTests } from "../api/astro-911.js";
import { completePositions, tarotCards } from "../src/data/tarot.js";
import { buildSpecificLayout, specificReadingsBySlug } from "../src/data/products.js";
import { astro911Fingerprint } from "../src/lib/astro911.js";
import { sampleAstroChart, sampleAstroRequest } from "./astro911-fixture.js";

function mockResponse() {
  return {
    statusCode: 0,
    payload: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

function request(body) {
  return {
    method: "POST",
    body,
    headers: {
      origin: "https://arcane911.vercel.app",
      host: "arcane911.vercel.app",
      "x-forwarded-for": "198.51.100.199",
    },
    socket: {},
  };
}

function followUpBody(payment) {
  const cards = [
    tarotCards[0], tarotCards[11], tarotCards[2], tarotCards[15],
    tarotCards[18], tarotCards[8], tarotCards[19],
  ];
  const createdAt = "2026-08-17T00:00:00.000Z";
  return {
    agent: "agent-911",
    requestId: "paid-follow-up-gate-test",
    action: "follow_up",
    readingMode: "acolhedora",
    message: "Qual limite concreto esta mesa pede agora?",
    history: [],
    memoryConsent: false,
    questionsUsed: 0,
    payment,
    context: {
      reading: {
        id: createdAt,
        createdAt,
        intentId: "caminhos",
        intentLabel: "Caminhos",
        question: "Que movimento pede verdade agora?",
        cards: cards.map((card, index) => ({
          slug: card.slug,
          position: { id: completePositions[index].id },
        })),
      },
    },
  };
}

function completeSummaryBody(payment = null) {
  const body = followUpBody(payment);
  body.action = "complete_summary";
  body.message = "";
  body.questionsUsed = 0;
  return body;
}

function specificSummaryBody(payment = null) {
  const reading = specificReadingsBySlug.caminhos;
  const layout = buildSpecificLayout(reading);
  const cards = [tarotCards[1], tarotCards[4], tarotCards[7], tarotCards[10], tarotCards[13]];
  const createdAt = "specific-payment-gate-123456";
  return {
    agent: "agent-911",
    requestId: "paid-specific-gate-test",
    action: "specific_summary",
    readingMode: "acolhedora",
    memoryConsent: false,
    questionsUsed: 0,
    payment,
    context: {
      reading: {
        id: createdAt,
        createdAt,
        intentId: reading.intentId,
        intentLabel: "Caminhos",
        question: "Qual decisão precisa de limite agora?",
        spreadId: reading.slug,
        cards: cards.map((card, index) => ({
          slug: card.slug,
          position: { id: layout[index].id },
        })),
      },
    },
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

test("chamada direta de follow-up sem crédito é recusada antes de qualquer provider", async () => {
  resetAgent911RuntimeStateForTests();
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { calls += 1; };
  try {
    const response = mockResponse();
    await agentHandler(request(followUpBody(null)), response);
    assert.equal(response.statusCode, 402);
    assert.equal(response.payload.error, "payment_required");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sínteses completas e específicas não podem chamar IA sem a compra correspondente", async () => {
  resetAgent911RuntimeStateForTests();
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { calls += 1; };
  try {
    const completeResponse = mockResponse();
    await agentHandler(request(completeSummaryBody()), completeResponse);
    assert.equal(completeResponse.statusCode, 402);
    assert.equal(completeResponse.payload.error, "payment_required");

    const specificResponse = mockResponse();
    await agentHandler(request(specificSummaryBody()), specificResponse);
    assert.equal(specificResponse.statusCode, 402);
    assert.equal(specificResponse.payload.error, "payment_required");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a ação antiga de sete cartas não reabre uma rota gratuita escondida", async () => {
  resetAgent911RuntimeStateForTests();
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { calls += 1; };
  try {
    const body = completeSummaryBody();
    body.action = "initial_reading";
    const response = mockResponse();
    await agentHandler(request(body), response);
    assert.equal(response.statusCode, 400);
    assert.equal(response.payload.error, "invalid_payload");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("crédito formal sem ledger configurado falha fechado e não consome IA", async () => {
  await withEnvironment({
    GEMINI_API_KEY: "gemini-payment-gate-test",
    GEMINI_FALLBACK_MODEL: "off",
    SUPABASE_URL: undefined,
    SUPABASE_SECRET_KEY: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
  }, async () => {
    resetAgent911RuntimeStateForTests();
    let calls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { calls += 1; };
    try {
      const body = followUpBody({
        sessionId: "cs_test_paidfollowup123456",
        productId: "agent911-pergunta",
        readingId: "2026-08-17T00:00:00.000Z",
        questionNumber: 1,
      });
      const response = mockResponse();
      await agentHandler(request(body), response);
      assert.equal(response.statusCode, 503);
      assert.equal(response.payload.error, "payment_ledger_not_configured");
      assert.equal(calls, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("falha do provider devolve o crédito ao ledger em vez de queimá-lo", async () => {
  await withEnvironment({
    GEMINI_API_KEY: "gemini-payment-release-test",
    GEMINI_FALLBACK_MODEL: "off",
    OPENAI_API_KEY: undefined,
    SUPABASE_URL: "https://arcane-ledger.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret_arcane911_payment_release_123456",
  }, async () => {
    resetAgent911RuntimeStateForTests();
    const originalFetch = globalThis.fetch;
    const originalError = console.error;
    const calls = [];
    console.error = () => {};
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body ?? "{}");
      calls.push({ url, body });
      if (url.endsWith("arcane911_claim_entitlement")) {
        return { ok: true, status: 200, async json() { return { claimed: true, state: "processing" }; } };
      }
      if (url.endsWith("arcane911_settle_entitlement")) {
        return { ok: true, status: 200, async json() { return { settled: true, state: "active" }; } };
      }
      return {
        ok: false,
        status: 403,
        async json() { return { error: { code: "permission_denied" } }; },
      };
    };

    try {
      const body = followUpBody({
        sessionId: "cs_test_paidfollowup123456",
        productId: "agent911-pergunta",
        readingId: "2026-08-17T00:00:00.000Z",
        questionNumber: 1,
      });
      const response = mockResponse();
      await agentHandler(request(body), response);
      assert.equal(response.statusCode, 503);
      assert.equal(calls.filter((call) => call.url.includes("generativelanguage.googleapis.com")).length, 1);
      const settlement = calls.find((call) => call.url.endsWith("arcane911_settle_entitlement"));
      assert.equal(settlement.body.p_outcome, "released");
    } finally {
      globalThis.fetch = originalFetch;
      console.error = originalError;
    }
  });
});

test("Documento Astral pago sem autorização é recusado antes da geração", async () => {
  await withEnvironment({ VITE_ASTRO911_PRICE_CENTS: "2990" }, async () => {
    resetAstro911RuntimeStateForTests();
    let calls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { calls += 1; };
    try {
      const response = mockResponse();
      await astroHandler(request(sampleAstroRequest()), response);
      assert.equal(response.statusCode, 402);
      assert.equal(response.payload.error, "payment_required");
      assert.equal(calls, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("fingerprint pago do mapa precisa coincidir antes de consultar o ledger", async () => {
  await withEnvironment({
    VITE_ASTRO911_PRICE_CENTS: "2990",
    GEMINI_API_KEY: "gemini-astro-payment-gate",
    SUPABASE_URL: undefined,
    SUPABASE_SECRET_KEY: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
  }, async () => {
    resetAstro911RuntimeStateForTests();
    const payment = {
      sessionId: "cs_test_astralpayment123456",
      productId: "astro911-documento-completo",
      readingId: astro911Fingerprint(sampleAstroChart()),
    };
    const validResponse = mockResponse();
    await astroHandler(request(sampleAstroRequest({ payment })), validResponse);
    assert.equal(validResponse.statusCode, 503);
    assert.equal(validResponse.payload.error, "payment_ledger_not_configured");

    const mismatchedResponse = mockResponse();
    await astroHandler(request(sampleAstroRequest({
      payment: { ...payment, readingId: "astro-v1-outro-mapa" },
    })), mismatchedResponse);
    assert.equal(mismatchedResponse.statusCode, 402);
    assert.equal(mismatchedResponse.payload.error, "payment_required");
  });
});
