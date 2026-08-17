import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import webhookHandler from "../api/stripe-webhook.js";
import {
  StripeWebhookError,
  verifyStripeWebhook,
} from "../server/stripe-webhook.js";

const secret = "whsec_arcane911_webhook_test_123456";

function signature(rawBody, timestamp, signingSecret = secret) {
  const digest = createHmac("sha256", signingSecret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

function response() {
  const headers = new Map();
  return {
    statusCode: 0,
    payload: null,
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
    headers,
  };
}

async function withEnvironment(values, operation) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await operation();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("assinatura Stripe usa o corpo bruto e rejeita adulteração ou replay antigo", () => {
  const timestamp = 1_786_920_000;
  const rawBody = JSON.stringify({
    id: "evt_webhooksignature123456",
    type: "checkout.session.completed",
    data: { object: { id: "cs_test_webhooksignature123456" } },
  });
  const event = verifyStripeWebhook(rawBody, signature(rawBody, timestamp), {
    env: { STRIPE_WEBHOOK_SECRET: secret },
    nowSeconds: timestamp,
  });
  assert.equal(event.id, "evt_webhooksignature123456");

  assert.throws(
    () => verifyStripeWebhook(`${rawBody} `, signature(rawBody, timestamp), {
      env: { STRIPE_WEBHOOK_SECRET: secret },
      nowSeconds: timestamp,
    }),
    (error) => error instanceof StripeWebhookError && error.code === "invalid_webhook_signature",
  );
  assert.throws(
    () => verifyStripeWebhook(rawBody, signature(rawBody, timestamp), {
      env: { STRIPE_WEBHOOK_SECRET: secret },
      nowSeconds: timestamp + 301,
    }),
    (error) => error instanceof StripeWebhookError && error.code === "stale_webhook_signature",
  );
});

test("webhook confirma a sessão no Stripe e registra todos os produtos no ledger", async () => {
  await withEnvironment({
    STRIPE_WEBHOOK_SECRET: secret,
    STRIPE_SECRET_KEY: "sk_test_arcane911webhook",
    SUPABASE_URL: "https://arcane-ledger.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret_arcane911_webhook_1234567890",
  }, async () => {
    const timestamp = Math.floor(Date.now() / 1_000);
    const event = {
      id: "evt_checkoutcompleted123456",
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_webhooksession123456" } },
    };
    const rawBody = JSON.stringify(event);
    const calls = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      if (String(url).includes("api.stripe.com")) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              id: "cs_test_webhooksession123456",
              status: "complete",
              payment_status: "paid",
              currency: "brl",
              amount_total: 1999,
              payment_intent: "pi_webhooksession123456",
              livemode: false,
              client_reference_id: "order-webhook-complete-123456",
              metadata: {
                product_id: "arcane911-leitura-profunda",
                order_id: "order-webhook-complete-123456",
                reading_id: "reading-webhook-complete-123456",
              },
            };
          },
        };
      }
      return {
        ok: true,
        status: 200,
        async json() { return { registered: true, state: "active" }; },
      };
    };

    try {
      const result = response();
      await webhookHandler({
        method: "POST",
        rawBody,
        headers: { "stripe-signature": signature(rawBody, timestamp) },
      }, result);
      assert.equal(result.statusCode, 200);
      assert.deepEqual(result.payload, { received: true });
      assert.equal(calls.length, 2);
      assert.match(calls[0].url, /api\.stripe\.com\/v1\/checkout\/sessions/u);
      assert.match(calls[1].url, /arcane911_register_entitlement$/u);
      const ledgerBody = JSON.parse(calls[1].options.body);
      assert.equal(ledgerBody.p_amount_total, 1999);
      assert.equal(ledgerBody.p_currency, "brl");
      assert.equal(Object.keys(ledgerBody).some((key) => /question_text|cards|answer/iu.test(key)), false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("webhook inválido não consulta Stripe nem Supabase", async () => {
  await withEnvironment({ STRIPE_WEBHOOK_SECRET: secret }, async () => {
    let calls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { calls += 1; };
    try {
      const result = response();
      await webhookHandler({
        method: "POST",
        rawBody: JSON.stringify({ id: "evt_invalid12345678", type: "x", data: { object: {} } }),
        headers: { "stripe-signature": "t=1,v1=deadbeef" },
      }, result);
      assert.equal(result.statusCode, 400);
      assert.equal(calls, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
