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
  const cardNames = selected.map((card) => card.name);
  return {
    responseMode: "reading",
    title: "A escolha pede medida",
    opening: "Você já percebeu que movimento sem verdade só muda o cenário do mesmo conflito.",
    sections: [{
      id: "whole-spread",
      title: "O movimento inteiro",
      text: `${cardNames.slice(0, 4).join(", ")} formam o eixo da escolha; ${cardNames.slice(4).join(", ")} deslocam a direção provável sem transformá-la em sentença.`,
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

test("o modo OpenAI legado continua usando Responses, Structured Output e nunca devolve a chave", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;
  const originalProvider = process.env.AGENT911_PROVIDER;
  let providerCall;

  process.env.AGENT911_PROVIDER = "openai";
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
    if (originalProvider === undefined) delete process.env.AGENT911_PROVIDER;
    else process.env.AGENT911_PROVIDER = originalProvider;
  }
});

test("Gemini é o provedor principal, recebe schema compatível e mantém a chave no servidor", async () => {
  const originalFetch = globalThis.fetch;
  const originalProvider = process.env.AGENT911_PROVIDER;
  const originalKey = process.env.GEMINI_API_KEY;
  const originalOpenAIKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;
  const originalFallback = process.env.GEMINI_FALLBACK_MODEL;
  let providerCall;
  let providerCallCount = 0;
  const overconfidentReading = modelReading();
  overconfidentReading.synthesis = "O ciclo atual se encerrou e permanecer gerará ressentimento.";

  delete process.env.AGENT911_PROVIDER;
  process.env.GEMINI_API_KEY = "gemini-secret-never-return";
  process.env.OPENAI_API_KEY = "legacy-openai-secret";
  process.env.GEMINI_MODEL = "gemini-3.5-flash";
  process.env.GEMINI_FALLBACK_MODEL = "off";
  globalThis.fetch = async (url, options) => {
    providerCallCount += 1;
    providerCall = { url, options, body: JSON.parse(options.body) };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: JSON.stringify(overconfidentReading) }] },
          finishReason: "STOP",
        }],
      }),
    };
  };

  try {
    const response = mockResponse();
    await handler({
      method: "POST",
      body: requestBody(),
      headers: {
        origin: "https://arcane911.vercel.app",
        host: "arcane911.vercel.app",
        "x-forwarded-for": "198.51.100.78",
      },
      socket: {},
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(providerCall.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent");
    assert.equal(providerCall.options.headers["x-goog-api-key"], "gemini-secret-never-return");
    assert.equal(providerCall.options.headers.Authorization, undefined);
    assert.equal(providerCall.body.store, false);
    assert.equal(providerCall.body.generationConfig.responseMimeType, "application/json");
    assert.ok(providerCall.body.generationConfig.maxOutputTokens >= 4_096);
    assert.deepEqual(providerCall.body.generationConfig.thinkingConfig, {
      includeThoughts: false,
      thinkingLevel: "MINIMAL",
    });
    assert.equal(providerCall.body.generationConfig.responseJsonSchema.type, "object");
    assert.equal(JSON.stringify(providerCall.body.generationConfig.responseJsonSchema).includes("maxLength"), false);
    assert.equal(
      providerCall.body.generationConfig.responseJsonSchema
        .properties.audit.properties.unsupportedCertainty.enum,
      undefined,
    );
    assert.match(providerCall.body.systemInstruction.parts[0].text, /ANTI-MONOTONIA/);
    assert.match(providerCall.body.contents[0].parts[0].text, /voiceDirection/);
    assert.match(providerCall.body.contents[0].parts[0].text, /personalizationContract/);
    assert.equal(response.payload.meta.provider, "gemini");
    assert.equal(response.payload.meta.model, "gemini-3.5-flash");
    assert.equal(response.payload.meta.usedFallbackModel, false);
    assert.equal(providerCallCount, 1);
    assert.match(response.payload.reading.synthesis, /o ciclo atual pode estar chegando ao limite/i);
    assert.match(response.payload.reading.synthesis, /pode alimentar ressentimento/i);
    assert.equal(JSON.stringify(response.payload).includes("gemini-secret-never-return"), false);
    assert.equal(JSON.stringify(response.payload).includes("legacy-openai-secret"), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalProvider === undefined) delete process.env.AGENT911_PROVIDER;
    else process.env.AGENT911_PROVIDER = originalProvider;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    if (originalOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAIKey;
    if (originalModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = originalModel;
    if (originalFallback === undefined) delete process.env.GEMINI_FALLBACK_MODEL;
    else process.env.GEMINI_FALLBACK_MODEL = originalFallback;
  }
});

test("Gemini troca para Flash-Lite quando o modelo principal esgota a faixa disponível", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const originalProvider = process.env.AGENT911_PROVIDER;
  const originalKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;
  const originalFallback = process.env.GEMINI_FALLBACK_MODEL;
  const calls = [];

  process.env.AGENT911_PROVIDER = "gemini";
  process.env.GEMINI_API_KEY = "gemini-fallback-secret";
  process.env.GEMINI_MODEL = "gemini-3.5-flash";
  process.env.GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";
  console.warn = () => {};
  globalThis.fetch = async (url) => {
    calls.push(url);
    if (calls.length === 1) {
      return {
        ok: false,
        status: 429,
        json: async () => ({ error: { status: "RESOURCE_EXHAUSTED", message: "Free tier rate limit reached." } }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(modelReading()) }] } }],
      }),
    };
  };

  try {
    const response = mockResponse();
    await handler({
      method: "POST",
      body: requestBody(),
      headers: {
        origin: "https://arcane911.vercel.app",
        host: "arcane911.vercel.app",
        "x-forwarded-for": "198.51.100.79",
      },
      socket: {},
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(calls.length, 2);
    assert.match(calls[0], /gemini-3\.5-flash:generateContent$/);
    assert.match(calls[1], /gemini-3\.5-flash-lite:generateContent$/);
    assert.equal(response.payload.meta.model, "gemini-3.5-flash-lite");
    assert.equal(response.payload.meta.usedFallbackModel, true);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
    if (originalProvider === undefined) delete process.env.AGENT911_PROVIDER;
    else process.env.AGENT911_PROVIDER = originalProvider;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = originalModel;
    if (originalFallback === undefined) delete process.env.GEMINI_FALLBACK_MODEL;
    else process.env.GEMINI_FALLBACK_MODEL = originalFallback;
  }
});

