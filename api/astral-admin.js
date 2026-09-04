import { timingSafeEqual } from "node:crypto";
import { generateAstro911DocumentForReview } from "./astro-911.js";
import {
  AstralDeliveryError,
  createAstralPdfSignedUrl,
  decodePdfData,
  reviewerDeliveryStatus,
  sendAstralDeliveryEmail,
  uploadAstralPdf,
} from "../server/astral-delivery.js";
import { buildAstralReviewDraft, sanitizeAstralDraft } from "../server/astral-review.js";
import {
  PaymentLedgerError,
  attachAstralPdf,
  finalizeAstralDelivery,
  getAstralOrderForReview,
  listAstralOrdersForReview,
  requestAstralRevision,
  saveAstralDraft,
} from "../server/payment-ledger.js";

export const config = { maxDuration: 60 };

function sendJson(response, status, payload) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  return response.status(status).json(payload);
}

function authorized(request) {
  const expected = String(process.env.ASTRO911_ADMIN_SECRET ?? "").trim();
  const received = String(request.headers.authorization ?? "").replace(/^Bearer\s+/iu, "").trim();
  if (expected.length < 24 || received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

function originIsAllowed(request) {
  const origin = String(request.headers.origin ?? "").trim();
  if (!origin) return true;
  try {
    const host = String(request.headers["x-forwarded-host"] ?? request.headers.host ?? "").split(",")[0].trim();
    return new URL(origin).host === host;
  } catch { return false; }
}

function parseBody(request) {
  const body = request.body && typeof request.body === "object" ? request.body
    : typeof request.body === "string" ? JSON.parse(request.body) : null;
  if (!body || Array.isArray(body) || JSON.stringify(body).length > 3_900_000) throw new Error("invalid_payload");
  return body;
}

async function detail(orderId) {
  const result = await getAstralOrderForReview(orderId);
  if (result?.found !== true) throw new PaymentLedgerError("purchase_not_found", 404);
  return result;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "method_not_allowed" });
  }
  if (!originIsAllowed(request)) return sendJson(response, 403, { error: "origin_not_allowed" });
  if (!authorized(request)) return sendJson(response, 401, { error: "unauthorized" });

  let body;
  try { body = parseBody(request); } catch { return sendJson(response, 400, { error: "invalid_payload" }); }

  try {
    if (body.action === "list") {
      const result = await listAstralOrdersForReview(body.status, body.limit);
      return sendJson(response, 200, { ...result, configuration: reviewerDeliveryStatus() });
    }
    const orderId = String(body.orderId ?? "").trim();
    if (body.action === "detail") return sendJson(response, 200, await detail(orderId));
    if (body.action === "generate") {
      const current = await detail(orderId);
      // A versão de revisão é sempre uma escrita própria do Agent911 com o
      // autorrelato; não reaproveita silenciosamente a leitura imediata.
      const generated = await generateAstro911DocumentForReview({
        context: current.snapshot?.context,
        questionnaire: current.order?.questionnaire,
        requestId: `review-${orderId}-${Date.now()}`,
      });
      const draft = buildAstralReviewDraft({ order: current.order, snapshot: current.snapshot, generated });
      await saveAstralDraft(orderId, draft, body.note);
      return sendJson(response, 200, await detail(orderId));
    }
    if (body.action === "save") {
      await saveAstralDraft(orderId, sanitizeAstralDraft(body.draft), body.note);
      return sendJson(response, 200, await detail(orderId));
    }
    if (body.action === "revision") {
      await requestAstralRevision(orderId, body.note);
      return sendJson(response, 200, await detail(orderId));
    }
    if (body.action === "upload_pdf") {
      await detail(orderId);
      const buffer = decodePdfData(body.pdfBase64);
      const uploaded = await uploadAstralPdf(orderId, buffer);
      await attachAstralPdf(orderId, uploaded.path);
      return sendJson(response, 200, { ...await detail(orderId), uploaded: { bytes: uploaded.bytes } });
    }
    if (body.action === "pdf_preview") {
      const current = await detail(orderId);
      if (!current.order?.pdfPath) throw new AstralDeliveryError("astral_pdf_unavailable", 404);
      return sendJson(response, 200, await createAstralPdfSignedUrl(current.order.pdfPath, { expiresIn: 900 }));
    }
    if (body.action === "approve") {
      const current = await detail(orderId);
      if (!current.order?.pdfPath || !current.order?.email) throw new AstralDeliveryError("astral_pdf_unavailable", 409);
      const signed = await createAstralPdfSignedUrl(current.order.pdfPath, { expiresIn: 604_800 });
      const email = await sendAstralDeliveryEmail(current.order, signed.url);
      const delivered = await finalizeAstralDelivery(orderId, email.id);
      return sendJson(response, 200, { delivered, emailId: email.id });
    }
    return sendJson(response, 400, { error: "invalid_action" });
  } catch (error) {
    const known = error instanceof PaymentLedgerError || error instanceof AstralDeliveryError;
    const code = known ? error.code : String(error?.message || "astral_admin_unavailable");
    const safeCode = /^[a-z0-9_]{3,80}$/u.test(code) ? code : "astral_admin_unavailable";
    const status = known ? error.status : safeCode === "astral_draft_invalid" ? 400 : 503;
    console.error("astral_admin_failed", { action: body.action, type: safeCode, status });
    return sendJson(response, status, { error: safeCode });
  }
}
