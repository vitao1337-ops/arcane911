import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

function source(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

test("landing mantém Tarot primeiro e transforma os 22 Arcanos em bloco recolhível", () => {
  const app = source("../src/App.jsx");
  const ritual = app.indexOf("{renderRitualSection()}");
  const astral = app.indexOf('id="mapa-astral"');
  const deck = app.indexOf('id="baralho"');
  assert.ok(ritual > 0 && astral > ritual && deck > astral);
  assert.match(app, /deckOpen/u);
  assert.match(app, /aria-expanded=\{deckOpen\}/u);
  assert.match(app, /Explorar os 22 Arcanos/u);
});

test("Documento Astral não revela mapa antes da autorização paga", () => {
  const page = source("../src/pages/AstralMapPage.jsx");
  assert.match(page, /chart && !astralAccessGranted/u);
  assert.match(page, /chart && astralAccessGranted/u);
  assert.match(page, /O mapa só abre após o pagamento/u);
  assert.match(page, /proceedToAstralCheckout\(nextChart\)/u);
  assert.doesNotMatch(page, /O cálculo básico permanece disponível/u);
});

test("oferta astral comunica entrega imediata, síntese humana e cinco perguntas", () => {
  const app = source("../src/App.jsx");
  const page = source("../src/pages/AstralMapPage.jsx");
  assert.match(app, /Mapa completo \+ leitura automática do 911/u);
  assert.match(app, /1–2 dias úteis/u);
  assert.match(app, /5 perguntas específicas/u);
  assert.match(page, /revisada por um astrólogo/u);
  assert.match(page, /incluedSpecificQuestions|includedSpecificQuestions/u);
});


test("preço do Documento Astral fica fora da landing e do pré-checkout", () => {
  const app = source("../src/App.jsx");
  const page = source("../src/pages/AstralMapPage.jsx");
  assert.doesNotMatch(app, /Documento Astral · \{commerceConfig\.products\.astralDocument\.price\}/u);
  assert.equal(page.includes("Continuar para pagamento · ${product.price}"), false);
  assert.equal(page.includes("Continuar para pagamento · ${astralProduct.price}"), false);
  assert.doesNotMatch(page, /<strong>\{astralProduct\.price\} · pagamento único\.<\/strong>/u);
  assert.match(page, /Seu nascimento deixou uma assinatura no céu/u);
  assert.match(page, /5 perguntas sobre o seu próprio mapa/u);
});