test("Gemini troca para Flash-Lite quando o principal interrompe o JSON por limite de tokens", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const originalProvider = process.env.AGENT911_PROVIDER;
  const originalKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;
  const originalFallback = process.env.GEMINI_FALLBACK_MODEL;
  const calls = [];

  process.env.AGENT911_PROVIDER = "gemini";
  process.env.GEMINI_API_KEY = "gemini-truncation-secret";
  process.env.GEMINI_MODEL = "gemini-3.5-flash";
  process.env.GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";
  console.warn = () => {};
  globalThis.fetch = async (url) => {
    calls.push(url);
    if (calls.length === 1) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{
            content: { parts: [{ text: '{"responseMode":"reading","title":"cortado' }] },
            finishReason: "MAX_TOKENS",
          }],
        }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: JSON.stringify(modelReading()) }] },
          finishReason: "STOP",
        }],
      }),
    };
  };

  try {
    const response = mockResponse();
    await handler({
      method: "POST",
      body: requestBody(),
      headers: {
        origin: "https://arcane911.vercel.app",
        host: "arcane911.vercel.app",
        "x-forwarded-for": "198.51.100.80",
      },
      socket: {},
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(calls.length, 2);
    assert.equal(response.payload.meta.model, "gemini-3.5-flash-lite");
    assert.equal(response.payload.meta.usedFallbackModel, true);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
    if (originalProvider === undefined) delete process.env.AGENT911_PROVIDER;
    else process.env.AGENT911_PROVIDER = originalProvider;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = originalModel;
    if (originalFallback === undefined) delete process.env.GEMINI_FALLBACK_MODEL;
    else process.env.GEMINI_FALLBACK_MODEL = originalFallback;
  }
});

