import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import adminHandler from "../api/astral-admin.js";
import {
  createAstralPdfSignedUrl,
  decodePdfData,
  notifyAstralReviewer,
  reviewerDeliveryStatus,
  sendAstralDeliveryEmail,
  uploadAstralPdf,
} from "../server/astral-delivery.js";
import { buildAstralReviewDraft, sanitizeAstralDraft } from "../server/astral-review.js";
import { normalizeAstralQuestionnaire } from "../src/config/astralQuestionnaire.js";
import { sampleAstroChart, sampleAstroDocument, sampleAstroRequest } from "./astro911-fixture.js";

function source(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const questionnaire = {
  clarity: ["work_money", "love_reciprocity"],
  patterns: ["urgency_all_or_nothing", "overgiving"],
  traits: ["determined_intense", "creative_visionary"],
};

test("questionário aceita várias escolhas válidas e exige resposta nos três blocos", () => {
  assert.deepEqual(normalizeAstralQuestionnaire(questionnaire), questionnaire);
  assert.throws(
    () => normalizeAstralQuestionnaire({ ...questionnaire, traits: [] }, { requireAnswers: true }),
    /astral_questionnaire_incomplete/u,
  );
  assert.deepEqual(normalizeAstralQuestionnaire({ ...questionnaire, clarity: ["hack", "work_money"] }).clarity, ["work_money"]);
});

test("modelo revisável cria 21 páginas Arcane com cartas discretas e autorrelato", () => {
  const chart = sampleAstroChart();
  const context = sampleAstroRequest().context.chart;
  const draft = buildAstralReviewDraft({
    order: { fullName: "Pessoa de Teste", orderId: "order-123456789012", questionnaire },
    snapshot: { chart, context, questionnaire },
    generated: { document: sampleAstroDocument(sampleAstroRequest().context) },
  });
  assert.equal(draft.pages.length, 21);
  assert.equal(draft.templateVersion, "arcane911-pdf-v31");
  assert.match(draft.pages[3].body, /Trabalho e dinheiro/u);
  assert.ok(draft.pages.every((page) => /^\d{2}-|^\d{1,2}-/u.test(page.card)));
  const tampered = structuredClone(draft);
  tampered.pages[0].card = "https://attacker.invalid/card.png";
  assert.equal(sanitizeAstralDraft(tampered).pages[0].card, "21-o-mundo.webp");
});

test("bancada não redesenha as 21 páginas nem carrega todas as cartas a cada tecla", () => {
  const page = source("../src/pages/AstralAdminPage.jsx");
  const styles = source("../src/astral-admin.css");

  assert.match(page, /const PreviewPage = memo/u);
  assert.match(page, /loading="lazy" decoding="async"/u);
  assert.match(page, /const \[dirty, setDirty\] = useState\(false\)/u);
  assert.doesNotMatch(page, /JSON\.stringify\(record\.draft\)/u);
  assert.match(styles, /content-visibility: auto/u);
  assert.match(styles, /@media print[\s\S]*content-visibility: visible/u);
});

test("PDF é validado, vai para bucket privado e recebe URL assinada", async () => {
  const pdf = Buffer.alloc(400, 0x20);
  pdf.write("%PDF-1.7\n", 0, "ascii");
  assert.deepEqual(decodePdfData(`data:application/pdf;base64,${pdf.toString("base64")}`), pdf);
  assert.throws(() => decodePdfData(Buffer.from("not a pdf").toString("base64")), /pdf_invalid/u);

  const calls = [];
  const fetchImplementation = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("/storage/v1/bucket/") && !options.method) {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    if (String(url).endsWith("/storage/v1/bucket")) return { ok: true, status: 200, json: async () => ({}) };
    if (String(url).includes("/storage/v1/object/sign/")) {
      return { ok: true, status: 200, json: async () => ({ signedURL: "/object/sign/arcane911-astral-pdfs/file.pdf?token=private" }) };
    }
    return { ok: true, status: 200, json: async () => ({ Key: "stored" }) };
  };
  const env = {
    SUPABASE_URL: "https://storage-unit.example.invalid",
    SUPABASE_SECRET_KEY: "sb_secret_unit_test_private_key",
    ASTRO911_PDF_BUCKET: "arcane911-astral-pdfs",
  };
  const uploaded = await uploadAstralPdf("order-123456789012", pdf, { env, fetchImplementation });
  assert.match(uploaded.path, /^astral\/order-123456789012\/\d+-[a-f0-9]+\.pdf$/u);
  const signed = await createAstralPdfSignedUrl(uploaded.path, { env, fetchImplementation, expiresIn: 900 });
  assert.match(signed.url, /storage\/v1\/object\/sign/u);
  const bucketBody = JSON.parse(calls.find((call) => call.url.endsWith("/storage/v1/bucket")).options.body);
  assert.equal(bucketBody.public, false);
});

test("e-mail example fica inerte e entrega real exige remetente configurado", async () => {
  const exampleEnv = { REVIEWER_EMAIL: "reviewer@example.com" };
  assert.equal(reviewerDeliveryStatus(exampleEnv).reviewerEmailConfigured, false);
  let called = false;
  const skipped = await notifyAstralReviewer({ orderId: "order-123456789012" }, {
    env: exampleEnv,
    fetchImplementation: async () => { called = true; },
  });
  assert.equal(skipped.skipped, true);
  assert.equal(called, false);

  let emailPayload;
  const delivered = await sendAstralDeliveryEmail(
    { orderId: "order-123456789012", fullName: "Vitor Teste", email: "cliente@example.invalid" },
    "https://storage.example.invalid/private.pdf?token=secret",
    {
      env: { RESEND_API_KEY: "re_test_12345678901234567890", ARCANE911_FROM_EMAIL: "Arcane911 <entregas@arcane911.com>" },
      fetchImplementation: async (_url, options) => {
        emailPayload = JSON.parse(options.body);
        return { ok: true, status: 200, json: async () => ({ id: "email_123" }) };
      },
    },
  );
  assert.equal(delivered.id, "email_123");
  assert.match(emailPayload.html, /Vitor/u);
});

test("bancada recusa acesso sem segredo e migração não abre dados ao público", async () => {
  const response = { statusCode: 0, payload: null, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(value) { this.payload = value; return this; } };
  await adminHandler({ method: "POST", body: { action: "list" }, headers: {} }, response);
  assert.equal(response.statusCode, 401);
  const sql = source("../database/arcane911-v31.sql");
  assert.match(sql, /revoke execute on function public\.arcane911_admin_get_astral_order\(text\) from public,anon,authenticated/u);
  assert.match(sql, /pdf_path is not null and status <> 'delivered'/u);
  assert.match(sql, /questions_available = 5/u);
  assert.match(source("../api/astral-admin.js"), /sendAstralDeliveryEmail[\s\S]+finalizeAstralDelivery/u);
});
