import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { PGlite } from '@electric-sql/pglite';
import { createHmac, randomUUID } from 'node:crypto';
import checkoutHandler from '../api/checkout.js';
import paymentHandler from '../api/payment.js';
import webhookHandler from '../api/mercadopago-webhook.js';
import astroHandler, { resetAstro911RuntimeStateForTests } from '../api/astro-911.js';
import questionHandler from '../api/astro-question.js';
import recoveryHandler from '../api/order-status.js';
import orderHandler from '../api/astral-order.js';
import { astro911Fingerprint } from '../src/lib/astro911.js';
import { sampleAstroChart, sampleAstroDocument, sampleAstroRequest } from './astro911-fixture.js';

function source(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

test("fila da síntese humana fica privada e libera cinco perguntas só na entrega", () => {
  const sql = source("../database/arcane911-payment-ledger.sql");
  assert.match(sql, /create table if not exists arcane911_private\.astral_orders/u);
  assert.match(sql, /force row level security/u);
  assert.match(sql, /revoke all on table arcane911_private\.astral_orders from public, anon, authenticated/u);
  assert.match(sql, /questions_available = 5/u);
  assert.match(sql, /status = 'delivered'/u);
  assert.match(sql, /claim_scope = 'astral_question' and claim_slot between 1 and 5/u);
  assert.match(sql, /grant execute on function public\.arcane911_claim_astral_question/u);
});

test("cadastro da síntese verifica a compra no servidor e não expõe os dados natais no status", () => {
  const api = source("../api/astral-order.js");
  assert.match(api, /findPaymentEntitlementByOrder/u);
  assert.match(api, /payment_mismatch/u);
  assert.match(api, /readPaidContent/u);
  assert.match(api, /getAstralOrderStatus/u);
  assert.doesNotMatch(api, /return sendJson\(response, 200, \{[^}]*fullName/u);
});

test("as cinco perguntas exigem PDF entregue, entitlement e fingerprint do próprio mapa", () => {
  const api = source("../api/astro-question.js");
  assert.match(api, /delivery\?\.status !== "delivered"/u);
  assert.match(api, /findPaymentEntitlementByOrder/u);
  assert.match(api, /readingId !== expectedReadingId\(chart\)/u);
  assert.match(api, /claimAstralQuestion/u);
  assert.match(api, /completePaidContent\(claim/u);
  assert.match(api, /settleAstralQuestion\(claim, "released"\)/u);
});

test("cliente envia ao Agent911 apenas o contexto calculado e recupera o histórico salvo", () => {
  const lib = source("../src/lib/astralQuestions.js");
  const component = source("../src/components/Astral911Questions.jsx");
  assert.match(lib, /createAstro911Context\(chart\)/u);
  assert.doesNotMatch(lib, /birth\.date|birth\.time|location\.latitude|location\.longitude/u);
  assert.match(component, /deliveryStatus\.answers/u);
  assert.doesNotMatch(component, /localStorage|sessionStorage/u);
  assert.match(component, /O crédito só é consumido quando uma resposta válida é concluída/u);
});

test("painel de perguntas só renderiza depois da entrega humana", () => {
  const component = source("../src/components/Astral911Questions.jsx");
  const page = source("../src/pages/AstralMapPage.jsx");
  assert.match(component, /if \(!delivered\) return null/u);
  assert.match(page, /<Astral911Questions/u);
  assert.match(page, /deliveryStatus=\{astralOrderStatus\}/u);
});


test("checkout astral falha fechado se a fila humana não estiver instalada", () => {
  const checkout = source("../api/checkout.js");
  const core = source("../server/checkout-core.js");
  const ledger = source("../server/payment-ledger.js");
  const sql = source("../database/arcane911-payment-ledger.sql");
  assert.match(core, /checkoutProductNeedsAstralFulfillment/u);
  assert.match(checkout, /preparePurchaseBeforeCharge/u);
  assert.match(ledger, /arcane911_astral_fulfillment_health/u);
  assert.match(sql, /create or replace function public\.arcane911_astral_fulfillment_health/u);
  assert.match(sql, /'version', 1/u);
});

test('V30: compra, recuperação e pós-venda com SQL real e provedores isolados', async (t) => {
  const db = new PGlite();
  const env = { SUPABASE_URL: 'https://isolated-ledger.example.invalid',
    SUPABASE_SECRET_KEY: 'sb_secret_local_regression_test_only',
    MERCADOPAGO_ACCESS_TOKEN: 'APP_USR-LOCAL-0000000000000000000000000000',
    MERCADOPAGO_WEBHOOK_SECRET: 'local-regression-webhook-secret',
    MERCADOPAGO_MODE: 'production',
    GEMINI_API_KEY: 'local-regression-not-a-real-key', OPENAI_API_KEY: '',
    ASTRO911_PROVIDER: 'gemini', ASTRO911_FALLBACK_MODEL: 'off', VERCEL_ENV: 'production' };
  const previousEnv = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  const previousFetch = globalThis.fetch;
  Object.assign(process.env, env);
  const chart = sampleAstroChart();
  let serial = 0, aiCalls = 0, paymentCalls = 0, dropCommittedResponse = false;
  let answerMode = 'valid', nextStatus = 'pending';
  const payments = new Map();
  const keys = new Map();
  const json = (payload, status = 200) => ({ ok: status < 400, status, headers: { get: () => null }, json: async () => payload });
  async function rpc(name, args = {}, executor = db) {
    assert.match(name, /^arcane911_[a-z_]+$/u);
    const names = Object.keys(args);
    names.forEach((name) => assert.match(name, /^p_[a-z_]+$/u));
    return (await executor.query(`select public.${name}(${names.map((name, i) => `${name} => $${i + 1}`).join(',')}) as result`, Object.values(args))).rows[0].result;
  }
  async function invoke(handler, body, headers = {}) {
    serial += 1;
    const response = { statusCode: 0, payload: null, setHeader() {},
      status(code) { this.statusCode = code; return this; }, json(value) { this.payload = value; return this; } };
    await handler({ method: 'POST', body, headers: { origin: 'https://arcane911.example.invalid', host: 'arcane911.example.invalid',
      'x-forwarded-for': `198.51.${Math.floor(serial / 200)}.${serial % 200 + 1}`, ...headers }, socket: {} }, response);
    return response;
  }
  function order() {
    return { orderId: `order-${randomUUID()}`, productId: 'astro911-documento-completo', readingId: astro911Fingerprint(chart), offerContext: 'astral_document' };
  }
  const fulfillment = { name: chart.person, email: 'test@example.invalid', date: chart.birth.date, time: chart.birth.time, location: chart.location };
  const paymentData = { payment_method_id: 'pix', payer: { email: 'test@example.invalid' } };
  async function notify(payment) {
    const id = String(payment.id), ts = String(Date.now()), requestId = randomUUID();
    const digest = createHmac('sha256', env.MERCADOPAGO_WEBHOOK_SECRET).update(`id:${id};request-id:${requestId};ts:${ts};`).digest('hex');
    return invoke(webhookHandler, { type: 'payment', data: { id } }, { 'x-request-id': requestId, 'x-signature': `ts=${ts},v1=${digest}` });
  }
  async function buy({ delivered = false } = {}) {
    const purchase = order();
    assert.equal((await invoke(checkoutHandler, { ...purchase, fulfillment })).statusCode, 200);
    const created = await invoke(paymentHandler, { ...purchase, paymentData });
    assert.equal(created.statusCode, 200);
    const payment = payments.get(created.payload.paymentId.slice(3));
    payment.status = 'approved';
    assert.equal((await notify(payment)).statusCode, 200);
    const access = { ...purchase, sessionId: created.payload.paymentId };
    if (delivered) await rpc('arcane911_mark_astral_order_delivered', { p_order_id: access.orderId });
    return { access, payment };
  }
  function question(access, text = 'Como posso compreender meus relacionamentos?') {
    return { payment: access, question: text, context: sampleAstroRequest().context };
  }
  const used = async (access) => Number((await db.query('select questions_used from arcane911_private.astral_orders where payment_id=$1', [access.sessionId])).rows[0].questions_used);
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    await db.exec(source('../database/arcane911-payment-ledger.sql'));
    await db.exec(source('../database/arcane911-v29.sql'));
    globalThis.fetch = async (url, options = {}) => {
      const target = String(url);
      if (target.startsWith(`${env.SUPABASE_URL}/rest/v1/rpc/`)) {
        const name = target.split('/').at(-1), args = JSON.parse(options.body || '{}');
        try {
          const result = await db.transaction(async (tx) => {
            await tx.exec('set local role service_role');
            return rpc(name, args, tx);
          });
          if (name === 'arcane911_complete_paid_content' && dropCommittedResponse) {
            dropCommittedResponse = false;
            return json({ code: 'SIMULATED_CONNECTION_LOSS_AFTER_COMMIT' }, 503);
          }
          return json(result);
        } catch (error) { return json({ code: error.code === '42883' ? 'PGRST202' : error.code, message: error.message }, 503); }
      }
      if (target === 'https://api.mercadopago.com/v1/payment_methods') return json([{ id: 'visa', payment_type_id: 'credit_card' }]);
      if (target.startsWith('https://api.mercadopago.com/v1/payments')) {
        paymentCalls += 1;
        if (options.method !== 'POST') return json(payments.get(target.split('/').at(-1)), payments.has(target.split('/').at(-1)) ? 200 : 404);
        const key = options.headers['X-Idempotency-Key'];
        if (keys.has(key)) return json(payments.get(keys.get(key)));
        const body = JSON.parse(options.body), id = String(900000000000 + payments.size + 1);
        const payment = { ...body, id, status: nextStatus, currency_id: 'BRL', live_mode: true,
          date_approved: new Date().toISOString(), payment_type_id: body.payment_method_id === 'pix' ? 'bank_transfer' : 'credit_card',
          point_of_interaction: { transaction_data: { qr_code: 'NOT_A_REAL_PIX' } } };
        payments.set(id, payment); keys.set(key, id);
        return json(payment);
      }
      if (target.startsWith('https://generativelanguage.googleapis.com/')) {
        aiCalls += 1;
        if (answerMode === 'quota') return json({ error: { code: 429, status: 'RESOURCE_EXHAUSTED' } }, 429);
        const body = JSON.parse(options.body);
        const answer = answerMode === 'tiny' ? 'ok' : Array.from({ length: 5 }, () =>
          'O Sol e a Lua oferecem linguagens simbólicas para observar suas escolhas. Considere como você comunica uma necessidade, escuta a outra pessoa e diferencia expectativas de fatos. A leitura pode ajudar a formular perguntas, mas não confirma intenções alheias nem substitui uma conversa direta.').join('\n\n');
        const text = body.generationConfig?.responseMimeType === 'application/json' ? JSON.stringify(sampleAstroDocument()) : answer;
        return json({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 1000 } });
      }
      throw new Error(`UNEXPECTED_NETWORK_IN_TEST: ${target}`);
    };

    await t.test('anon e authenticated não acessam conteúdo nem funções de escrita', async () => {
      for (const role of ['anon', 'authenticated']) {
        await db.exec(`set role ${role}`);
        try { await assert.rejects(rpc('arcane911_read_paid_content', { p_payment_id: 'mp-999999', p_product_id: 'x', p_reading_id: 'x', p_order_id: 'order-test-1234567890' }), (error) => error.code === '42501'); }
        finally { await db.exec('reset role'); }
      }
    });
    await t.test('rota direta recusa cobrança sem dados de entrega persistidos', async () => {
      const before = paymentCalls;
      const response = await invoke(paymentHandler, { ...order(), paymentData });
      assert.equal(response.statusCode, 409); assert.equal(paymentCalls, before);
    });
    const paid = await buy();
    await t.test('pagamento confirmado cria a fila mesmo sem retorno do navegador', async () => {
      assert.equal(paid.payment.transaction_amount, 119.9);
      const entitlement = (await db.query('select amount_total,currency,livemode from arcane911_private.payment_entitlements where order_id=$1', [paid.access.orderId])).rows[0];
      assert.equal(Number(entitlement.amount_total), 11_990);
      assert.equal(entitlement.currency, 'brl');
      assert.equal(entitlement.livemode, true);
      const rows = (await db.query('select * from arcane911_private.astral_orders where order_id=$1', [paid.access.orderId])).rows;
      assert.equal(rows.length, 1); assert.equal(rows[0].email, fulfillment.email);
      assert.equal(new Date(rows[0].birth_utc).toISOString(), new Date(chart.birth.utc).toISOString());
      assert.equal(Number(rows[0].utc_offset_minutes), chart.birth.utcOffsetMinutes);
      assert.equal((await notify(paid.payment)).statusCode, 200);
      assert.equal((await db.query('select count(*) as n from arcane911_private.astral_orders where order_id=$1', [paid.access.orderId])).rows[0].n, 1);
    });
    await t.test('pedido não aceita troca de dados depois da cobrança', async () => {
      const response = await invoke(orderHandler, { ...paid.access, action: 'register', fullName: chart.person, email: fulfillment.email,
        birth: { date: '2000-02-02', time: '05:00' }, location: chart.location });
      assert.equal(response.statusCode, 409);
      const duplicate = await invoke(checkoutHandler, { ...paid.access, fulfillment: { ...fulfillment, email: 'different@example.invalid' } });
      assert.equal(duplicate.statusCode, 409);
    });
    await t.test('perguntas ficam bloqueadas antes da entrega', async () => {
      assert.equal((await invoke(questionHandler, question(paid.access))).statusCode, 403);
      assert.equal(await used(paid.access), 0);
    });
    await t.test('documento reabre após reinício sem segunda chamada nem crédito', async () => {
      const request = sampleAstroRequest({ payment: paid.access });
      const first = await invoke(astroHandler, request);
      assert.equal(first.statusCode, 200, JSON.stringify(first.payload));
      const calls = aiCalls;
      resetAstro911RuntimeStateForTests();
      const second = await invoke(astroHandler, request);
      assert.equal(second.statusCode, 200); assert.deepEqual(second.payload, first.payload); assert.equal(aiCalls, calls);
      const recovered = await invoke(recoveryHandler, { orderId: paid.access.orderId });
      assert.equal(recovered.statusCode, 200); assert.equal(recovered.payload.content.snapshot.chart.birth.date, chart.birth.date);
      assert.deepEqual(recovered.payload.content.results[0].payload, first.payload);
    });
    await t.test('identificadores públicos sem o código privado não recuperam o documento', async () => {
      const request = sampleAstroRequest({ payment: { ...paid.access, orderId: 'order-wrong-code-123456789' } });
      assert.equal((await invoke(astroHandler, request)).statusCode, 403);
    });
    await rpc('arcane911_mark_astral_order_delivered', { p_order_id: paid.access.orderId });
    await t.test('resposta vazia ou superficial não consome crédito', async () => {
      answerMode = 'tiny';
      assert.equal((await invoke(questionHandler, question(paid.access))).statusCode, 502);
      assert.equal(await used(paid.access), 0); answerMode = 'valid';
    });
    await t.test('resposta gravada antes de queda de conexão é recuperada sem novo débito', async () => {
      dropCommittedResponse = true;
      assert.equal((await invoke(questionHandler, question(paid.access))).statusCode, 503);
      assert.equal(await used(paid.access), 1);
      const calls = aiCalls;
      const replay = await invoke(questionHandler, question(paid.access));
      assert.equal(replay.statusCode, 200); assert.ok(replay.payload.answer.length > 400);
      assert.equal(await used(paid.access), 1); assert.equal(aiCalls, calls);
      const history = await invoke(orderHandler, { ...paid.access, action: 'status' });
      assert.equal(history.payload.answers.length, 1); assert.equal(history.payload.answers[0].answer, replay.payload.answer);
    });
    await t.test('requisições simultâneas da mesma pergunta debitam uma única vez', async () => {
      const calls = aiCalls;
      const responses = await Promise.all([invoke(questionHandler, question(paid.access, 'Como posso lidar com as escolhas profissionais?')),
        invoke(questionHandler, question(paid.access, 'Como posso lidar com as escolhas profissionais?'))]);
      assert.ok(responses.some((response) => response.statusCode === 200));
      assert.ok(responses.every((response) => [200,409].includes(response.statusCode)));
      assert.equal(aiCalls, calls + 1); assert.equal(await used(paid.access), 2);
    });
    await t.test('cinco respostas são salvas e a sexta pergunta é bloqueada', async () => {
      for (let i = 3; i <= 5; i += 1) assert.equal((await invoke(questionHandler, question(paid.access, `Como integrar o aprendizado de número ${i} no meu mapa?`))).statusCode, 200);
      assert.equal((await invoke(questionHandler, question(paid.access, 'Uma sexta pergunta diferente sobre relacionamentos?'))).statusCode, 402);
      assert.equal(await used(paid.access), 5);
    });
    await t.test('reservas abandonadas vencem e não bloqueiam as cinco perguntas', async () => {
      const { access } = await buy({ delivered: true });
      await db.query("insert into arcane911_private.payment_claims(payment_id,claim_scope,claim_slot,claim_id,state,claimed_at) select $1,'astral_question',s,'abandoned-claim-'||s,'processing',now()-interval '1 hour' from generate_series(1,5) s", [access.sessionId]);
      assert.equal((await invoke(questionHandler, question(access))).statusCode, 200); assert.equal(await used(access), 1);
    });
    await t.test('falha de cota libera a reserva para uma tentativa posterior', async () => {
      const { access } = await buy({ delivered: true });
      answerMode = 'quota';
      assert.equal((await invoke(questionHandler, question(access))).statusCode, 503);
      assert.equal(await used(access), 0); answerMode = 'valid';
      assert.equal((await invoke(questionHandler, question(access))).statusCode, 200);
    });
    await t.test('reembolso revoga recuperação, documento e perguntas inclusive com cache quente', async () => {
      paid.payment.status = 'refunded'; assert.equal((await notify(paid.payment)).statusCode, 200);
      assert.equal((await invoke(recoveryHandler, { orderId: paid.access.orderId })).statusCode, 403);
      assert.equal((await invoke(astroHandler, sampleAstroRequest({ payment: paid.access }))).statusCode, 403);
      assert.equal((await invoke(questionHandler, question(paid.access))).statusCode, 409);
      paid.payment.status = 'approved'; assert.equal((await notify(paid.payment)).statusCode, 200);
      assert.equal((await db.query('select state from arcane911_private.payment_entitlements where payment_id=$1', [paid.access.sessionId])).rows[0].state, 'revoked');
    });
    await t.test('nova tentativa só muda a chave após recusa confirmada pelo provedor', async () => {
      const purchase = order();
      await invoke(checkoutHandler, { ...purchase, fulfillment });
      nextStatus = 'rejected';
      const declined = await invoke(paymentHandler, { ...purchase, paymentData: { ...paymentData, payment_method_id: 'visa', token: 'fake-token', installments: 1 } });
      assert.equal(declined.payload.status, 'rejected');
      nextStatus = 'approved';
      const retry = { ...purchase, retryPaymentId: declined.payload.paymentId, paymentData: { ...paymentData, payment_method_id: 'visa', token: 'new-fake-token', installments: 1 } };
      const approved = await invoke(paymentHandler, retry);
      assert.equal(approved.payload.status, 'approved'); assert.notEqual(approved.payload.paymentId, declined.payload.paymentId);
      assert.equal((await invoke(paymentHandler, retry)).payload.paymentId, approved.payload.paymentId);
      assert.equal((await invoke(paymentHandler, { ...retry, retryPaymentId: approved.payload.paymentId })).payload.paymentId, approved.payload.paymentId);
      nextStatus = 'pending';
    });
    await t.test('reaplicar os scripts preserva dados, respostas e permissões', async () => {
      const count = (await db.query('select count(*) n from arcane911_private.paid_results')).rows[0].n;
      await db.exec(source('../database/arcane911-payment-ledger.sql'));
      await db.exec(source('../database/arcane911-v29.sql'));
      assert.equal((await db.query('select count(*) n from arcane911_private.paid_results')).rows[0].n, count);
      assert.equal((await rpc('arcane911_payment_ledger_health')).version, 5);
    });
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of Object.entries(previousEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    await db.close();
  }
});
