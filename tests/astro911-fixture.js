import { createAstro911Context } from "../src/lib/astro911.js";
import { calculateNatalChart, fallbackLocations } from "../src/lib/astrology.js";

export function sampleAstroChart() {
  return calculateNatalChart({
    name: "Pessoa de Teste",
    date: "1990-01-01",
    time: "12:00",
    location: fallbackLocations[0],
  });
}

export function sampleAstroRequest(overrides = {}) {
  const chart = sampleAstroChart();
  return {
    agent: "astro-911",
    requestId: "astro-api-contract-test",
    schemaVersion: "2026-08-12.1",
    context: createAstro911Context(chart),
    ...overrides,
  };
}

function paragraph(seed, repeat = 6) {
  return Array.from({ length: repeat }, (_, index) => (
    `${seed} A combinação ganha sentido quando é observada em escolhas, ritmos e relações concretas, sem transformar símbolo em sentença ${index + 1}.`
  )).join(" ");
}

export function sampleAstroDocument(context = sampleAstroRequest().context) {
  const planetFacts = context.chart.planets.map((planet) => `planet:${planet.key}`);
  const angleFacts = ["angle:ascendant", "angle:midheaven"];
  const aspectFacts = context.chart.aspects.map((aspect) => aspect.id);
  const anchors = [...planetFacts, ...angleFacts, ...aspectFacts];
  const sectionIds = ["essencia", "afetos", "vocacao", "tensoes", "integracao"];
  return {
    title: "Uma arquitetura que pede presença",
    subtitle: "Força e sensibilidade não precisam disputar o mesmo lugar.",
    opening: paragraph("Pessoa, este mapa reúne estrutura, percepção e abertura para compreender como você ocupa o próprio caminho.", 4),
    portrait: {
      centralStrength: "Sustentar processos sem perder a capacidade de perceber nuance e mudar de perspectiva.",
      centralTension: "Equilibrar responsabilidade, liberdade e necessidades emocionais sem fazer uma dimensão silenciar a outra.",
      integration: "Transformar percepção em acordos observáveis, com ritmo, limite e espaço para revisão.",
    },
    sections: sectionIds.map((id, index) => ({
      id,
      title: [
        "A forma como você ocupa a própria vida",
        "Afeto precisa de presença e espaço",
        "Construção com assinatura própria",
        "O conflito que também vira recurso",
        "Um modo possível de integrar o mapa",
      ][index],
      body: paragraph(`Pessoa encontra nesta camada uma relação específica entre ${anchors[index]} e ${anchors[index + 5]}.`, 5),
      anchors: [anchors[index], anchors[index + 5], anchors[12 + index]],
      practicalDirection: "Observe por sete dias em qual situação esta combinação aparece e registre o fato antes de interpretar a intenção de alguém.",
    })),
    practices: Array.from({ length: 5 }, (_, index) => ({
      title: `Prática de presença ${index + 1}`,
      action: "Escolha uma situação real da semana, separe fato, reação e necessidade, e teste uma resposta pequena antes de tomar uma decisão maior.",
      purpose: "Dar forma observável ao símbolo sem transformar o mapa em ordem ou diagnóstico.",
    })),
    reflectionQuestions: Array.from(
      { length: 5 },
      (_, index) => `Em qual situação concreta a tensão desta camada aparece com mais nitidez hoje ${index + 1}?`,
    ),
    closing: paragraph("Pessoa pode voltar a este documento como espelho de escolhas e linguagem para reconhecer padrões, sem tratá-lo como destino.", 2),
    audit: {
      usedFactIds: anchors.slice(0, 15),
      factualConsistency: true,
      deterministicClaims: false,
    },
  };
}

export function sampleAstroApiPayload() {
  const context = sampleAstroRequest().context;
  return {
    document: sampleAstroDocument(context),
    factLabels: {},
    meta: {
      schemaVersion: "2026-08-12.1",
      grounded: true,
      provider: "gemini",
      model: "gemini-3.5-flash",
      usedFallbackModel: false,
      rawBirthDataSent: false,
    },
  };
}
