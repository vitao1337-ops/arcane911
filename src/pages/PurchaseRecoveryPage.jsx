import { ArrowLeft, ArrowRight, Check, KeyRound, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { commerceConfig, formatBRL } from "../config/commerce";
import { restorePaidPurchase } from "../lib/purchaseRecovery.js";
import {
  checkoutErrorMessage,
  clearPendingCheckout,
  loadPendingCheckout,
  recoverHostedOrder,
  savePaymentEntitlement,
  trackCommercialEvent,
} from "../lib/checkout";

function productForId(productId) {
  return Object.values(commerceConfig.products).find((product) => product.id === productId) ?? null;
}

function destinationFor(entitlement, product) {
  if (product?.kind?.startsWith("specific_") && entitlement.readingSlug) {
    const query = entitlement.offerContext === "complete_reading" ? "?origem=tiragem-completa" : "";
    return `/leituras/${entitlement.readingSlug}${query}`;
  }
  if (product?.kind === "astral_document") return "/mapa-astral";
  return "/tiragem-completa";
}

export default function PurchaseRecoveryPage() {
  const pending = useMemo(() => loadPendingCheckout(), []);
  const [orderId, setOrderId] = useState(pending?.orderId ?? "");
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);

  async function recover(event) {
    event.preventDefault();
    if (state === "loading") return;
    setState("loading");
    setMessage("Localizando a confirmação segura…");
    setResult(null);
    try {
      const payload = await recoverHostedOrder(orderId);
      const entitlement = savePaymentEntitlement(payload.entitlement);
      if (!entitlement) throw new Error("invalid_entitlement");
      clearPendingCheckout(entitlement.orderId);
      const product = productForId(entitlement.productId);
      restorePaidPurchase(payload);
      setResult({ entitlement, product, content: payload.content, destination: destinationFor(entitlement, product) });
      setState("success");
      setMessage("Compra localizada. O conteúdo salvo está disponível sem consumir outro crédito.");
      trackCommercialEvent("purchase_recovered", {
        product_id: entitlement.productId,
        order_id: entitlement.orderId,
        credit_available: entitlement.creditAvailable,
      });
    } catch (error) {
      setState("error");
      setMessage(checkoutErrorMessage(error?.code));
    }
  }

  return (
    <main className="recovery-page" id="recovery-content">
      <section className="recovery-shell">
        <Link className="specific-back-link" to="/"><ArrowLeft size={15} /> Voltar ao Arcane911</Link>
        <div className="recovery-heading">
          <div className="recovery-icon" aria-hidden="true"><KeyRound /></div>
          <span className="section-kicker">Compra digital · sem cadastro</span>
          <h1>Recuperar uma compra</h1>
          <p>Digite o código <strong>order-…</strong> exibido no pagamento. Ele é sua chave privada de acesso; não compartilhe.</p>
        </div>

        <form className="recovery-form" onSubmit={recover}>
          <label htmlFor="recovery-order-id">
            <span>Código do pedido</span>
            <input
              id="recovery-order-id"
              value={orderId}
              onChange={(event) => setOrderId(event.target.value.trim().slice(0, 120))}
              placeholder="order-00000000-0000-0000-0000-000000000000"
              autoComplete="off"
              spellCheck="false"
              required
            />
          </label>
          <button className="button button-primary" type="submit" disabled={state === "loading"}>
            {state === "loading" ? "Verificando…" : "Recuperar autorização"} <ArrowRight size={17} />
          </button>
          {message ? <p className={`recovery-status is-${state}`} role="status">{message}</p> : null}
        </form>

        {result ? (
          <article className="recovery-result">
            <Check size={20} />
            <div>
              <span>Compra confirmada</span>
              <h2>{result.product?.name ?? "Produto Arcane911"}</h2>
              <p>{result.entitlement.amountTotal > 0 ? formatBRL(result.entitlement.amountTotal) : "Valor confirmado"} · código {result.entitlement.orderId}</p>
              <a className="button button-glass" href={result.destination}>Abrir minha compra <ArrowRight size={16} /></a>
            </div>
          </article>
        ) : null}

        {result?.content?.results?.filter((item) => item.payload?.answer || item.payload?.reading?.synthesis).map((item) => (
          <article className="recovery-result" key={`${item.scope}-${item.slot}`}>
            <div>
              <h3>{item.input?.question || item.input?.message || item.input?.reading?.question || 'Sua leitura salva'}</h3>
              {(item.payload.answer || item.payload.reading.synthesis).split(/\n{2,}/u).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
              {item.payload.reading?.groundedAction ? <p>{item.payload.reading.groundedAction}</p> : null}
            </div>
          </article>
        ))}

        <aside className="recovery-privacy-note">
          <ShieldCheck size={17} />
          <p><strong>O que é recuperado:</strong> os dados e conteúdos salvos da compra, incluindo mapa e respostas concluídas. Compras antigas, anteriores ao salvamento seguro, podem precisar do suporte. O código funciona como senha.</p>
        </aside>
      </section>
    </main>
  );
}
