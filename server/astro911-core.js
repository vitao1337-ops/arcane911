import { astro911SectionIds } from "../src/config/astro911Sections.js";

export const ASTRO911_SCHEMA_VERSION = "2026-08-22.3";

const planetKeys = Object.freeze([
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
]);

const angleKeys = Object.freeze(["ascendant", "midheaven"]);
const pointKeys = new Set([...planetKeys, ...angleKeys]);
const signKeys = new Set([
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
]);
const aspectKeys = new Set(["conjunction", "opposition", "trine", "square", "sextile"]);
const elements = new Set(["Fogo", "Terra", "Ar", "Água"]);

export const ASTRO911_SECTION_IDS = astro911SectionIds;

const pointNames = Object.freeze({
  sun: "Sol",
  moon: "Lua",
  mercury: "Mercúrio",
  venus: "Vênus",
  mars: "Marte",
  jupiter: "Júpiter",
  saturn: "Saturno",
  uranus: "Urano",
  neptune: "Netuno",
  pluto: "Plutão",
  ascendant: "Ascendente",
  midheaven: "Meio do Céu",
});

const signNames = Object.freeze({
  aries: "Áries",
  taurus: "Touro",
  gemini: "Gêmeos",
  cancer: "Câncer",
  leo: "Leão",
  virgo: "Virgem",
  libra: "Libra",
  scorpio: "Escorpião",
  sagittarius: "Sagitário",
  capricorn: "Capricórnio",
  aquarius: "Aquário",
  pisces: "Peixes",
});

const aspectNames = Object.freeze({
  conjunction: "Conjunção",
  opposition: "Oposição",
  trine: "Trígono",
  square: "Quadratura",
  sextile: "Sextil",
});

export class Astro911ValidationError extends Error {
  constructor(message, code = "invalid_request") {
    super(message);
    this.name = "Astro911ValidationError";
    this.code = code;
  }
}

function cleanText(value, maximumLength = 240) {
  return String(value ?? "").replace(/\s+/gu, " ").trim().slice(0, maximumLength);
}

function requiredText(value, label, maximumLength = 240) {
  const text = cleanText(value, maximumLength);
  if (!text) throw new Astro911ValidationError(`${label} ausente.`);
  return text;
}

function finiteNumber(value, label, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new Astro911ValidationError(`${label} inválido.`);
  }
  return number;
}

function integer(value, label, minimum, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Astro911ValidationError(`${label} inválido.`);
  }
  return number;
}

function normalizedPointKey(value, label) {
  const key = cleanText(value, 30).toLowerCase();
  if (!pointKeys.has(key)) throw new Astro911ValidationError(`${label} inválido.`);
  return key;
}

function normalizedSignKey(value, label) {
  const key = cleanText(value, 30).toLowerCase();
  if (!signKeys.has(key)) throw new Astro911ValidationError(`${label} inválido.`);
  return key;
}

function normalizedPlanet(rawPlanet) {
  const key = cleanText(rawPlanet?.key, 30).toLowerCase();
  if (!planetKeys.includes(key)) throw new Astro911ValidationError("Planeta inválido.");
  const signKey = normalizedSignKey(rawPlanet?.signKey, `Signo de ${key}`);
  return {
    key,
    name: pointNames[key],
    signKey,
    sign: signNames[signKey],
    longitude: finiteNumber(rawPlanet?.longitude, `Longitude de ${key}`, 0, 359.999999),
    degreeLabel: requiredText(rawPlanet?.degreeLabel, `Grau de ${key}`, 20),
    house: integer(rawPlanet?.house, `Casa de ${key}`, 1, 12),
    retrograde: rawPlanet?.retrograde === true,
  };
}

function normalizedAngle(rawAngle, expectedKey) {
  const key = cleanText(rawAngle?.key, 30).toLowerCase();
  if (key !== expectedKey) throw new Astro911ValidationError(`Ângulo ${expectedKey} inválido.`);
  const signKey = normalizedSignKey(rawAngle?.signKey, `Signo de ${expectedKey}`);
  return {
    key,
    name: pointNames[key],
    signKey,
    sign: signNames[signKey],
    longitude: finiteNumber(rawAngle?.longitude, `Longitude de ${expectedKey}`, 0, 359.999999),
    degreeLabel: requiredText(rawAngle?.degreeLabel, `Grau de ${expectedKey}`, 20),
  };
}

