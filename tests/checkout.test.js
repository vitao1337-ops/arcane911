import assert from "node:assert/strict";
import test from "node:test";
import { createProductCatalog } from "../src/config/productCatalog.js";
import {
  CheckoutClientError,
  createHostedCheckout,
  verifyHostedCheckout,
} from "../src/lib/checkout.js";
import {
  CheckoutError,
  checkoutErrorPayload,
  createStripeCheckout,
  verifyStripeCheckout,
} from "../server/checkout-core.js";

const env = Object.freeze({ STRIPE_SECRET_KEY: ["sk", "test", "arcane911checkouttests"].join("_") });
const catalog = createProductCatalog(env);
const origin = "http://localhost:5173";

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

function order(overrides = {}) {
  return {
    orderId: "order-checkout-test-0001",
    productId: catalog.completeReading.id,
    readingId: "reading-complete-0001",
    returnPath: "/tiragem-completa",
    ...overrides,
  };
}

function paidSession(expected, overrides = {}) {
  return {
    id: overrides.id ?? "cs_test_1234567890abcdef",
    status: "complete",
    payment_status: "paid",
    currency: "brl",
    amount_total: expected.priceCents,
    client_reference_id: expected.orderId,
    metadata: {
      product_id: expected.productId,
      order_id: expected.orderId,
      reading_id: expected.readingId,
      ...(expected.readingSlug ? { reading_slug: expected.readingSlug } : {}),
      ...(expected.offerContext ? { offer_context: expected.offerContext } : {}),
      ...(expected.questionNumber ? { question_number: String(expected.questionNumber) } : {}),
    },
    ...overrides,
  };
}

