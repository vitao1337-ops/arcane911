import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { positions, tarotCards } from "../src/data/tarot.js";
import {
  AGENT911_INSTRUCTIONS,
  auditAgent911Response,
  buildAgent911ModelInput,
  normalizeAgent911InterpretiveLanguage,
  validateAgent911Request,
} from "../server/agent911-core.js";

const cards = [tarotCards[6], tarotCards[12], tarotCards[17]];
const evaluationCases = [
  {
    intentId: "amor",
    question: "Ainda existe reciprocidade ou estou sustentando esse vínculo apenas pela saudade?",
    anchors: ["reciprocidade", "saudade"],
  },
  {
    intentId: "trabalho",
    question: "Estou adiando a mudança de carreira por prudência ou por medo de perder estabilidade?",
    anchors: ["carreira", "estabilidade"],
  },
  {
    intentId: "decisao",
    question: "Vale aceitar a proposta mesmo sabendo que o dinheiro pode cobrar minha paz?",
    anchors: ["proposta", "dinheiro"],
  },
  {
    intentId: "interior",
    question: "Por que meu desejo de criar desaparece quando começo a me cobrar perfeição?",
    anchors: ["criar", "perfeição"],
  },
  {
    intentId: "caminhos",
    question: "Que limite preciso sustentar para parar de repetir o mesmo desgaste?",
    anchors: ["limite", "desgaste"],
  },
];

function normalizedCase(item) {
  return validateAgent911Request({
    agent: "agent-911",
    requestId: `eval-${item.intentId}`,
    action: "opening_summary",
    memoryConsent: false,
    context: {
      reading: {
        id: `reading-${item.intentId}`,
        createdAt: "2026-08-12T18:00:00.000Z",
        intentId: item.intentId,
        intentLabel: item.intentId,
        question: item.question,
        cards: cards.map((card, index) => ({
          slug: card.slug,
          position: { id: positions[index].id },
        })),
      },
    },
  });
}

function personalReading(normalized, anchors) {
  const [first, second, third] = normalized.reading.canonical.cards;
  return {
    responseMode: "reading",
    title: `O preço de manter ${anchors[0]} sem medida`,
    opening: `Você não está dividida apenas entre ficar e sair; está tentando preservar ${anchors[0]} sem voltar a pagar com ${anchors[1]}.`,
    sections: [{
      id: "relacao-central",
      title: "O ponto que não aceita mais disfarce",
      text: `${first.name} tensiona a escolha que ${second.name} mantém suspensa; ${third.name} desloca esse impasse para uma atitude observável, sem prometer o comportamento de ninguém.`,
      cardSlugs: [...normalized.reading.cardSlugs],
    }],
    synthesis: `O acolhimento aqui não apaga o corte: ${anchors[0]} só permanece íntegra quando ${anchors[1]} deixa de ser o preço automático. A combinação fala menos de esperar uma resposta externa e mais de medir o que já acontece quando você sustenta o próprio limite.`,
    groundedAction: `Defina uma atitude verificável que preserve ${anchors[0]} sem negociar ${anchors[1]}.`,
    closingQuestion: "",
    suggestedQuestions: [],
    safetyMessage: "",
    memoryUpdate: { summary: "", themes: [], people: [] },
    audit: {
      usedCardSlugs: [...normalized.reading.cardSlugs],
      confidence: "grounded",
      unsupportedCertainty: false,
    },
  };
}

test("a suíte de voz exige detalhes pessoais e as três cartas na abertura", () => {
  evaluationCases.forEach((item) => {
    const normalized = normalizedCase(item);
    const response = personalReading(normalized, item.anchors);
    assert.equal(auditAgent911Response(response, normalized).ok, true, item.intentId);

    const modelInput = JSON.parse(buildAgent911ModelInput(normalized));
    assert.ok(modelInput.personalizationContract.concreteAnchors.length >= 2);
    assert.equal(modelInput.personalizationContract.minimumNamedCards, 3);
    assert.deepEqual(modelInput.personalizationContract.selectedCardNames, cards.map((card) => card.name));
  });
});

test("a auditoria manda reparar abertura genérica e resposta transplantável", () => {
  const normalized = normalizedCase(evaluationCases[0]);
  const response = personalReading(normalized, evaluationCases[0].anchors);
  response.title = "Uma passagem que pede clareza";
  response.opening = "A mesa mostra uma energia de mudança e transformação.";
  response.synthesis = "Confie no processo e siga o movimento que fizer sentido para você.";
  response.groundedAction = "Observe o cenário antes de escolher o próximo passo.";

  const audit = auditAgent911Response(response, normalized);
  assert.equal(audit.ok, false);
  assert.ok(audit.reasons.includes("generic_opening"));
  assert.ok(audit.reasons.includes("question_not_reflected"));
});

test("o contrato combina acolhimento, incisão e limite factual", () => {
  assert.match(AGENT911_INSTRUCTIONS, /Acolha primeiro o custo emocional/);
  assert.match(AGENT911_INSTRUCTIONS, /Ser incisiva significa revelar uma contradição/);
  assert.match(AGENT911_INSTRUCTIONS, /Nunca confirme traição/);
  assert.match(AGENT911_INSTRUCTIONS, /Fale diretamente com "você"/);
  assert.match(AGENT911_INSTRUCTIONS, /Corte o padrão, não a dignidade/);
  assert.match(AGENT911_INSTRUCTIONS, /Cartas não diagnosticam a pessoa/);
});

