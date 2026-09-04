const PENDING_CHECKOUT_KEY = "arcane911.checkout.pending.v1";
const ENTITLEMENTS_KEY = "arcane911.checkout.entitlements.v1";
const PENDING_CHECKOUT_TTL_MS = 24 * 60 * 60 * 1_000;

const checkoutMessages = Object.freeze({
  checkout_not_configured: "O pagamento está temporariamente indisponível. Tente novamente em breve.",
  webhook_not_configured: "A confirmação automática do pagamento ainda não está configurada. Nenhuma cobrança foi aberta.",
  checkout_provider_error: "O pagamento não pôde ser aberto agora. Tente novamente.",
  checkout_timeout: "O pagamento demorou mais do que o esperado. Tente novamente.",
  checkout_unavailable: "O pagamento está temporariamente indisponível. Tente novamente.",
  checkout_invalid_response: "O pagamento não pôde ser aberto agora. Tente novamente.",
  payment_not_confirmed: "O pagamento ainda não foi confirmado. Aguarde um instante e tente novamente.",
  payment_revoked: "Este pagamento foi cancelado ou reembolsado. O acesso foi encerrado.",
  payment_rejected: "O pagamento não foi aprovado. Volte à oferta para tentar novamente.",
  astral_order_invalid: "Confira o e-mail e os dados de nascimento antes de pagar.",
  astral_questionnaire_incomplete: "Responda aos três blocos de personalização antes de pagar.",
  astral_order_requires_support: "Use o código da compra no suporte para recuperar os dados deste pedido antigo.",
  payment_mismatch: "Não foi possível vincular este pagamento à leitura. O acesso não foi liberado.",
  payment_environment_mismatch: "O pagamento recebido não pertence ao ambiente de produção. O acesso não foi liberado.",
  payment_ledger_not_configured: "A liberação segura ainda não está configurada. Nenhuma cobrança foi aberta.",
  payment_ledger_not_ready: "O pagamento foi confirmado, mas a liberação ainda está sendo preparada. Tente confirmar novamente.",
  astral_fulfillment_not_ready: "O Documento Astral está em preparação e ainda não pode receber pagamentos.",
  payment_ledger_unavailable: "O pagamento foi confirmado, mas a liberação está temporariamente indisponível. Tente novamente.",
  payment_ledger_conflict: "Este pagamento já está ligado a outra liberação e não foi reutilizado.",
  payment_credit_unavailable: "Este pagamento já liberou o conteúdo contratado e não criou um novo crédito.",
  complete_entitlement_required: "O valor de R$ 5,00 é exclusivo para esta Tiragem Completa.",
  invalid_payment_id: "Não foi possível confirmar este pagamento.",
  invalid_payment_method: "Esse meio de pagamento não está disponível.",
  invalid_card_data: "Confira os dados do cartão e tente novamente.",
  invalid_payer: "Confira o e-mail e o documento informados no pagamento.",
  invalid_payload: "Não foi possível preparar esta compra. Reabra a oferta e tente novamente.",
  invalid_order: "Confira o código do pedido e tente novamente.",
  purchase_not_found: "Nenhuma compra confirmada foi encontrada com este código.",
  purchase_processing: "A compra ainda está sendo processada. Aguarde um instante e tente novamente.",
  rate_limit: "Muitas tentativas foram feitas em sequência. Aguarde um pouco e tente novamente.",
  unknown: "O pagamento não pôde ser concluído agora. Tente novamente.",
});

export class CheckoutClientError extends Error {
  constructor(code, status = 0) {
    super(checkoutMessages[code] ?? checkoutMessages.unknown);
    this.name = "CheckoutClientError";
    this.code = code || "unknown";
    this.status = Number(status) || 0;
  }
}

function safeSession() {
  return typeof window === "object" ? window.sessionStorage : null;
}

function safeLocal() {
  return typeof window === "object" ? window.localStorage : null;
}

function cleanText(value, maximumLength = 120) {
  return String(value ?? "").trim().slice(0, maximumLength);
}


function safeReturnPath(value) {
  const normalized = cleanText(value, 240);
  if (["/", "/tiragem-completa", "/mapa-astral"].includes(normalized)) return normalized;
  if (/^\/leituras\/(amor|caminhos|trabalho|decisao|interior)(?:\?origem=tiragem-completa)?$/u.test(normalized)) return normalized;
  return "/";
}

