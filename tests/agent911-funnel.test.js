import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { completePositions, positions, tarotCards } from "../src/data/tarot.js";
import { buildAgent911Fallback } from "../src/lib/agent911Fallback.js";
import { buildCompleteSpreadFromSelections } from "../src/lib/reading.js";
import {
  auditAgent911Response,
  validateAgent911Request,
} from "../server/agent911-core.js";

const opening = [tarotCards[0], tarotCards[11], tarotCards[21]];
const complete = buildCompleteSpreadFromSelections(
  opening,
  [tarotCards[2], tarotCards[8], tarotCards[16], tarotCards[19]],
);

function summaryRequest(cards, action) {
  const layout = cards.length === 7 ? completePositions : positions;
  return {
    agent: "agent-911",
    requestId: "summary-test",
    action,
    memoryConsent: false,
    context: {
      reading: {
        id: "reading-summary-test",
        createdAt: "2026-08-11T12:00:00.000Z",
        intentId: "amor",
        intentLabel: "Amor",
        question: "Por que continuo evitando essa conversa?",
        cards: cards.map((card, index) => ({
          slug: card.slug,
          position: { id: layout[index].id },
        })),
      },
    },
  };
}

test("o resumo essencial nasce da pergunta e das cartas reais nas duas tiragens", () => {
  const free = buildAgent911Fallback({
    cards: opening,
    intentId: "amor",
    question: "Por que continuo evitando essa conversa?",
    variant: "opening",
  });
  const full = buildAgent911Fallback({
    cards: complete,
    intentId: "amor",
    question: "Por que continuo evitando essa conversa?",
    variant: "complete",
  });

  assert.match(free.opening, /evitando essa conversa/);
  opening.forEach((card) => assert.match(`${free.synthesis} ${free.sections[0].text}`, new RegExp(card.name)));
  assert.deepEqual(free.audit.usedCardSlugs, opening.map((card) => card.slug));
  complete.forEach((card) => assert.match(`${full.synthesis} ${full.sections[0].text}`, new RegExp(card.name)));
  assert.deepEqual(full.audit.usedCardSlugs, complete.map((card) => card.slug));
});

test("o fallback interrompe simbolismo quando o texto indica risco imediato", () => {
  const response = buildAgent911Fallback({
    cards: opening,
    intentId: "interior",
    question: "Estou pensando em tirar minha vida agora.",
    variant: "opening",
  });

  assert.equal(response.responseMode, "safety");
  assert.deepEqual(response.sections, []);
  assert.deepEqual(response.audit.usedCardSlugs, []);
  assert.match(response.synthesis, /ajuda humana|emergência/i);
});

test("ações compactas exigem o número certo de cartas e passam pela auditoria", () => {
  const normalized = validateAgent911Request(summaryRequest(opening, "opening_summary"));
  const response = buildAgent911Fallback({
    cards: opening,
    intentId: "amor",
    question: normalized.reading.question,
    variant: "opening",
  });

  assert.equal(normalized.action, "opening_summary");
  assert.equal(auditAgent911Response(response, normalized).ok, true);
  response.suggestedQuestions = ["Pergunta que não pertence à síntese automática."];
  assert.equal(auditAgent911Response(response, normalized).ok, true);
  assert.deepEqual(response.suggestedQuestions, []);
  assert.throws(
    () => validateAgent911Request(summaryRequest(complete, "opening_summary")),
    /exige três cartas/,
  );
  assert.throws(
    () => validateAgent911Request(summaryRequest(opening, "complete_summary")),
    /exige sete cartas/,
  );
});

test("o funil entrega uma síntese automática e só pede cadastro na consulta", () => {
  const app = readFileSync(fileURLToPath(new URL("../src/App.jsx", import.meta.url)), "utf8");
  const summary = readFileSync(fileURLToPath(new URL("../src/components/Agent911Summary.jsx", import.meta.url)), "utf8");
  const consultation = readFileSync(fileURLToPath(new URL("../src/components/Agent911Consultation.jsx", import.meta.url)), "utf8");
  const agentStyles = readFileSync(fileURLToPath(new URL("../src/agent911.css", import.meta.url)), "utf8");
  const vite = readFileSync(fileURLToPath(new URL("../vite.config.js", import.meta.url)), "utf8");

  const openingStart = app.indexOf("function renderReadingPhase");
  const openingEnd = app.indexOf("function renderCompleteSpecificTeasers");
  const openingFlow = app.slice(openingStart, openingEnd);
  const completeStart = app.indexOf("function renderCompleteReadingPhase");
  const completeEnd = app.indexOf("function renderRitualSection");
  const completeFlow = app.slice(completeStart, completeEnd);

  assert.ok(openingFlow.indexOf('renderAgent911Summary("opening")') >= 0);
  assert.ok(openingFlow.indexOf('renderAgent911Summary("opening")') < openingFlow.indexOf("conversion-gate"));
  assert.doesNotMatch(openingFlow, /specific-teasers/);
  assert.doesNotMatch(openingFlow, /Ouvir a leitura do 911/);

  const fullSummary = completeFlow.indexOf('renderAgent911Summary("complete")');
  const consultationOffer = completeFlow.indexOf("renderAgent911Consultation()");
  const focusedOffers = completeFlow.indexOf("renderCompleteSpecificTeasers()");
  assert.ok(fullSummary >= 0 && fullSummary < consultationOffer && consultationOffer < focusedOffers);

  assert.match(summary, /useEffect/);
  assert.match(summary, /opening_summary/);
  assert.match(summary, /complete_summary/);
  assert.match(summary, /catch\(\([^)]*\) =>/);
  assert.match(summary, /Nenhum texto automático foi colocado no lugar/);
  assert.doesNotMatch(summary, /setResult\(fallback\)/);
  assert.match(consultation, /Nome completo/);
  assert.match(consultation, /stage === "register"/);
  assert.doesNotMatch(agentStyles, /agent911-error/);
  assert.match(vite, /ARCANE911_DEV_API_TARGET/);
  assert.match(vite, /ARCANE911_DEV_REAL_AI/);
  assert.match(vite, /Sem opt-in não existe proxy/);
  assert.doesNotMatch(vite, /https:\/\/arcane911\.vercel\.app/);
  assert.match(vite, /"\/api"/);
});
