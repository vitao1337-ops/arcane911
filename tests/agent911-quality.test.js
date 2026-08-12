import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { tarotCards } from "../src/data/tarot.js";
import {
  buildAgent911Fallback,
  buildAgent911FollowUpFallback,
  extractAgent911QuestionTerms,
} from "../src/lib/agent911Fallback.js";
import { buildCanonicalReading } from "../server/tarot-canon.js";

const opening = [tarotCards[16], tarotCards[18], tarotCards[21]];
const complete = [
  tarotCards[16],
  tarotCards[18],
  tarotCards[15],
  tarotCards[12],
  tarotCards[11],
  tarotCards[21],
  tarotCards[17],
];
const cases = [
  { intentId: "amor", question: "Estou entre retomar um relacionamento que me desgastou e seguir em frente. O que preciso enxergar?" },
  { intentId: "trabalho", question: "Por que continuo adiando uma mudança de carreira que eu desejo há anos?" },
  { intentId: "caminhos", question: "Como colocar limite numa amizade que me suga sem agir por culpa?" },
  { intentId: "interior", question: "O que está bloqueando minha vontade de criar um projeto que importa para mim?" },
  { intentId: "decisao", question: "Vale aceitar uma proposta que paga mais, mas pode tirar minha paz?" },
];

function interpretationText(reading) {
  return [
    reading.title,
    ...(reading.sections ?? []).map((section) => section.text),
    reading.synthesis,
    reading.groundedAction,
  ].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function assertQuestionIsReflected(reading, question) {
  const text = interpretationText(reading);
  const terms = extractAgent911QuestionTerms(question);
  assert.ok(terms.some((term) => text.includes(term)), `leitura não refletiu nenhum termo concreto: ${terms.join(", ")}`);
}

test("o motor local muda título, síntese e ação quando a pergunta muda", () => {
  const readings = cases.map((item) => buildAgent911Fallback({
    cards: opening,
    ...item,
    variant: "opening",
  }));

  assert.equal(new Set(readings.map((reading) => reading.title)).size, cases.length);
  assert.equal(new Set(readings.map((reading) => reading.synthesis)).size, cases.length);
  assert.equal(new Set(readings.map((reading) => reading.groundedAction)).size, cases.length);
  readings.forEach((reading, index) => assertQuestionIsReflected(reading, cases[index].question));
});

test("perguntas diferentes de amor não viram a mesma leitura com outra frase entre aspas", () => {
  const questions = [
    "Por que ele se afastou quando a relação começou a ficar séria?",
    "Ela quer voltar ou eu estou alimentando expectativa sozinho?",
    "Como colocar limite sem transformar toda conversa em briga?",
    "Ainda existe reciprocidade ou só saudade entre nós?",
    "O medo de perder está me fazendo aceitar pouco?",
    "Devo seguir em frente depois de tantas promessas quebradas?",
  ];
  const readings = questions.map((question) => buildAgent911Fallback({
    cards: opening,
    intentId: "amor",
    question,
    variant: "opening",
  }));

  assert.equal(new Set(readings.map((reading) => reading.synthesis)).size, questions.length);
  assert.ok(new Set(readings.map((reading) => reading.title)).size >= 4);
  readings.forEach((reading, index) => assertQuestionIsReflected(reading, questions[index]));
});

test("a Ferradura local usa sete cartas sem voltar ao antigo molde monótono", () => {
  const readings = cases.map((item) => buildAgent911Fallback({
    cards: complete,
    ...item,
    variant: "complete",
  }));

  assert.equal(new Set(readings.map((reading) => reading.synthesis)).size, cases.length);
  readings.forEach((reading, index) => {
    assert.deepEqual(reading.audit.usedCardSlugs, complete.map((card) => card.slug));
    complete.forEach((card) => assert.match(`${reading.sections[0].text} ${reading.synthesis}`, new RegExp(card.name)));
    assertQuestionIsReflected(reading, cases[index].question);
    assert.doesNotMatch(reading.title, /Sua pergunta não pede pressa|O centro da sua pergunta já mudou/);
  });
});

test("aprofundamentos locais respondem ao texto atual em vez de repetir uma fórmula", () => {
  const readings = cases.map((item) => buildAgent911FollowUpFallback({
    cards: complete,
    message: item.question,
    question: "O que preciso enxergar?",
    intentId: item.intentId,
  }));

  assert.equal(new Set(readings.map((reading) => reading.title)).size, cases.length);
  assert.equal(new Set(readings.map((reading) => reading.synthesis)).size, cases.length);
  assert.equal(new Set(readings.map((reading) => reading.groundedAction)).size, cases.length);
  readings.forEach((reading, index) => assertQuestionIsReflected(reading, cases[index].question));
});

test("o cânone envia somente as relações decisivas para o modelo", () => {
  const openingCanon = buildCanonicalReading(opening.map((card) => card.slug), "amor", "tarot.opening.v1");
  const completeCanon = buildCanonicalReading(complete.map((card) => card.slug), "amor", "tarot.horseshoe.v1");
  assert.equal(openingCanon.relationships.length, 3);
  assert.equal(completeCanon.relationships.length, 6);
  assert.ok(completeCanon.relationships.some((relation) => relation.cards.includes(complete[5].slug)));
});

test("falha do modo conectado não consome uma das três perguntas", () => {
  const component = readFileSync(fileURLToPath(new URL("../src/components/Agent911Consultation.jsx", import.meta.url)), "utf8");
  assert.match(component, /setTemporaryResult\(resultFromFallback/);
  assert.match(component, /question_consumed:\s*false/);
  assert.doesNotMatch(component, /catch[^}]+setResponses\(nextResponses\)/s);
});
