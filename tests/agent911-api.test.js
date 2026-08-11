import assert from "node:assert/strict";
import test from "node:test";
import handler from "../api/agent-911.js";
import { completePositions, tarotCards } from "../src/data/tarot.js";

const selected = [
  tarotCards[0],
  tarotCards[11],
  tarotCards[2],
  tarotCards[15],
  tarotCards[18],
  tarotCards[8],
  tarotCards[19],
];

function requestBody() {
  return {
    agent: "agent-911",
    requestId: "api-contract-test",
    action: "initial_reading",
    memoryConsent: false,
    questionsUsed: 0,
    context: {
      reading: {
        id: "reading-contract-test",
        createdAt: "2026-08-11T12:00:00.000Z",
        intentId: "caminhos",
        intentLabel: "Caminhos",
        question: "Que movimento pede verdade agora?",
        cards: selected.map((card, index) => ({
          slug: card.slug,
          position: { id: completePositions[index].id },
        })),
      },
    },
  };
}

function modelReading() {
  const cardSlugs = selected.map((card) => card.slug);
  return {
    responseMode: "reading",
    title: "A escolha pede medida",
    opening: "A mesa mostra uma passagem entre impulso, evidência e escolha consciente.",
    sections: [{
      id: "whole-spread",
      title: "O movimento inteiro",
      text: "As sete posições formam uma narrativa única e mantêm a direção provável como tendência condicional.",
      cardSlugs,
    }],
    synthesis: "O caminho ganha consistência quando desejo, medo e fatos deixam de ocupar o mesmo lugar.",
    groundedAction: "Escreva o que é fato e o que é interpretação antes da próxima conversa.",
    closingQuestion: "Qual gesto torna sua posição visível sem pedir garantia?",
    suggestedQuestions: [
      "O que ainda não estou nomeando?",
      "Qual limite muda essa dinâmica?",
      "O que depende realmente de mim?",
    ],
    safetyMessage: "",
    memoryUpdate: { summary: "não deve sobreviver", themes: ["limites"], people: [] },
    audit: { usedCardSlugs: cardSlugs, confidence: "grounded", unsupportedCertainty: false },
  };
}

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

test("a rota server-side usa Responses, Structured Output e nunca devolve a chave", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;
  let providerCall;

  process.env.OPENAI_API_KEY = "test-secret-never-return";
  process.env.OPENAI_MODEL = "gpt-5.6-terra";
  globalThis.fetch = async (url, options) => {
    providerCall = { url, options, body: JSON.parse(options.body) };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        output: [{
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify(modelReading()) }],
        }],
      }),
    };
  };

  try {
    const request = {
      method: "POST",
      body: requestBody(),
      headers: {
        origin: "https://arcane911.vercel.app",
        host: "arcane911.vercel.app",
        "x-forwarded-for": "198.51.100.77",
      },
      socket: {},
    };
    const response = mockResponse();
    await handler(request, response);

    assert.equal(response.statusCode, 200);
    assert.equal(providerCall.url, "https://api.openai.com/v1/responses");
    assert.equal(providerCall.options.headers.Authorization, "Bearer test-secret-never-return");
    assert.equal(providerCall.body.model, "gpt-5.6-terra");
    assert.equal(providerCall.body.store, false);
    assert.equal(providerCall.body.text.format.type, "json_schema");
    assert.equal(providerCall.body.text.format.strict, true);
    assert.equal(JSON.stringify(providerCall.body.text.format.schema).includes("uniqueItems"), false);
    assert.equal(response.payload.meta.grounded, true);
    assert.deepEqual(response.payload.reading.memoryUpdate, { summary: "", themes: [], people: [] });
    assert.equal(JSON.stringify(response.payload).includes("test-secret-never-return"), false);
    assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = originalModel;
  }
});

test("a rota recusa método diferente de POST sem chamar o provedor", async () => {
  const response = mockResponse();
  await handler({ method: "GET", headers: {}, socket: {} }, response);
  assert.equal(response.statusCode, 405);
  assert.equal(response.payload.error, "method_not_allowed");
  assert.equal(response.headers.get("allow"), "POST");
});