test("a auditoria rejeita sentença afetiva e rótulo psicológico disfarçados de corte", () => {
  const normalized = normalizedCase(evaluationCases[0]);
  const certainty = personalReading(normalized, evaluationCases[0].anchors);
  certainty.synthesis = "O que mantém você aqui não é amor: essa história já acabou.";

  const labeled = personalReading(normalized, evaluationCases[0].anchors);
  labeled.synthesis = "Seu conflito real é um apego infantil sustentado por dependência mútua.";

  const foretold = personalReading(normalized, evaluationCases[0].anchors);
  foretold.synthesis = "O ciclo atual se encerrou; você já sabe o que quer e permanecer gerará ressentimento.";

  const familyStory = personalReading(normalized, evaluationCases[0].anchors);
  familyStory.synthesis = "O seu conflito real não é a proposta. As cartas mostram que um acordo inconsciente impede você de seguir.";

  const loadedQuestion = personalReading(normalized, evaluationCases[0].anchors);
  loadedQuestion.sections[0].text += " A Estrela guarda um silêncio que sabe exatamente onde o medo infantil opera.";
  loadedQuestion.closingQuestion = "O que na sua relação familiar faz você acreditar que crescer ameaça sua mãe?";
  loadedQuestion.groundedAction = "Se nenhuma condição estiver presente nos próximos 7 dias, encerre a espera.";

  assert.ok(auditAgent911Response(certainty, normalized).reasons.includes("unsupported_certainty_language"));
  assert.ok(auditAgent911Response(labeled, normalized).reasons.includes("unsupported_certainty_language"));
  assert.ok(auditAgent911Response(foretold, normalized).reasons.includes("unsupported_certainty_language"));
  assert.ok(auditAgent911Response(familyStory, normalized).reasons.includes("unsupported_certainty_language"));
  assert.ok(auditAgent911Response(loadedQuestion, normalized).reasons.includes("unsupported_certainty_language"));

  const softened = normalizeAgent911InterpretiveLanguage(foretold);
  assert.equal(auditAgent911Response(softened, normalized).ok, true);
  assert.match(softened.synthesis, /o ciclo atual pode estar chegando ao limite/i);
  assert.match(softened.synthesis, /pode ser que uma parte sua já saiba/i);
  assert.match(softened.synthesis, /pode alimentar ressentimento/i);

  const softenedFamilyStory = normalizeAgent911InterpretiveLanguage(familyStory);
  assert.equal(auditAgent911Response(softenedFamilyStory, normalized).ok, true);
  assert.match(softenedFamilyStory.synthesis, /o conflito talvez não seja apenas a proposta/i);
  assert.match(softenedFamilyStory.synthesis, /levanta a hipótese/i);
  assert.doesNotMatch(softenedFamilyStory.synthesis, /acordo inconsciente|impede você/i);

  const softenedLoadedQuestion = normalizeAgent911InterpretiveLanguage(loadedQuestion);
  assert.equal(auditAgent911Response(softenedLoadedQuestion, normalized).ok, true);
  assert.doesNotMatch(softenedLoadedQuestion.sections[0].text, /medo infantil|silêncio que sabe/i);
  assert.match(softenedLoadedQuestion.closingQuestion, /Que evidências.+sustentam — ou contradizem/i);
  assert.doesNotMatch(softenedLoadedQuestion.groundedAction, /próximos 7 dias/i);
  assert.match(softenedLoadedQuestion.groundedAction, /próxima oportunidade concreta/i);
});

test("a lapidação preserva o corte sem declarar ciclo saturado ou verdade já conhecida", () => {
  const normalized = validateAgent911Request({
    agent: "agent-911",
    requestId: "eval-lapidacao",
    action: "opening_summary",
    memoryConsent: false,
    context: {
      reading: {
        id: "reading-lapidacao",
        createdAt: "2026-08-12T19:20:00.000Z",
        intentId: "trabalho",
        intentLabel: "Trabalho",
        question: evaluationCases[1].question,
        cards: [tarotCards[1], tarotCards[11], tarotCards[13]].map((card, index) => ({
          slug: card.slug,
          position: { id: positions[index].id },
        })),
      },
    },
  });
  const response = personalReading(normalized, evaluationCases[1].anchors);
  response.sections[0].text += " A Morte executa o corte necessário: o ciclo da sua estabilidade atual está saturado.";
  response.closingQuestion = "Você está adiando o fim de um ciclo que você já sabe que acabou?";

  const softened = normalizeAgent911InterpretiveLanguage(response);
  assert.doesNotMatch(softened.sections[0].text, /executa o corte necessário|está saturado/iu);
  assert.match(softened.sections[0].text, /pode ser necessário/iu);
  assert.match(softened.sections[0].text, /pode estar chegando ao limite/iu);
  assert.doesNotMatch(softened.closingQuestion, /você já sabe que acabou/iu);
  assert.match(softened.closingQuestion, /talvez já esteja chegando ao limite/iu);
  assert.equal(auditAgent911Response(softened, normalized).ok, true);
});

test("o modo conectado espera o Gemini e não exibe uma leitura local provisória", () => {
  const summary = readFileSync(
    fileURLToPath(new URL("../src/components/Agent911Summary.jsx", import.meta.url)),
    "utf8",
  );
  assert.match(summary, /setResult\(null\)/);
  assert.match(summary, /Sete posições estão virando uma história só/);
  assert.match(summary, /Nenhum texto automático foi colocado no lugar/);
  assert.doesNotMatch(summary, /source:\s*"fallback"/);
});
