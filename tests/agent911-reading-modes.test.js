import assert from "node:assert/strict";
import test from "node:test";
import {
  agent911ReadingModes,
  normalizeAgent911ReadingMode,
} from "../src/config/agent911ReadingModes.js";
import { positions, tarotCards } from "../src/data/tarot.js";
import {
  auditAgent911Response,
  buildAgent911ModelInput,
  buildAgent911ReadingStyleContract,
  classifyAgent911Question,
  normalizeAgent911ReadingModeOutput,
  validateAgent911Request,
} from "../server/agent911-core.js";

const selectedCards = [tarotCards[1], tarotCards[11], tarotCards[13]];

function normalizeQuestion(question, readingMode = "sem_rodeios") {
  return validateAgent911Request({
    agent: "agent-911",
    requestId: `mode-${readingMode}`,
    action: "opening_summary",
    readingMode,
    memoryConsent: false,
    context: {
      reading: {
        id: "mode-reading",
        createdAt: "2026-08-12T20:00:00.000Z",
        intentId: "decisao",
        intentLabel: "Decisão",
        question,
        cards: selectedCards.map((card, index) => ({
          slug: card.slug,
          position: { id: positions[index].id },
        })),
      },
    },
  });
}

function groundedModeReading(normalized, synthesis) {
  const names = normalized.reading.canonical.cards.map((card) => card.name);
  return {
    responseMode: "reading",
    title: "A proposta cobra uma medida real",
    opening: "Aceitar a proposta exige separar o medo de perder estabilidade do ganho que existe de fato.",
    sections: [{
      id: "mesa-inteira",
      title: "O corte desta escolha",
      text: `${names[0]} abre a possibilidade, ${names[1]} exige critério e ${names[2]} encerra o formato antigo sem prometer resultado.`,
      cardSlugs: [...normalized.reading.cardSlugs],
    }],
    synthesis,
    groundedAction: "Compare por escrito proposta, estabilidade e custo antes de responder.",
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

test("a chave oferece três posturas válidas e normaliza entradas desconhecidas", () => {
  assert.deepEqual(agent911ReadingModes.map((mode) => mode.id), [
    "acolhedora",
    "direta",
    "sem_rodeios",
  ]);
  assert.equal(normalizeAgent911ReadingMode("SEM_RODEIOS"), "sem_rodeios");
  assert.equal(normalizeAgent911ReadingMode("qualquer-coisa"), "acolhedora");
});

test("o servidor distingue pergunta binária de pergunta aberta e protege fatos ocultos", () => {
  assert.deepEqual(classifyAgent911Question("Devo aceitar esta proposta?"), {
    binary: true,
    protectedFact: false,
  });
  assert.deepEqual(classifyAgent911Question("O que preciso observar antes de aceitar?"), {
    binary: false,
    protectedFact: false,
  });
  assert.deepEqual(classifyAgent911Question("Ele está me traindo e mentindo sobre outra pessoa?"), {
    binary: true,
    protectedFact: true,
  });
});

test("cada postura vira contrato real dentro do pedido ao modelo", () => {
  const question = "Devo aceitar a proposta mesmo com medo de perder estabilidade?";
  const soft = normalizeQuestion(question, "acolhedora");
  const direct = normalizeQuestion(question, "direta");
  const blunt = normalizeQuestion(question, "sem_rodeios");

  assert.equal(buildAgent911ReadingStyleContract(soft).mode, "acolhedora");
  assert.match(buildAgent911ReadingStyleContract(direct).instruction, /resposta nítida/iu);
  assert.deepEqual(buildAgent911ReadingStyleContract(blunt).requiredSynthesisOpening, [
    "Resposta da mesa: SIM.",
    "Resposta da mesa: NÃO.",
    "Resposta da mesa: INCONCLUSIVA.",
  ]);
  const modelInput = JSON.parse(buildAgent911ModelInput(blunt));
  assert.equal(modelInput.readingStyleContract.mode, "sem_rodeios");
  assert.equal(modelInput.readingStyleContract.questionShape.binary, true);
});

test("sem rodeios ganha abertura obrigatória sem fabricar um SIM ou NÃO", () => {
  const normalized = normalizeQuestion(
    "Devo aceitar a proposta mesmo com medo de perder estabilidade?",
  );
  const raw = groundedModeReading(
    normalized,
    "Aceitar faz sentido somente se a estabilidade não depender de um acordo invisível.",
  );
  const normalizedOutput = normalizeAgent911ReadingModeOutput(raw, normalized);

  assert.match(normalizedOutput.synthesis, /^Resposta da mesa: INCONCLUSIVA\./u);
  assert.equal(auditAgent911Response(normalizedOutput, normalized).ok, true);

  const explicit = normalizeAgent911ReadingModeOutput({
    ...raw,
    synthesis: "Resposta da mesa: SIM. Aceitar a proposta pode abrir espaço, desde que a estabilidade tenha critérios claros.",
  }, normalized);
  assert.match(explicit.synthesis, /^Resposta da mesa: SIM\./u);
  assert.equal(auditAgent911Response(explicit, normalized).ok, true);
});

test("alegação factual recebe INCONCLUSIVA e pergunta aberta recebe Na mesa", () => {
  const protectedQuestion = normalizeQuestion("Ele está me traindo e mentindo sobre outra pessoa?");
  const protectedOutput = normalizeAgent911ReadingModeOutput(
    groundedModeReading(
      protectedQuestion,
      "Resposta da mesa: SIM. Existe tensão suficiente para desconfiar.",
    ),
    protectedQuestion,
  );
  assert.match(protectedOutput.synthesis, /^Resposta da mesa: INCONCLUSIVA\./u);

  const openQuestion = normalizeQuestion("O que preciso compreender antes de escolher?");
  const openOutput = normalizeAgent911ReadingModeOutput(
    groundedModeReading(openQuestion, "A escolha cobra uma medida concreta."),
    openQuestion,
  );
  assert.match(openOutput.synthesis, /^Na mesa:/u);
});
