import assert from "node:assert/strict";
import { resolveBirthInstant } from '../src/lib/birthTime.js';
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

test("o cálculo recusa data impossível, nascimento futuro e coordenadas inválidas", () => {
  assert.throws(
    () => calculateNatalChart({
      name: "Pessoa de Teste",
      date: "1990-02-31",
      time: "12:00",
      location: fallbackLocations[0],
    }),
    /data de nascimento válida/u,
  );
  assert.throws(
    () => calculateNatalChart({
      name: "Pessoa de Teste",
      date: "2990-01-01",
      time: "12:00",
      location: fallbackLocations[0],
    }),
    /data de nascimento válida/u,
  );
  assert.throws(
    () => calculateNatalChart({
      name: "Pessoa de Teste",
      date: "1990-01-01",
      time: "12:00",
      location: { ...fallbackLocations[0], latitude: 120 },
    }),
    /cidade válida/u,
  );
});

test("a interface astrológica expõe cálculo, privacidade e atribuição", () => {
  const pagePath = fileURLToPath(new URL("../src/pages/AstralMapPage.jsx", import.meta.url));
  const page = readFileSync(pagePath, "utf8");

  assert.match(page, /calculateNatalChart/);
  assert.match(page, /Seus dados ficam protegidos/);
  assert.match(page, /dados de nascimento são usados apenas/);
  assert.match(page, /Astral911Document/);
  assert.match(page, /astralAccessGranted/u);
  assert.match(page, /verifyHostedCheckout/u);
  assert.match(page, /Documento Astral[\s\S]*?protegido/u);
  assert.doesNotMatch(page, /<Astral911Document chart=\{chart\} onStatus=\{updateStatus\} \/>\s*\n\s*<section/u);
  assert.match(page, /GeoNames/);


  assert.match(page, /Nome completo/);
  assert.match(page, /showPicker/);
  assert.match(page, /id="birth-date"/);
  assert.match(page, /id="birth-time"/);
  assert.match(page, /sessionStorage/u);
  assert.match(page, /ASTRO_STORAGE_MAX_AGE_MS/u);
});

test('horário de verão inexistente é rejeitado antes de calcular ou cobrar', () => {
  assert.throws(() => calculateNatalChart({ name: 'Pessoa Teste', date: '2018-11-04', time: '00:30', location: fallbackLocations[0] }), /horário não existiu/);
});

test('horário duplicado exige escolha explícita e preserva as duas ocorrências', () => {
  const input = { name: 'Pessoa Teste', date: '2019-02-16', time: '23:30', location: fallbackLocations[0] };
  assert.throws(() => calculateNatalChart(input), (error) => error.offsetOptions?.length === 2);
  const first = calculateNatalChart({ ...input, utcOffsetMinutes: -120 });
  const second = calculateNatalChart({ ...input, utcOffsetMinutes: -180 });
  assert.equal(first.birth.utc, '2019-02-17T01:30:00.000Z');
  assert.equal(second.birth.utc, '2019-02-17T02:30:00.000Z');
  assert.ok(Math.abs(first.ascendant.longitude - second.ascendant.longitude) > 5);
  assert.equal(first.birth.time, second.birth.time);
  assert.ok(second.precision.maximumDelta < 0.05);
});

test('fuso informado determina o instante mesmo quando difere do fuso inferido', () => {
  const resolved = resolveBirthInstant({ date: '2024-07-01', time: '12:00', timezone: 'Europe/London' });
  assert.equal(resolved.date.toISOString(), '2024-07-01T11:00:00.000Z');
  assert.equal(resolved.offset, 60);
});
