const LEDGER_TIMEOUT_MS = 6_000;

export class PaymentLedgerError extends Error {
  constructor(code, status = 503, retryAfterMs = 0) {
    super(code);
    this.name = "PaymentLedgerError";
    this.code = code;
    this.status = status;
    this.retryAfterMs = Math.max(0, Number(retryAfterMs) || 0);
  }
}

function cleanIdentifier(value, maximumLength = 240) {
  const normalized = String(value ?? "").trim().slice(0, maximumLength);
  return /^[a-zA-Z0-9:._-]+$/u.test(normalized) ? normalized : "";
}

function ledgerConfig(env = process.env) {
  const rawUrl = String(env.SUPABASE_URL ?? "").trim().replace(/\/+$/u, "");
  const secretKey = String(
    env.SUPABASE_SECRET_KEY
      ?? env.SUPABASE_SERVICE_ROLE_KEY
      ?? "",
  ).trim();
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new PaymentLedgerError("payment_ledger_not_configured", 503);
  }
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || secretKey.length < 20) {
    throw new PaymentLedgerError("payment_ledger_not_configured", 503);
  }
  return { baseUrl: url.origin, secretKey };
}

export function paymentLedgerConfigured(env = process.env) {
  try {
    ledgerConfig(env);
    return true;
  } catch {
    return false;
  }
}

export async function assertPaymentLedgerReady(options = {}) {
  const result = await callLedgerRpc("arcane911_payment_ledger_health", {}, options);
  if (result?.ready !== true || Number(result?.version) !== 2) {
    throw new PaymentLedgerError("payment_ledger_not_ready", 503, 5_000);
  }
  return result;
}

function requestHeaders(secretKey) {
  const headers = {
    Accept: "application/json",
    apikey: secretKey,
    "Content-Type": "application/json",
  };
  // As chaves sb_secret_ usam apenas apikey. A chave service_role legada
  // continua aceita temporariamente e também precisa do JWT no Authorization.
  if (!secretKey.startsWith("sb_secret_")) {
    headers.Authorization = `Bearer ${secretKey}`;
  }
  return headers;
}