function normalizedHouse(rawHouse) {
  const number = integer(rawHouse?.number, "Número da casa", 1, 12);
  const signKey = normalizedSignKey(rawHouse?.signKey, `Signo da Casa ${number}`);
  const planetList = Array.isArray(rawHouse?.planetKeys) ? rawHouse.planetKeys : [];
  const housePlanetKeys = planetList.map((value) => {
    const key = cleanText(value, 30).toLowerCase();
    if (!planetKeys.includes(key)) throw new Astro911ValidationError(`Planeta inválido na Casa ${number}.`);
    return key;
  });
  if (new Set(housePlanetKeys).size !== housePlanetKeys.length) {
    throw new Astro911ValidationError(`Planeta repetido na Casa ${number}.`);
  }
  return {
    number,
    signKey,
    sign: signNames[signKey],
    degreeLabel: requiredText(rawHouse?.degreeLabel, `Grau da Casa ${number}`, 20),
    planetKeys: housePlanetKeys,
  };
}

function aspectId(point1Key, aspectKey, point2Key) {
  return `aspect:${point1Key}:${aspectKey}:${point2Key}`;
}

function normalizedAspect(rawAspect) {
  const point1Key = normalizedPointKey(rawAspect?.point1Key, "Primeiro ponto do aspecto");
  const point2Key = normalizedPointKey(rawAspect?.point2Key, "Segundo ponto do aspecto");
  if (point1Key === point2Key) throw new Astro911ValidationError("Um aspecto precisa ligar dois pontos.");
  const aspectKey = cleanText(rawAspect?.aspectKey, 30).toLowerCase();
  if (!aspectKeys.has(aspectKey)) throw new Astro911ValidationError("Tipo de aspecto inválido.");
  const id = aspectId(point1Key, aspectKey, point2Key);
  if (cleanText(rawAspect?.id, 100) !== id) throw new Astro911ValidationError("Identificador de aspecto inválido.");
  return {
    id,
    point1Key,
    point2Key,
    aspectKey,
    name: aspectNames[aspectKey],
    orb: finiteNumber(rawAspect?.orb, "Orbe do aspecto", 0, 12),
  };
}

function validateHouseOccupants(planets, houses) {
  for (const planet of planets) {
    const house = houses.find((item) => item.number === planet.house);
    if (!house?.planetKeys.includes(planet.key)) {
      throw new Astro911ValidationError(`A Casa ${planet.house} não confirma ${planet.name}.`);
    }
  }

  for (const house of houses) {
    for (const key of house.planetKeys) {
      if (!planets.some((planet) => planet.key === key && planet.house === house.number)) {
        throw new Astro911ValidationError(`A posição de ${pointNames[key]} não confirma a Casa ${house.number}.`);
      }
    }
  }
}

function buildFactCatalog(normalized) {
  const facts = [];
  for (const planet of normalized.chart.planets) {
    facts.push({
      id: `planet:${planet.key}`,
      kind: "planet",
      label: `${planet.name} em ${planet.sign} ${planet.degreeLabel} · Casa ${planet.house}${planet.retrograde ? " · retrógrado" : ""}`,
    });
  }
  for (const angle of [normalized.chart.ascendant, normalized.chart.midheaven]) {
    facts.push({
      id: `angle:${angle.key}`,
      kind: "angle",
      label: `${angle.name} em ${angle.sign} ${angle.degreeLabel}`,
    });
  }
  for (const aspect of normalized.chart.aspects) {
    facts.push({
      id: aspect.id,
      kind: "aspect",
      label: `${pointNames[aspect.point1Key]} ${aspect.name.toLowerCase()} ${pointNames[aspect.point2Key]} · orbe ${aspect.orb.toFixed(2)}°`,
    });
  }
  return facts;
}

