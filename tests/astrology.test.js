import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  buildAstroShareText,
  calculateNatalChart,
  fallbackLocations,
  planetOrder,
} from "../src/lib/astrology.js";

const sample = calculateNatalChart({
  name: "Pessoa de Teste",
  date: "1990-01-01",
  time: "12:00",
  location: fallbackLocations[0],
});

test("o mapa natal calcula os dez planetas, as doze casas e os ângulos", () => {
  assert.equal(sample.planets.length, 10);
  assert.deepEqual(sample.planets.map((planet) => planet.key), planetOrder);
  assert.equal(sample.houses.length, 12);
  assert.equal(new Set(sample.houses.map((house) => house.number)).size, 12);
  assert.ok(Number.isFinite(sample.ascendant.longitude));
  assert.ok(Number.isFinite(sample.midheaven.longitude));
  assert.equal(sample.method, "Zodíaco tropical · Casas Iguais");
});

test("o exemplo de referência mantém o trio principal e a verificação independente", () => {
  assert.deepEqual(
    sample.bigThree.map((point) => point.title),
    ["Sol em Capricórnio", "Lua em Peixes", "Ascendente em Peixes"],
  );
  assert.equal(sample.precision.status, "verified");
  assert.ok(sample.precision.maximumDelta < 0.05);
  assert.ok(sample.aspects.length >= 8);
});

test("o mapa é serializável e o resumo compartilhável contém método e posições", () => {
  assert.doesNotThrow(() => JSON.stringify(sample));
  const text = buildAstroShareText(sample);
  assert.match(text, /MAPA ASTRAL/);
  assert.match(text, /Sol em Capricórnio/);
  assert.match(text, /Ascendente em Peixes/);
  assert.match(text, /Casas Iguais/);
});

test("a interface astrológica expõe cálculo, privacidade e atribuição", () => {
  const pagePath = fileURLToPath(new URL("../src/pages/AstralMapPage.jsx", import.meta.url));
  const page = readFileSync(pagePath, "utf8");

  assert.match(page, /calculateNatalChart/);
  assert.match(page, /Seus dados ficam no seu navegador/);
  assert.match(page, /Open-Meteo/);
  assert.match(page, /10 planetas/);
  assert.match(page, /12 casas/);
  assert.match(page, /Nome completo/);
  assert.match(page, /showPicker/);
  assert.match(page, /id="birth-date"/);
  assert.match(page, /id="birth-time"/);
});
