import { normalizeOrder, CheckoutError, mercadoPagoConfigured } from './checkout-core.js';
import { assertPaymentLedgerReady, assertAstralFulfillmentReady, preparePurchase } from './payment-ledger.js';
import { calculateNatalChart } from '../src/lib/astrology.js';
import { astro911Fingerprint, createAstro911Context } from '../src/lib/astro911.js';

// Both checkout entry points must persist the fulfillment data BEFORE charging.
export async function preparePurchaseBeforeCharge(raw, options = {}) {
  const env = options.env ?? process.env;
  const order = normalizeOrder(raw, env);
  if (!mercadoPagoConfigured(env)) throw new CheckoutError('checkout_not_configured', 503);
  if (String(env.MERCADOPAGO_WEBHOOK_SECRET ?? '').trim().length < 16) {
    throw new CheckoutError('webhook_not_configured', 503);
  }
  await assertPaymentLedgerReady(options);
  let snapshot = options.createDraft ? {} : null;
  if (order.product.kind === 'astral_document') {
    await assertAstralFulfillmentReady(options);
    const input = raw.fulfillment;
    if (!input && !options.createDraft) {
      const saved = await preparePurchase({ ...order, snapshot: null }, options);
      return { ...order, existingPaymentId: saved.paymentId };
    }
    const email = String(input?.email ?? '').trim().toLowerCase();
    if (!input || email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
      throw new CheckoutError('astral_order_invalid', 400);
    }
    let chart;
    try { chart = calculateNatalChart(input); }
    catch { throw new CheckoutError('astral_order_invalid', 400); }
    if (astro911Fingerprint(chart) !== order.readingId) throw new CheckoutError('payment_mismatch', 409);
    snapshot = { chart, context: createAstro911Context(chart).chart, email };
    // Generated timestamps are not part of the immutable purchase identity.
    delete snapshot.chart.id;
    delete snapshot.chart.createdAt;
  } else if (raw.readingSnapshot && typeof raw.readingSnapshot === 'object') {
    snapshot = { reading: raw.readingSnapshot };
  }
  const saved = await preparePurchase({ ...order, snapshot }, options);
  return { ...order, existingPaymentId: saved.paymentId };
}
