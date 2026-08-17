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
  payment_mismatch: "Não foi possível vincular este pagamento à leitura. O acesso não foi liberado.",
  payment_ledger_not_configured: "A liberação segura ainda não está configurada. Nenhuma cobrança foi aberta.",
  payment_ledger_not_ready: "O pagamento foi confirmado, mas a liberação ainda está sendo preparada. Tente confirmar novamente.",
  payment_ledger_unavailable: "O pagamento foi confirmado, mas a liberação está temporariamente indisponível. Tente novamente.",
  payment_ledger_conflict: "Este pagamento já está ligado a outra liberação e não foi reutilizado.",
  payment_credit_unavailable: "Este pagamento já liberou o conteúdo contratado e não criou um novo crédito.",
  complete_entitlement_required: "O valor de R$ 5,00 é exclusivo para esta Tiragem Completa.",
  invalid_checkout_session: "Não foi possível confirmar este pagamento.",
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
    returnPath: cleanText(order?.returnPath, 240),
    createdAt: cleanText(order?.createdAt, 40) || new Date().toISOString(),
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
  const payload = await requestJson(options.endpoint ?? "/api/checkout", normalized, options.fetchImplementation);
  if (!/^https:\/\/checkout\.stripe\.com\//iu.test(String(payload?.checkoutUrl ?? ""))) {
    throw new CheckoutClientError("checkout_invalid_response");
  }
  return payload;
}

export async function verifyHostedCheckout(sessionId, order, options = {}) {
  const normalized = normalizedOrder(order);
  return requestJson(options.endpoint ?? "/api/checkout-session", {
    ...normalized,
    sessionId: cleanText(sessionId, 240),
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

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push(event);
  }

  window.dispatchEvent(new CustomEvent("arcane911:commercial-event", { detail: event }));
}