test("uma paráfrase pessoal não vira 502 quando só a checagem lexical da pergunta falha", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const originalProvider = process.env.AGENT911_PROVIDER;
  const originalKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;
  const originalFallback = process.env.GEMINI_FALLBACK_MODEL;
  const calls = [];
  const warnings = [];
  const paraphrasedReading = {
    ...modelReading(),
    title: "A escolha que já amadureceu",
    opening: "A mesa encontra uma tensão entre impulso, evidência e escolha consciente.",
    sections: [{
      ...modelReading().sections[0],
      title: "O desenho da mesa",
      text: `${selected.slice(0, 4).map((card) => card.name).join(", ")} formam o eixo; ${selected.slice(4).map((card) => card.name).join(", ")} mostram que desejo e fatos ainda ocupam lugares diferentes.`,
    }],
    synthesis: "O caminho ganha consistência quando desejo, medo e fatos deixam de ocupar o mesmo lugar.",
    groundedAction: "Escreva o que é fato e o que é interpretação antes da próxima conversa.",
    suggestedQuestions: [],
  };

  process.env.AGENT911_PROVIDER = "gemini";
  process.env.GEMINI_API_KEY = "gemini-paraphrase-secret";
  process.env.GEMINI_MODEL = "gemini-3.5-flash";
  process.env.GEMINI_FALLBACK_MODEL = "off";
  console.warn = (...items) => warnings.push(items);
  globalThis.fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: JSON.stringify(paraphrasedReading) }] },
          finishReason: "STOP",
        }],
      }),
    };
  };

  try {
    const body = requestBody();
    body.action = "complete_summary";
    body.context.reading.question = "Que movimento pede verdade agora?";
    const response = mockResponse();
    await handler({
      method: "POST",
      body,
      headers: {
        origin: "https://arcane911.vercel.app",
        host: "arcane911.vercel.app",
        "x-forwarded-for": "198.51.100.81",
      },
      socket: {},
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(calls.length, 2);
    assert.match(calls[1].systemInstruction.parts[0].text, /palavra ou expressão concreta presente na pergunta/);
    assert.equal(response.payload.meta.grounded, true);
    assert.ok(warnings.some((items) => items[0] === "agent911_audit_style_warning"));
    assert.equal(JSON.stringify(warnings).includes(body.context.reading.question), false);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
    if (originalProvider === undefined) delete process.env.AGENT911_PROVIDER;
    else process.env.AGENT911_PROVIDER = originalProvider;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = originalModel;
    if (originalFallback === undefined) delete process.env.GEMINI_FALLBACK_MODEL;
    else process.env.GEMINI_FALLBACK_MODEL = originalFallback;
  }
});

test("a rota recusa método diferente de POST sem chamar o provedor", async () => {
  const response = mockResponse();
  await handler({ method: "GET", headers: {}, socket: {} }, response);
  assert.equal(response.statusCode, 405);
  assert.equal(response.payload.error, "method_not_allowed");
  assert.equal(response.headers.get("allow"), "POST");
});

test("a rota distingue falta de crédito sem registrar a pergunta pessoal", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  const originalProvider = process.env.AGENT911_PROVIDER;
  const originalError = console.error;
  const logs = [];
  process.env.AGENT911_PROVIDER = "openai";
  process.env.OPENAI_API_KEY = "test-secret-never-return";
  globalThis.fetch = async () => ({
    ok: false,
    status: 429,
    json: async () => ({
      error: {
        code: "insufficient_quota",
        type: "insufficient_quota",
        message: "You exceeded your current quota; check billing details.",
      },
    }),
  });
  console.error = (...items) => logs.push(items);

  try {
    const response = mockResponse();
    await handler({
      method: "POST",
      body: requestBody(),
      headers: {
        origin: "https://arcane911.vercel.app",
        host: "arcane911.vercel.app",
        "x-forwarded-for": "198.51.100.91",
      },
      socket: {},
    }, response);

    assert.equal(response.statusCode, 503);
    assert.equal(response.payload.error, "provider_quota");
    assert.match(JSON.stringify(logs), /insufficient_quota/);
    assert.doesNotMatch(JSON.stringify(logs), /Que movimento pede verdade agora/);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalProvider === undefined) delete process.env.AGENT911_PROVIDER;
    else process.env.AGENT911_PROVIDER = originalProvider;
  }
});
