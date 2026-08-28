import { createHash } from "node:crypto";
import { createProductCatalog, findCatalogProduct } from "../src/config/productCatalog.js";
import { specificReadingsBySlug } from "../src/data/products.js";

const MERCADOPAGO_API = "https://api.mercadopago.com";
const MERCADOPAGO_TIMEOUT_MS = 12_000;
const PAYMENT_METHOD_CACHE_MS = 10 * 60 * 1_000;
let paymentMethodCache = { expiresAt: 0, items: [] };

export class CheckoutError extends Error {
  constructor(code, status = 400, details = {}) {
    super(code);
    this.name = "CheckoutError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function cleanIdentifier(value, maximumLength = 240) {
  const normalized = String(value ?? "").trim().slice(0, maximumLength);
  return /^[a-zA-Z0-9:._-]+$/u.test(normalized) ? normalized : "";
}

function cleanText(value, maximumLength = 160) {
  return String(value ?? "").trim().slice(0, maximumLength);
}

function positiveInteger(value, maximum = 36) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : 0;
}

function trustedOrigin(value) {
  try {
    const url = new URL(String(value ?? ""));
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
      return "";
    }
    return url.origin;
  } catch {
    return "";
  }
}

function paymentReference(value) {
  const normalized = cleanIdentifier(value, 80);
  if (/^mp-\d{5,30}$/u.test(normalized)) return normalized;
  if (/^\d{5,30}$/u.test(normalized)) return `mp-${normalized}`;
  return "";
}

function rawPaymentId(value) {
  const reference = paymentReference(value);
  return reference ? reference.slice(3) : "";
}

function mercadoPagoAccessToken(env = process.env) {
  const token = String(env.MERCADOPAGO_ACCESS_TOKEN ?? "").trim();
  if (!/^APP_USR-[A-Za-z0-9-]{20,}$/u.test(token) && !/^TEST-[A-Za-z0-9-]{20,}$/u.test(token)) {
    throw new CheckoutError("checkout_not_configured", 503);
  }
  return token;
}

export function mercadoPagoConfigured(env = process.env) {
  try {
    mercadoPagoAccessToken(env);
    return true;
  } catch {
    return false;
  }
}

export function checkoutProductNeedsLedger(productIdValue, env = process.env) {
  const product = findCatalogProduct(createProductCatalog(env), cleanIdentifier(productIdValue, 80));
  return Boolean(product && Number.isInteger(product.priceCents) && product.priceCents > 0);
}

export function checkoutProductNeedsAstralFulfillment(productIdValue, env = process.env) {
  const product = findCatalogProduct(createProductCatalog(env), cleanIdentifier(productIdValue, 80));
  return product?.kind === "astral_document";
}

export function checkoutProductAllowsConsumedAccess(productIdValue, env = process.env) {
  const product = findCatalogProduct(createProductCatalog(env), cleanIdentifier(productIdValue, 80));
  return ["complete_reading", "specific_complete", "specific_standalone", "astral_document"].includes(product?.kind);
}

export function normalizeOrder(raw, env = process.env) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new CheckoutError("invalid_payload", 400);

  const catalog = createProductCatalog(env);
  const product = findCatalogProduct(catalog, cleanIdentifier(raw.productId, 80));
  if (!product) throw new CheckoutError("unknown_product", 400);
  if (!Number.isInteger(product.priceCents) || product.priceCents <= 0) throw new CheckoutError("checkout_not_configured", 503);

  const orderId = cleanIdentifier(raw.orderId, 120);
  const readingId = cleanIdentifier(raw.readingId, 120);
  const readingSlug = cleanIdentifier(raw.readingSlug, 40);
  const offerContext = cleanIdentifier(raw.offerContext, 40);
  const questionNumber = Number(raw.questionNumber) || 0;
  const parentSessionId = paymentReference(raw.parentSessionId);

  if (!orderId.startsWith("order-") || orderId.length < 18) throw new CheckoutError("invalid_order", 400);
  if (!readingId) throw new CheckoutError("invalid_reading", 400);

  if (product.kind.startsWith("specific_")) {
    if (!specificReadingsBySlug[readingSlug]) throw new CheckoutError("invalid_reading_slug", 400);
    const expectedContext = product.kind === "specific_complete" ? "complete_reading" : "standalone";
    if (offerContext !== expectedContext) throw new CheckoutError("invalid_offer_context", 400);
    if (product.kind === "specific_complete" && !parentSessionId) throw new CheckoutError("complete_entitlement_required", 403);
  }

  if (product.kind === "agent_question" && (!Number.isInteger(questionNumber) || questionNumber < 1 || questionNumber > 3)) {
    throw new CheckoutError("invalid_question_number", 400);
  }
  if (product.kind === "agent_question" && !parentSessionId) throw new CheckoutError("complete_entitlement_required", 403);
  if (product.kind === "astral_document" && offerContext !== "astral_document") throw new CheckoutError("invalid_offer_context", 400);

  return { catalog, product, orderId, readingId, readingSlug, offerContext, questionNumber, parentSessionId };
}

