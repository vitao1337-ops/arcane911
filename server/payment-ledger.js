import { createProductCatalog, findCatalogProduct } from "../src/config/productCatalog.js";

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
    String(env.SUPABASE_SECRET_KEY ?? "").trim()
      || env.SUPABASE_SERVICE_ROLE_KEY
      || "",
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
  if (result?.ready !== true || Number(result?.version) !== 5) {
    throw new PaymentLedgerError("payment_ledger_not_ready", 503, 5_000);
  }
  return result;
}

export async function assertAstralFulfillmentReady(options = {}) {
  const result = await callLedgerRpc("arcane911_astral_fulfillment_health", {}, options);
  if (result?.ready !== true || Number(result?.version) !== 2) {
    throw new PaymentLedgerError("astral_fulfillment_not_ready", 503, 5_000);
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

function normalizedEntitlement(entitlement, env = process.env) {
  const product = findCatalogProduct(
    createProductCatalog(env),
    cleanIdentifier(entitlement?.productId, 80),
  );
  const normalized = {
    sessionId: cleanIdentifier(entitlement?.sessionId),
    providerTransactionId: cleanIdentifier(entitlement?.providerTransactionId),
    orderId: cleanIdentifier(entitlement?.orderId, 120),
    productId: cleanIdentifier(entitlement?.productId, 80),
    productKind: cleanIdentifier(product?.kind, 40),
    readingId: cleanIdentifier(entitlement?.readingId, 120),
    readingSlug: cleanIdentifier(entitlement?.readingSlug, 40),
    offerContext: cleanIdentifier(entitlement?.offerContext, 40),
    questionNumber: Number(entitlement?.questionNumber) || 0,
    amountTotal: Number(entitlement?.amountTotal) || 0,
    currency: cleanIdentifier(entitlement?.currency, 8).toLowerCase(),
    livemode: entitlement?.livemode === true,
    verifiedAt: String(entitlement?.verifiedAt ?? "").trim().slice(0, 40),
  };
  if (!normalized.sessionId || !normalized.orderId || !normalized.productId || !normalized.productKind
      || !normalized.readingId
      || !Number.isInteger(normalized.amountTotal) || normalized.amountTotal <= 0
      || normalized.currency !== "brl") {
    throw new PaymentLedgerError("payment_ledger_invalid_entitlement", 400);
  }
  return normalized;
}

export async function registerPaymentEntitlement(entitlement, options = {}) {
  const normalized = normalizedEntitlement(entitlement, options.env ?? process.env);
  const result = await callLedgerRpc("arcane911_register_entitlement", {
    p_payment_id: normalized.sessionId,
    p_provider_transaction_id: normalized.providerTransactionId,
    p_order_id: normalized.orderId,
    p_product_id: normalized.productId,
    p_product_kind: normalized.productKind,
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
  if (result.state === "revoked") throw new PaymentLedgerError("payment_revoked", 403);
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
    completeSummaryUsed: result.completeSummaryUsed === true,
    includedQuestionsUsed: Math.max(0, Number(result.includedQuestionsUsed) || 0),
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
    p_payment_id: normalized.sessionId,
    p_claim_id: normalized.claimId,
    p_product_id: normalized.productId,
    p_reading_id: normalized.readingId,
    p_question_number: normalized.questionNumber,
  }, options);
  if (result?.claimed !== true) {
    throw new PaymentLedgerError(result?.state === "processing" ? "purchase_processing" : "payment_credit_unavailable", result?.state === "processing" ? 409 : 402, 5000);
  }
  return result;
}

export async function claimBundlePaymentEntitlement(access, options = {}) {
  const normalized = {
    sessionId: cleanIdentifier(access?.sessionId),
    claimId: cleanIdentifier(access?.claimId, 120),
    productId: cleanIdentifier(access?.productId, 80),
    readingId: cleanIdentifier(access?.readingId, 120),
    claimScope: cleanIdentifier(access?.claimScope, 40),
    claimSlot: Number(access?.claimSlot) || 0,
  };
  const validScope = normalized.claimScope === "complete_summary"
    ? normalized.claimSlot === 0
    : normalized.claimScope === "specific_summary"
      && Number.isInteger(normalized.claimSlot)
      && normalized.claimSlot >= 1
      && normalized.claimSlot <= 5;
  if (!normalized.sessionId || !normalized.claimId || !normalized.productId || !normalized.readingId || !validScope) {
    throw new PaymentLedgerError("payment_required", 402);
  }
  const result = await callLedgerRpc("arcane911_claim_bundle_entitlement", {
    p_payment_id: normalized.sessionId,
    p_claim_id: normalized.claimId,
    p_product_id: normalized.productId,
    p_reading_id: normalized.readingId,
    p_claim_scope: normalized.claimScope,
    p_claim_slot: normalized.claimSlot,
  }, options);
  if (result?.claimed !== true) {
    throw new PaymentLedgerError(result?.state === "processing" ? "purchase_processing" : "payment_credit_unavailable", result?.state === "processing" ? 409 : 402, 5000);
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
    p_payment_id: sessionId,
    p_claim_id: claimId,
    p_outcome: outcome,
  }, options);
  if (result?.settled !== true) {
    throw new PaymentLedgerError("payment_ledger_conflict", 409);
  }
  return result;
}

export async function settleBundlePaymentEntitlement(access, outcome, options = {}) {
  const sessionId = cleanIdentifier(access?.sessionId);
  const claimId = cleanIdentifier(access?.claimId, 120);
  const claimScope = cleanIdentifier(access?.claimScope, 40);
  const claimSlot = Number(access?.claimSlot) || 0;
  if (!sessionId || !claimId || !["complete_summary", "specific_summary"].includes(claimScope)
      || !Number.isInteger(claimSlot) || claimSlot < 0 || claimSlot > 5
      || !["consumed", "released"].includes(outcome)) {
    throw new PaymentLedgerError("payment_ledger_invalid_entitlement", 400);
  }
  const result = await callLedgerRpc("arcane911_settle_bundle_entitlement", {
    p_payment_id: sessionId,
    p_claim_id: claimId,
    p_claim_scope: claimScope,
    p_claim_slot: claimSlot,
    p_outcome: outcome,
  }, options);
  if (result?.settled !== true) {
    throw new PaymentLedgerError("payment_ledger_conflict", 409);
  }
  return result;
}

function cleanEmail(value) {
  const email = String(value ?? "").trim().toLowerCase().slice(0, 150);
  return /^\S+@\S+\.\S+$/u.test(email) ? email : "";
}

export async function registerAstralOrder(order, options = {}) {
  const normalized = {
    sessionId: cleanIdentifier(order?.sessionId),
    orderId: cleanIdentifier(order?.orderId, 120),
    readingId: cleanIdentifier(order?.readingId, 120),
    fullName: String(order?.fullName ?? "").replace(/\s+/gu, " ").trim().slice(0, 80),
    email: cleanEmail(order?.email),
    birthDate: String(order?.birthDate ?? "").trim().slice(0, 10),
    birthTime: String(order?.birthTime ?? "").trim().slice(0, 8),
    cityName: String(order?.cityName ?? "").replace(/\s+/gu, " ").trim().slice(0, 120),
    regionName: String(order?.regionName ?? "").replace(/\s+/gu, " ").trim().slice(0, 120),
    countryName: String(order?.countryName ?? "").replace(/\s+/gu, " ").trim().slice(0, 120),
    timezone: String(order?.timezone ?? "").trim().slice(0, 80),
    latitude: Number(order?.latitude),
    longitude: Number(order?.longitude),
  };
  if (!normalized.sessionId || !normalized.orderId || !normalized.readingId
      || normalized.fullName.length < 2 || !normalized.email
      || !/^\d{4}-\d{2}-\d{2}$/u.test(normalized.birthDate)
      || !/^\d{2}:\d{2}(?::\d{2})?$/u.test(normalized.birthTime)
      || !normalized.cityName || !normalized.countryName || !normalized.timezone
      || !Number.isFinite(normalized.latitude) || normalized.latitude < -90 || normalized.latitude > 90
      || !Number.isFinite(normalized.longitude) || normalized.longitude < -180 || normalized.longitude > 180) {
    throw new PaymentLedgerError("astral_order_invalid", 400);
  }

  const result = await callLedgerRpc("arcane911_register_astral_order", {
    p_payment_id: normalized.sessionId,
    p_order_id: normalized.orderId,
    p_reading_id: normalized.readingId,
    p_full_name: normalized.fullName,
    p_email: normalized.email,
    p_birth_date: normalized.birthDate,
    p_birth_time: normalized.birthTime,
    p_city_name: normalized.cityName,
    p_region_name: normalized.regionName,
    p_country_name: normalized.countryName,
    p_timezone: normalized.timezone,
    p_latitude: normalized.latitude,
    p_longitude: normalized.longitude,
  }, options);
  if (result?.registered !== true) throw new PaymentLedgerError("astral_order_conflict", 409);
  return result;
}

export async function getAstralOrderStatus(access, options = {}) {
  const normalized = {
    sessionId: cleanIdentifier(access?.sessionId),
    orderId: cleanIdentifier(access?.orderId, 120),
    readingId: cleanIdentifier(access?.readingId, 120),
  };
  if (!normalized.sessionId || !normalized.orderId || !normalized.readingId) {
    throw new PaymentLedgerError("astral_order_invalid", 400);
  }
  return callLedgerRpc("arcane911_get_astral_order_status", {
    p_payment_id: normalized.sessionId,
    p_order_id: normalized.orderId,
    p_reading_id: normalized.readingId,
  }, options);
}

export async function markAstralOrderDelivered(orderIdValue, options = {}) {
  const orderId = cleanIdentifier(orderIdValue, 120);
  if (!orderId.startsWith("order-") || orderId.length < 18) {
    throw new PaymentLedgerError("invalid_order", 400);
  }
  const result = await callLedgerRpc("arcane911_mark_astral_order_delivered", {
    p_order_id: orderId,
  }, options);
  if (result?.updated !== true) throw new PaymentLedgerError("purchase_not_found", 404);
  return result;
}

export async function claimAstralQuestion(access, options = {}) {
  const normalized = {
    sessionId: cleanIdentifier(access?.sessionId),
    orderId: cleanIdentifier(access?.orderId, 120),
    readingId: cleanIdentifier(access?.readingId, 120),
    claimId: cleanIdentifier(access?.claimId, 120),
  };
  if (!normalized.sessionId || !normalized.orderId || !normalized.readingId || !normalized.claimId) {
    throw new PaymentLedgerError("payment_required", 402);
  }
  const result = await callLedgerRpc("arcane911_claim_astral_question", {
    p_payment_id: normalized.sessionId,
    p_order_id: normalized.orderId,
    p_reading_id: normalized.readingId,
    p_claim_id: normalized.claimId,
  }, options);
  if (result?.replayed === true) return result;
  if (result?.claimed !== true) {
    if (result?.state === "processing") throw new PaymentLedgerError("purchase_processing", 409, 5000);
    const code = result?.state === "delivery_required" ? "astral_delivery_required" : "payment_credit_unavailable";
    throw new PaymentLedgerError(code, code === "astral_delivery_required" ? 403 : 402);
  }
  return result;
}

export async function preparePurchase(order, options = {}) {
  const result = await callLedgerRpc('arcane911_prepare_purchase', {
    p_order_id: order.orderId, p_product_id: order.product.id,
    p_reading_id: order.readingId, p_amount_total: order.product.priceCents,
    p_snapshot: order.snapshot,
  }, options);
  if (!result?.prepared) throw new PaymentLedgerError('payment_mismatch', 409);
  return result;
}

export async function revokePaymentEntitlement(sessionId, reason, options = {}) {
  return callLedgerRpc('arcane911_revoke_entitlement', {
    p_payment_id: cleanIdentifier(sessionId), p_reason: cleanIdentifier(reason, 40),
  }, options);
}

export async function readPaidContent(access, options = {}) {
  const result = await callLedgerRpc('arcane911_read_paid_content', {
    p_payment_id: cleanIdentifier(access.sessionId),
    p_product_id: cleanIdentifier(access.productId, 80),
    p_reading_id: cleanIdentifier(access.readingId, 120),
    p_order_id: cleanIdentifier(access.orderId, 120),
  }, options);
  if (!result?.authorized) throw new PaymentLedgerError(result?.state === 'revoked' ? 'payment_revoked' : 'payment_required', 403);
  return result;
}

export async function completePaidContent(access, payload, input, options = {}) {
  const result = await callLedgerRpc('arcane911_complete_paid_content', {
    p_payment_id: cleanIdentifier(access.sessionId), p_claim_id: cleanIdentifier(access.claimId, 120),
    p_scope: access.claimScope || 'single', p_slot: Number(access.claimSlot) || 0,
    p_payload: payload, p_input: input,
  }, options);
  if (!result?.settled) throw new PaymentLedgerError(result?.state === 'revoked' ? 'payment_revoked' : 'payment_ledger_conflict', 409);
  return result.payload;
}

export async function settleAstralQuestion(access, outcome, options = {}) {
  const normalized = {
    sessionId: cleanIdentifier(access?.sessionId),
    claimId: cleanIdentifier(access?.claimId, 120),
    claimSlot: Number(access?.claimSlot) || 0,
  };
  if (!normalized.sessionId || !normalized.claimId
      || !Number.isInteger(normalized.claimSlot) || normalized.claimSlot < 1 || normalized.claimSlot > 5
      || !["consumed", "released"].includes(outcome)) {
    throw new PaymentLedgerError("payment_ledger_invalid_entitlement", 400);
  }
  const result = await callLedgerRpc("arcane911_settle_astral_question", {
    p_payment_id: normalized.sessionId,
    p_claim_id: normalized.claimId,
    p_claim_slot: normalized.claimSlot,
    p_outcome: outcome,
  }, options);
  if (result?.settled !== true) throw new PaymentLedgerError("payment_ledger_conflict", 409);
  return result;
}
