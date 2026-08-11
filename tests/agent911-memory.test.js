import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAgent911MemoryUpdate,
  forgetAgent911Memory,
  hasAgent911MemoryConsent,
  hasRememberedAgent911Context,
  loadAgent911Conversation,
  loadAgent911Memory,
  saveAgent911Conversation,
  setAgent911MemoryConsent,
} from "../src/lib/agent911Memory.js";

class MemoryStorage {
  #values = new Map();

  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
}

test("a memória só é gravada depois de consentimento explícito", () => {
  const storage = new MemoryStorage();
  const update = { summary: "A pessoa está avaliando um limite.", themes: ["limite"], people: ["Aline"] };
  const reading = {
    createdAt: "2026-08-11T12:00:00.000Z",
    intentLabel: "Amor",
    question: "O que preciso reconhecer?",
    cards: ["o-louco", "a-justica", "o-mundo"],
    insight: "Separar fato de expectativa.",
  };

  assert.equal(applyAgent911MemoryUpdate(update, reading, storage), null);
  assert.equal(hasRememberedAgent911Context(storage), false);

  setAgent911MemoryConsent(true, storage);
  const saved = applyAgent911MemoryUpdate(update, reading, storage);
  assert.equal(hasAgent911MemoryConsent(storage), true);
  assert.equal(saved.summary, update.summary);
  assert.deepEqual(saved.people, ["Aline"]);
  assert.equal(loadAgent911Memory(storage).recentReadings.length, 1);
});

test("a pessoa pode apagar integralmente lembranças e consentimento", () => {
  const storage = new MemoryStorage();
  setAgent911MemoryConsent(true, storage);
  applyAgent911MemoryUpdate(
    { summary: "Contexto privado", themes: ["decisão"], people: [] },
    null,
    storage,
  );

  assert.equal(hasRememberedAgent911Context(storage), true);
  assert.equal(forgetAgent911Memory(storage), true);
  assert.equal(hasAgent911MemoryConsent(storage), false);
  assert.equal(hasRememberedAgent911Context(storage), false);
});

test("o histórico da conversa é limitado e sanitizado por leitura", () => {
  const storage = new MemoryStorage();
  const history = Array.from({ length: 12 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user",
    content: `Mensagem ${index}`,
  }));

  assert.equal(saveAgent911Conversation("reading-1", history, storage), true);
  const loaded = loadAgent911Conversation("reading-1", storage);
  assert.equal(loaded.length, 8);
  assert.equal(loaded[0].content, "Mensagem 4");
  assert.equal(loadAgent911Conversation("outra-reading", storage).length, 0);
});