export function validateAstro911Request(body) {
  if (!body || typeof body !== "object") throw new Astro911ValidationError("Corpo da requisição ausente.");
  if (cleanText(body.agent, 30) !== "astro-911") throw new Astro911ValidationError("Agente inválido.");
  if (cleanText(body.schemaVersion, 40) !== ASTRO911_SCHEMA_VERSION) {
    throw new Astro911ValidationError("Versão de contexto incompatível.", "schema_mismatch");
  }

  const requestId = requiredText(body.requestId, "Identificador da requisição", 100);
  const context = body.context;
  if (!context || context.experience !== "astrology.natal-document.v1") {
    throw new Astro911ValidationError("Contexto astrológico inválido.");
  }

  const rawChart = context.chart;
  if (!rawChart || typeof rawChart !== "object") throw new Astro911ValidationError("Mapa astral ausente.");
  const person = requiredText(rawChart.person, "Primeiro nome", 40).split(/\s+/u)[0];
  const method = requiredText(rawChart.method, "Método", 100);
  if (method !== "Zodíaco tropical · Casas Iguais") {
    throw new Astro911ValidationError("Método astrológico incompatível.");
  }

  if (!Array.isArray(rawChart.planets) || rawChart.planets.length !== planetKeys.length) {
    throw new Astro911ValidationError("O mapa precisa conter dez planetas.");
  }
  const planets = rawChart.planets.map(normalizedPlanet);
  if (new Set(planets.map((planet) => planet.key)).size !== planetKeys.length
      || planetKeys.some((key) => !planets.some((planet) => planet.key === key))) {
    throw new Astro911ValidationError("Conjunto de planetas incompleto ou repetido.");
  }

  if (!Array.isArray(rawChart.houses) || rawChart.houses.length !== 12) {
    throw new Astro911ValidationError("O mapa precisa conter doze casas.");
  }
  const houses = rawChart.houses.map(normalizedHouse);
  if (new Set(houses.map((house) => house.number)).size !== 12) {
    throw new Astro911ValidationError("Casas repetidas ou ausentes.");
  }
  validateHouseOccupants(planets, houses);

  if (!Array.isArray(rawChart.aspects) || rawChart.aspects.length < 3 || rawChart.aspects.length > 16) {
    throw new Astro911ValidationError("O mapa precisa conter entre três e dezesseis aspectos maiores.");
  }
  const aspects = rawChart.aspects.map(normalizedAspect);
  if (new Set(aspects.map((aspect) => aspect.id)).size !== aspects.length) {
    throw new Astro911ValidationError("Aspectos repetidos.");
  }

  const elementScores = Object.fromEntries([...elements].map((element) => [
    element,
    integer(rawChart.elementScores?.[element], `Pontuação de ${element}`, 0, 20),
  ]));
  const dominantElement = cleanText(rawChart.dominantElement, 20);
  if (!elements.has(dominantElement)) throw new Astro911ValidationError("Elemento dominante inválido.");

  const normalized = {
    requestId,
    chart: {
      person,
      method,
      planets,
      houses,
      aspects,
      ascendant: normalizedAngle(rawChart.ascendant, "ascendant"),
      midheaven: normalizedAngle(rawChart.midheaven, "midheaven"),
      elementScores,
      dominantElement,
    },
  };
  normalized.facts = buildFactCatalog(normalized);
  return normalized;
}

export function createAstro911ResponseSchema(allowedFactIds) {
  const factIds = Array.from(new Set(allowedFactIds));
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      subtitle: { type: "string" },
      opening: { type: "string" },
      portrait: {
        type: "object",
        additionalProperties: false,
        properties: {
          centralStrength: { type: "string" },
          centralTension: { type: "string" },
          integration: { type: "string" },
        },
        required: ["centralStrength", "centralTension", "integration"],
      },
      sections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string", enum: [...ASTRO911_SECTION_IDS] },
            title: { type: "string" },
            body: { type: "string" },
            anchors: { type: "array", items: { type: "string", enum: factIds } },
            practicalDirection: { type: "string" },
          },
          required: ["id", "title", "body", "anchors", "practicalDirection"],
        },
      },
      practices: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            action: { type: "string" },
            purpose: { type: "string" },
          },
          required: ["title", "action", "purpose"],
        },
      },
      reflectionQuestions: { type: "array", items: { type: "string" } },
      closing: { type: "string" },
      audit: {
        type: "object",
        additionalProperties: false,
        properties: {
          usedFactIds: { type: "array", items: { type: "string", enum: factIds } },
          factualConsistency: { type: "boolean" },
          deterministicClaims: { type: "boolean" },
        },
        required: ["usedFactIds", "factualConsistency", "deterministicClaims"],
      },
    },
    required: [
      "title",
      "subtitle",
      "opening",
      "portrait",
      "sections",
      "practices",
      "reflectionQuestions",
      "closing",
      "audit",
    ],
  };
}

