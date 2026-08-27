import { mercadoPagoConfigured } from "../server/checkout-core.js";
import { assertPaymentLedgerReady, paymentLedgerConfigured } from "../server/payment-ledger.js";

function sendJson(response, status, payload) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
  return response.status(status).json(payload);
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
