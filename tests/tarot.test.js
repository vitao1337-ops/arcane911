import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { completePositions, intents, tarotCards } from "../src/data/tarot.js";
import { salesConfig } from "../src/config/sales.js";
import { buildCheckoutUrl, isCheckoutConfigured } from "../src/lib/checkout.js";
import {
  buildCompleteSpreadFromSelections,
  buildCompleteSynthesis,
  buildSynthesis,
  cardReading,
  completeCardReading,
  createRandomDrawPool,
  formatCompleteReading,
  formatReading,
} from "../src/lib/reading.js";

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

function seededRandom(seed = 1) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

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

test("a mesa manual usa Fisher–Yates e muda de verdade entre embaralhadas", () => {
  const random = seededRandom(911);
  const first = createRandomDrawPool(tarotCards, 9, [], random);
  const second = createRandomDrawPool(tarotCards, 9, first, random);
  const firstSlugs = new Set(first.map((card) => card.slug));
  const overlap = second.filter((card) => firstSlugs.has(card.slug)).length;
  const samePositions = second.filter((card, index) => card.slug === first[index]?.slug).length;

  assert.equal(first.length, 9);
  assert.equal(second.length, 9);
  assert.equal(new Set(first.map((card) => card.slug)).size, 9);
  assert.equal(new Set(second.map((card) => card.slug)).size, 9);
  assert.ok(overlap <= 4, `sobreposição excessiva: ${overlap}`);
  assert.ok(samePositions <= 1, `cartas presas à mesma posição: ${samePositions}`);
  assert.deepEqual(tarotCards.map((card) => card.name), expectedOrder);
});

test("o segundo baralho preserva os três Arcanos e evita uma mesa quase idêntica", () => {
  const opening = [tarotCards[0], tarotCards[11], tarotCards[21]];
  const openingSlugs = new Set(opening.map((card) => card.slug));
  const remaining = tarotCards.filter((card) => !openingSlugs.has(card.slug));
  const random = seededRandom(1911);
  const first = createRandomDrawPool(remaining, 12, [], random);
  const second = createRandomDrawPool(remaining, 12, first, random);
  const firstSlugs = new Set(first.map((card) => card.slug));
  const overlap = second.filter((card) => firstSlugs.has(card.slug)).length;
  const samePositions = second.filter((card, index) => card.slug === first[index]?.slug).length;

  assert.equal(new Set(second.map((card) => card.slug)).size, 12);
  assert.equal(second.some((card) => openingSlugs.has(card.slug)), false);
  assert.ok(overlap <= 8, `sobreposição excessiva: ${overlap}`);
  assert.ok(samePositions <= 1, `cartas presas à mesma posição: ${samePositions}`);
});