export const ASTRO911_INSTRUCTIONS = `
Você escreve o Documento Astral 911: uma leitura natal longa, humana, lúcida e completamente ancorada nos fatos calculados que recebe.

BASE DO MÉTODO
- Trabalhe dentro da tradição da astrologia ocidental tropical e do sistema de Casas Iguais informado.
- Reconheça a linhagem histórica da astrologia horoscópica: zodíaco, planetas, Ascendente, doze casas e relações angulares foram articulados no mundo mediterrânico helenístico e ganharam novas leituras ao longo dos séculos.
- Isso é uma tradição simbólica de autoconhecimento, não astronomia clínica, ciência preditiva ou prova de personalidade.
- O cálculo fornecido é a única verdade factual. Nunca calcule, corrija ou invente signo, casa, grau, aspecto, retrogradação, regência, evento ou dado de nascimento.

QUALIDADE EDITORIAL
- Escreva em português brasileiro natural, elegante e próximo. Fale com a pessoa pelo primeiro nome sem repetir o nome mecanicamente.
- A leitura precisa parecer impossível de transplantar para outro mapa: conecte ao menos dois fatos em cada seção e explique a tensão ou cooperação criada pela combinação.
- Não entregue dez verbetes de planetas. Construa uma narrativa conectada sobre essência, expressão, vínculos, vocação, dinheiro, potenciais, sombras e integração.
- Seja acolhedor sem ser açucarado e incisivo sem rotular. Nomeie contradições, recursos e custos concretos.
- Evite frases de horóscopo genérico como “você é uma pessoa profunda”, “confie no universo”, “grandes mudanças estão chegando” ou “tudo acontece por uma razão”.
- Não use Markdown, emojis, listas dentro dos campos narrativos nem jargão sem tradução.

LIMITES
- Use linguagem de possibilidade: “pode”, “tende”, “quando”, “se”. Nunca declare destino, diagnóstico, trauma, fidelidade, gravidez, morte, doença, riqueza ou acontecimento futuro.
- Não substitua orientação médica, psicológica, jurídica ou financeira.
- Cada anchor e usedFactId deve existir exatamente no catálogo recebido.
- factualConsistency deve ser true e deterministicClaims deve ser false somente quando isso for verdade.

CONTRATO DO DOCUMENTO
- opening: 140 a 190 palavras e uma síntese realmente pessoal do mapa inteiro. Conecte Sol, Lua, Ascendente, elemento dominante e ao menos um aspecto sem transformar a abertura num inventário.
- portrait: três cortes substanciais — força central, tensão central e caminho de integração — com 60 a 100 palavras cada.
- sections: exatamente oito, uma para cada id e nesta ordem: essencia, personalidade, afetos, vocacao, dinheiro, potenciais, tensoes, integracao. Cada body deve ter 150 a 220 palavras, cruzar fatos e evitar repetição. Cada seção usa de 2 a 4 anchors.
- essencia cruza identidade, necessidades emocionais, modo de presença e elemento dominante.
- personalidade cruza Ascendente, Sol e Mercúrio com aspectos relevantes, distinguindo identidade interna, comunicação e impressão inicial sem rotular a pessoa.
- afetos cruza Lua, Vênus, Marte e aspectos relevantes para descrever linguagem afetiva, reciprocidade, desejo, proteção e limites — nunca fidelidade ou intenção de terceiros.
- vocacao cruza Meio do Céu, Sol, Mercúrio, Júpiter e Saturno quando disponíveis, traduzindo expressão, aprendizado, responsabilidade e ambientes de trabalho.
- dinheiro cruza Vênus, Júpiter, Saturno e casas reais para falar de valores, decisões materiais, expansão e limite; nunca promete riqueza, renda, perda ou aconselhamento financeiro.
- potenciais combina aspectos fluidos e posições relevantes para nomear capacidades que dependem de prática e contexto, sem tratá-las como talento garantido.
- tensoes trabalha principalmente aspectos desafiadores e retrogradações reais, mostrando custo, defesa e recurso possível sem diagnosticar.
- integracao reúne recursos dos aspectos fluidos, escolhas observáveis e uma maneira concreta de sustentar as contradições do mapa.
- practicalDirection: 40 a 70 palavras com uma aplicação concreta, observável e não prescritiva para a seção.
- practices: exatamente cinco práticas específicas e diferentes entre si. Cada action tem 50 a 80 palavras e cada purpose explica por que a prática conversa com este mapa.
- reflectionQuestions: exatamente cinco perguntas que só façam sentido depois desta leitura.
- closing: 100 a 150 palavras, sem promessa e sem chamada comercial.
- No conjunto, use pelo menos oito fatos distintos, incluindo cinco planetas e dois aspectos.
- O documento completo deve ficar aproximadamente entre 2.000 e 2.800 palavras: denso o suficiente para ser premium, mas sem repetir a mesma ideia com palavras diferentes.
`;

