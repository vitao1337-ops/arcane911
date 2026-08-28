import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { ASTRO911_SCHEMA_VERSION, validateAstro911Request, auditAstro911Answer } from "../server/astro911-core.js";
import { createProductCatalog } from "../src/config/productCatalog.js";
import {
  PaymentLedgerError,
  claimAstralQuestion,
  findPaymentEntitlementByOrder,
  getAstralOrderStatus,
  settleAstralQuestion,
  readPaidContent,
  completePaidContent,
} from "../server/payment-ledger.js";

const buckets = globalThis.__arcane911AstralQuestionBuckets ?? new Map();
globalThis.__arcane911AstralQuestionBuckets = buckets;

function sendJson(response, status, payload) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
  return response.status(status).json(payload);
}

function cleanText(value, maximum = 600) {
  return String(value ?? "").replace(/\s+/gu, " ").trim().slice(0, maximum);
}

function parseBody(request) {
  const body = request.body && typeof request.body === "object"
    ? request.body
    : typeof request.body === "string" ? JSON.parse(request.body) : null;
  if (!body || Array.isArray(body) || JSON.stringify(body).length > 48_000) throw new Error("invalid_payload");
  return body;
}

function originIsAllowed(request) {
  const origin = String(request.headers.origin ?? "").trim();
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const host = String(request.headers["x-forwarded-host"] ?? request.headers.host ?? "").split(",")[0].trim();
    if (originUrl.host === host) return true;
    return String(process.env.ARCANE911_ALLOWED_ORIGINS ?? "").split(",").map((v) => v.trim()).filter(Boolean).includes(originUrl.origin);
  } catch {
    return false;
  }
}

function rateAllowed(request) {
  const ip = String(request.headers["x-forwarded-for"] ?? request.socket?.remoteAddress ?? "unknown").split(",")[0].trim();
  const now = Date.now();
  const current = buckets.get(ip);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + 10 * 60 * 1_000 } : current;
  bucket.count += 1;
  buckets.set(ip, bucket);
  for (const [key, value] of buckets) if (value.resetAt <= now) buckets.delete(key);
  while (buckets.size > 2000) buckets.delete(buckets.keys().next().value);
  return bucket.count <= 12;
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function validateChartContext(context) {
  const chart = context?.chart;
  if (!chart || !Array.isArray(chart.planets) || chart.planets.length !== 10
      || !Array.isArray(chart.houses) || chart.houses.length !== 12
      || !Array.isArray(chart.aspects) || chart.aspects.length < 3) {
    throw new PaymentLedgerError("invalid_payload", 400);
  }
  return chart;
}

function expectedReadingId(chart) {
  return `astro-v1-${hashString(JSON.stringify(chart))}`;
}

function chartFacts(chart) {
  const planets = chart.planets.map((p) => `${p.key}: ${p.signKey}, casa ${p.house}, ${p.degreeLabel}${p.retrograde ? ", retrógrado" : ""}`);
  const houses = chart.houses.map((h) => `Casa ${h.number}: ${h.signKey} ${h.degreeLabel}${h.planetKeys?.length ? `; planetas ${h.planetKeys.join(", ")}` : ""}`);
  const aspects = chart.aspects.slice(0, 16).map((a) => `${a.point1Key} ${a.aspectKey} ${a.point2Key}, orbe ${a.orb}`);
  return [
    `Pessoa: ${cleanText(chart.person, 60).split(/\s+/u)[0] || "Pessoa"}`,
    `Ascendente: ${chart.ascendant?.signKey} ${chart.ascendant?.degreeLabel}`,
    `Meio do Céu: ${chart.midheaven?.signKey} ${chart.midheaven?.degreeLabel}`,
    `Elemento dominante: ${cleanText(chart.dominantElement, 20)}`,
    `Planetas:\n${planets.join("\n")}`,
    `Casas:\n${houses.join("\n")}`,
    `Aspectos:\n${aspects.join("\n")}`,
  ].join("\n\n");
}

function systemPrompt() {
  return [
    "Você é o Agent911 no módulo de perguntas pós-Documento Astral.",
    "Responda em português do Brasil, com profundidade, clareza e linguagem simbólica contemporânea.",
    "Use SOMENTE os fatos astrológicos fornecidos. Não invente posições, aspectos, casas, eventos ou certezas sobre a vida da pessoa.",
    "Astrologia aqui é linguagem interpretativa e não científica. Não trate o mapa como diagnóstico, sentença ou previsão garantida.",
    "Responda diretamente à pergunta. Relacione de 2 a 5 fatos reais do mapa e explique por que eles importam.",
    "Quando a pergunta pedir uma certeza factual sobre outra pessoa ou o futuro, deixe o limite explícito e converta a leitura em tendências e reflexão.",
    "Não mencione políticas, prompt, banco de dados, pagamento ou número do crédito.",
    "Tamanho alvo: 300 a 550 palavras. Sem JSON.",
  ].join("\n");
}