export function checkoutErrorMessage(code) {
  return checkoutMessages[code] ?? checkoutMessages.unknown;
}

export function createCheckoutOrderId() {
  const token = typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `order-${token}`;
}

function normalizedOrder(order) {
  return {
    orderId: cleanText(order?.orderId),
    productId: cleanText(order?.productId, 80),
    readingId: cleanText(order?.readingId),
    readingSlug: cleanText(order?.readingSlug, 40),
    offerContext: cleanText(order?.offerContext, 40),
    questionNumber: Number(order?.questionNumber) || 0,
    parentSessionId: cleanText(order?.parentSessionId, 240),
    returnPath: safeReturnPath(order?.returnPath),
    createdAt: cleanText(order?.createdAt, 40) || new Date().toISOString(),
    paymentId: cleanText(order?.paymentId, 80),
    retryPaymentId: cleanText(order?.retryPaymentId, 80),
    paymentStatus: cleanText(order?.paymentStatus, 40),
    pix: order?.pix && typeof order.pix === 'object' ? {
      qrCode: cleanText(order.pix.qrCode, 4000),
      qrCodeBase64: cleanText(order.pix.qrCodeBase64, 200000),
      ticketUrl: cleanText(order.pix.ticketUrl, 1600),
    } : null,
  };
}

export function savePendingCheckout(order) {
  const normalized = normalizedOrder(order);
  try {
    safeLocal()?.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(normalized));
  } catch {
    // A compra ainda pode ser aberta; a volta exibirá uma mensagem segura.
  }
  return normalized;
}

export function loadPendingCheckout() {
  try {
    const pending = JSON.parse(safeLocal()?.getItem(PENDING_CHECKOUT_KEY) ?? "null");
    if (!pending?.orderId || !pending?.productId || !pending?.readingId) return null;
    const normalized = normalizedOrder(pending);
    const createdAt = Date.parse(normalized.createdAt);
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > PENDING_CHECKOUT_TTL_MS) {
      safeLocal()?.removeItem(PENDING_CHECKOUT_KEY);
      return null;
    }
    return normalized;
  } catch {
    return null;
  }
}

export function clearPendingCheckout(orderId = "") {
  const pending = loadPendingCheckout();
  if (!orderId || pending?.orderId === orderId) safeLocal()?.removeItem(PENDING_CHECKOUT_KEY);
}

