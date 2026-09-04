import { randomBytes } from "node:crypto";

const MAX_PDF_BYTES = 2_700_000;
const STORAGE_TIMEOUT_MS = 15_000;
const EMAIL_TIMEOUT_MS = 15_000;
const DEFAULT_BUCKET = "arcane911-astral-pdfs";
const readyBuckets = globalThis.__arcane911ReadyPdfBuckets ?? new Set();
globalThis.__arcane911ReadyPdfBuckets = readyBuckets;

export class AstralDeliveryError extends Error {
  constructor(code, status = 503) {
    super(code);
    this.name = "AstralDeliveryError";
    this.code = code;
    this.status = status;
  }
}

function cleanEmail(value) {
  const email = String(value ?? "").trim().toLowerCase().slice(0, 150);
  return /^\S+@\S+\.\S+$/u.test(email) ? email : "";
}

function isExampleAddress(value) {
  return /@example\.(?:com|org|net)(?:>|$)/iu.test(String(value ?? "").trim());
}

function storageConfig(env = process.env) {
  const rawUrl = String(env.SUPABASE_URL ?? "").trim().replace(/\/+$/u, "");
  const key = String(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const bucket = String(env.ASTRO911_PDF_BUCKET || DEFAULT_BUCKET).trim();
  let url;
  try { url = new URL(rawUrl); } catch { throw new AstralDeliveryError("pdf_storage_not_configured"); }
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:"))
      || key.length < 20 || !/^[a-z0-9][a-z0-9._-]{2,62}$/u.test(bucket)) {
    throw new AstralDeliveryError("pdf_storage_not_configured");
  }
  return { baseUrl: url.origin, key, bucket };
}

function storageHeaders(key, contentType = "application/json") {
  const headers = { apikey: key, "Content-Type": contentType };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function timedFetch(url, options, timeoutMs, fetchImplementation) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("request_timeout"), timeoutMs);
  try { return await fetchImplementation(url, { ...options, signal: controller.signal }); }
  catch { throw new AstralDeliveryError("delivery_provider_unavailable", 503); }
  finally { clearTimeout(timeout); }
}

async function ensurePrivateBucket(config, fetchImplementation) {
  const cacheKey = `${config.baseUrl}:${config.bucket}`;
  if (readyBuckets.has(cacheKey)) return;
  const check = await timedFetch(
    `${config.baseUrl}/storage/v1/bucket/${encodeURIComponent(config.bucket)}`,
    { headers: storageHeaders(config.key) },
    STORAGE_TIMEOUT_MS,
    fetchImplementation,
  );
  if (check.ok) {
    const current = await check.json().catch(() => ({}));
    if (current?.public === true) throw new AstralDeliveryError("pdf_bucket_must_be_private", 409);
    readyBuckets.add(cacheKey);
    return;
  }
  if (check.status !== 404) throw new AstralDeliveryError("pdf_storage_unavailable");
  const create = await timedFetch(
    `${config.baseUrl}/storage/v1/bucket`,
    {
      method: "POST",
      headers: storageHeaders(config.key),
      body: JSON.stringify({
        id: config.bucket,
        name: config.bucket,
        public: false,
        file_size_limit: MAX_PDF_BYTES,
        allowed_mime_types: ["application/pdf"],
      }),
    },
    STORAGE_TIMEOUT_MS,
    fetchImplementation,
  );
  if (!create.ok && create.status !== 409) throw new AstralDeliveryError("pdf_storage_unavailable");
  readyBuckets.add(cacheKey);
}

export function decodePdfData(value) {
  const raw = String(value ?? "").replace(/^data:application\/pdf;base64,/iu, "").trim();
  if (!raw || !/^[a-zA-Z0-9+/]+={0,2}$/u.test(raw)
      || raw.length > Math.ceil(MAX_PDF_BYTES * 4 / 3) + 8) {
    throw new AstralDeliveryError("pdf_too_large", 413);
  }
  const buffer = Buffer.from(raw, "base64");
  if (buffer.length < 100 || buffer.length > MAX_PDF_BYTES
      || buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new AstralDeliveryError(buffer.length > MAX_PDF_BYTES ? "pdf_too_large" : "pdf_invalid", buffer.length > MAX_PDF_BYTES ? 413 : 400);
  }
  return buffer;
}

export async function uploadAstralPdf(orderIdValue, pdfBuffer, options = {}) {
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  if (typeof fetchImplementation !== "function") throw new AstralDeliveryError("pdf_storage_unavailable");
  const orderId = String(orderIdValue ?? "").trim();
  if (!/^order-[a-zA-Z0-9:._-]{12,114}$/u.test(orderId) || !Buffer.isBuffer(pdfBuffer)) {
    throw new AstralDeliveryError("pdf_invalid", 400);
  }
  if (pdfBuffer.length > MAX_PDF_BYTES || pdfBuffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new AstralDeliveryError("pdf_invalid", 400);
  }
  const config = storageConfig(options.env ?? process.env);
  await ensurePrivateBucket(config, fetchImplementation);
  const path = `astral/${orderId}/${Date.now()}-${randomBytes(5).toString("hex")}.pdf`;
  const upload = await timedFetch(
    `${config.baseUrl}/storage/v1/object/${config.bucket}/${path}`,
    {
      method: "POST",
      headers: { ...storageHeaders(config.key, "application/pdf"), "x-upsert": "false" },
      body: pdfBuffer,
    },
    STORAGE_TIMEOUT_MS,
    fetchImplementation,
  );
  if (!upload.ok) throw new AstralDeliveryError("pdf_upload_failed", 503);
  return { path, bytes: pdfBuffer.length };
}