async function callLedgerRpc(functionName, body, {
  env = process.env,
  fetchImplementation = globalThis.fetch,
} = {}) {
  const config = ledgerConfig(env);
  if (typeof fetchImplementation !== "function") {
    throw new PaymentLedgerError("payment_ledger_unavailable", 503, 5_000);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("ledger_timeout"), LEDGER_TIMEOUT_MS);
  try {
    const response = await fetchImplementation(
      `${config.baseUrl}/rest/v1/rpc/${functionName}`,
      {
        method: "POST",
        headers: requestHeaders(config.secretKey),
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const missingSchema = response.status === 404
        || ["PGRST202", "PGRST205"].includes(String(payload?.code ?? ""));
      throw new PaymentLedgerError(
        missingSchema ? "payment_ledger_not_ready" : "payment_ledger_unavailable",
        503,
        5_000,
      );
    }
    return payload;
  } catch (error) {
    if (error instanceof PaymentLedgerError) throw error;
    throw new PaymentLedgerError("payment_ledger_unavailable", 503, 5_000);
  } finally {
    clearTimeout(timeout);
  }
}

function normalizedEntitlement(entitlement) {
  const normalized = {
    sessionId: cleanIdentifier(entitlement?.sessionId),
    paymentIntentId: cleanIdentifier(entitlement?.paymentIntentId),
    orderId: cleanIdentifier(entitlement?.orderId, 120),
    productId: cleanIdentifier(entitlement?.productId, 80),
    readingId: cleanIdentifier(entitlement?.readingId, 120),
    readingSlug: cleanIdentifier(entitlement?.readingSlug, 40),
    offerContext: cleanIdentifier(entitlement?.offerContext, 40),
    questionNumber: Number(entitlement?.questionNumber) || 0,
    amountTotal: Number(entitlement?.amountTotal) || 0,
    currency: cleanIdentifier(entitlement?.currency, 8).toLowerCase(),
    livemode: entitlement?.livemode === true,
    verifiedAt: String(entitlement?.verifiedAt ?? "").trim().slice(0, 40),
  };
  if (!normalized.sessionId || !normalized.orderId || !normalized.productId || !normalized.readingId
      || !Number.isInteger(normalized.amountTotal) || normalized.amountTotal <= 0
      || normalized.currency !== "brl") {
    throw new PaymentLedgerError("payment_ledger_invalid_entitlement", 400);
  }
  return normalized;
}

export async function registerPaymentEntitlement(entitlement, options = {}) {
  const normalized = normalizedEntitlement(entitlement);
  const result = await callLedgerRpc("arcane911_register_entitlement", {
    p_stripe_session_id: normalized.sessionId,
    p_payment_intent_id: normalized.paymentIntentId,
    p_order_id: normalized.orderId,
    p_product_id: normalized.productId,
    p_reading_id: normalized.readingId,
    p_reading_slug: normalized.readingSlug,
    p_offer_context: normalized.offerContext,
    p_question_number: normalized.questionNumber,
    p_amount_total: normalized.amountTotal,
    p_currency: normalized.currency,
    p_livemode: normalized.livemode,
    p_verified_at: normalized.verifiedAt || new Date().toISOString(),
  }, options);
  if (result?.registered !== true) {
    throw new PaymentLedgerError("payment_ledger_conflict", 409);
  }
  return result;
}

export async function findPaymentEntitlementByOrder(orderIdValue, options = {}) {
  const orderId = cleanIdentifier(orderIdValue, 120);
  if (!orderId.startsWith("order-") || orderId.length < 18) {
    throw new PaymentLedgerError("invalid_order", 400);
  }
  const result = await callLedgerRpc("arcane911_find_entitlement", {
    p_order_id: orderId,
  }, options);
  if (result?.found !== true) return null;

  const entitlement = {
    sessionId: cleanIdentifier(result.sessionId),
    orderId: cleanIdentifier(result.orderId, 120),
    productId: cleanIdentifier(result.productId, 80),
    readingId: cleanIdentifier(result.readingId, 120),
    readingSlug: cleanIdentifier(result.readingSlug, 40),
    offerContext: cleanIdentifier(result.offerContext, 40),
    questionNumber: Number(result.questionNumber) || 0,
    amountTotal: Number(result.amountTotal) || 0,
    currency: cleanIdentifier(result.currency, 8).toLowerCase(),
    livemode: result.livemode === true,
    state: cleanIdentifier(result.state, 24),
    verifiedAt: String(result.verifiedAt ?? "").trim().slice(0, 40),
  };
  if (!entitlement.sessionId || !entitlement.orderId || !entitlement.productId
      || !entitlement.readingId || entitlement.orderId !== orderId) {
    throw new PaymentLedgerError("payment_ledger_unavailable", 503, 5_000);
  }
  return entitlement;
}

export async function claimPaymentEntitlement(access, options = {}) {
  const normalized = {
    sessionId: cleanIdentifier(access?.sessionId),
    claimId: cleanIdentifier(access?.claimId, 120),
    productId: cleanIdentifier(access?.productId, 80),
    readingId: cleanIdentifier(access?.readingId, 120),
    questionNumber: Number(access?.questionNumber) || 0,
  };
  if (!normalized.sessionId || !normalized.claimId || !normalized.productId || !normalized.readingId) {
    throw new PaymentLedgerError("payment_required", 402);
  }
  const result = await callLedgerRpc("arcane911_claim_entitlement", {
    p_stripe_session_id: normalized.sessionId,
    p_claim_id: normalized.claimId,
    p_product_id: normalized.productId,
    p_reading_id: normalized.readingId,
    p_question_number: normalized.questionNumber,
  }, options);
  if (result?.claimed !== true) {
    throw new PaymentLedgerError("payment_credit_unavailable", 402);
  }
  return result;
}

export async function settlePaymentEntitlement(access, outcome, options = {}) {
  const sessionId = cleanIdentifier(access?.sessionId);
  const claimId = cleanIdentifier(access?.claimId, 120);
  if (!sessionId || !claimId || !["consumed", "released"].includes(outcome)) {
    throw new PaymentLedgerError("payment_ledger_invalid_entitlement", 400);
  }
  const result = await callLedgerRpc("arcane911_settle_entitlement", {
    p_stripe_session_id: sessionId,
    p_claim_id: claimId,
    p_outcome: outcome,
  }, options);
  if (result?.settled !== true) {
    throw new PaymentLedgerError("payment_ledger_conflict", 409);
  }
  return result;
}