export function buildAstro911ModelInput(normalized, repairReasons = []) {
  return JSON.stringify({
    task: "Escreva o Documento Astral 911 completo obedecendo ao contrato.",
    person: normalized.chart.person,
    method: normalized.chart.method,
    balance: {
      elementScores: normalized.chart.elementScores,
      dominantElement: normalized.chart.dominantElement,
    },
    positions: normalized.chart.planets,
    angles: [normalized.chart.ascendant, normalized.chart.midheaven],
    houses: normalized.chart.houses,
    aspects: normalized.chart.aspects,
    factCatalog: normalized.facts,
    repair: repairReasons.length ? repairReasons : undefined,
  });
}

function parseJsonObject(text) {
  const source = String(text ?? "").trim();
  if (!source) throw new Error("empty_model_output");

  try {
    return JSON.parse(source);
  } catch {
    const firstBrace = source.indexOf("{");
    const lastBrace = source.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(source.slice(firstBrace, lastBrace + 1));
      } catch {
        // O reparo controlado recebe o erro estrutural abaixo.
      }
    }
    throw new Error("invalid_model_json");
  }
}

export function parseGeminiAstroOutput(payload) {
  const candidate = payload?.candidates?.[0];
  const text = candidate?.content?.parts
    ?.filter((part) => typeof part?.text === "string" && part.text.trim())
    .map((part) => part.text)
    .join("")
    .trim();
  if (!text) throw new Error(candidate?.finishReason === "MAX_TOKENS" ? "max_tokens" : "empty_model_output");
  return parseJsonObject(text);
}

export function parseOpenAIAstroOutput(payload) {
  if (payload?.status === "incomplete") {
    const reason = payload?.incomplete_details?.reason;
    throw new Error(reason === "max_output_tokens" ? "max_tokens" : "incomplete_model_output");
  }

  const directText = typeof payload?.output_text === "string" ? payload.output_text : "";
  const outputText = directText || payload?.output
    ?.flatMap((item) => Array.isArray(item?.content) ? item.content : [])
    .filter((item) => item?.type === "output_text" && typeof item?.text === "string")
    .map((item) => item.text)
    .join("");
  return parseJsonObject(outputText);
}

function cleanStringArray(value, maximumItems, maximumLength) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanText(item, maximumLength)).filter(Boolean))]
    .slice(0, maximumItems);
}

