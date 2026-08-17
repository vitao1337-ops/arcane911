import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import handler, { resetAgent911RuntimeStateForTests } from "../api/agent-911.js";
import { positions, tarotCards } from "../src/data/tarot.js";

function response() {
  return {
    statusCode: 0,
    payload: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

function openingBody() {
  return {
    agent: "agent-911",
    requestId: "budget-gate-test",
    action: "opening_summary",
    memoryConsent: false,
    context: {
      reading: {
        id: "budget-reading-123456",
        createdAt: "budget-reading-123456",
        intentId: "caminhos",
        intentLabel: "Caminhos",
        question: "Como separar desejo e fatos nesta escolha?",
        cards: [tarotCards[0], tarotCards[11], tarotCards[2]].map((card, index) => ({
          slug: card.slug,
          position: { id: positions[index].id },
        })),
      },
    },
  };
}

test("o teto conservador bloqueia a chamada antes do provider e o padrão permanece R$ 1", async () => {
  const source = readFileSync(new URL("../api/agent-911.js", import.meta.url), "utf8");
  assert.match(source, /DEFAULT_MAX_COST_BRL = 1/);
  assert.match(source, /DEFAULT_MAX_OUTPUT_TOKENS = 4_096/);

  const original = {
    key: process.env.GEMINI_API_KEY,
    fallback: process.env.GEMINI_FALLBACK_MODEL,
    budget: process.env.AGENT911_MAX_COST_BRL,
  };
  process.env.GEMINI_API_KEY = "gemini-budget-test";
  process.env.GEMINI_FALLBACK_MODEL = "off";
  process.env.AGENT911_MAX_COST_BRL = "0.10";
  resetAgent911RuntimeStateForTests();
  let providerCalls = 0;
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  globalThis.fetch = async () => { providerCalls += 1; };
  console.error = () => {};

  try {
    const result = response();
    await handler({
      method: "POST",
      body: openingBody(),
      headers: { host: "arcane911.vercel.app", "x-forwarded-for": "198.51.100.230" },
      socket: {},
    }, result);
    assert.equal(result.statusCode, 503);
    assert.equal(result.payload.error, "provider_unavailable");
    assert.equal(providerCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    if (original.key === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = original.key;
    if (original.fallback === undefined) delete process.env.GEMINI_FALLBACK_MODEL;
    else process.env.GEMINI_FALLBACK_MODEL = original.fallback;
    if (original.budget === undefined) delete process.env.AGENT911_MAX_COST_BRL;
    else process.env.AGENT911_MAX_COST_BRL = original.budget;
  }
});
