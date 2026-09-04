import { createProductCatalog } from "../src/config/productCatalog.js";
import {
  PaymentLedgerError,
  findPaymentEntitlementByOrder,
  getAstralPdfPath,
  getAstralOrderStatus,
  readPaidContent,
} from "../server/payment-ledger.js";
import { AstralDeliveryError, createAstralPdfSignedUrl } from "../server/astral-delivery.js";
import { normalizeAstralQuestionnaire } from "../src/config/astralQuestionnaire.js";

function sendJson(response, status, payload) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
  return response.status(status).json(payload);
}

function parseBody(request) {
  const body = request.body && typeof request.body === "object"
    ? request.body
    : typeof request.body === "string" ? JSON.parse(request.body) : null;
  if (!body || Array.isArray(body) || JSON.stringify(body).length > 12_000) throw new Error("invalid_payload");
  return body;
}

function originIsAllowed(request) {
  const origin = String(request.headers.origin ?? "").trim();
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const host = String(request.headers["x-forwarded-host"] ?? request.headers.host ?? "").split(",")[0].trim();
    if (originUrl.host === host) return true;
    return String(process.env.ARCANE911_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .includes(originUrl.origin);
  } catch {
    return false;
  }
}

async function verifiedAstralEntitlement(body) {
  const sessionId = String(body?.sessionId ?? "").trim();
  const orderId = String(body?.orderId ?? "").trim();
  const readingId = String(body?.readingId ?? "").trim();
  if (!sessionId || !orderId || !readingId) throw new PaymentLedgerError("astral_order_invalid", 400);

  const entitlement = await findPaymentEntitlementByOrder(orderId);
  const astralProduct = createProductCatalog(process.env).astralDocument;
  if (!entitlement || entitlement.state === "revoked"
      || entitlement.sessionId !== sessionId
      || entitlement.productId !== astralProduct.id
      || entitlement.readingId !== readingId
      || entitlement.offerContext !== "astral_document") {
    throw new PaymentLedgerError("payment_mismatch", 409);
  }
  return entitlement;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "method_not_allowed" });
  }
  if (!originIsAllowed(request)) return sendJson(response, 403, { error: "origin_not_allowed" });

  let body;
  try {
    body = parseBody(request);
  } catch {
    return sendJson(response, 400, { error: "invalid_payload" });
  }

  try {
    const entitlement = await verifiedAstralEntitlement(body);
    if (body.action === "status") {
      const status = await getAstralOrderStatus(entitlement);
      return sendJson(response, 200, status);
    }
    if (body.action === "download") {
      const result = await getAstralPdfPath(entitlement);
      return sendJson(response, 200, await createAstralPdfSignedUrl(result.path, { expiresIn: 86_400 }));
    }
    if (body.action !== "register") return sendJson(response, 400, { error: "invalid_action" });

    // New orders are queued transactionally by the payment callback, never by
    // accepting a second, potentially different set of birth data after payment.
    const content = await readPaidContent(entitlement);
    if (content.snapshot?.chart) {
      const chart = content.snapshot.chart;
      if (body.birth?.date !== chart.birth.date || body.birth?.time !== chart.birth.time
          || body.fullName !== chart.person || String(body.email).trim().toLowerCase() !== content.snapshot.email
          || JSON.stringify(normalizeAstralQuestionnaire(body.questionnaire))
            !== JSON.stringify(normalizeAstralQuestionnaire(content.snapshot.questionnaire))
          || Number(body.location?.latitude) !== chart.location.latitude
          || Number(body.location?.longitude) !== chart.location.longitude) {
        throw new PaymentLedgerError("payment_mismatch", 409);
      }
      return sendJson(response, 200, { registered: true, ...await getAstralOrderStatus(entitlement) });
    }
    throw new PaymentLedgerError("astral_order_requires_support", 409);
  } catch (error) {
    const known = error instanceof PaymentLedgerError || error instanceof AstralDeliveryError;
    const code = known ? error.code : "astral_order_unavailable";
    const status = known ? error.status : 503;
    return sendJson(response, status, { error: code });
  }
}