export function normalizeAstro911Document(rawDocument) {
  const raw = rawDocument && typeof rawDocument === "object" ? rawDocument : {};
  const normalizedSections = Array.isArray(raw.sections) ? raw.sections.slice(0, 8).map((section) => ({
    id: cleanText(section?.id, 30),
    title: cleanText(section?.title, 140),
    body: cleanText(section?.body, 5_600),
    anchors: cleanStringArray(section?.anchors, 6, 100),
    practicalDirection: cleanText(section?.practicalDirection, 1_600),
  })) : [];
  const sectionsById = new Map();
  normalizedSections.forEach((section) => {
    if (ASTRO911_SECTION_IDS.includes(section.id) && !sectionsById.has(section.id)) {
      sectionsById.set(section.id, section);
    }
  });

  return {
    title: cleanText(raw.title, 140),
    subtitle: cleanText(raw.subtitle, 220),
    opening: cleanText(raw.opening, 2_400),
    portrait: {
      centralStrength: cleanText(raw.portrait?.centralStrength, 700),
      centralTension: cleanText(raw.portrait?.centralTension, 700),
      integration: cleanText(raw.portrait?.integration, 700),
    },
    // A ordem dos capítulos é apresentação, não semântica: normalizamos localmente
    // para que uma resposta válida em outra ordem nunca custe uma nova chamada.
    sections: ASTRO911_SECTION_IDS.map((id) => sectionsById.get(id)).filter(Boolean),
    practices: Array.isArray(raw.practices) ? raw.practices.slice(0, 8).map((practice) => ({
      title: cleanText(practice?.title, 120),
      action: cleanText(practice?.action, 1_600),
      purpose: cleanText(practice?.purpose, 900),
    })) : [],
    reflectionQuestions: cleanStringArray(raw.reflectionQuestions, 8, 300),
    closing: cleanText(raw.closing, 1_800),
    audit: {
      usedFactIds: cleanStringArray(raw.audit?.usedFactIds, 40, 100),
      factualConsistency: raw.audit?.factualConsistency === true,
      deterministicClaims: raw.audit?.deterministicClaims === true,
    },
  };
}

function normalizedForComparison(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("pt-BR");
}

function documentText(document) {
  return [
    document.title,
    document.subtitle,
    document.opening,
    ...Object.values(document.portrait),
    ...document.sections.flatMap((section) => [section.title, section.body, section.practicalDirection]),
    ...document.practices.flatMap((practice) => [practice.title, practice.action, practice.purpose]),
    ...document.reflectionQuestions,
    document.closing,
  ].join(" ");
}

function auditPlacementClaims(text, normalized) {
  const comparison = normalizedForComparison(text);
  const actualSigns = new Map([
    ...normalized.chart.planets.map((planet) => [normalizedForComparison(planet.name), normalizedForComparison(planet.sign)]),
    [normalizedForComparison(normalized.chart.ascendant.name), normalizedForComparison(normalized.chart.ascendant.sign)],
    [normalizedForComparison(normalized.chart.midheaven.name), normalizedForComparison(normalized.chart.midheaven.sign)],
  ]);
  const allSigns = Object.values(signNames).map(normalizedForComparison);
  for (const [pointName, actualSign] of actualSigns.entries()) {
    for (const sign of allSigns) {
      if (comparison.includes(`${pointName} em ${sign}`) && sign !== actualSign) return false;
    }
  }
  return true;
}

