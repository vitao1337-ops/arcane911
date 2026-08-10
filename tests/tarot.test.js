import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { intents, tarotCards } from "../src/data/tarot.js";
import { salesConfig } from "../src/config/sales.js";
import { buildCheckoutUrl, isCheckoutConfigured } from "../src/lib/checkout.js";
import { buildSynthesis, cardReading, formatReading, pickSpread } from "../src/lib/reading.js";

const expectedOrder = [
  "O Louco",
  "O Mago",
  "A Sacerdotisa",
  "A Imperatriz",
  "O Imperador",
  "O Hierofante",
  "Os Enamorados",
  "O Carro",
  "A Força",
  "O Eremita",
  "A Roda da Fortuna",
  "A Justiça",
  "O Enforcado",
  "A Morte",
  "A Temperança",
  "O Diabo",
  "A Torre",
  "A Estrela",
  "A Lua",
  "O Sol",
  "O Julgamento",
  "O Mundo",
];

test("o baralho mantém os 22 Arcanos Maiores na ordem definida", () => {
  assert.equal(tarotCards.length, 22);
  assert.deepEqual(tarotCards.map((card) => card.name), expectedOrder);
  assert.deepEqual(tarotCards.map((card) => card.index), [...Array(22).keys()]);
});

test("slugs e imagens são únicos e todos os arquivos existem", () => {
  assert.equal(new Set(tarotCards.map((card) => card.slug)).size, 22);
  assert.equal(new Set(tarotCards.map((card) => card.image)).size, 22);

  tarotCards.forEach((card) => {
    const imagePath = fileURLToPath(new URL(`../public${card.image}`, import.meta.url));
    assert.equal(existsSync(imagePath), true, `Imagem ausente: ${card.image}`);
  });
});

test("um embaralhamento sempre entrega três cartas distintas e é reproduzível", () => {
  const first = pickSpread("uma pergunta importante");
  const second = pickSpread("uma pergunta importante");

  assert.equal(first.length, 3);
  assert.equal(new Set(first.map((card) => card.slug)).size, 3);
  assert.deepEqual(first.map((card) => card.slug), second.map((card) => card.slug));
});

test("as leituras têm luz, sombra, ação e síntese contextual", () => {
  const cards = [tarotCards[0], tarotCards[11], tarotCards[21]];
  const reading = cardReading(cards[0], "root");
  const synthesis = buildSynthesis(cards, "decisao");

  assert.match(reading, /O Louco/);
  assert.match(synthesis, /decisão/);
  cards.forEach((card) => {
    assert.ok(card.message.length > 80);
    assert.ok(card.shadow.length > 45);
    assert.ok(card.action.length > 45);
  });
});

test("o texto compartilhável contém pergunta, três posições e síntese", () => {
  const cards = [tarotCards[2], tarotCards[8], tarotCards[17]];
  const text = formatReading({
    cards,
    intentId: intents[0].id,
    intentLabel: intents[0].label,
    question: "O que precisa ganhar forma?",
    createdAt: "2026-08-10T12:00:00.000Z",
  });

  assert.match(text, /A raiz/);
  assert.match(text, /O espelho/);
  assert.match(text, /O movimento/);
  assert.match(text, /Síntese/);
});

test("a oferta comercial fica configurável sem acoplar um provedor de pagamento", () => {
  assert.equal(isCheckoutConfigured(""), false);
  assert.equal(isCheckoutConfigured("/checkout"), false);
  assert.equal(isCheckoutConfigured("https://pay.exemplo.com/arcane911"), true);
  assert.equal(salesConfig.offer.features.length, 4);

  const url = new URL(
    buildCheckoutUrl("https://pay.exemplo.com/arcane911", {
      product_id: "leitura-profunda",
      intent: "amor",
      cards: "o-louco,a-estrela,o-mundo",
    }),
  );

  assert.equal(url.searchParams.get("product_id"), "leitura-profunda");
  assert.equal(url.searchParams.get("intent"), "amor");
  assert.equal(url.searchParams.get("cards"), "o-louco,a-estrela,o-mundo");
});
