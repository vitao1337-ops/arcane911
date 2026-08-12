import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("o mobile bloqueia zoom de interface e evita o zoom automático de campos no iPhone", () => {
  const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
  const styles = readFileSync(fileURLToPath(new URL("../src/styles.css", import.meta.url)), "utf8");
  assert.match(html, /maximum-scale=1/);
  assert.match(html, /user-scalable=no/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(styles, /touch-action: pan-x pan-y/);
  assert.match(styles, /body input,[\s\S]*font-size: 16px/);
});

test("a interface preserva palavras inteiras e adapta os blocos estreitos", () => {
  const styles = readFileSync(fileURLToPath(new URL("../src/styles.css", import.meta.url)), "utf8");
  const agentStyles = readFileSync(fileURLToPath(new URL("../src/agent911.css", import.meta.url)), "utf8");
  assert.match(styles, /word-break: normal/);
  assert.match(styles, /hyphens: none/);
  assert.match(styles, /@media \(max-width: 410px\)[\s\S]*\.reading-mode-switch-card[\s\S]*grid-template-columns: 1fr/);
  assert.doesNotMatch(agentStyles, /overflow-wrap: anywhere/);
});
