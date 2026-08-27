import { mercadoPagoConfigured } from "../server/checkout-core.js";
import { assertPaymentLedgerReady, paymentLedgerConfigured } from "../server/payment-ledger.js";

function sendJson(response, status, payload) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
  return response.status(status).json(payload);
}

function supabaseProjectRef() {
  try {
    const url = new URL(String(process.env.SUPABASE_URL ?? "").trim());
    const host = String(url.hostname || "").toLowerCase();
    const suffix = ".supabase.co";
    return host.endsWith(suffix) ? host.slice(0, -suffix.length) : host || null;
  } catch {
    return null;
  }
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { error: "method_not_allowed" });
  }

  const result = {
    mercadoPagoConfigured: mercadoPagoConfigured(),
    paymentLedgerConfigured: paymentLedgerConfigured(),
    paymentLedgerReady: false,
    paymentLedgerError: null,
    supabaseProjectRef: supabaseProjectRef(),
  };

  if (result.paymentLedgerConfigured) {
    try {
      await assertPaymentLedgerReady();
      result.paymentLedgerReady = true;
    } catch (error) {
      result.paymentLedgerError = String(error?.code ?? "payment_ledger_unavailable");
    }
  }

  return sendJson(response, 200, result);
}
