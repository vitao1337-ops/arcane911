import assert from "node:assert/strict";
import test from "node:test";
import {
  cacheAstro911Document,
  clearCachedAstro911Document,
  createAstro911Context,
  readCachedAstro911Document,
  requestAstro911Document,
} from "../src/lib/astro911.js";
import { sampleAstroApiPayload, sampleAstroChart } from "./astro911-fixture.js";

test("o cliente envia só primeiro nome e fatos calculados, nunca data, hora ou cidade", () => {
  const context = createAstro911Context(sampleAstroChart());
  const serialized = JSON.stringify(context);
  assert.equal(context.chart.person, "Pessoa");
  assert.equal(Object.hasOwn(context.chart, "birth"), false);
  assert.equal(Object.hasOwn(context.chart, "location"), false);
  assert.equal(serialized.includes("1990-01-01"), false);
  assert.equal(serialized.includes("12:00"), false);
  assert.equal(serialized.includes("São Paulo"), false);
});

test("pedidos simultâneos do mesmo mapa são deduplicados para economizar chamadas", async () => {
  const chart = sampleAstroChart();
  const payload = sampleAstroApiPayload();
  let calls = 0;
  const fetchImplementation = async (_url, options) => {
    calls += 1;
    const body = JSON.parse(options.body);
    assert.equal(body.agent, "astro-911");
    assert.equal(body.schemaVersion, "2026-08-22.3");
    await new Promise((resolve) => setTimeout(resolve, 8));
    return { ok: true, status: 200, json: async () => payload };
  };

  const [first, second] = await Promise.all([
    requestAstro911Document(chart, { fetchImplementation, endpoint: "https://arcane911.test/api/astro-911" }),
    requestAstro911Document(chart, { fetchImplementation, endpoint: "https://arcane911.test/api/astro-911" }),
  ]);
  assert.equal(calls, 1);
  assert.equal(first.document.title, payload.document.title);
  assert.equal(second.document.title, payload.document.title);
});

test("Documento Astral fica somente na sessão curta e pode ser limpo ao trocar de mapa", () => {
  const values = new Map();
  const sessionStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  const localValues = new Map();
  const localStorage = {
    getItem: (key) => localValues.get(key) ?? null,
    setItem: (key, value) => localValues.set(key, String(value)),
    removeItem: (key) => localValues.delete(key),
  };
  const previousWindow = globalThis.window;
  globalThis.window = { sessionStorage, localStorage, location: { origin: "https://arcane911.test" } };

  try {
    const chart = sampleAstroChart();
    const payload = sampleAstroApiPayload();
    cacheAstro911Document(chart, payload);
    assert.equal(readCachedAstro911Document(chart)?.document.title, payload.document.title);
    assert.equal(values.has("arcane911.astral-document.v3"), true);
    assert.equal(localValues.size, 0);

    clearCachedAstro911Document(chart);
    assert.equal(readCachedAstro911Document(chart), null);
    assert.equal(values.size, 0);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
