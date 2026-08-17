import { createProductCatalog, findCatalogProduct } from "../src/config/productCatalog.js";
import { specificReadingsBySlug } from "../src/data/products.js";

const STRIPE_API = "https://api.stripe.com/v1";
const STRIPE_VERSION = "2026-02-25.clover";
const STRIPE_TIMEOUT_MS = 12_000;

export class CheckoutError extends Error {
  constructor(code, status = 400, details = {}) {
    super(code);
    this.name = "CheckoutError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function checkoutProductNeedsLedger(productIdValue, env = process.env) {
  const product = findCatalogProduct(createProductCatalog(env), cleanIdentifier(productIdValue, 80));
  return Boolean(product && Number.isInteger(product.priceCents) && product.priceCents > 0);
}

export function checkoutProductAllowsConsumedAccess(productIdValue, env = process.env) {
  const product = findCatalogProduct(createProductCatalog(env), cleanIdentifier(productIdValue, 80));
  return ["complete_reading", "specific_complete", "specific_standalone"].includes(product?.kind);
}

function cleanIdentifier(value, maximumLength = 120) {
  const normalized = String(value ?? "").trim().slice(0, maximumLength);
  return /^[a-zA-Z0-9:._-]+$/u.test(normalized) ? normalized : "";
}

function checkoutSessionId(value) {
  const normalized = String(value ?? "").trim();
  return /^cs_(?:test_|live_)?[a-zA-Z0-9]{10,220}$/u.test(normalized) ? normalized : "";
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

function returnUrl(origin, returnPath, product) {
  const baseOrigin = trustedOrigin(origin);
  if (!baseOrigin) throw new CheckoutError("invalid_origin", 403);

  const parsed = new URL(String(returnPath ?? ""), baseOrigin);
  if (parsed.origin !== baseOrigin) throw new CheckoutError("invalid_return_path", 400);

  const specificPath = product.kind.startsWith("specific_")
    ? /^\/leituras\/(amor|caminhos|trabalho|decisao|interior)$/u.test(parsed.pathname)
    : product.kind === "astral_document"
      ? parsed.pathname === "/mapa-astral"
      : parsed.pathname === "/tiragem-completa";
  if (!specificPath) throw new CheckoutError("invalid_return_path", 400);

  for (const key of [...parsed.searchParams.keys()]) {
    if (key !== "origem" || parsed.searchParams.get(key) !== "tiragem-completa") {
      parsed.searchParams.delete(key);
    }
  }
  parsed.hash = "";
  return parsed;
}

function normalizeOrder(raw, env = process.env) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new CheckoutError("invalid_payload", 400);
  }

  const catalog = createProductCatalog(env);
  const product = findCatalogProduct(catalog, cleanIdentifier(raw.productId, 80));
  if (!product) throw new CheckoutError("unknown_product", 400);
  if (!Number.isInteger(product.priceCents) || product.priceCents <= 0) {
    throw new CheckoutError("checkout_not_configured", 503);
  }

  const orderId = cleanIdentifier(raw.orderId, 120);
  const readingId = cleanIdentifier(raw.readingId, 120);
  const readingSlug = cleanIdentifier(raw.readingSlug, 40);
  const offerContext = cleanIdentifier(raw.offerContext, 40);
  const questionNumber = Number(raw.questionNumber) || 0;
  const parentSessionId = checkoutSessionId(raw.parentSessionId);

  if (!orderId.startsWith("order-") || orderId.length < 18) {
    throw new CheckoutError("invalid_order", 400);
  }
  if (!readingId) throw new CheckoutError("invalid_reading", 400);

  if (product.kind.startsWith("specific_")) {
    if (!specificReadingsBySlug[readingSlug]) throw new CheckoutError("invalid_reading_slug", 400);
    const expectedContext = product.kind === "specific_complete" ? "complete_reading" : "standalone";
    if (offerContext !== expectedContext) throw new CheckoutError("invalid_offer_context", 400);
    if (product.kind === "specific_complete" && !parentSessionId) {
      throw new CheckoutError("complete_entitlement_required", 403);
    }
  }

  if (product.kind === "agent_question" && (!Number.isInteger(questionNumber) || questionNumber < 1 || questionNumber > 3)) {
    throw new CheckoutError("invalid_question_number", 400);
  }
  if (product.kind === "agent_question" && !parentSessionId) {
    throw new CheckoutError("complete_entitlement_required", 403);
  }

