import { createAstro911Context } from "./astro911.js";

function cleanText(value, maximum = 700) {
  return String(value ?? "").replace(/\s+/gu, " ").trim().slice(0, maximum);
}

export function astralQuestionErrorMessage(code) {
  const messages = {
    invalid_payload: "Escreva uma pergunta um pouco mais específica sobre o seu mapa.",
    payment_required: "Não foi possível confirmar o acesso desta compra.",
    payment_mismatch: "Esta compra não corresponde ao mapa que está aberto.",
    payment_revoked: "Este pagamento foi cancelado ou reembolsado.",
    purchase_processing: "Sua pergunta ainda está sendo concluída. Aguarde e tente novamente; não será cobrado outro crédito.",
    payment_credit_unavailable: "As 5 perguntas desta síntese já foram utilizadas.",
    astral_delivery_required: "As perguntas são liberadas depois que a síntese em PDF é entregue.",
    rate_limit: "Muitas perguntas em sequência. Aguarde um pouco e tente novamente.",
    provider_quota: "O Agent911 está temporariamente indisponível. Seu crédito não foi consumido.",
    provider_unavailable: "O Agent911 está temporariamente indisponível. Seu crédito não foi consumido.",
    provider_invalid_response: "A resposta não ficou válida. Seu crédito não foi consumido; tente novamente.",
  };
  return messages[String(code ?? "")] ?? "Não foi possível responder agora. Seu crédito permanece protegido quando a resposta não é concluída.";
}

export async function askAstralQuestion({ entitlement, chart, question }, options = {}) {
  const normalizedQuestion = cleanText(question, 700);
  if (normalizedQuestion.length < 5) {
    const error = new Error("invalid_payload");
    error.code = "invalid_payload";
    throw error;
  }
  if (!entitlement?.sessionId || !entitlement?.orderId || !entitlement?.readingId || !entitlement?.productId) {
    const error = new Error("payment_required");
    error.code = "payment_required";
    throw error;
  }

  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  if (typeof fetchImplementation !== "function") {
    const error = new Error("provider_unavailable");
    error.code = "provider_unavailable";
    throw error;
  }

  const response = await fetchImplementation("/api/astro-question", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: normalizedQuestion,
      context: createAstro911Context(chart),
      payment: {
        sessionId: entitlement.sessionId,
        orderId: entitlement.orderId,
        readingId: entitlement.readingId,
        productId: entitlement.productId,
      },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload?.answer !== "string" || !payload.answer.trim()) {
    const code = String(payload?.error ?? "provider_unavailable");
    const error = new Error(code);
    error.code = code;
    throw error;
  }
  return {
    id: payload.id,
    answer: payload.answer.trim(),
    slot: Number(payload.slot) || null,
    questionsAvailable: Number(payload.questionsAvailable) || 5,
    questionsUsed: Number(payload.questionsUsed) || 0,
  };
}