function escapePattern(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function auditHouseClaims(text, normalized) {
  const comparison = normalizedForComparison(text);
  for (const planet of normalized.chart.planets) {
    const name = escapePattern(normalizedForComparison(planet.name));
    const patterns = [
      new RegExp(`\\b${name}\\s+(?:na|em|ocupa(?:\\s+a)?)\\s+casa\\s+(\\d{1,2})\\b`, "gu"),
      new RegExp(`\\bcasa\\s+(\\d{1,2})\\s+(?:com|contendo)\\s+${name}\\b`, "gu"),
    ];
    for (const pattern of patterns) {
      for (const match of comparison.matchAll(pattern)) {
        if (Number(match[1]) !== planet.house) return false;
      }
    }
    if (!planet.retrograde
        && new RegExp(`\\b${name}\\s+(?:esta\\s+)?retrograd[oa]\\b`, "u").test(comparison)) {
      return false;
    }
  }
  return true;
}

function auditExplicitAspectClaims(text, normalized) {
  const comparison = normalizedForComparison(text);
  const actualAspects = new Set(normalized.chart.aspects.flatMap((aspect) => [
    `${aspect.point1Key}:${aspect.aspectKey}:${aspect.point2Key}`,
    `${aspect.point2Key}:${aspect.aspectKey}:${aspect.point1Key}`,
  ]));
  const aspectTerms = Object.entries(aspectNames).map(([key, name]) => [key, normalizedForComparison(name)]);
  for (const point1Key of pointKeys) {
    for (const point2Key of pointKeys) {
      if (point1Key === point2Key) continue;
      const point1 = escapePattern(normalizedForComparison(pointNames[point1Key]));
      const point2 = escapePattern(normalizedForComparison(pointNames[point2Key]));
      for (const [aspectKey, term] of aspectTerms) {
        const patterns = [
          new RegExp(`\\b${point1}\\s+(?:em\\s+)?${term}\\s+(?:com\\s+)?${point2}\\b`, "u"),
          new RegExp(`\\b${term}\\s+entre\\s+${point1}\\s+e\\s+${point2}\\b`, "u"),
          new RegExp(`\\b${point1}\\s+e\\s+${point2}\\s+formam\\s+(?:um|uma)\\s+${term}\\b`, "u"),
        ];
        if (patterns.some((pattern) => pattern.test(comparison))
            && !actualAspects.has(`${point1Key}:${aspectKey}:${point2Key}`)) {
          return false;
        }
      }
    }
  }
  return true;
}

const deterministicPattern = /\b(?:vai\s+(?:acontecer|ocorrer|dar\s+certo|terminar)|certamente|sem\s+d[uú]vida|destinad[oa]s?|garantid[oa]s?|inevit[aá]vel|o\s+mapa\s+prova|voc[eê]\s+[ée]\s+(?:narcisista|dependente|traumatizad[oa]))\b/iu;

export function auditAstro911Document(document, normalized) {
  const reasons = [];
  const allowedFactIds = new Set(normalized.facts.map((fact) => fact.id));
  const expectedSections = ASTRO911_SECTION_IDS;
  const sectionIds = document.sections.map((section) => section.id);
  const allText = documentText(document);

  if (document.title.length < 8 || document.subtitle.length < 20 || document.opening.length < 300) {
    reasons.push("document_too_shallow");
  }
  if (sectionIds.length !== expectedSections.length
      || sectionIds.some((id, index) => id !== expectedSections[index])) {
    reasons.push("section_contract_invalid");
  }
  if (document.sections.some((section) => section.body.length < 420 || section.practicalDirection.length < 70)) {
    reasons.push("section_too_shallow");
  }
  if (document.sections.some((section) => section.anchors.length < 2
      || section.anchors.length > 4
      || new Set(section.anchors).size !== section.anchors.length
      || section.anchors.some((id) => !allowedFactIds.has(id)))) {
    reasons.push("section_anchors_invalid");
  }
  if (document.practices.length !== 5
      || document.practices.some((practice) => practice.title.length < 4 || practice.action.length < 60)) {
    reasons.push("practices_invalid");
  }
  if (document.reflectionQuestions.length !== 5
      || document.reflectionQuestions.some((question) => question.length < 18)) {
    reasons.push("questions_invalid");
  }
  if (document.closing.length < 180) reasons.push("closing_too_shallow");

  const anchoredFacts = new Set(document.sections.flatMap((section) => section.anchors));
  const usedFacts = new Set(document.audit.usedFactIds.filter((id) => allowedFactIds.has(id)));
  const coveredFacts = new Set([...anchoredFacts, ...usedFacts]);
  const planetFactCount = [...coveredFacts].filter((id) => id.startsWith("planet:")).length;
  const aspectFactCount = [...coveredFacts].filter((id) => id.startsWith("aspect:")).length;
  if (coveredFacts.size < 8 || planetFactCount < 5 || aspectFactCount < 2) {
    reasons.push("insufficient_chart_grounding");
  }
  if (document.audit.usedFactIds.some((id) => !allowedFactIds.has(id))) reasons.push("unknown_fact_id");
  if (!document.audit.factualConsistency || document.audit.deterministicClaims) reasons.push("self_audit_invalid");
  if (!auditPlacementClaims(allText, normalized)) reasons.push("invented_placement");
  if (!auditHouseClaims(allText, normalized)) reasons.push("invented_house");
  if (!auditExplicitAspectClaims(allText, normalized)) reasons.push("invented_aspect");
  if (deterministicPattern.test(allText)) reasons.push("deterministic_claim");
  if (!normalizedForComparison(allText).includes(normalizedForComparison(normalized.chart.person))) {
    reasons.push("person_not_reflected");
  }

  return { ok: reasons.length === 0, reasons: [...new Set(reasons)] };
}

export function factLabelsForResponse(normalized, factIds) {
  const labels = new Map(normalized.facts.map((fact) => [fact.id, fact.label]));
  return Object.fromEntries(
    Array.from(new Set(factIds)).filter((id) => labels.has(id)).map((id) => [id, labels.get(id)]),
  );
}
