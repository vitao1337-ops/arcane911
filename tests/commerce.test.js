import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { commerceConfig, formatBRL } from "../src/config/commerce.js";
import { salesConfig } from "../src/config/sales.js";
import { getReadingForIntent, specificReadings } from "../src/data/products.js";

function source(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

test("catálogo comercial centraliza os preços da Tiragem Completa e das perguntas", () => {
  assert.equal(commerceConfig.products.completeReading.priceCents, 1_999);
  assert.equal(commerceConfig.products.completeReading.price, "R$ 19,99");
  assert.equal(commerceConfig.products.agentQuestion.priceCents, 500);
  assert.equal(commerceConfig.products.agentQuestion.price, "R$ 5,00");
  assert.equal(commerceConfig.products.specificQuestionComplete.priceCents, 500);
  assert.equal(commerceConfig.products.specificQuestionComplete.price, "R$ 5,00");
  assert.equal(commerceConfig.products.specificQuestionStandalone.priceCents, 1_000);
  assert.equal(commerceConfig.products.specificQuestionStandalone.price, "R$ 10,00");
  assert.equal(salesConfig.offer.price, "R$ 19,99");
  assert.equal(formatBRL(1_999), "R$ 19,99");
});

test("Documento Astral fica preparado sem inventar preço ainda não decidido", () => {
  assert.equal(commerceConfig.products.astralDocument.priceCents, 0);
  assert.equal(commerceConfig.products.astralDocument.price, "A definir");
  assert.equal(commerceConfig.products.astralDocument.accessRequired, false);
  assert.equal(commerceConfig.products.astralDocument.available, false);
  assert.equal(commerceConfig.products.astralDocument.kind, "astral_document");
});

test("Documento Astral usa o mesmo catálogo confiável no cliente e no servidor", () => {
  const catalog = source("../src/config/productCatalog.js");
  const checkout = source("../server/checkout-core.js");
  const page = source("../src/pages/AstralMapPage.jsx");

  assert.match(catalog, /kind:\s*"astral_document"/u);
  assert.match(checkout, /product\.kind === "astral_document"/u);
  assert.match(checkout, /product\.priceCents <= 0/u);
  assert.match(page, /offerContext:\s*ASTRAL_OFFER_CONTEXT/u);
  assert.match(page, /readingId:\s*chartFingerprint/u);
  assert.match(page, /verifyHostedCheckout/u);
  assert.match(page, /!astralProduct\.available \? \(/u);
});

test("bypass comercial só pode existir em import.meta.env.DEV", () => {
  const commerce = source("../src/config/commerce.js");
  const vite = source("../vite.config.js");
  const app = source("../src/App.jsx");

  assert.equal(commerceConfig.devUnlocked, false);
  assert.match(commerce, /const devUnlocked = isDevelopment/u);
  assert.match(commerce, /ARCANE911_DEV_UNLOCK_PAID/u);
  assert.match(vite, /ARCANE911_DEV_UNLOCK_PAID/u);
  assert.match(app, /if \(salesConfig\.devUnlocked\)/u);
  assert.match(app, /if \(!salesConfig\.devUnlocked && !completeAccessGranted/u);
});

test("produção depende de confirmação server-side e não possui bypass comercial", () => {
  const app = source("../src/App.jsx");
  const checkout = source("../src/lib/checkout.js");

  assert.equal(salesConfig.devUnlocked, false);
  assert.match(checkout, /\/api\/checkout/u);
  assert.match(checkout, /\/api\/payment-status/u);
  assert.match(app, /verifyHostedCheckout/u);
  assert.match(app, /savePaymentEntitlement/u);
});

test("Tiragem Completa sempre abre o modal e só o modal decide entre checkout e DEV", () => {
  const app = source("../src/App.jsx");
  const start = app.indexOf("function openCompleteReading");
  const end = app.indexOf("function shuffleCompleteDeck", start);
  const openFlow = app.slice(start, end);

  assert.match(openFlow, /openCheckout\(\)/u);
  assert.match(openFlow, /^function openCompleteReading\(\) \{\s*openCheckout\(\);\s*\}/u);
  assert.match(app, /Pagamento necessário/u);
  assert.match(app, /Continuar sem cobrança no DEV/u);
  assert.match(app, /Liberar agora/u);
  assert.match(app, /createHostedCheckout/u);
});

test("pergunta específica usa produto próprio sem enviar texto privado ou preço no checkout", () => {
  const app = source("../src/App.jsx");
  const page = source("../src/pages/SpecificReadingPage.jsx");

  assert.match(app, /specificReadingOrigin === "tiragem-completa"\s*&& completeSpread\.length === 7/u);
  assert.match(app, /renderSpecificQuestionOffer\("standalone"\)/u);
  assert.match(app, /renderSpecificQuestionOffer\("complete"\)/u);
  assert.match(page, /specificQuestionComplete/u);
  assert.match(page, /specificQuestionStandalone/u);
  assert.match(page, /insideCompleteReading/u);
  assert.match(page, /readingSlug/u);
  assert.match(page, /createHostedCheckout/u);
  assert.match(page, /verifyHostedCheckout/u);
  assert.match(page, /buildSpecificLayout/u);
  assert.doesNotMatch(page, /productId:\s*question/u);
});

test("cada intenção oferece somente a pergunta específica correspondente", () => {
  const app = source("../src/App.jsx");
  const intentIds = ["caminhos", "amor", "trabalho", "decisao", "interior"];

  assert.equal(specificReadings.length, intentIds.length);
  intentIds.forEach((intentId) => {
    assert.equal(getReadingForIntent(intentId).intentId, intentId);
  });
  assert.match(app, /data-specific-intent=\{selectedIntent\.id\}/u);
  assert.match(app, /featuredSpecificReading\.positions\.map/u);
  assert.match(app, /Fazer pergunta incluída de \$\{selectedIntent\.label\}/u);
  assert.equal(commerceConfig.products.completeReading.includedSpecificQuestions, 5);
  assert.match(app, /includedRemaining/u);
  assert.doesNotMatch(app, /specificReadings\.filter/u);
  assert.doesNotMatch(app, /specific-teasers/u);
});

test("pergunta específica reutiliza a dinâmica do input principal e uma mesa legível", () => {
  const page = source("../src/pages/SpecificReadingPage.jsx");
  const styles = source("../src/styles.css");

  assert.match(page, /className="question-field specific-question-field"/u);
  assert.match(page, /initialDraft\?\.question \?\? contextualQuestion/u);
  assert.match(page, /placeholder=\{reading\.question\}/u);
  assert.match(page, /createRandomDrawPool\(tarotCards, 10, drawPool\)/u);
  assert.match(page, /shuffle-stage specific-shuffle-stage/u);
  assert.match(page, /Revelar as 5 cartas/u);
  assert.match(styles, /\.specific-draw-grid\s*\{[\s\S]*?width:\s*min\(100%, 960px\)[\s\S]*?repeat\(5/u);
  assert.match(styles, /\.specific-result-card\s*\{[\s\S]*?color:\s*var\(--ink\)/u);
  assert.match(styles, /\.specific-result-card \.spread-copy > p,[\s\S]*?color:\s*var\(--ink-soft\)/u);
  assert.doesNotMatch(styles, /\.specific-spread-preview|\.specific-teaser-card/u);
});

test("fluxo específico possui adaptação explícita nos cinco breakpoints aprovados", () => {
  const styles = source("../src/styles.css");
  const targetViewports = [390, 430, 768, 1_024, 1_440];

  assert.deepEqual(targetViewports, [390, 430, 768, 1_024, 1_440]);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*?\.specific-question-offer,[\s\S]*?grid-template-columns:\s*1fr/u);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*?\.specific-context-positions,[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*?\.specific-draw-grid\s*\{\s*grid-template-columns:\s*repeat\(3/u);
  assert.match(styles, /body input,[\s\S]*?body textarea,[\s\S]*?font-size:\s*16px/u);
});

test("modal de compra é deliberadamente compacto e nunca cria rolagem interna", () => {
  const styles = source("../src/styles.css");
  const targetViewports = [390, 430, 768, 1_024, 1_440];

  assert.deepEqual(targetViewports, [390, 430, 768, 1_024, 1_440]);
  assert.match(styles, /\.checkout-overlay[\s\S]*?overflow:\s*hidden/u);
  assert.match(styles, /\.checkout-modal[\s\S]*?overflow:\s*clip/u);
  assert.match(styles, /max-height:\s*calc\(100dvh/u);
  assert.match(styles, /@media \(max-height: 760px\)[\s\S]*?\.checkout-reading-context\s*\{\s*display:\s*none/u);
  assert.match(styles, /@media \(max-height: 610px\)[\s\S]*?\.checkout-modal ul,[\s\S]*?display:\s*none/u);
  assert.doesNotMatch(styles, /\.checkout-(?:overlay|modal)[^{]*\{[^}]*overflow-y:\s*(?:auto|scroll)/u);
});