test("checkout da Tiragem Completa cobra R$ 19,99 do catálogo confiável", async () => {
  const calls = [];
  const raw = order({ price: 1, priceCents: 1, question: "texto privado que não pode sair" });
  const result = await createStripeCheckout(raw, {
    env,
    origin,
    fetchImplementation: async (url, options) => {
      calls.push({ url, options });
      return response({
        id: "cs_test_1234567890abcdef",
        url: "https://checkout.stripe.com/c/pay/cs_test_1234567890abcdef",
      });
    },
  });

  assert.equal(calls.length, 1);
  const form = new URLSearchParams(calls[0].options.body);
  assert.equal(form.get("line_items[0][price_data][unit_amount]"), "1999");
  assert.equal(form.get("line_items[0][price_data][currency]"), "brl");
  assert.equal(form.get("metadata[product_id]"), catalog.completeReading.id);
  assert.equal(form.get("metadata[reading_id]"), raw.readingId);
  assert.equal([...form.keys()].some((key) => /question(?!_number)/iu.test(key)), false);
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${env.STRIPE_SECRET_KEY}`);
  assert.equal(result.checkoutUrl.startsWith("https://checkout.stripe.com/"), true);
});

test("retorno pago libera somente a compra que bate produto, valor e leitura", async () => {
  const raw = order();
  const session = paidSession({
    productId: raw.productId,
    priceCents: catalog.completeReading.priceCents,
    orderId: raw.orderId,
    readingId: raw.readingId,
  });
  const verified = await verifyStripeCheckout({ ...raw, sessionId: session.id }, {
    env,
    fetchImplementation: async () => response(session),
  });

  assert.equal(verified.paid, true);
  assert.equal(verified.entitlement.sessionId, session.id);
  assert.equal(verified.entitlement.productId, catalog.completeReading.id);
  assert.equal(verified.entitlement.readingId, raw.readingId);
});

test("retorno pendente ou com valor adulterado nunca libera o acesso", async () => {
  const raw = order();
  const base = paidSession({
    productId: raw.productId,
    priceCents: catalog.completeReading.priceCents,
    orderId: raw.orderId,
    readingId: raw.readingId,
  });

  await assert.rejects(
    verifyStripeCheckout({ ...raw, sessionId: base.id }, {
      env,
      fetchImplementation: async () => response({ ...base, payment_status: "unpaid" }),
    }),
    (error) => error instanceof CheckoutError && error.code === "payment_not_confirmed",
  );
  await assert.rejects(
    verifyStripeCheckout({ ...raw, sessionId: base.id }, {
      env,
      fetchImplementation: async () => response({ ...base, amount_total: 1 }),
    }),
    (error) => error instanceof CheckoutError && error.code === "payment_mismatch",
  );
});

test("pergunta específica avulsa custa R$ 10,00 e abre sem compra anterior", async () => {
  const calls = [];
  const raw = order({
    orderId: "order-specific-standalone-0001",
    productId: catalog.specificQuestionStandalone.id,
    readingId: "reading-specific-standalone-0001",
    readingSlug: "interior",
    offerContext: "standalone",
    returnPath: "/leituras/interior",
  });
  await createStripeCheckout(raw, {
    env,
    origin,
    fetchImplementation: async (url, options) => {
      calls.push({ url, options });
      return response({
        id: "cs_test_2234567890abcdef",
        url: "https://checkout.stripe.com/c/pay/cs_test_2234567890abcdef",
      });
    },
  });

  assert.equal(calls.length, 1);
  const form = new URLSearchParams(calls[0].options.body);
  assert.equal(form.get("line_items[0][price_data][unit_amount]"), "1000");
  assert.equal(form.get("metadata[reading_slug]"), "interior");
  assert.equal(form.get("metadata[offer_context]"), "standalone");
});

test("pergunta específica de R$ 5,00 exige uma Tiragem Completa paga da mesma leitura", async () => {
  const parentSessionId = "cs_test_3234567890abcdef";
  const raw = order({
    orderId: "order-specific-complete-0001",
    productId: catalog.specificQuestionComplete.id,
    readingId: "reading-complete-0001",
    readingSlug: "caminhos",
    offerContext: "complete_reading",
    parentSessionId,
    returnPath: "/leituras/caminhos?origem=tiragem-completa",
  });
  const calls = [];
  await createStripeCheckout(raw, {
    env,
    origin,
    fetchImplementation: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith(parentSessionId)) {
        return response({
          id: parentSessionId,
          status: "complete",
          payment_status: "paid",
          currency: "brl",
          amount_total: catalog.completeReading.priceCents,
          metadata: {
            product_id: catalog.completeReading.id,
            reading_id: raw.readingId,
          },
        });
      }
      return response({
        id: "cs_test_4234567890abcdef",
        url: "https://checkout.stripe.com/c/pay/cs_test_4234567890abcdef",
      });
    },
  });

  assert.equal(calls.length, 2);
  const form = new URLSearchParams(calls[1].options.body);
  assert.equal(form.get("line_items[0][price_data][unit_amount]"), "500");

  await assert.rejects(
    createStripeCheckout({ ...raw, parentSessionId: "" }, {
      env,
      origin,
      fetchImplementation: async () => response({}),
    }),
    (error) => error instanceof CheckoutError && error.code === "complete_entitlement_required",
  );
});

test("Documento Astral só cobra após preço explícito e volta para o mesmo mapa", async () => {
  const astralEnv = {
    ...env,
    VITE_ASTRO911_PRICE_CENTS: "2990",
  };
  const astralCatalog = createProductCatalog(astralEnv);
  const raw = order({
    orderId: "order-astral-document-0001",
    productId: astralCatalog.astralDocument.id,
    readingId: "astro-v1-fingerprint123",
    offerContext: "astral_document",
    returnPath: "/mapa-astral",
    name: "dado pessoal que não pode sair",
    date: "1990-01-01",
    city: "São Paulo",
  });
  const calls = [];
  await createStripeCheckout(raw, {
    env: astralEnv,
    origin,
    fetchImplementation: async (url, options) => {
      calls.push({ url, options });
      return response({
        id: "cs_test_astro1234567890",
        url: "https://checkout.stripe.com/c/pay/cs_test_astro1234567890",
      });
    },
  });

  assert.equal(calls.length, 1);
  const form = new URLSearchParams(calls[0].options.body);
  assert.equal(form.get("line_items[0][price_data][unit_amount]"), "2990");
  assert.equal(form.get("metadata[reading_id]"), raw.readingId);
  assert.equal(form.get("metadata[offer_context]"), "astral_document");
  assert.match(form.get("success_url"), /^http:\/\/localhost:5173\/mapa-astral\?checkout=success/u);
  assert.equal(form.get("metadata[name]"), null);
  assert.equal(form.get("metadata[date]"), null);
  assert.equal(form.get("metadata[city]"), null);
  assert.equal(calls[0].options.body.includes("dado+pessoal"), false);
  assert.equal(calls[0].options.body.includes("S%C3%A3o+Paulo"), false);
});

test("Documento Astral sem preço configurado não cria cobrança de valor zero", async () => {
  await assert.rejects(
    createStripeCheckout(order({
      productId: catalog.astralDocument.id,
      readingId: "astro-v1-fingerprint123",
      offerContext: "astral_document",
      returnPath: "/mapa-astral",
    }), {
      env,
      origin,
      fetchImplementation: async () => response({}),
    }),
    (error) => error instanceof CheckoutError && error.code === "checkout_not_configured",
  );
});

test("cada pergunta ao 911 custa R$ 5,00 e também exige a Ferradura paga", async () => {
  const parentSessionId = "cs_test_5234567890abcdef";
  const raw = order({
    orderId: "order-agent-question-0001",
    productId: catalog.agentQuestion.id,
    readingId: "reading-complete-0001",
    questionNumber: 1,
    parentSessionId,
  });
  const calls = [];
  await createStripeCheckout(raw, {
    env,
    origin,
    fetchImplementation: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith(parentSessionId)) {
        return response({
          id: parentSessionId,
          status: "complete",
          payment_status: "paid",
          currency: "brl",
          amount_total: catalog.completeReading.priceCents,
          metadata: {
            product_id: catalog.completeReading.id,
            reading_id: raw.readingId,
          },
        });
      }
      return response({
        id: "cs_test_6234567890abcdef",
        url: "https://checkout.stripe.com/c/pay/cs_test_6234567890abcdef",
      });
    },
  });

  assert.equal(calls.length, 2);
  const form = new URLSearchParams(calls[1].options.body);
  assert.equal(form.get("line_items[0][price_data][unit_amount]"), "500");
  assert.equal(form.get("metadata[question_number]"), "1");
});

test("checkout recusa retorno fora das rotas do produto e segredo ausente", async () => {
  await assert.rejects(
    createStripeCheckout(order({ returnPath: "https://evil.example/roubo" }), {
      env,
      origin,
      fetchImplementation: async () => response({}),
    }),
    (error) => error instanceof CheckoutError && error.code === "invalid_return_path",
  );
  await assert.rejects(
    createStripeCheckout(order(), {
      env: {},
      origin,
      fetchImplementation: async () => response({}),
    }),
    (error) => error instanceof CheckoutError && error.code === "checkout_not_configured",
  );
});

test("cliente envia somente o contrato mínimo e valida a URL hospedada", async () => {
  let sentBody;
  const raw = order({ question: "segredo", price: 1, priceCents: 1 });
  const created = await createHostedCheckout(raw, {
    fetchImplementation: async (_url, options) => {
      sentBody = JSON.parse(options.body);
      return response({ checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_cliente123456" });
    },
  });

  assert.equal(created.checkoutUrl.startsWith("https://checkout.stripe.com/"), true);
  assert.equal(Object.hasOwn(sentBody, "question"), false);
  assert.equal(Object.hasOwn(sentBody, "price"), false);
  assert.equal(Object.hasOwn(sentBody, "priceCents"), false);

  await assert.rejects(
    createHostedCheckout(raw, {
      fetchImplementation: async () => response({ checkoutUrl: "https://evil.example/falso" }),
    }),
    (error) => error instanceof CheckoutClientError && error.code === "checkout_invalid_response",
  );
});

test("cliente confirma a sessão somente pelo endpoint server-side", async () => {
  let requestedUrl = "";
  let sentBody;
  const raw = order();
  const result = await verifyHostedCheckout("cs_test_7234567890abcdef", raw, {
    fetchImplementation: async (url, options) => {
      requestedUrl = url;
      sentBody = JSON.parse(options.body);
      return response({ paid: true, entitlement: { sessionId: sentBody.sessionId } });
    },
  });

  assert.equal(requestedUrl, "/api/checkout-session");
  assert.equal(sentBody.sessionId, "cs_test_7234567890abcdef");
  assert.equal(result.paid, true);
});

test("erros internos do checkout viram códigos públicos sem detalhes do provedor", () => {
  const payload = checkoutErrorPayload(new CheckoutError("checkout_provider_error", 503, {
    providerCode: "secret-provider-detail",
  }));

  assert.deepEqual(payload, {
    status: 503,
    body: { error: "checkout_provider_error" },
  });
});