  if (product.kind === "astral_document" && offerContext !== "astral_document") {
    throw new CheckoutError("invalid_offer_context", 400);
  }

  return {
    catalog,
    product,
    orderId,
    readingId,
    readingSlug,
    offerContext,
    questionNumber,
    parentSessionId,
  };
}

async function stripeRequest(path, { env = process.env, fetchImplementation = globalThis.fetch, method = "GET", body } = {}) {
  const secretKey = String(env.STRIPE_SECRET_KEY ?? "").trim();
  if (!/^sk_(?:test|live)_[a-zA-Z0-9]+$/u.test(secretKey)) {
    throw new CheckoutError("checkout_not_configured", 503);
  }
  if (typeof fetchImplementation !== "function") throw new CheckoutError("checkout_unavailable", 503);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("stripe_timeout"), STRIPE_TIMEOUT_MS);
  try {
    const response = await fetchImplementation(`${STRIPE_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": STRIPE_VERSION,
      },
      body,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new CheckoutError("checkout_provider_error", response.status >= 500 ? 503 : 502, {
        providerStatus: Number(response.status) || 0,
        providerCode: String(payload?.error?.code ?? payload?.error?.type ?? "unknown").slice(0, 80),
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

async function retrieveStripeSession(sessionId, options = {}) {
  const normalized = checkoutSessionId(sessionId);
  if (!normalized) throw new CheckoutError("invalid_checkout_session", 400);
  return stripeRequest(`/checkout/sessions/${encodeURIComponent(normalized)}`, options);
}

function assertPaidSession(session, expected) {
  if (session?.status !== "complete" || session?.payment_status !== "paid") {
    throw new CheckoutError("payment_not_confirmed", 409);
  }
  if (session.currency !== "brl" || Number(session.amount_total) !== expected.product.priceCents) {
    throw new CheckoutError("payment_mismatch", 409);
  }
  if (session.client_reference_id !== expected.orderId
      || session.metadata?.product_id !== expected.product.id
      || session.metadata?.order_id !== expected.orderId
      || session.metadata?.reading_id !== expected.readingId) {
    throw new CheckoutError("payment_mismatch", 409);
  }
  if (expected.readingSlug && session.metadata?.reading_slug !== expected.readingSlug) {
    throw new CheckoutError("payment_mismatch", 409);
  }
  if (expected.offerContext && session.metadata?.offer_context !== expected.offerContext) {
    throw new CheckoutError("payment_mismatch", 409);
  }
  if (expected.questionNumber && Number(session.metadata?.question_number) !== expected.questionNumber) {
    throw new CheckoutError("payment_mismatch", 409);
  }
  if (expected.parentSessionId && session.metadata?.parent_session_id !== expected.parentSessionId) {
    throw new CheckoutError("payment_mismatch", 409);
  }
}

async function assertCompleteEntitlement(order, options) {
  const session = await retrieveStripeSession(order.parentSessionId, options);
  const completeProduct = order.catalog.completeReading;
  if (session?.status !== "complete" || session?.payment_status !== "paid"
      || session.currency !== "brl" || Number(session.amount_total) !== completeProduct.priceCents
      || session.metadata?.product_id !== completeProduct.id
      || session.metadata?.reading_id !== order.readingId) {
    throw new CheckoutError("complete_entitlement_required", 403);
  }
}

function addMetadata(form, order) {
  const metadata = {
    product_id: order.product.id,
    order_id: order.orderId,
    reading_id: order.readingId,
    reading_slug: order.readingSlug,
    offer_context: order.offerContext,
    question_number: order.questionNumber || "",
    parent_session_id: order.parentSessionId || "",
  };
  Object.entries(metadata).forEach(([key, value]) => {
    if (value !== "") form.set(`metadata[${key}]`, String(value));
  });
}

export async function createStripeCheckout(raw, {
  env = process.env,
  fetchImplementation = globalThis.fetch,
  origin,
} = {}) {
  const order = normalizeOrder(raw, env);
  const destination = returnUrl(origin, raw.returnPath, order.product);

  if (["specific_complete", "agent_question"].includes(order.product.kind)) {
    await assertCompleteEntitlement(order, { env, fetchImplementation });
  }

  const successUrl = new URL(destination);
  successUrl.searchParams.set("checkout", "success");
  successUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
  const cancelUrl = new URL(destination);
  cancelUrl.searchParams.set("checkout", "cancelled");

  const form = new URLSearchParams({
    mode: "payment",
    "payment_method_types[0]": "card",
    "line_items[0][price_data][currency]": "brl",
    "line_items[0][price_data][unit_amount]": String(order.product.priceCents),
    "line_items[0][price_data][product_data][name]": order.product.name,
    "line_items[0][price_data][product_data][description]": `Código do pedido: ${order.orderId}. Guarde para recuperar o acesso.`,
    "line_items[0][quantity]": "1",
    "payment_intent_data[description]": `Arcane911 · ${order.orderId}`,
    "payment_intent_data[metadata][order_id]": order.orderId,
    client_reference_id: order.orderId,
    success_url: successUrl.toString(),
    cancel_url: cancelUrl.toString(),
    locale: "pt-BR",
    submit_type: "pay",
    "custom_text[submit][message]": `Entrega digital vinculada ao código ${order.orderId}. O conteúdo é simbólico e não substitui orientação profissional.`,
  });
  if (String(env.STRIPE_REQUIRE_TERMS_ACCEPTANCE ?? "").trim().toLowerCase() === "true") {
    form.set("consent_collection[terms_of_service]", "required");
  }
  addMetadata(form, order);

  const session = await stripeRequest("/checkout/sessions", {
    env,
    fetchImplementation,
    method: "POST",
    body: form.toString(),
  });
  if (!checkoutSessionId(session?.id) || !/^https:\/\/checkout\.stripe\.com\//iu.test(String(session?.url ?? ""))) {
    throw new CheckoutError("checkout_invalid_response", 502);
  }

  return {
    checkoutUrl: session.url,
    checkoutSessionId: session.id,
    productId: order.product.id,
    orderId: order.orderId,
  };
}

export async function verifyStripeCheckout(raw, {
  env = process.env,
  fetchImplementation = globalThis.fetch,
} = {}) {
  const order = normalizeOrder(raw, env);
  const sessionId = checkoutSessionId(raw.sessionId);
  if (!sessionId) throw new CheckoutError("invalid_checkout_session", 400);

  const session = await retrieveStripeSession(sessionId, { env, fetchImplementation });
  assertPaidSession(session, order);

  return {
    paid: true,
    entitlement: {
      sessionId,
      paymentIntentId: cleanIdentifier(session.payment_intent, 240),
      orderId: order.orderId,
      productId: order.product.id,
      readingId: order.readingId,
      readingSlug: order.readingSlug,
      offerContext: order.offerContext,
      questionNumber: order.questionNumber || 0,
      amountTotal: Number(session.amount_total) || order.product.priceCents,
      currency: String(session.currency ?? "brl").toLowerCase(),
      livemode: session.livemode === true,
      verifiedAt: new Date().toISOString(),
    },
  };
}

export async function fulfillStripeCheckoutSession(sessionIdValue, {
  env = process.env,
  fetchImplementation = globalThis.fetch,
} = {}) {
  const sessionId = checkoutSessionId(sessionIdValue);
  if (!sessionId) throw new CheckoutError("invalid_checkout_session", 400);

  const session = await retrieveStripeSession(sessionId, { env, fetchImplementation });
  const metadata = session?.metadata ?? {};
  const raw = {
    sessionId,
    orderId: session?.client_reference_id ?? metadata.order_id,
    productId: metadata.product_id,
    readingId: metadata.reading_id,
    readingSlug: metadata.reading_slug,
    offerContext: metadata.offer_context,
    questionNumber: Number(metadata.question_number) || 0,
    parentSessionId: metadata.parent_session_id,
    returnPath: "/tiragem-completa",
  };
  const order = normalizeOrder(raw, env);
  assertPaidSession(session, order);

  return {
    paid: true,
    entitlement: {
      sessionId,
      paymentIntentId: cleanIdentifier(session.payment_intent, 240),
      orderId: order.orderId,
      productId: order.product.id,
      readingId: order.readingId,
      readingSlug: order.readingSlug,
      offerContext: order.offerContext,
      questionNumber: order.questionNumber || 0,
      amountTotal: Number(session.amount_total) || order.product.priceCents,
      currency: String(session.currency ?? "brl").toLowerCase(),
      livemode: session.livemode === true,
      verifiedAt: new Date().toISOString(),
    },
  };
}

export function checkoutErrorPayload(error) {
  const normalized = error instanceof CheckoutError
    ? error
    : new CheckoutError("checkout_unavailable", 503);
  return {
    status: normalized.status,
    body: { error: normalized.code },
  };
}