export async function createAstralPdfSignedUrl(pathValue, options = {}) {
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  const path = String(pathValue ?? "").trim();
  if (!/^astral\/[a-zA-Z0-9:._/-]+\.pdf$/u.test(path)) throw new AstralDeliveryError("pdf_invalid", 400);
  const config = storageConfig(options.env ?? process.env);
  const expiresIn = Math.max(300, Math.min(604_800, Number(options.expiresIn) || 86_400));
  const response = await timedFetch(
    `${config.baseUrl}/storage/v1/object/sign/${config.bucket}/${path}`,
    {
      method: "POST",
      headers: storageHeaders(config.key),
      body: JSON.stringify({ expiresIn }),
    },
    STORAGE_TIMEOUT_MS,
    fetchImplementation,
  );
  const payload = await response.json().catch(() => ({}));
  const signed = String(payload?.signedURL ?? payload?.signedUrl ?? "").trim();
  if (!response.ok || !signed) throw new AstralDeliveryError("pdf_link_failed", 503);
  const url = signed.startsWith("http")
    ? signed
    : `${config.baseUrl}/storage/v1${signed.startsWith("/") ? "" : "/"}${signed}`;
  if (!url.startsWith(`${config.baseUrl}/storage/v1/`)) throw new AstralDeliveryError("pdf_link_failed", 503);
  return { url, expiresAt: new Date(Date.now() + expiresIn * 1_000).toISOString() };
}

function emailConfig(env = process.env) {
  const apiKey = String(env.RESEND_API_KEY ?? "").trim();
  const from = String(env.ARCANE911_FROM_EMAIL ?? "").trim().slice(0, 240);
  if (apiKey.length < 20 || !from || isExampleAddress(from)) {
    throw new AstralDeliveryError("email_not_configured", 503);
  }
  return { apiKey, from };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]);
}

async function sendEmail({ to, subject, html, idempotencyKey }, options = {}) {
  const recipient = cleanEmail(to);
  if (!recipient) throw new AstralDeliveryError("email_invalid", 400);
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  const config = emailConfig(options.env ?? process.env);
  const response = await timedFetch(
    "https://api.resend.com/emails",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": String(idempotencyKey ?? "").slice(0, 256),
      },
      body: JSON.stringify({ from: config.from, to: [recipient], subject, html }),
    },
    EMAIL_TIMEOUT_MS,
    fetchImplementation,
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.id) throw new AstralDeliveryError("email_send_failed", 503);
  return { id: String(payload.id).slice(0, 240) };
}

export function reviewerDeliveryStatus(env = process.env) {
  const reviewerEmail = cleanEmail(env.REVIEWER_EMAIL);
  let emailReady = true;
  try { emailConfig(env); } catch { emailReady = false; }
  return {
    reviewerEmail: reviewerEmail && !isExampleAddress(reviewerEmail) ? reviewerEmail : "",
    reviewerEmailConfigured: Boolean(reviewerEmail && !isExampleAddress(reviewerEmail)),
    outboundEmailConfigured: emailReady,
  };
}

export async function notifyAstralReviewer(order, options = {}) {
  const env = options.env ?? process.env;
  const status = reviewerDeliveryStatus(env);
  if (!status.reviewerEmailConfigured || !status.outboundEmailConfigured) {
    return { sent: false, skipped: true };
  }
  const name = escapeHtml(order?.fullName || "Novo cliente");
  const orderId = escapeHtml(order?.orderId || "");
  const publicUrl = String(env.VITE_PUBLIC_SITE_URL || "https://arcane911.vercel.app").replace(/\/+$/u, "");
  const result = await sendEmail({
    to: status.reviewerEmail,
    subject: `Novo mapa para revisar · ${order?.fullName || order?.orderId || "Arcane911"}`,
    idempotencyKey: `astral-review-${order?.orderId}`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#241b2c"><h1 style="font-family:Georgia,serif">Um novo céu entrou na sua mesa.</h1><p><strong>${name}</strong> concluiu a compra do Documento Astral 911.</p><p>Código: <code>${orderId}</code></p><p><a href="${escapeHtml(`${publicUrl}/admin/mapas`)}">Abrir bancada de revisão</a></p><p style="color:#6e6174">O cliente só recebe o PDF depois da sua aprovação.</p></div>`,
  }, options);
  return { sent: true, ...result };
}

export async function sendAstralDeliveryEmail(order, signedUrl, options = {}) {
  const rawFirstName = String(order?.fullName || "").trim().split(/\s+/u)[0] || "Olá";
  return sendEmail({
    to: order?.email,
    subject: `${rawFirstName}, seu Documento Astral 911 está pronto`,
    idempotencyKey: `astral-delivery-${order?.orderId}`,
    html: `<div style="max-width:620px;margin:auto;font-family:Arial,sans-serif;line-height:1.7;color:#241b2c"><p style="color:#74539a;letter-spacing:.12em;text-transform:uppercase">Arcane911 · entrega individual</p><h1 style="font-family:Georgia,serif;font-size:34px">${escapeHtml(rawFirstName)}, o seu céu voltou em forma de leitura.</h1><p>O Agent911 construiu a primeira camada e a síntese passou pela revisão humana do seu tarólogo. Agora o documento é seu.</p><p><a href="${escapeHtml(signedUrl)}" style="display:inline-block;background:#5d2c91;color:white;text-decoration:none;padding:14px 22px;border-radius:999px">Abrir meu PDF privado</a></p><p>O link é temporário por segurança. Se expirar, volte ao seu mapa no Arcane911 e toque em <strong>Baixar minha síntese em PDF</strong> para gerar outro.</p><p style="color:#6e6174">Depois desta entrega, as 5 perguntas incluídas no seu pedido ficam liberadas no site.</p></div>`,
  }, options);
}

export const ASTRAL_PDF_MAX_BYTES = MAX_PDF_BYTES;
