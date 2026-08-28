import { mercadoPagoConfigured } from "../server/checkout-core.js";
import {
  paymentLedgerConfigured,
  assertPaymentLedgerReady,
  assertAstralFulfillmentReady,
} from "../server/payment-ledger.js";

function safeError(error) {
  return {
    ok: false,
    code: String(error?.code ?? error?.message ?? "unknown").slice(0, 80),
    status: Number(error?.status) || 0,
  };
}

function supabaseTarget() {
  try {
    const url = new URL(String(process.env.SUPABASE_URL ?? "").trim());
    return {
      host: url.hostname,
      projectRef: url.hostname.endsWith(".supabase.co") ? url.hostname.split(".")[0] : "custom",
    };
  } catch {
    return { host: "", projectRef: "" };
  }
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "method_not_allowed" });
  }

  const target = supabaseTarget();
  const result = {
    mercadoPagoConfigured: mercadoPagoConfigured(process.env),
    webhookConfigured: String(process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "").trim().length >= 16,
    paymentLedgerConfigured: paymentLedgerConfigured(process.env),
    supabaseUrlConfigured: Boolean(String(process.env.SUPABASE_URL ?? "").trim()),
    supabaseSecretConfigured: Boolean(String(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim()),
    supabaseHost: target.host,
    supabaseProjectRef: target.projectRef,
  };

  try {
    result.ledgerHealth = { ok: true, value: await assertPaymentLedgerReady() };
  } catch (error) {
    result.ledgerHealth = safeError(error);
  }

  try {
    result.astralHealth = { ok: true, value: await assertAstralFulfillmentReady() };
  } catch (error) {
    result.astralHealth = safeError(error);
  }

  response.setHeader("Cache-Control", "no-store, max-age=0");
  return response.status(200).json(result);
}