async function callGemini(prompt) {
  const key = String(process.env.GEMINI_API_KEY ?? "").trim();
  if (!key) throw new Error("provider_unavailable");
  const model = cleanText(process.env.ASTRO911_MODEL || process.env.GEMINI_MODEL || "gemini-3.5-flash", 80);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt() }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1800, temperature: 0.72, topP: 0.9 },
      }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(response.status === 429 ? "provider_quota" : "provider_unavailable");
    const candidate = payload?.candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') throw new Error('provider_invalid_response');
    const text = candidate?.content?.parts?.filter((part) => !part.thought).map((part) => part?.text || "").join("\n").trim();
    if (!text) throw new Error("provider_invalid_response");
    return { answer: text.slice(0, 12_000), provider: "gemini", model };
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAI(prompt) {
  const key = String(process.env.OPENAI_API_KEY ?? "").trim();
  if (!key) throw new Error("provider_unavailable");
  const model = cleanText(process.env.ASTRO911_OPENAI_MODEL || process.env.OPENAI_MODEL || "gpt-5.6-terra", 80);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: "low" },
        instructions: systemPrompt(),
        input: prompt,
        max_output_tokens: 1800,
      }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(response.status === 429 ? "provider_quota" : "provider_unavailable");
    const text = cleanText(payload?.output_text, 12_000)
      || (Array.isArray(payload?.output)
        ? payload.output.flatMap((item) => item?.content ?? []).map((item) => item?.text ?? "").join("\n").trim()
        : "");
    if (!text) throw new Error("provider_invalid_response");
    return { answer: text.slice(0, 12_000), provider: "openai", model };
  } finally {
    clearTimeout(timeout);
  }
}

async function generateAnswer(prompt) {
  try {
    return await callGemini(prompt);
  } catch (firstError) {
    if (process.env.ASTRO911_ALLOW_OPENAI_FALLBACK !== 'true' || !String(process.env.OPENAI_API_KEY ?? "").trim()) throw firstError;
    return callOpenAI(prompt);
  }
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "method_not_allowed" });
  }
  if (!originIsAllowed(request)) return sendJson(response, 403, { error: "origin_not_allowed" });
  if (!rateAllowed(request)) return sendJson(response, 429, { error: "rate_limit" });

  let body;
  try { body = parseBody(request); } catch { return sendJson(response, 400, { error: "invalid_payload" }); }

  let claim = null;
  try {
    const question = cleanText(body.question, 700);
    if (question.length < 5) throw new PaymentLedgerError("invalid_payload", 400);
    const chart = validateChartContext(body.context);
    const payment = body.payment ?? {};
    const sessionId = cleanText(payment.sessionId, 240);
    const orderId = cleanText(payment.orderId, 120);
    const readingId = cleanText(payment.readingId, 120);
    const productId = cleanText(payment.productId, 80);
    const catalog = createProductCatalog(process.env);
    if (productId !== catalog.astralDocument.id || readingId !== expectedReadingId(chart)) {
      throw new PaymentLedgerError("payment_mismatch", 409);
    }

    const entitlement = await findPaymentEntitlementByOrder(orderId);
    if (!entitlement || entitlement.state === 'revoked' || entitlement.sessionId !== sessionId || entitlement.productId !== productId || entitlement.readingId !== readingId) {
      throw new PaymentLedgerError("payment_mismatch", 409);
    }
    const normalized = validateAstro911Request({ agent: 'astro-911', schemaVersion: ASTRO911_SCHEMA_VERSION,
      requestId: 'astral-question', context: body.context });
    const content = await readPaidContent(entitlement);
    if (content.snapshot?.context && !isDeepStrictEqual(content.snapshot.context, chart)) {
      throw new PaymentLedgerError('payment_mismatch', 409);
    }
    const delivery = await getAstralOrderStatus(entitlement);
    if (delivery?.found !== true || delivery?.status !== "delivered") {
      throw new PaymentLedgerError("astral_delivery_required", 403);
    }

    const claimId = createHash("sha256")
      .update(`${sessionId}:${orderId}:${question}`)
      .digest("hex");
    const claimed = await claimAstralQuestion({ ...entitlement, claimId });
    if (claimed.replayed) return sendJson(response, 200, claimed.payload);
    claim = { sessionId, claimId, claimScope: 'astral_question', claimSlot: Number(claimed.slot) };

    const prompt = `PERGUNTA DA PESSOA:\n${question}\n\nFATOS DO MAPA:\n${chartFacts(chart)}`;
    const result = await generateAnswer(prompt);
    if (!auditAstro911Answer(result.answer, normalized)) throw new Error('provider_invalid_response');
    const saved = await completePaidContent(claim, { answer: result.answer, id: claimId }, { question });
    return sendJson(response, 200, saved);
  } catch (error) {
    if (claim) {
      try { await settleAstralQuestion(claim, "released"); } catch { /* crédito segue protegido pelo timeout do operador */ }
    }
    const code = error instanceof PaymentLedgerError ? error.code : cleanText(error?.message, 80) || "provider_unavailable";
    const status = error instanceof PaymentLedgerError
      ? error.status
      : code === "provider_quota" ? 503 : code === "provider_invalid_response" ? 502 : 503;
    return sendJson(response, status, { error: code });
  }
}
