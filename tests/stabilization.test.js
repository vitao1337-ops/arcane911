import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

function source(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

test("DEV não contém target silencioso de produção e exige opt-in de IA real", () => {
  const vite = source("../vite.config.js");
  const config = source("../src/config/agent911.js");
  const astroConfig = source("../src/config/astro911.js");
  const astroClient = source("../src/lib/astro911.js");
  const summary = source("../src/components/Agent911Summary.jsx");
  const consultation = source("../src/components/Agent911Consultation.jsx");

  assert.match(vite, /ARCANE911_DEV_REAL_AI/);
  assert.match(vite, /ARCANE911_DEV_API_TARGET explícito/);
  assert.match(vite, /Sem opt-in não existe proxy/);
  assert.doesNotMatch(vite, /https:\/\/arcane911\.vercel\.app/);
  assert.match(config, /isDevelopment && !devRealAiEnabled \? "mock" : "live"/);
  assert.match(astroConfig, /isDevelopment && !devRealAiEnabled \? "mock" : "live"/);
  assert.match(astroClient, /import\("\.\/astro911Fallback"\)/);
  assert.match(summary, /if \(import\.meta\.env\.DEV && agent911Config\.devMockEnabled\)/);
  assert.match(consultation, /if \(import\.meta\.env\.DEV && agent911Config\.devMockEnabled\)/);
});

test("a cascata mobile termina no footer de uma coluna e hero-caption tem um único override", () => {
  const styles = source("../src/styles.css");
  const footerColumns = [...styles.matchAll(
    /(?:^|\n)\s*footer\s*\{[^}]*grid-template-columns:\s*([^;]+);/gu,
  )].map((match) => match[1].trim());
  const heroWhiteSpaceRules = [...styles.matchAll(/\.hero-caption\s*\{[^}]*white-space:/gu)];

  assert.ok(footerColumns.includes("1fr auto"));
  assert.equal(footerColumns.at(-1), "1fr");
  assert.equal(heroWhiteSpaceRules.length, 1);
  assert.doesNotMatch(styles, /!important/);
});

test("a limpeza preserva infraestrutura futura e remove somente candidatos sem uso", () => {
  const styles = source("../src/styles.css");
  const reading = source("../src/lib/reading.js");
  const agent = source("../src/lib/agent911.js");
  const memory = source("../src/lib/agent911Memory.js");
  const app = source("../src/App.jsx");

  [
    "agent911-bridge",
    "agent911-mark",
    "agent911-copy",
    "agent911-readiness",
    "complete-synthesis-card",
    "--cream-light",
    "--champagne",
    "--violet-black",
    "--lilac",
    "--rose",
    "--glass:",
    "--glass-strong",
  ].forEach((candidate) => assert.equal(styles.includes(candidate), false, candidate));

  assert.doesNotMatch(reading, /pickSpread|buildCompleteSpread\s*\(|mulberry32/);
  assert.doesNotMatch(agent, /createAstrologyAgentContext/);
  assert.match(memory, /Infraestrutura reservada/);
  assert.match(app, /deck-order/);
  assert.match(styles, /\.deck-order strong/);
});
