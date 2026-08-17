import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import handler, { resetAgent911RuntimeStateForTests } from "../api/agent-911.js";
import { positions, tarotCards } from "../src/data/tarot.js";

const selected = [
  tarotCards[0],
  tarotCards[11],
  tarotCards[2],
];

beforeEach(() => {
  resetAgent911RuntimeStateForTests();
  process.env.AGENT911_MAX_COST_BRL = "10";
});

function requestBody() {
  return {
    agent: "agent-911",
    requestId: "api-contract-test",
    action: "opening_summary",
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
          position: { id: positions[index].id },
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

test("OpenAI não vira cérebro principal só porque a chave Gemini está ausente", async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const originalProvider = process.env.AGENT911_PROVIDER;
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalGoogleKey = process.env.GOOGLE_API_KEY;
  const originalGoogleAiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const originalOpenAIKey = process.env.OPENAI_API_KEY;
  let providerCalls = 0;

  delete process.env.AGENT911_PROVIDER;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  process.env.OPENAI_API_KEY = "openai-parachute-only";
  console.error = () => {};
  globalThis.fetch = async () => { providerCalls += 1; };

  try {
    const response = mockResponse();
    await handler({
      method: "POST",
      body: requestBody(),
      headers: {
        origin: "https://arcane911.vercel.app",
        host: "arcane911.vercel.app",
        "x-forwarded-for": "198.51.100.76",
      },
      socket: {},
    }, response);
    assert.equal(response.statusCode, 503);
    assert.equal(response.payload.error, "provider_unavailable");
    assert.equal(providerCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    for (const [name, value] of Object.entries({
      AGENT911_PROVIDER: originalProvider,
      GEMINI_API_KEY: originalGeminiKey,
      GOOGLE_API_KEY: originalGoogleKey,
      GOOGLE_GENERATIVE_AI_API_KEY: originalGoogleAiKey,
      OPENAI_API_KEY: originalOpenAIKey,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
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
    assert.ok(providerCall.body.generationConfig.maxOutputTokens >= 3_072);
    assert.ok(providerCall.body.generationConfig.maxOutputTokens <= 4_096);
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
  globalThis.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
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
    assert.match(calls[0].url, /gemini-3\.5-flash:generateContent$/);
    assert.match(calls[1].url, /gemini-3\.5-flash-lite:generateContent$/);
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

test("JSON truncado recebe no máximo um reparo controlado no mesmo modelo", async () => {
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
  globalThis.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
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
    assert.equal(response.payload.meta.model, "gemini-3.5-flash");
    assert.equal(response.payload.meta.usedFallbackModel, false);
    assert.match(calls[1].body.systemInstruction.parts[0].text, /REPARO ESTRUTURAL ÚNICO/);
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
  console.warn = () => {};
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
    body.action = "opening_summary";
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
    assert.equal(calls.length, 1);
    assert.equal(response.payload.meta.grounded, true);
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

test("origem não autorizada é bloqueada antes de qualquer chamada externa", async () => {
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => { providerCalls += 1; };
  try {
    const response = mockResponse();
    await handler({
      method: "POST",
      body: requestBody(),
      headers: {
        origin: "https://example.invalid",
        host: "arcane911.vercel.app",
        "x-forwarded-for": "198.51.100.88",
      },
      socket: {},
    }, response);
    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.payload, { error: "origin_not_allowed" });
    assert.equal(providerCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("payload inválido termina em 400 sem acionar fallback ou expor diagnóstico", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  let providerCalls = 0;
  globalThis.fetch = async () => { providerCalls += 1; };
  console.warn = () => {};

  try {
    const response = mockResponse();
    await handler({
      method: "POST",
      body: { agent: "agent-911", context: {} },
      headers: { host: "arcane911.vercel.app", "x-forwarded-for": "198.51.100.89" },
      socket: {},
    }, response);
    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.payload, { error: "invalid_payload" });
    assert.equal(providerCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
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

test("Gemini inteiro em quota transfere uma única vez para OpenAI quando configurado", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const originalEnv = {
    provider: process.env.AGENT911_PROVIDER,
    geminiKey: process.env.GEMINI_API_KEY,
    openAIKey: process.env.OPENAI_API_KEY,
    model: process.env.GEMINI_MODEL,
    fallback: process.env.GEMINI_FALLBACK_MODEL,
  };
  const calls = [];

  process.env.AGENT911_PROVIDER = "gemini";
  process.env.GEMINI_API_KEY = "gemini-quota-secret";
  process.env.OPENAI_API_KEY = "openai-parachute-secret";
  process.env.GEMINI_MODEL = "gemini-3.5-flash";
  process.env.GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";
  console.warn = () => {};
  globalThis.fetch = async (url) => {
    calls.push(url);
    if (String(url).includes("generativelanguage")) {
      return {
        ok: false,
        status: 429,
        headers: { get: () => "2" },
        json: async () => ({ error: { status: "RESOURCE_EXHAUSTED" } }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        output: [{
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify(modelReading()) }],
        }],
        usage: {
          input_tokens: 4_200,
          output_tokens: 1_200,
          output_tokens_details: { reasoning_tokens: 180 },
          total_tokens: 5_400,
        },
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
        "x-forwarded-for": "198.51.100.101",
      },
      socket: {},
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(calls.length, 3);
    assert.match(calls[0], /gemini-3\.5-flash:generateContent$/);
    assert.match(calls[1], /gemini-3\.5-flash-lite:generateContent$/);
    assert.equal(calls[2], "https://api.openai.com/v1/responses");
    assert.equal(response.payload.meta.provider, "openai");
    assert.equal(response.payload.meta.usedFallbackModel, false);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
    for (const [name, value] of Object.entries({
      AGENT911_PROVIDER: originalEnv.provider,
      GEMINI_API_KEY: originalEnv.geminiKey,
      OPENAI_API_KEY: originalEnv.openAIKey,
      GEMINI_MODEL: originalEnv.model,
      GEMINI_FALLBACK_MODEL: originalEnv.fallback,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("todos os providers indisponíveis terminam em 503 sem ultrapassar três chamadas", async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalProvider = process.env.AGENT911_PROVIDER;
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalOpenAIKey = process.env.OPENAI_API_KEY;
  const originalFallback = process.env.GEMINI_FALLBACK_MODEL;
  let providerCalls = 0;

  process.env.AGENT911_PROVIDER = "gemini";
  process.env.GEMINI_API_KEY = "gemini-all-fail";
  process.env.OPENAI_API_KEY = "openai-all-fail";
  process.env.GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";
  console.warn = () => {};
  console.error = () => {};
  globalThis.fetch = async () => {
    providerCalls += 1;
    return {
      ok: false,
      status: 503,
      headers: { get: () => null },
      json: async () => ({ error: { status: "UNAVAILABLE", code: "server_error" } }),
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
        "x-forwarded-for": "198.51.100.102",
      },
      socket: {},
    }, response);
    assert.equal(response.statusCode, 503);
    assert.equal(response.payload.error, "provider_unavailable");
    assert.equal(providerCalls, 3);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    console.warn = originalWarn;
    if (originalProvider === undefined) delete process.env.AGENT911_PROVIDER;
    else process.env.AGENT911_PROVIDER = originalProvider;
    if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGeminiKey;
    if (originalOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAIKey;
    if (originalFallback === undefined) delete process.env.GEMINI_FALLBACK_MODEL;
    else process.env.GEMINI_FALLBACK_MODEL = originalFallback;
  }
});

test("erro proibido do provider não aciona fallback cego", async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const originalProvider = process.env.AGENT911_PROVIDER;
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalOpenAIKey = process.env.OPENAI_API_KEY;
  const originalFallback = process.env.GEMINI_FALLBACK_MODEL;
  let providerCalls = 0;

  process.env.AGENT911_PROVIDER = "gemini";
  process.env.GEMINI_API_KEY = "gemini-forbidden";
  process.env.OPENAI_API_KEY = "openai-must-not-run";
  process.env.GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";
  console.error = () => {};
  globalThis.fetch = async () => {
    providerCalls += 1;
    return {
      ok: false,
      status: 403,
      headers: { get: () => null },
      json: async () => ({ error: { status: "PERMISSION_DENIED" } }),
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
        "x-forwarded-for": "198.51.100.102",
      },
      socket: {},
    }, response);
    assert.equal(response.statusCode, 503);
    assert.equal(response.payload.error, "provider_unavailable");
    assert.equal(providerCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    for (const [name, value] of Object.entries({
      AGENT911_PROVIDER: originalProvider,
      GEMINI_API_KEY: originalGeminiKey,
      OPENAI_API_KEY: originalOpenAIKey,
      GEMINI_FALLBACK_MODEL: originalFallback,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("quota do Gemini sem paraquedas devolve provider_quota e inicia cooldown", async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalProvider = process.env.AGENT911_PROVIDER;
  const originalKey = process.env.GEMINI_API_KEY;
  const originalOpenAIKey = process.env.OPENAI_API_KEY;
  const originalFallback = process.env.GEMINI_FALLBACK_MODEL;
  let providerCalls = 0;

  process.env.AGENT911_PROVIDER = "gemini";
  process.env.GEMINI_API_KEY = "gemini-quota-only";
  delete process.env.OPENAI_API_KEY;
  process.env.GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";
  console.warn = () => {};
  console.error = () => {};
  globalThis.fetch = async () => {
    providerCalls += 1;
    return {
      ok: false,
      status: 429,
      headers: { get: (name) => name === "retry-after" ? "3" : null },
      json: async () => ({ error: { status: "RESOURCE_EXHAUSTED" } }),
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
        "x-forwarded-for": "198.51.100.103",
      },
      socket: {},
    }, response);
    assert.equal(response.statusCode, 503);
    assert.equal(response.payload.error, "provider_quota");
    assert.equal(providerCalls, 2);
    assert.ok(Number(response.headers.get("retry-after")) >= 60);

    const cooldownResponse = mockResponse();
    const cooldownBody = requestBody();
    cooldownBody.context.reading.id = "reading-during-cooldown";
    cooldownBody.context.reading.question = "Que movimento pode esperar o intervalo seguro?";
    await handler({
      method: "POST",
      body: cooldownBody,
      headers: {
        origin: "https://arcane911.vercel.app",
        host: "arcane911.vercel.app",
        "x-forwarded-for": "198.51.100.103",
      },
      socket: {},
    }, cooldownResponse);
    assert.equal(cooldownResponse.statusCode, 503);
    assert.equal(cooldownResponse.payload.error, "provider_quota");
    assert.equal(providerCalls, 2);
    assert.ok(Number(cooldownResponse.headers.get("retry-after")) >= 59);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    console.warn = originalWarn;
    if (originalProvider === undefined) delete process.env.AGENT911_PROVIDER;
    else process.env.AGENT911_PROVIDER = originalProvider;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    if (originalOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAIKey;
    if (originalFallback === undefined) delete process.env.GEMINI_FALLBACK_MODEL;
    else process.env.GEMINI_FALLBACK_MODEL = originalFallback;
  }
});

test("timeout do provider é distinguido e não cria retry interno", async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const originalProvider = process.env.AGENT911_PROVIDER;
  const originalKey = process.env.GEMINI_API_KEY;
  const originalFallback = process.env.GEMINI_FALLBACK_MODEL;
  let providerCalls = 0;

  process.env.AGENT911_PROVIDER = "gemini";
  process.env.GEMINI_API_KEY = "gemini-timeout";
  process.env.GEMINI_FALLBACK_MODEL = "off";
  console.error = () => {};
  globalThis.fetch = async () => {
    providerCalls += 1;
    throw new DOMException("provider_timeout", "AbortError");
  };

  try {
    const response = mockResponse();
    await handler({
      method: "POST",
      body: requestBody(),
      headers: {
        origin: "https://arcane911.vercel.app",
        host: "arcane911.vercel.app",
        "x-forwarded-for": "198.51.100.104",
      },
      socket: {},
    }, response);
    assert.equal(response.statusCode, 504);
    assert.equal(response.payload.error, "provider_timeout");
    assert.equal(providerCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    if (originalProvider === undefined) delete process.env.AGENT911_PROVIDER;
    else process.env.AGENT911_PROVIDER = originalProvider;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    if (originalFallback === undefined) delete process.env.GEMINI_FALLBACK_MODEL;
    else process.env.GEMINI_FALLBACK_MODEL = originalFallback;
  }
});

test("rate limit interno é configurável e continua distinto da quota", async () => {
  const originalFetch = globalThis.fetch;
  const originalProvider = process.env.AGENT911_PROVIDER;
  const originalKey = process.env.GEMINI_API_KEY;
  const originalFallback = process.env.GEMINI_FALLBACK_MODEL;
  const originalLimit = process.env.ARCANE911_RATE_LIMIT;
  const originalWindow = process.env.ARCANE911_RATE_WINDOW_MS;
  let providerCalls = 0;

  process.env.AGENT911_PROVIDER = "gemini";
  process.env.GEMINI_API_KEY = "gemini-rate-limit";
  process.env.GEMINI_FALLBACK_MODEL = "off";
  process.env.ARCANE911_RATE_LIMIT = "1";
  process.env.ARCANE911_RATE_WINDOW_MS = "60000";
  globalThis.fetch = async () => {
    providerCalls += 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(modelReading()) }] } }],
      }),
    };
  };

  try {
    const firstResponse = mockResponse();
    const secondResponse = mockResponse();
    const secondBody = requestBody();
    secondBody.context.reading.id = "reading-contract-test-2";
    secondBody.context.reading.question = "Que limite torna o movimento mais claro agora?";
    const baseRequest = {
      method: "POST",
      headers: {
        origin: "https://arcane911.vercel.app",
        host: "arcane911.vercel.app",
        "x-forwarded-for": "198.51.100.105",
      },
      socket: {},
    };
    await handler({ ...baseRequest, body: requestBody() }, firstResponse);
    await handler({ ...baseRequest, body: secondBody }, secondResponse);
    assert.equal(firstResponse.statusCode, 200);
    assert.equal(secondResponse.statusCode, 429);
    assert.equal(secondResponse.payload.error, "rate_limit");
    assert.equal(providerCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of Object.entries({
      AGENT911_PROVIDER: originalProvider,
      GEMINI_API_KEY: originalKey,
      GEMINI_FALLBACK_MODEL: originalFallback,
      ARCANE911_RATE_LIMIT: originalLimit,
      ARCANE911_RATE_WINDOW_MS: originalWindow,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("duas requisições simultâneas idênticas compartilham uma única chamada", async () => {
  const originalFetch = globalThis.fetch;
  const originalProvider = process.env.AGENT911_PROVIDER;
  const originalKey = process.env.GEMINI_API_KEY;
  const originalFallback = process.env.GEMINI_FALLBACK_MODEL;
  let providerCalls = 0;
  let releaseProvider;

  process.env.AGENT911_PROVIDER = "gemini";
  process.env.GEMINI_API_KEY = "gemini-dedupe";
  process.env.GEMINI_FALLBACK_MODEL = "off";
  globalThis.fetch = async () => {
    providerCalls += 1;
    await new Promise((resolve) => { releaseProvider = resolve; });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(modelReading()) }] } }],
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
        "x-forwarded-for": "198.51.100.106",
      },
      socket: {},
    };
    const firstResponse = mockResponse();
    const secondResponse = mockResponse();
    const first = handler(request, firstResponse);
    const second = handler(request, secondResponse);
    assert.equal(providerCalls, 1);
    releaseProvider();
    await Promise.all([first, second]);
    assert.equal(providerCalls, 1);
    assert.equal(firstResponse.statusCode, 200);
    assert.equal(secondResponse.statusCode, 200);
    assert.deepEqual(secondResponse.payload, firstResponse.payload);

    const cachedResponse = mockResponse();
    await handler(request, cachedResponse);
    assert.equal(cachedResponse.statusCode, 200);
    assert.equal(providerCalls, 1);
    assert.deepEqual(cachedResponse.payload, firstResponse.payload);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalProvider === undefined) delete process.env.AGENT911_PROVIDER;
    else process.env.AGENT911_PROVIDER = originalProvider;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    if (originalFallback === undefined) delete process.env.GEMINI_FALLBACK_MODEL;
    else process.env.GEMINI_FALLBACK_MODEL = originalFallback;
  }
});

test("usageMetadata registra tokens, chamadas e duração sem registrar a pergunta", async () => {
  const originalFetch = globalThis.fetch;
  const originalInfo = console.info;
  const originalProvider = process.env.AGENT911_PROVIDER;
  const originalKey = process.env.GEMINI_API_KEY;
  const originalFallback = process.env.GEMINI_FALLBACK_MODEL;
  const logs = [];

  process.env.AGENT911_PROVIDER = "gemini";
  process.env.GEMINI_API_KEY = "gemini-usage-secret";
  process.env.GEMINI_FALLBACK_MODEL = "off";
  console.info = (...items) => logs.push(items);
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(modelReading()) }] } }],
      usageMetadata: {
        promptTokenCount: 4_280,
        candidatesTokenCount: 1_740,
        thoughtsTokenCount: 210,
        totalTokenCount: 6_230,
      },
    }),
  });

  try {
    const response = mockResponse();
    await handler({
      method: "POST",
      body: requestBody(),
      headers: {
        origin: "https://arcane911.vercel.app",
        host: "arcane911.vercel.app",
        "x-forwarded-for": "198.51.100.107",
      },
      socket: {},
    }, response);
    const usageLog = logs.find((items) => items[0] === "agent911_usage")?.[1];
    assert.equal(response.statusCode, 200);
    assert.equal(usageLog.provider, "gemini");
    assert.equal(usageLog.inputTokens, 4_280);
    assert.equal(usageLog.outputTokens, 1_740);
    assert.equal(usageLog.thinkingTokens, 210);
    assert.equal(usageLog.totalTokens, 6_230);
    assert.equal(usageLog.calls, 1);
    assert.equal(usageLog.repaired, false);
    assert.equal(usageLog.fallback, false);
    assert.ok(Number.isInteger(usageLog.durationMs));
    assert.doesNotMatch(JSON.stringify(logs), /Que movimento pede verdade agora/);
    assert.doesNotMatch(JSON.stringify(logs), /gemini-usage-secret/);
  } finally {
    globalThis.fetch = originalFetch;
    console.info = originalInfo;
    if (originalProvider === undefined) delete process.env.AGENT911_PROVIDER;
    else process.env.AGENT911_PROVIDER = originalProvider;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    if (originalFallback === undefined) delete process.env.GEMINI_FALLBACK_MODEL;
    else process.env.GEMINI_FALLBACK_MODEL = originalFallback;
  }
});
