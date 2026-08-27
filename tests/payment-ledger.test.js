import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PaymentLedgerError,
  assertPaymentLedgerReady,
  claimBundlePaymentEntitlement,
  claimPaymentEntitlement,
  paymentLedgerConfigured,
  registerPaymentEntitlement,
  settleBundlePaymentEntitlement,
  settlePaymentEntitlement,
} from "../server/payment-ledger.js";

const TEST_SUPABASE_SECRET = ["sb", "secret", "arcane911", "test", "key", "1234567890"].join("_");

const baseEnv = Object.freeze({
  SUPABASE_URL: "https://arcane-ledger.supabase.co",
  SUPABASE_SECRET_KEY: TEST_SUPABASE_SECRET,
});

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return payload; },
  };
}

function entitlement() {
  return {
    sessionId: "mp-12345678901",
    orderId: "order-ledger-test-123456",
    productId: "agent911-pergunta",
    readingId: "2026-08-17T00:00:00.000Z",
    questionNumber: 1,
    providerTransactionId: "mp-12345678901",
    amountTotal: 500,
    currency: "brl",
    livemode: false,
    verifiedAt: "2026-08-17T00:01:00.000Z",
  };
}

test("o ledger só é considerado configurado com URL e segredo server-side", () => {
  assert.equal(paymentLedgerConfigured(baseEnv), true);
  assert.equal(paymentLedgerConfigured({ SUPABASE_URL: baseEnv.SUPABASE_URL }), false);
  assert.equal(paymentLedgerConfigured({ SUPABASE_SECRET_KEY: baseEnv.SUPABASE_SECRET_KEY }), false);
});

test("SQL mantém dados em schema privado, RLS e RPCs restritas ao service_role", () => {
  const sql = readFileSync(new URL("../database/arcane911-payment-ledger.sql", import.meta.url), "utf8");
  assert.match(sql, /create schema if not exists arcane911_private/iu);
  assert.match(sql, /enable row level security/iu);
  assert.match(sql, /revoke all on table[\s\S]+from public, anon, authenticated/iu);
  assert.match(sql, /grant execute[\s\S]+to service_role/iu);
  assert.equal(/security definer/iu.test(sql), false);
  assert.equal(/\b(question_text|cards|answer|birth_date|full_name)\b/iu.test(sql), false);
});

test("healthcheck comprova a versão do schema antes de abrir cobrança", async () => {
  const ready = await assertPaymentLedgerReady({
    env: baseEnv,
    fetchImplementation: async () => response({ ready: true, version: 4 }),
  });
  assert.equal(ready.ready, true);

  await assert.rejects(
    assertPaymentLedgerReady({
      env: baseEnv,
      fetchImplementation: async () => response({ ready: true, version: 2 }),
    }),
    (error) => error instanceof PaymentLedgerError && error.code === "payment_ledger_not_ready",
  );
});

test("registro usa RPC privada, sb_secret_ apenas em apikey e não envia conteúdo pessoal", async () => {
  let call;
  const result = await registerPaymentEntitlement(entitlement(), {
    env: baseEnv,
    fetchImplementation: async (url, options) => {
      call = { url, options, body: JSON.parse(options.body) };
      return response({ registered: true, state: "active" });
    },
  });

  assert.equal(result.state, "active");
  assert.equal(call.url, "https://arcane-ledger.supabase.co/rest/v1/rpc/arcane911_register_entitlement");
  assert.equal(call.options.headers.apikey, baseEnv.SUPABASE_SECRET_KEY);
  assert.equal(Object.hasOwn(call.options.headers, "Authorization"), false);
  assert.equal(call.body.p_product_id, "agent911-pergunta");
  assert.equal(call.body.p_product_kind, "agent_question");
  assert.equal(JSON.stringify(call.body).includes("question"), true);
  assert.equal(Object.keys(call.body).some((key) => ["message", "cards", "answer", "birthDate"].includes(key)), false);
});

test("service_role legada recebe Authorization somente no servidor", async () => {
  let headers;
  await registerPaymentEntitlement(entitlement(), {
    env: {
      SUPABASE_URL: baseEnv.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: "legacy_service_role_test_token_1234567890",
    },
    fetchImplementation: async (_url, options) => {
      headers = options.headers;
      return response({ registered: true, state: "active" });
    },
  });
  assert.equal(headers.Authorization, "Bearer legacy_service_role_test_token_1234567890");
});

test("claim e settle formam um consumo atômico e crédito indisponível falha fechado", async () => {
  const calls = [];
  const access = {
    sessionId: entitlement().sessionId,
    claimId: "claim-ledger-1234567890",
    productId: entitlement().productId,
    readingId: entitlement().readingId,
    questionNumber: 1,
  };
  const fetchImplementation = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    if (url.endsWith("arcane911_claim_entitlement")) return response({ claimed: true, state: "processing" });
    return response({ settled: true, state: "consumed" });
  };

  await claimPaymentEntitlement(access, { env: baseEnv, fetchImplementation });
  await settlePaymentEntitlement(access, "consumed", { env: baseEnv, fetchImplementation });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].body.p_outcome, "consumed");

  await assert.rejects(
    claimPaymentEntitlement(access, {
      env: baseEnv,
      fetchImplementation: async () => response({ claimed: false, state: "consumed" }),
    }),
    (error) => error instanceof PaymentLedgerError && error.code === "payment_credit_unavailable",
  );
});

test("RPC ausente é distinguida de crédito consumido", async () => {
  await assert.rejects(
    registerPaymentEntitlement(entitlement(), {
      env: baseEnv,
      fetchImplementation: async () => response({ code: "PGRST202" }, 404),
    }),
    (error) => error instanceof PaymentLedgerError && error.code === "payment_ledger_not_ready",
  );
});

test("bundle da Ferradura usa slot 0 na síntese e slots 1–5 nas perguntas incluídas", async () => {
  const calls = [];
  const access = {
    sessionId: "mp-12345678902",
    claimId: "claim-bundle-specific-123456",
    productId: "arcane911-leitura-profunda",
    readingId: "reading-bundle-123456",
    claimScope: "specific_summary",
    claimSlot: 5,
  };
  const fetchImplementation = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    if (url.endsWith("arcane911_claim_bundle_entitlement")) {
      return response({ claimed: true, state: "processing" });
    }
    return response({ settled: true, state: "consumed" });
  };

  await claimBundlePaymentEntitlement(access, { env: baseEnv, fetchImplementation });
  await settleBundlePaymentEntitlement(access, "consumed", { env: baseEnv, fetchImplementation });
  assert.equal(calls[0].body.p_claim_scope, "specific_summary");
  assert.equal(calls[0].body.p_claim_slot, 5);
  assert.equal(calls[1].body.p_outcome, "consumed");

  await assert.rejects(
    claimBundlePaymentEntitlement({ ...access, claimSlot: 6 }, { env: baseEnv, fetchImplementation }),
    (error) => error instanceof PaymentLedgerError && error.code === "payment_required",
  );
});
