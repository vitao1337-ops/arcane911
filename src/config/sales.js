import { commerceConfig } from "./commerce.js";

const completeReading = commerceConfig.products.completeReading;

export const salesConfig = Object.freeze({
  productId: completeReading.id,
  devUnlocked: commerceConfig.devUnlocked,
  offer: Object.freeze({
    name: completeReading.name,
    price: completeReading.price,
    priceCents: completeReading.priceCents,
    paymentLabel: "pagamento único",
    promise: "Aprofunde a mesma pergunta sem perder as três cartas que já escolheram você.",
    paymentNotice: "A Tiragem Completa é um conteúdo pago e só é liberada após a confirmação do pagamento.",
    features: Object.freeze([
      "Ferradura de 7 cartas, da origem à direção provável",
      "Quatro novas cartas sem perder as três que você escolheu",
      "Leitura de cada posição, com sombra e convite prático",
      "Leitura completa salva no seu diário",
      `${completeReading.includedSpecificQuestions} perguntas específicas incluídas`,
    ]),
  }),
});
