import assert from "node:assert/strict";
import test from "node:test";
import { agent911Config } from "../src/config/agent911.js";
import {
  Agent911Error,
  createTarotAgentContext,
  requestAgent911,
  serializeAgent911Reading,
} from "../src/lib/agent911.js";
import { tarotCards } from "../src/data/tarot.js";
import { buildCompleteSpreadFromSelections } from "../src/lib/reading.js";

const opening = [tarotCards[0], tarotCards[11], tarotCards[21]];
const complete = buildCompleteSpreadFromSelections(
  opening,
  [tarotCards[2], tarotCards[8], tarotCards[16], tarotCards[19]],
);
const context = createTarotAgentContext({
  cards: complete,
  intentId: "caminhos",
  intentLabel: "Caminhos",
  question: "Qual movimento pede coragem agora?",
  createdAt: "2026-08-11T12:00:00.000Z",
});

test("o contexto seguro do Agente 911 preserva pergunta, posições e guardrails", () => {
  assert.equal(context.experience, "tarot.horseshoe.v1");
  assert.equal(context.reading.cards.length, 7);
  assert.equal(context.reading.cards[0].position.id, "past");
  assert.equal(context.reading.cards[5].position.id, "action");
  assert.equal(context.reading.question, "Qual movimento pede coragem agora?");
  assert.equal(context.guardrails.preserveUserAgency, true);
  assert.equal(agent911Config.offer.isVisible, false);
  assert.equal(agent911Config.offer.isCheckoutEnabled, false);
  assert.equal(agent911Config.offer.questionLimit, 3);
  assert.equal(agent911Config.enabled, true);
  assert.equal(agent911Config.mode, "local");
  assert.equal(agent911Config.remoteEnabled, false);
});

test("o cliente do Agente 911 fica desligado até ativação explícita", async () => {
  await assert.rejects(
    requestAgent911(context, { enabled: false }),
    (error) => error instanceof Agent911Error && error.code === "agent_disabled",
  );
});

test("o modo local não chama a API nem cria custo por leitura", async () => {
  let fetchWasCalled = false;
  await assert.rejects(
    requestAgent911(context, {
      enabled: true,
      remoteEnabled: false,
      fetchImplementation: async () => { fetchWasCalled = true; },
    }),
    (error) => error instanceof Agent911Error && error.code === "remote_disabled",
  );
  assert.equal(fetchWasCalled, false);
});

test("a futura chamada usa endpoint próprio sem chave de provedor no navegador", async () => {
  let captured;
  const response = await requestAgent911(context, {
    enabled: true,
    remoteEnabled: true,
    endpoint: "/api/agent-911",
    fetchImplementation: async (url, options) => {
      captured = { url, options };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          answer: "A resposta considera o desenho completo da Ferradura.",
          reading: {
            responseMode: "reading",
            title: "O movimento inteiro",
            opening: "As sete posições formam uma narrativa única.",
            sections: [{
              id: "terrain",
              title: "O terreno",
              text: "A origem conversa com o movimento possível sem transformar tendência em sentença.",
              cardSlugs: [complete[0].slug, complete[1].slug],
            }],
            synthesis: "A resposta considera o desenho completo da Ferradura.",
            groundedAction: "Separe o que é fato do que ainda é expectativa.",
            closingQuestion: "O que depende de você agora?",
            suggestedQuestions: [
              "O que ainda não estou nomeando?",
              "Qual limite muda essa dinâmica?",
              "O que depende realmente de mim?",
            ],
            safetyMessage: "",
            memoryUpdate: { summary: "", themes: [], people: [] },
            audit: { usedCardSlugs: complete.map((card) => card.slug), confidence: "grounded", unsupportedCertainty: false },
          },
          followUps: ["O que muda se eu sustentar esse limite?"],
          conversationId: "conversation-911",
          questionsRemaining: 3,
        }),
      };
    },
  });

  assert.equal(captured.url, "/api/agent-911");
  assert.equal(captured.options.credentials, "same-origin");
  assert.equal(captured.options.headers.Authorization, undefined);
  const requestBody = JSON.parse(captured.options.body);
  assert.equal(requestBody.context.reading.cards.length, 7);
  assert.equal(requestBody.action, "initial_reading");
  assert.equal(requestBody.memoryConsent, false);
  assert.match(response.answer, /Ferradura/);
  assert.equal(response.followUps.length, 1);
  assert.match(serializeAgent911Reading(response.reading), /O terreno/);
});
