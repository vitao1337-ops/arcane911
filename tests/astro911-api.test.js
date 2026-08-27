import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import handler, { resetAstro911RuntimeStateForTests } from "../api/astro-911.js";
import { sampleAstroDocument, sampleAstroRequest } from "./astro911-fixture.js";

// A suíte ativa deliberadamente o modo gratuito. Sem este opt-in, produção
// sem preço recusa a geração antes de qualquer chamada ao provedor.
process.env.VITE_ASTRO911_ALLOW_FREE_PRODUCTION = "true";

beforeEach(() => resetAstro911RuntimeStateForTests());

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

function mockRequest(body = sampleAstroRequest()) {
  return {
    method: "POST",
    body,
    headers: {
      origin: "https://arcane911.vercel.app",
      host: "arcane911.vercel.app",
      "x-forwarded-for": `203.0.113.${Math.floor(Math.random() * 120) + 10}`,
    },
    socket: {},
  };
}

function geminiSuccess(document = sampleAstroDocument(sampleAstroRequest().context), usageMetadata) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(document) }] }, finishReason: "STOP" }],
      usageMetadata,
    }),
  };
}

function providerFailure(status, code = "RESOURCE_EXHAUSTED", retryAfter = null) {
  return {
    ok: false,
    status,
    headers: { get: (name) => name.toLowerCase() === "retry-after" ? retryAfter : null },
    json: async () => ({ error: { status: code, code, message: "provider failure" } }),
  };
}

async function withEnvironment(values, callback) {
  const originals = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));
  Object.entries(values).forEach(([name, value]) => {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  });
  try {
    return await callback();
  } finally {
    Object.entries(originals).forEach(([name, value]) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    });
  }
}

test("a API astral usa Gemini server-side, Structured Output e não devolve a chave", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.ASTRO911_MODEL;
  const originalFallback = process.env.ASTRO911_FALLBACK_MODEL;
  const originalOutputLimit = process.env.ASTRO911_MAX_OUTPUT_TOKENS;
  let providerCall;
  process.env.GEMINI_API_KEY = "astro-secret-never-return";
  process.env.ASTRO911_MODEL = "gemini-3.5-flash";
  process.env.ASTRO911_FALLBACK_MODEL = "off";
  delete process.env.ASTRO911_MAX_OUTPUT_TOKENS;
  const request = sampleAstroRequest();
  globalThis.fetch = async (url, options) => {
    providerCall = { url, options, body: JSON.parse(options.body) };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(sampleAstroDocument(request.context)) }] } }],
      }),
    };
  };

  try {
    const response = mockResponse();
    await handler(mockRequest(request), response);
    assert.equal(response.statusCode, 200);
    assert.equal(providerCall.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent");
    assert.equal(providerCall.options.headers["x-goog-api-key"], "astro-secret-never-return");
    assert.equal(providerCall.body.store, false);
    assert.equal(providerCall.body.generationConfig.responseMimeType, "application/json");
    assert.equal(providerCall.body.generationConfig.responseJsonSchema.type, "object");
    assert.equal(providerCall.body.generationConfig.maxOutputTokens, 8_192);
    assert.match(providerCall.body.systemInstruction.parts[0].text, /mundo mediterrânico helenístico/);
    assert.equal(providerCall.body.contents[0].parts[0].text.includes("1990-01-01"), false);
    assert.equal(response.payload.meta.provider, "gemini");
    assert.equal(response.payload.meta.rawBirthDataSent, false);
    assert.equal(JSON.stringify(response.payload).includes("astro-secret-never-return"), false);
    assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.ASTRO911_MODEL;
    else process.env.ASTRO911_MODEL = originalModel;
    if (originalFallback === undefined) delete process.env.ASTRO911_FALLBACK_MODEL;
    else process.env.ASTRO911_FALLBACK_MODEL = originalFallback;
    if (originalOutputLimit === undefined) delete process.env.ASTRO911_MAX_OUTPUT_TOKENS;
    else process.env.ASTRO911_MAX_OUTPUT_TOKENS = originalOutputLimit;
  }
});

