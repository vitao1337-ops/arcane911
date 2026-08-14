import { createProductCatalog } from "./productCatalog.js";

const viteEnv = typeof import.meta.env === "object" ? import.meta.env : {};

function positiveCents(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function formatBRL(cents) {
  const amount = Math.max(0, Number(cents) || 0) / 100;
  return `R$ ${amount.toFixed(2).replace(".", ",")}`;
}

function product({ id, name, kind, cents, accessRequired = true }) {
  const priceCents = positiveCents(cents);
  return Object.freeze({
    id,
    name,
    kind,
    currency: "BRL",
    priceCents,
    price: priceCents > 0 ? formatBRL(priceCents) : "A definir",
    accessRequired,
  });
}

const isDevelopment = viteEnv.DEV === true;
const devUnlocked = isDevelopment
  && String(viteEnv.ARCANE911_DEV_UNLOCK_PAID ?? "true").trim().toLowerCase() !== "false";
const catalog = createProductCatalog(viteEnv);

const products = Object.freeze({
  completeReading: product({
    ...catalog.completeReading,
    cents: catalog.completeReading.priceCents,
  }),
  agentQuestion: product({
    ...catalog.agentQuestion,
    cents: catalog.agentQuestion.priceCents,
  }),
  specificQuestionComplete: product({
    ...catalog.specificQuestionComplete,
    cents: catalog.specificQuestionComplete.priceCents,
  }),
  specificQuestionStandalone: product({
    ...catalog.specificQuestionStandalone,
    cents: catalog.specificQuestionStandalone.priceCents,
  }),
  astralDocument: product({
    ...catalog.astralDocument,
    cents: catalog.astralDocument.priceCents,
    // Sem preço, a validação atual continua aberta. Ao configurar um valor,
    // o mesmo catálogo ativa automaticamente a proteção server-side.
    accessRequired: catalog.astralDocument.priceCents > 0,
  }),
});

export const commerceConfig = Object.freeze({
  mode: devUnlocked ? "development_unlocked" : "payment_required",
  devUnlocked,
  provider: "stripe_checkout",
  products,
});
