const viteEnv = typeof import.meta.env === "object" ? import.meta.env : {};

export const salesConfig = Object.freeze({
  checkoutUrl: String(viteEnv.VITE_CHECKOUT_URL ?? "").trim(),
  productId: String(viteEnv.VITE_PRODUCT_ID ?? "arcane911-leitura-profunda").trim(),
  offer: Object.freeze({
    name: "Leitura Profunda",
    price: String(viteEnv.VITE_OFFER_PRICE ?? "R$ 19,90").trim(),
    paymentLabel: "pagamento único",
    promise: "Aprofunde a mesma pergunta sem perder as três cartas que já escolheram você.",
    features: Object.freeze([
      "Ferradura de 7 cartas, da origem à direção provável",
      "Quatro novas cartas sem perder as três que você escolheu",
      "Leitura de cada posição, com sombra e convite prático",
      "Leitura completa salva no seu diário",
    ]),
  }),
});