test("a rota astral recusa método diferente de POST sem chamar o provedor", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error("não deveria chamar"); };
  try {
    const request = mockRequest();
    request.method = "GET";
    const response = mockResponse();
    await handler(request, response);
    assert.equal(response.statusCode, 405);
    assert.equal(response.payload.error, "method_not_allowed");
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("produção sem preço ou campanha gratuita recusa o documento antes do provedor", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    await withEnvironment({
      VITE_ASTRO911_PRICE_CENTS: undefined,
      VITE_ASTRO911_ALLOW_FREE_PRODUCTION: "false",
      GEMINI_API_KEY: "must-not-run",
    }, async () => {
      globalThis.fetch = async () => {
        calls += 1;
        throw new Error("não deveria chamar");
      };
      const response = mockResponse();
      await handler(mockRequest(), response);
      assert.equal(response.statusCode, 503);
      assert.equal(response.payload.error, "astral_not_configured");
      assert.equal(calls, 0);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Gemini principal entrega documento válido em uma chamada e registra tokens reais", async () => {
  const originalFetch = globalThis.fetch;
  const originalInfo = console.info;
  const usageLogs = [];
  let calls = 0;
  console.info = (event, payload) => {
    if (event === "astro911_usage") usageLogs.push(payload);
  };

  try {
    await withEnvironment({
      ASTRO911_PROVIDER: "gemini",
      GEMINI_API_KEY: "gemini-primary",
      ASTRO911_MODEL: "gemini-3.5-flash",
      ASTRO911_FALLBACK_MODEL: "off",
      OPENAI_API_KEY: undefined,
    }, async () => {
      globalThis.fetch = async () => {
        calls += 1;
        return geminiSuccess(undefined, {
          promptTokenCount: 1_240,
          candidatesTokenCount: 3_180,
          thoughtsTokenCount: 0,
          totalTokenCount: 4_420,
        });
      };
      const response = mockResponse();
      await handler(mockRequest(), response);
      assert.equal(response.statusCode, 200);
      assert.equal(calls, 1);
      assert.equal(usageLogs.length, 1);
      assert.deepEqual(
        {
          inputTokens: usageLogs[0].inputTokens,
          outputTokens: usageLogs[0].outputTokens,
          totalTokens: usageLogs[0].totalTokens,
          calls: usageLogs[0].calls,
        },
        { inputTokens: 1_240, outputTokens: 3_180, totalTokens: 4_420, calls: 1 },
      );
      assert.equal(usageLogs[0].estimatedCostBrl, 0.1829);
      assert.equal(usageLogs[0].maxCostBrl, 2);
    });
  } finally {
    globalThis.fetch = originalFetch;
    console.info = originalInfo;
  }
});

test("o teto de custo astral bloqueia antes de qualquer chamada externa", async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  let calls = 0;
  console.error = () => {};
  try {
    await withEnvironment({
      ASTRO911_PROVIDER: "gemini",
      GEMINI_API_KEY: "gemini-budget",
      ASTRO911_MODEL: "gemini-3.5-flash",
      ASTRO911_FALLBACK_MODEL: "off",
      ASTRO911_MAX_COST_BRL: "0.10",
    }, async () => {
      globalThis.fetch = async () => {
        calls += 1;
        return geminiSuccess();
      };
      const response = mockResponse();
      await handler(mockRequest(), response);
      assert.equal(response.statusCode, 503);
      assert.equal(response.payload.error, "provider_unavailable");
      assert.equal(calls, 0);
    });
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});

test("quota no Gemini principal usa o fallback Gemini sem tempestade de retry", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  try {
    await withEnvironment({
      ASTRO911_PROVIDER: "gemini",
      GEMINI_API_KEY: "gemini-fallback",
      ASTRO911_MODEL: "gemini-3.5-flash",
      ASTRO911_FALLBACK_MODEL: "gemini-3.5-flash-lite",
      OPENAI_API_KEY: undefined,
    }, async () => {
      globalThis.fetch = async (url) => {
        calls.push(url);
        return calls.length === 1 ? providerFailure(429) : geminiSuccess();
      };
      const response = mockResponse();
      await handler(mockRequest(), response);
      assert.equal(response.statusCode, 200);
      assert.equal(calls.length, 2);
      assert.match(calls[0], /gemini-3\.5-flash:generateContent$/u);
      assert.match(calls[1], /gemini-3\.5-flash-lite:generateContent$/u);
      assert.equal(response.payload.meta.usedFallbackModel, true);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("quota nos dois Gemini aciona OpenAI somente como paraquedas", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  try {
    await withEnvironment({
      ASTRO911_PROVIDER: "gemini",
      GEMINI_API_KEY: "gemini-quota",
      ASTRO911_MODEL: "gemini-main",
      ASTRO911_FALLBACK_MODEL: "gemini-lite",
      OPENAI_API_KEY: "openai-parachute",
      ASTRO911_OPENAI_MODEL: "gpt-5.6-terra",
    }, async () => {
      globalThis.fetch = async (url, options) => {
        calls.push({ url, body: JSON.parse(options.body) });
        if (calls.length <= 2) return providerFailure(429);
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({
            output: [{
              type: "message",
              content: [{ type: "output_text", text: JSON.stringify(sampleAstroDocument()) }],
            }],
            usage: { input_tokens: 1_000, output_tokens: 2_800, total_tokens: 3_800 },
          }),
        };
      };
      const response = mockResponse();
      await handler(mockRequest(), response);
      assert.equal(response.statusCode, 200);
      assert.equal(calls.length, 3);
      assert.equal(calls[2].url, "https://api.openai.com/v1/responses");
      assert.equal(calls[2].body.text.format.strict, true);
      assert.equal(response.payload.meta.provider, "openai");
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("todos os providers em quota encerram em três chamadas e erro público neutro", async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  let calls = 0;
  console.error = () => {};
  try {
    await withEnvironment({
      ASTRO911_PROVIDER: "gemini",
      GEMINI_API_KEY: "gemini-quota",
      ASTRO911_MODEL: "gemini-main",
      ASTRO911_FALLBACK_MODEL: "gemini-lite",
      OPENAI_API_KEY: "openai-quota",
    }, async () => {
      globalThis.fetch = async () => {
        calls += 1;
        return providerFailure(429, "RESOURCE_EXHAUSTED", "30");
      };
      const response = mockResponse();
      await handler(mockRequest(), response);
      assert.equal(response.statusCode, 503);
      assert.deepEqual(response.payload, { error: "provider_quota" });
      assert.equal(response.headers.get("retry-after"), "60");
      assert.equal(calls, 3);
    });
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});

test("JSON truncado recebe no máximo um reparo estrutural controlado", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  try {
    await withEnvironment({
      ASTRO911_PROVIDER: "gemini",
      GEMINI_API_KEY: "gemini-repair",
      ASTRO911_MODEL: "gemini-main",
      ASTRO911_FALLBACK_MODEL: "off",
      OPENAI_API_KEY: undefined,
    }, async () => {
      globalThis.fetch = async (_url, options) => {
        calls.push(JSON.parse(options.body));
        if (calls.length === 1) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => null },
            json: async () => ({ candidates: [{ content: { parts: [{ text: "{\"title\":\"cortado" }] } }] }),
          };
        }
        return geminiSuccess();
      };
      const response = mockResponse();
      await handler(mockRequest(), response);
      assert.equal(response.statusCode, 200);
      assert.equal(calls.length, 2);
      assert.match(calls[1].systemInstruction.parts[0].text, /REPARO ESTRUTURAL ÚNICO/u);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("capítulos parafraseados e fora de ordem são normalizados localmente em uma chamada", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    await withEnvironment({
      ASTRO911_PROVIDER: "gemini",
      GEMINI_API_KEY: "gemini-semantic",
      ASTRO911_MODEL: "gemini-main",
      ASTRO911_FALLBACK_MODEL: "off",
      OPENAI_API_KEY: undefined,
    }, async () => {
      const document = JSON.parse(JSON.stringify(sampleAstroDocument()).replaceAll("Pessoa", "A leitura"));
      document.sections.reverse();
      globalThis.fetch = async () => {
        calls += 1;
        return geminiSuccess(document);
      };
      const response = mockResponse();
      await handler(mockRequest(), response);
      assert.equal(response.statusCode, 200);
      assert.equal(calls, 1);
      assert.deepEqual(
        response.payload.document.sections.map((section) => section.id),
        ["essencia", "personalidade", "afetos", "vocacao", "dinheiro", "potenciais", "tensoes", "integracao"],
      );
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("duas requisições simultâneas do mesmo mapa compartilham uma chamada server-side", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let release;
  try {
    await withEnvironment({
      ASTRO911_PROVIDER: "gemini",
      GEMINI_API_KEY: "gemini-dedupe",
      ASTRO911_MODEL: "gemini-main",
      ASTRO911_FALLBACK_MODEL: "off",
      OPENAI_API_KEY: undefined,
    }, async () => {
      globalThis.fetch = async () => {
        calls += 1;
        await new Promise((resolve) => { release = resolve; });
        return geminiSuccess();
      };
      const request = sampleAstroRequest();
      const firstResponse = mockResponse();
      const secondResponse = mockResponse();
      const firstRequest = mockRequest(request);
      const secondRequest = mockRequest(request);
      firstRequest.headers["x-forwarded-for"] = "203.0.113.210";
      secondRequest.headers["x-forwarded-for"] = "203.0.113.210";
      const first = handler(firstRequest, firstResponse);
      const second = handler(secondRequest, secondResponse);
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(calls, 1);
      release();
      await Promise.all([first, second]);
      assert.equal(firstResponse.statusCode, 200);
      assert.equal(secondResponse.statusCode, 200);
      assert.equal(calls, 1);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("timeout recuperável recebe erro próprio sem revelar provider", async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  console.error = () => {};
  try {
    await withEnvironment({
      ASTRO911_PROVIDER: "gemini",
      GEMINI_API_KEY: "gemini-timeout",
      ASTRO911_MODEL: "gemini-main",
      ASTRO911_FALLBACK_MODEL: "off",
      OPENAI_API_KEY: undefined,
    }, async () => {
      globalThis.fetch = async () => {
        const error = new Error("timed out");
        error.name = "AbortError";
        throw error;
      };
      const response = mockResponse();
      await handler(mockRequest(), response);
      assert.equal(response.statusCode, 504);
      assert.deepEqual(response.payload, { error: "provider_timeout" });
      assert.equal(JSON.stringify(response.payload).includes("gemini"), false);
    });
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});

test("rate limit astral é configurável e não se confunde com quota externa", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    await withEnvironment({
      ASTRO911_PROVIDER: "gemini",
      GEMINI_API_KEY: "gemini-rate",
      ASTRO911_MODEL: "gemini-main",
      ASTRO911_FALLBACK_MODEL: "off",
      OPENAI_API_KEY: undefined,
      ASTRO911_RATE_LIMIT: "1",
      ASTRO911_RATE_WINDOW_MS: "600000",
    }, async () => {
      globalThis.fetch = async () => {
        calls += 1;
        return geminiSuccess();
      };
      const firstRequest = sampleAstroRequest();
      const secondRequest = sampleAstroRequest();
      secondRequest.context.chart.person = "Outra";
      const ip = "203.0.113.222";
      const firstResponse = mockResponse();
      const secondResponse = mockResponse();
      const first = mockRequest(firstRequest);
      const second = mockRequest(secondRequest);
      first.headers["x-forwarded-for"] = ip;
      second.headers["x-forwarded-for"] = ip;
      await handler(first, firstResponse);
      await handler(second, secondResponse);
      assert.equal(firstResponse.statusCode, 200);
      assert.equal(secondResponse.statusCode, 429);
      assert.deepEqual(secondResponse.payload, { error: "rate_limit" });
      assert.equal(calls, 1);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
