import assert from "node:assert/strict";
import test from "node:test";
import handler from "../api/astro-911.js";
import { sampleAstroDocument, sampleAstroRequest } from "./astro911-fixture.js";

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

test("a API astral usa Gemini server-side, Structured Output e não devolve a chave", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.ASTRO911_MODEL;
  const originalFallback = process.env.ASTRO911_FALLBACK_MODEL;
  let providerCall;
  process.env.GEMINI_API_KEY = "astro-secret-never-return";
  process.env.ASTRO911_MODEL = "gemini-3.5-flash";
  process.env.ASTRO911_FALLBACK_MODEL = "off";
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
