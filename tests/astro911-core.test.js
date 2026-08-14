import assert from "node:assert/strict";
import test from "node:test";
import {
  ASTRO911_SECTION_IDS,
  Astro911ValidationError,
  auditAstro911Document,
  createAstro911ResponseSchema,
  normalizeAstro911Document,
  validateAstro911Request,
} from "../server/astro911-core.js";
import { buildAstro911MockPayload } from "../src/lib/astro911Fallback.js";
import { sampleAstroChart } from "./astro911-fixture.js";
import { sampleAstroDocument, sampleAstroRequest } from "./astro911-fixture.js";

test("o servidor valida dez planetas, doze casas e aspectos sem receber dados brutos de nascimento", () => {
  const raw = sampleAstroRequest();
  const normalized = validateAstro911Request(raw);

  assert.equal(normalized.chart.planets.length, 10);
  assert.equal(normalized.chart.houses.length, 12);
  assert.ok(normalized.chart.aspects.length >= 3);
  assert.equal(normalized.chart.person, "Pessoa");
  assert.equal(JSON.stringify(raw.context).includes("1990-01-01"), false);
  assert.equal(JSON.stringify(raw.context).includes("São Paulo"), false);
  assert.equal(JSON.stringify(raw.context).includes("12:00"), false);
});

test("mapa adulterado ou incoerente entre planeta e casa é recusado", () => {
  const raw = sampleAstroRequest();
  raw.context.chart.planets[0].house = raw.context.chart.planets[0].house === 12 ? 1 : 12;
  assert.throws(() => validateAstro911Request(raw), Astro911ValidationError);
});

test("o Structured Output restringe capítulos e âncoras aos fatos calculados", () => {
  const normalized = validateAstro911Request(sampleAstroRequest());
  const factIds = normalized.facts.map((fact) => fact.id);
  const schema = createAstro911ResponseSchema(factIds);

  assert.deepEqual(schema.properties.sections.items.properties.id.enum, [...ASTRO911_SECTION_IDS]);
  assert.deepEqual(schema.properties.sections.items.properties.anchors.items.enum, factIds);
  assert.equal(schema.additionalProperties, false);
});

test("a auditoria aceita documento pessoal ancorado e recusa posição inventada", () => {
  const normalized = validateAstro911Request(sampleAstroRequest());
  const valid = normalizeAstro911Document(sampleAstroDocument(sampleAstroRequest().context));
  assert.deepEqual(auditAstro911Document(valid, normalized), { ok: true, reasons: [] });

  const invented = structuredClone(valid);
  invented.opening += " Sol em Áries define toda a personalidade.";
  const audit = auditAstro911Document(invented, normalized);
  assert.equal(audit.ok, false);
  assert.ok(audit.reasons.includes("invented_placement"));
});

test("a auditoria também barra casa e aspecto explícitos que não existem no mapa", () => {
  const normalized = validateAstro911Request(sampleAstroRequest());
  const base = normalizeAstro911Document(sampleAstroDocument(sampleAstroRequest().context));
  const sun = normalized.chart.planets.find((planet) => planet.key === "sun");
  const wrongHouse = sun.house === 12 ? 1 : 12;
  base.opening += ` Sol na Casa ${wrongHouse} seria uma posição inventada.`;
  let audit = auditAstro911Document(base, normalized);
  assert.ok(audit.reasons.includes("invented_house"));

  const wrongAspect = normalizeAstro911Document(sampleAstroDocument(sampleAstroRequest().context));
  const hasSunMoonSquare = normalized.chart.aspects.some((aspect) => (
    aspect.aspectKey === "square"
      && new Set([aspect.point1Key, aspect.point2Key]).has("sun")
      && new Set([aspect.point1Key, aspect.point2Key]).has("moon")
  ));
  assert.equal(hasSunMoonSquare, false);
  wrongAspect.closing += " Sol e Lua formam uma quadratura neste mapa.";
  audit = auditAstro911Document(wrongAspect, normalized);
  assert.ok(audit.reasons.includes("invented_aspect"));
});

test("a auditoria impede destino garantido e documento genérico sem fatos suficientes", () => {
  const normalized = validateAstro911Request(sampleAstroRequest());
  const document = normalizeAstro911Document(sampleAstroDocument(sampleAstroRequest().context));
  document.closing += " Certamente grandes mudanças estão chegando e tudo vai dar certo.";
  document.audit.usedFactIds = [];
  document.sections.forEach((section) => { section.anchors = section.anchors.slice(0, 1); });

  const audit = auditAstro911Document(document, normalized);
  assert.equal(audit.ok, false);
  assert.ok(audit.reasons.includes("deterministic_claim"));
  assert.ok(audit.reasons.includes("section_anchors_invalid"));
});

test("o mock DEV é um documento completo, pessoal e válido no mesmo contrato da produção", () => {
  const normalized = validateAstro911Request(sampleAstroRequest());
  const payload = buildAstro911MockPayload(sampleAstroChart());
  const document = normalizeAstro911Document(payload.document);

  assert.equal(payload.meta.provider, "mock");
  assert.equal(payload.meta.rawBirthDataSent, false);
  assert.equal(document.sections.length, 5);
  assert.ok(document.sections.every((section) => section.body.length > 700));
  assert.deepEqual(auditAstro911Document(document, normalized), { ok: true, reasons: [] });
});