test("a segunda mesa monta a Ferradura com quatro escolhas manuais", () => {
  const opening = [tarotCards[0], tarotCards[11], tarotCards[21]];
  const selected = [tarotCards[2], tarotCards[8], tarotCards[16], tarotCards[19]];
  const complete = buildCompleteSpreadFromSelections(opening, selected);

  assert.equal(completePositions.length, 7);
  assert.deepEqual(
    completePositions.map((position) => position.id),
    ["past", "present", "hidden", "obstacle", "external", "action", "outcome"],
  );
  assert.equal(complete.length, 7);
  assert.equal(new Set(complete.map((card) => card.slug)).size, 7);
  assert.deepEqual(
    complete.map((card) => card.slug),
    [opening[0], opening[1], selected[0], selected[1], selected[2], opening[2], selected[3]].map((card) => card.slug),
  );
  assert.deepEqual(buildCompleteSpreadFromSelections(opening, [selected[0], selected[0], selected[1], selected[2]]), []);
  assert.deepEqual(buildCompleteSpreadFromSelections(opening, [opening[0], ...selected.slice(0, 3)]), []);
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

test("a leitura completa cobre as sete posições, integração e síntese", () => {
  const opening = [tarotCards[2], tarotCards[8], tarotCards[17]];
  const selected = [tarotCards[3], tarotCards[9], tarotCards[15], tarotCards[20]];
  const cards = buildCompleteSpreadFromSelections(opening, selected);
  const synthesis = buildCompleteSynthesis(cards, "caminhos");
  const text = formatCompleteReading({
    cards,
    intentId: intents[0].id,
    intentLabel: intents[0].label,
    question: "O que precisa ganhar forma?",
    createdAt: "2026-08-10T12:00:00.000Z",
  });

  assert.match(completeCardReading(cards[3], "obstacle"), /nó central/i);
  assert.match(synthesis, /travessia/i);
  completePositions.forEach((position) => {
    assert.match(text, new RegExp(position.eyebrow, "i"));
  });
  assert.match(text, /Pergunta-chave/);
  assert.match(text, /Síntese completa/);
});

test("a tiragem de sete cartas está liberada no fluxo, sem passar pelo checkout", () => {
  const appPath = fileURLToPath(new URL("../src/App.jsx", import.meta.url));
  const vercelPath = fileURLToPath(new URL("../vercel.json", import.meta.url));
  const app = readFileSync(appPath, "utf8");
  const vercel = JSON.parse(readFileSync(vercelPath, "utf8"));

  assert.match(app, /Tiragem completa liberada/);
  assert.match(app, /onClick=\{openCompleteReading\}/);
  assert.match(app, /navigate\("\/tiragem-completa"\)/);
  assert.match(app, /isCompleteRoute \? renderCompleteRoute\(\)/);
  assert.match(app, /saveReadingSession/);
  assert.match(app, /A Ferradura de 7 cartas/);
  assert.match(app, /Segundo baralho/);
  assert.match(app, /completeSelectedCards.length !== 4/);
  assert.match(app, /renderCompleteSpecificTeasers/);
  assert.doesNotMatch(app, /buildCompleteSpread[(]/);
  assert.deepEqual(vercel.rewrites, [{ source: "/(.*)", destination: "/index.html" }]);
});

test("a plataforma separa landing, tarot, mapa astral e produtos específicos", () => {
  const appPath = fileURLToPath(new URL("../src/App.jsx", import.meta.url));
  const mainPath = fileURLToPath(new URL("../src/main.jsx", import.meta.url));
  const productsPath = fileURLToPath(new URL("../src/data/products.js", import.meta.url));
  const app = readFileSync(appPath, "utf8");
  const main = readFileSync(mainPath, "utf8");
  const products = readFileSync(productsPath, "utf8");

  assert.match(main, /BrowserRouter/);
  ["/tiragem-gratis", "/tiragem-completa", "/mapa-astral", "/leituras/"].forEach((path) => {
    assert.match(app, new RegExp(path.replaceAll("/", "\\/")));
  });
  ["amor", "caminhos", "trabalho", "decisao"].forEach((slug) => {
    assert.match(products, new RegExp(`slug: "${slug}"`));
  });
  assert.match(app, /lazy\(\(\) => import\("\.\/pages\/AstralMapPage"\)\)/);
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

test("a landing mantém a composição completa e a centralização óptica das cartas", () => {
  const appPath = fileURLToPath(new URL("../src/App.jsx", import.meta.url));
  const stylesPath = fileURLToPath(new URL("../src/styles.css", import.meta.url));
  const app = readFileSync(appPath, "utf8");
  const styles = readFileSync(stylesPath, "utf8");

  assert.match(app, /tarotCards\.map\(\(card, index\)/);
  assert.match(app, /composição ritual 7 · 8 · 7/);
  assert.match(styles, /grid-template-columns: repeat\(16, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.deck-gallery > \.gallery-item:nth-child\(16\)/);
  assert.match(styles, /top: 7\.2%/);
  assert.match(styles, /top: 91\.15%/);
  assert.match(styles, /\.tarot-name[\s\S]*left: 50%/);
  assert.match(styles, /\.tarot-name[\s\S]*transform: translate\(-50%, -50%\)/);
  assert.match(styles, /container-type: inline-size/);
  assert.doesNotMatch(styles, /text-indent/);
  assert.match(app, /--tarot-name-scale/);
  assert.match(styles, /\.complete-horseshoe-item[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
});

test("a pergunta inicial expõe a chave de postura sem interferir nas cartas", () => {
  const appPath = fileURLToPath(new URL("../src/App.jsx", import.meta.url));
  const app = readFileSync(appPath, "utf8");

  assert.match(app, /Como o 911 deve falar\?/);
  assert.match(app, /role="switch"/);
  assert.match(app, /Sem rodeios/);
  assert.match(app, /Ligado/);
  assert.match(app, /Desligado/);
  assert.match(app, /não interferem no embaralhamento nem escolhem as cartas/);
  assert.match(app, /Não interfere no embaralhamento/);
  assert.match(app, /readingMode=\{readingMode\}/);
});

test("os campos místicos preservam o desenho sem reintroduzir efeitos pesados", () => {
  const appPath = fileURLToPath(new URL("../src/App.jsx", import.meta.url));
  const stylesPath = fileURLToPath(new URL("../src/styles.css", import.meta.url));
  const app = readFileSync(appPath, "utf8");
  const styles = readFileSync(stylesPath, "utf8");
  const mysticStyles = styles.slice(
    styles.indexOf(".mystic-field"),
    styles.indexOf(".free-reading-badge"),
  );

  assert.match(app, /className="mystic-lace"/);
  assert.match(app, /mystic-lace-constellation/);
  assert.match(app, /mystic-lace-sigil/);
  assert.match(styles, /content-visibility: auto/);
  assert.match(styles, /\.gallery-item \.gallery-card[\s\S]*animation: gallery-arrival/);
  assert.equal((mysticStyles.match(/infinite/g) ?? []).length, 2);

  [
    "mystic-panel-breathe",
    "starfield-drift",
    "mystic-field-rotate",
    "mystic-veil-cross",
    "mystic-veil-breathe",
    "constellation-float",
    "closing-symbol-breathe",
  ].forEach((removedEffect) => {
    assert.doesNotMatch(styles, new RegExp(removedEffect));
  });
});
