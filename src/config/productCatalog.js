function positiveCents(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function optionalCents(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function productId(value, fallback) {
  const normalized = String(value ?? fallback).trim();
  return /^[a-z0-9][a-z0-9._-]{2,79}$/iu.test(normalized) ? normalized : fallback;
}

export function createProductCatalog(env = {}) {
  return Object.freeze({
    completeReading: Object.freeze({
      id: productId(env.VITE_COMPLETE_READING_PRODUCT_ID, "arcane911-leitura-profunda"),
      name: "Tiragem Completa",
      priceCents: positiveCents(env.VITE_COMPLETE_READING_PRICE_CENTS, 1_999),
      kind: "complete_reading",
      includedSpecificQuestions: boundedInteger(env.VITE_COMPLETE_INCLUDED_QUESTIONS, 5, 1, 5),
    }),
    agentQuestion: Object.freeze({
      id: productId(env.VITE_AGENT911_QUESTION_PRODUCT_ID, "agent911-pergunta"),
      name: "Pergunta ao 911",
      priceCents: positiveCents(env.VITE_AGENT911_QUESTION_PRICE_CENTS, 500),
      kind: "agent_question",
    }),
    specificQuestionComplete: Object.freeze({
      id: productId(
        env.VITE_SPECIFIC_QUESTION_COMPLETE_PRODUCT_ID,
        "arcane911-pergunta-especifica-completa",
      ),
      name: "Pergunta específica após a Tiragem Completa",
      priceCents: positiveCents(env.VITE_SPECIFIC_QUESTION_COMPLETE_PRICE_CENTS, 500),
      kind: "specific_complete",
    }),
    specificQuestionStandalone: Object.freeze({
      id: productId(
        env.VITE_SPECIFIC_QUESTION_STANDALONE_PRODUCT_ID,
        "arcane911-pergunta-especifica-avulsa",
      ),
      name: "Pergunta específica avulsa",
      priceCents: positiveCents(env.VITE_SPECIFIC_QUESTION_STANDALONE_PRICE_CENTS, 1_000),
      kind: "specific_standalone",
    }),
    astralDocument: Object.freeze({
      id: productId(env.VITE_ASTRO911_PRODUCT_ID, "astro911-documento-completo"),
      name: "Documento Astral 911",
      // Ticket premium padrão. A variável de ambiente continua podendo sobrescrever o valor.
      priceCents: positiveCents(env.VITE_ASTRO911_PRICE_CENTS, 11_990),
      kind: "astral_document",
      includedSpecificQuestions: 5,
    }),
  });
}

export function findCatalogProduct(catalog, productIdValue) {
  return Object.values(catalog).find((product) => product.id === productIdValue) ?? null;
}