function paymentMetadata(order) {
  return {
    product_id: order.product.id,
    product_kind: order.product.kind,
    order_id: order.orderId,
    reading_id: order.readingId,
    reading_slug: order.readingSlug || "",
    offer_context: order.offerContext || "",
    question_number: String(order.questionNumber || 0),
    parent_payment_id: order.parentSessionId || "",
  };
}

function paymentNotificationUrl(env = process.env) {
  const explicit = String(env.MERCADOPAGO_NOTIFICATION_URL ?? "").trim();
  const site = String(env.VITE_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/u, "");
  const candidate = explicit || (site ? `${site}/api/mercadopago-webhook` : "");
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function deterministicIdempotencyKey(orderId) {
  const hex = createHash("sha256").update(`arcane911:${orderId}`).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ["8", "9", "a", "b"][parseInt(hex[16], 16) % 4];
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

async function mercadoPagoRequest(path, {
  env = process.env,
  fetchImplementation = globalThis.fetch,
  method = "GET",
  body,
  idempotencyKey = "",
} = {}) {
  const accessToken = mercadoPagoAccessToken(env);
  if (typeof fetchImplementation !== "function") throw new CheckoutError("checkout_unavailable", 503);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("mercadopago_timeout"), MERCADOPAGO_TIMEOUT_MS);
  try {
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
    if (idempotencyKey) headers["X-Idempotency-Key"] = idempotencyKey;
    const response = await fetchImplementation(`${MERCADOPAGO_API}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new CheckoutError("checkout_provider_error", response.status >= 500 ? 503 : 502, {
        providerStatus: Number(response.status) || 0,
        providerCode: cleanText(payload?.code ?? payload?.cause?.[0]?.code ?? payload?.message ?? "unknown", 100),
      });
    }
    return payload;
  } catch (error) {
    if (error instanceof CheckoutError) throw error;
    throw new CheckoutError(error?.name === "AbortError" ? "checkout_timeout" : "checkout_unavailable", 503);
  } finally {
    clearTimeout(timeout);
  }
}

async function paymentMethods(options = {}) {
  if (paymentMethodCache.expiresAt > Date.now() && paymentMethodCache.items.length) return paymentMethodCache.items;
  const items = await mercadoPagoRequest("/v1/payment_methods", options);
  if (!Array.isArray(items)) throw new CheckoutError("checkout_invalid_response", 502);
  paymentMethodCache = { expiresAt: Date.now() + PAYMENT_METHOD_CACHE_MS, items };
  return items;
}

async function assertAllowedPaymentMethod(paymentMethodId, options = {}) {
  const id = cleanIdentifier(paymentMethodId, 80).toLowerCase();
  if (!id) throw new CheckoutError("invalid_payment_method", 400);
  if (id === "pix") return { id: "pix", payment_type_id: "bank_transfer" };
  const method = (await paymentMethods(options)).find((item) => String(item?.id ?? "").toLowerCase() === id);
  if (!method || String(method.payment_type_id ?? "") !== "credit_card") throw new CheckoutError("invalid_payment_method", 400);
  return method;
}

function safePayer(raw) {
  const email = cleanText(raw?.email, 150).toLowerCase();
  if (!/^\S+@\S+\.\S+$/u.test(email)) throw new CheckoutError("invalid_payer", 400);
  const payer = { email };
  const type = cleanText(raw?.identification?.type, 12).toUpperCase();
  const number = cleanText(raw?.identification?.number, 32).replace(/\D/gu, "");
  if (type && number) payer.identification = { type, number };
  return payer;
}

async function retrieveMercadoPagoPayment(paymentIdValue, options = {}) {
  const id = rawPaymentId(paymentIdValue);
  if (!id) throw new CheckoutError("invalid_payment_id", 400);
  return mercadoPagoRequest(`/v1/payments/${encodeURIComponent(id)}`, options);
}

function assertPaymentMatches(payment, order, { requireApproved = true } = {}) {
  const reference = paymentReference(payment?.id);
  if (!reference) throw new CheckoutError("checkout_invalid_response", 502);
  if (requireApproved && payment?.status !== "approved") {
    const code = ['refunded', 'charged_back', 'cancelled'].includes(payment?.status) ? 'payment_revoked'
      : payment?.status === 'rejected' ? 'payment_rejected' : 'payment_not_confirmed';
    throw new CheckoutError(code, 409, { paymentStatus: payment?.status });
  }
  if (String(payment?.currency_id ?? "").toUpperCase() !== "BRL") throw new CheckoutError("payment_mismatch", 409);
  const amountCents = Math.round(Number(payment?.transaction_amount) * 100);
  if (amountCents !== order.product.priceCents || payment?.external_reference !== order.orderId) throw new CheckoutError("payment_mismatch", 409);

  const metadata = payment?.metadata ?? {};
  if (metadata.product_id !== order.product.id || metadata.order_id !== order.orderId || metadata.reading_id !== order.readingId) {
    throw new CheckoutError("payment_mismatch", 409);
  }
  if ((order.readingSlug || "") !== String(metadata.reading_slug ?? "")) throw new CheckoutError("payment_mismatch", 409);
  if ((order.offerContext || "") !== String(metadata.offer_context ?? "")) throw new CheckoutError("payment_mismatch", 409);
  if ((order.questionNumber || 0) !== Number(metadata.question_number || 0)) throw new CheckoutError("payment_mismatch", 409);

  const type = String(payment?.payment_type_id ?? "");
  const method = String(payment?.payment_method_id ?? "").toLowerCase();
  if (!(type === "credit_card" || (type === "bank_transfer" && method === "pix"))) throw new CheckoutError("payment_mismatch", 409);
  return reference;
}

function entitlementFromPayment(payment, order) {
  const sessionId = assertPaymentMatches(payment, order, { requireApproved: true });
  return {
    sessionId,
    providerTransactionId: sessionId,
    orderId: order.orderId,
    productId: order.product.id,
    readingId: order.readingId,
    readingSlug: order.readingSlug,
    offerContext: order.offerContext,
    questionNumber: order.questionNumber || 0,
    amountTotal: Math.round(Number(payment.transaction_amount) * 100),
    currency: "brl",
    livemode: payment.live_mode === true,
    verifiedAt: String(payment.date_approved ?? payment.date_last_updated ?? new Date().toISOString()),
  };
}

async function assertCompleteEntitlement(order, options = {}) {
  const payment = await retrieveMercadoPagoPayment(order.parentSessionId, options);
  const completeProduct = order.catalog.completeReading;
  if (payment?.status !== "approved"
      || String(payment.currency_id ?? "").toUpperCase() !== "BRL"
      || Math.round(Number(payment.transaction_amount) * 100) !== completeProduct.priceCents
      || payment?.metadata?.product_id !== completeProduct.id
      || payment?.metadata?.reading_id !== order.readingId) {
    throw new CheckoutError("complete_entitlement_required", 403);
  }
}

export async function prepareMercadoPagoCheckout(raw, { env = process.env, fetchImplementation = globalThis.fetch, origin } = {}) {
  mercadoPagoAccessToken(env);
  const order = normalizeOrder(raw, env);
  if (["specific_complete", "agent_question"].includes(order.product.kind)) {
    await assertCompleteEntitlement(order, { env, fetchImplementation });
  }
  const baseOrigin = trustedOrigin(origin);
  if (!baseOrigin) throw new CheckoutError("invalid_origin", 403);
  return {
    checkoutUrl: `${baseOrigin}/pagamento`,
    provider: "mercadopago",
    productId: order.product.id,
    orderId: order.orderId,
  };
}

export async function createMercadoPagoPayment(raw, {
  env = process.env,
  fetchImplementation = globalThis.fetch,
} = {}) {
  const order = normalizeOrder(raw, env);
  let attemptKey = order.orderId;
  if (raw.retryPaymentId) {
    const previous = await retrieveMercadoPagoPayment(raw.retryPaymentId, { env, fetchImplementation });
    assertPaymentMatches(previous, order, { requireApproved: false });
    if (!['rejected', 'cancelled'].includes(previous.status)) throw new CheckoutError('payment_not_confirmed', 409);
    attemptKey = `${order.orderId}:${paymentReference(previous.id)}`;
  }
  if (["specific_complete", "agent_question"].includes(order.product.kind)) {
    await assertCompleteEntitlement(order, { env, fetchImplementation });
  }

  const form = raw?.paymentData;
  if (!form || typeof form !== "object" || Array.isArray(form)) throw new CheckoutError("invalid_payload", 400);
  const method = await assertAllowedPaymentMethod(form.payment_method_id, { env, fetchImplementation });
  const payer = safePayer(form.payer);
  const body = {
    transaction_amount: order.product.priceCents / 100,
    description: `${order.product.name} · Arcane911`,
    external_reference: order.orderId,
    payment_method_id: String(method.id),
    payer,
    metadata: paymentMetadata(order),
    statement_descriptor: "ARCANE911",
  };

  const notificationUrl = paymentNotificationUrl(env);
  if (notificationUrl) body.notification_url = notificationUrl;

  if (String(method.payment_type_id) === "credit_card") {
    const token = cleanText(form.token, 220);
    const installments = positiveInteger(form.installments, 24);
    if (!token || !installments) throw new CheckoutError("invalid_card_data", 400);
    body.token = token;
    body.installments = installments;
    const issuerId = cleanIdentifier(form.issuer_id, 80);
    if (issuerId) body.issuer_id = issuerId;
  }

  const payment = await mercadoPagoRequest("/v1/payments", {
    env,
    fetchImplementation,
    method: "POST",
    body,
    idempotencyKey: deterministicIdempotencyKey(attemptKey),
  });

  const sessionId = assertPaymentMatches(payment, order, { requireApproved: false });
  const status = cleanIdentifier(payment?.status, 32) || "unknown";
  const response = {
    provider: "mercadopago",
    paymentId: sessionId,
    orderId: order.orderId,
    productId: order.product.id,
    status,
    statusDetail: cleanIdentifier(payment?.status_detail, 80),
    paymentType: cleanIdentifier(payment?.payment_type_id, 40),
    paymentMethod: cleanIdentifier(payment?.payment_method_id, 40),
  };

  const transactionData = payment?.point_of_interaction?.transaction_data ?? {};
  if (payment?.payment_method_id === "pix") {
    response.pix = {
      qrCode: cleanText(transactionData.qr_code, 4000),
      qrCodeBase64: cleanText(transactionData.qr_code_base64, 200000),
      ticketUrl: cleanText(transactionData.ticket_url, 1600),
    };
  }
  if (status === "approved") response.entitlement = entitlementFromPayment(payment, order);
  return response;
}

export async function verifyMercadoPagoPayment(raw, { env = process.env, fetchImplementation = globalThis.fetch } = {}) {
  const order = normalizeOrder(raw, env);
  const payment = await retrieveMercadoPagoPayment(raw.paymentId ?? raw.sessionId, { env, fetchImplementation });
  return { paid: true, entitlement: entitlementFromPayment(payment, order) };
}

export async function fulfillMercadoPagoPayment(paymentIdValue, { env = process.env, fetchImplementation = globalThis.fetch } = {}) {
  const payment = await retrieveMercadoPagoPayment(paymentIdValue, { env, fetchImplementation });
  if (["refunded", "charged_back", "cancelled"].includes(payment?.status)) {
    return { paid: false, revoked: true, sessionId: paymentReference(payment.id), reason: payment.status };
  }
  if (payment?.status !== "approved") throw new CheckoutError("payment_not_confirmed", 409);
  const metadata = payment?.metadata ?? {};
  const raw = {
    paymentId: paymentReference(payment.id),
    orderId: payment.external_reference ?? metadata.order_id,
    productId: metadata.product_id,
    readingId: metadata.reading_id,
    readingSlug: metadata.reading_slug,
    offerContext: metadata.offer_context,
    questionNumber: Number(metadata.question_number) || 0,
    parentSessionId: metadata.parent_payment_id,
  };
  const order = normalizeOrder(raw, env);
  return { paid: true, entitlement: entitlementFromPayment(payment, order) };
}

export function checkoutErrorPayload(error) {
  const normalized = error instanceof CheckoutError ? error : new CheckoutError("checkout_unavailable", 503);
  return { status: normalized.status, body: { error: normalized.code } };
}