async function requestJson(url, body, fetchImplementation = globalThis.fetch) {
  if (typeof fetchImplementation !== "function") throw new CheckoutClientError("checkout_unavailable");
  let response;
  try {
    response = await fetchImplementation(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new CheckoutClientError("checkout_unavailable");
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new CheckoutClientError(cleanText(payload?.error, 80) || "unknown", response.status);
  return payload;
}

export async function createHostedCheckout(order, options = {}) {
  const normalized = normalizedOrder(order);
  const payload = await requestJson(options.endpoint ?? "/api/checkout", {
    ...normalized,
    ...(options.fulfillment ? { fulfillment: options.fulfillment } : {}),
    ...(options.readingSnapshot ? { readingSnapshot: options.readingSnapshot } : {}),
  }, options.fetchImplementation);
  const checkoutUrl = String(payload?.checkoutUrl ?? "");
  if (!/^https?:\/\/[^/]+\/pagamento(?:[?#]|$)/iu.test(checkoutUrl)) {
    throw new CheckoutClientError("checkout_invalid_response");
  }
  return payload;
}

export async function verifyHostedCheckout(paymentId, order, options = {}) {
  const normalized = normalizedOrder(order);
  return requestJson(options.endpoint ?? "/api/payment-status", {
    ...normalized,
    paymentId: cleanText(paymentId, 80),
  }, options.fetchImplementation);
}

export async function recoverHostedOrder(orderId, options = {}) {
  const normalizedOrderId = cleanText(orderId, 120);
  if (!/^order-[A-Za-z0-9:._-]{12,114}$/u.test(normalizedOrderId)) {
    throw new CheckoutClientError("invalid_order", 400);
  }
  return requestJson(
    options.endpoint ?? "/api/order-status",
    { orderId: normalizedOrderId },
    options.fetchImplementation,
  );
}

export function loadPaymentEntitlements() {
  try {
    const entitlements = JSON.parse(safeSession()?.getItem(ENTITLEMENTS_KEY) ?? "[]");
    return Array.isArray(entitlements)
      ? entitlements.filter((item) => item?.sessionId && item?.orderId && item?.productId).slice(0, 24)
      : [];
  } catch {
    return [];
  }
}

export function savePaymentEntitlement(entitlement) {
  const normalized = {
    sessionId: cleanText(entitlement?.sessionId, 240),
    orderId: cleanText(entitlement?.orderId),
    productId: cleanText(entitlement?.productId, 80),
    readingId: cleanText(entitlement?.readingId),
    readingSlug: cleanText(entitlement?.readingSlug, 40),
    offerContext: cleanText(entitlement?.offerContext, 40),
    questionNumber: Number(entitlement?.questionNumber) || 0,
    amountTotal: Number(entitlement?.amountTotal) || 0,
    currency: cleanText(entitlement?.currency, 8).toLowerCase(),
    livemode: entitlement?.livemode === true,
    state: cleanText(entitlement?.state, 24) || "active",
    creditAvailable: entitlement?.creditAvailable !== false,
    completeSummaryUsed: entitlement?.completeSummaryUsed === true,
    includedQuestionsUsed: Math.max(0, Math.min(10, Number(entitlement?.includedQuestionsUsed) || 0)),
    verifiedAt: cleanText(entitlement?.verifiedAt, 40) || new Date().toISOString(),
    consumedAt: cleanText(entitlement?.consumedAt, 40),
  };
  if (!normalized.sessionId || !normalized.orderId || !normalized.productId) return null;

  const next = [
    normalized,
    ...loadPaymentEntitlements().filter((item) => item.sessionId !== normalized.sessionId),
  ].slice(0, 24);
  try {
    safeSession()?.setItem(ENTITLEMENTS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("arcane911:entitlements-changed"));
  } catch {
    // A confirmação atual continua válida em memória mesmo sem persistência.
  }
  return normalized;
}

export function findPaymentEntitlement(criteria = {}) {
  return loadPaymentEntitlements().find((item) => Object.entries(criteria).every(
    ([key, value]) => value === undefined || value === "" || item[key] === value,
  )) ?? null;
}

export function removePaymentEntitlement(sessionId) {
  const normalizedSessionId = cleanText(sessionId, 240);
  if (!normalizedSessionId) return false;
  const current = loadPaymentEntitlements();
  const next = current.filter((item) => item.sessionId !== normalizedSessionId);
  if (next.length === current.length) return false;
  try {
    safeSession()?.setItem(ENTITLEMENTS_KEY, JSON.stringify(next));
    if (typeof window === "object") {
      window.dispatchEvent(new CustomEvent("arcane911:entitlements-changed"));
    }
  } catch {
    return false;
  }
  return true;
}

export async function verifyStoredPaymentEntitlement(candidate, criteria = {}, options = {}) {
  if (!candidate?.sessionId || !candidate?.orderId || !candidate?.productId) {
    throw new CheckoutClientError("payment_mismatch", 409);
  }

  const payload = await recoverHostedOrder(candidate.orderId, options);
  const entitlement = payload?.entitlement;
  const expected = { ...candidate, ...criteria };
  const identityFields = [
    "sessionId",
    "orderId",
    "productId",
    "readingId",
    "readingSlug",
    "offerContext",
    "questionNumber",
  ];
  const matches = entitlement && identityFields.every((field) => {
    const expectedValue = expected[field];
    if (expectedValue === undefined || expectedValue === "" || expectedValue === 0) return true;
    return entitlement[field] === expectedValue;
  });
  if (!matches) throw new CheckoutClientError("payment_mismatch", 409);
  return entitlement;
}

export function consumePaymentEntitlement(sessionId) {
  const now = new Date().toISOString();
  let consumed = null;
  const next = loadPaymentEntitlements().map((item) => {
    if (item.sessionId !== sessionId || item.consumedAt) return item;
    consumed = { ...item, consumedAt: now };
    return consumed;
  });
  if (!consumed) return null;
  try {
    safeSession()?.setItem(ENTITLEMENTS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("arcane911:entitlements-changed"));
  } catch {
    return null;
  }
  return consumed;
}

export function trackCommercialEvent(eventName, payload = {}) {
  if (typeof window === "undefined") return;

  const event = {
    event: eventName,
    product: "arcane911",
    timestamp: new Date().toISOString(),
    ...payload,
  };

  delete event.order_id;
  delete event.orderId;
  delete event.sessionId;
  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push(event);
  }

  window.dispatchEvent(new CustomEvent("arcane911:commercial-event", { detail: event }));
}
