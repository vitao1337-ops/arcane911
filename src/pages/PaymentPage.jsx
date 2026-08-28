import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Copy, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { commerceConfig } from "../config/commerce";
import {
  CheckoutClientError,
  checkoutErrorMessage,
  loadPendingCheckout,
  savePendingCheckout,
  savePaymentEntitlement,
  trackCommercialEvent,
  verifyHostedCheckout,
} from "../lib/checkout";

const SDK_SRC = "https://sdk.mercadopago.com/js/v2";
const POLL_INTERVAL_MS = 4_000;

function loadMercadoPagoSdk() {
  if (window.MercadoPago) return Promise.resolve(window.MercadoPago);
  const existing = document.querySelector(`script[src="${SDK_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(window.MercadoPago), { once: true });
      existing.addEventListener("error", () => reject(new Error("sdk_load_failed")), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    script.onload = () => resolve(window.MercadoPago);
    script.onerror = () => reject(new Error("sdk_load_failed"));
    document.head.appendChild(script);
  });
}

function productFor(productId) {
  return Object.values(commerceConfig.products).find((product) => product.id === productId) ?? null;
}

async function postJson(url, body) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new CheckoutClientError("checkout_unavailable");
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new CheckoutClientError(String(payload?.error ?? "unknown"), response.status);
  return payload;
}

function returnWithPayment(navigate, pending, paymentId) {
  const separator = pending.returnPath.includes("?") ? "&" : "?";
  navigate(`${pending.returnPath}${separator}checkout=success&payment_id=${encodeURIComponent(paymentId)}`, { replace: true });
}

export default function PaymentPage() {
  const navigate = useNavigate();
  const controllerRef = useRef(null);
  const pollRef = useRef(null);
  const [pending, setPending] = useState(loadPendingCheckout);
  const product = useMemo(() => productFor(pending?.productId), [pending?.productId]);
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("Preparando pagamento seguro…");
  const [paymentId, setPaymentId] = useState("");
  const [pix, setPix] = useState(null);

  useEffect(() => {
    if (!pending || !product) {
      setState("error");
      setMessage("Esta compra expirou ou não pôde ser recuperada. Volte para a oferta e tente novamente.");
      return undefined;
    }
    if (pending.paymentId && ['pending', 'in_process', 'authorized'].includes(pending.paymentStatus)) {
      setPaymentId(pending.paymentId);
      setPix(pending.pix);
      setState(pending.pix ? 'pix_pending' : 'card_pending');
      setMessage('Retomando a confirmação do pagamento já iniciado. Não pague novamente.');
      return undefined;
    }
    const publicKey = String(import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY ?? "").trim();
    if (!publicKey) {
      setState("error");
      setMessage("O Mercado Pago ainda não está configurado neste ambiente.");
      return undefined;
    }

    let active = true;
    loadMercadoPagoSdk()
      .then((MercadoPago) => {
        if (!active || typeof MercadoPago !== "function") return;
        const mp = new MercadoPago(publicKey, { locale: "pt-BR" });
        const bricksBuilder = mp.bricks();
        return bricksBuilder.create("payment", "mercadopago-payment-brick", {
          initialization: { amount: product.priceCents / 100 },
          customization: {
            paymentMethods: {
              creditCard: "all",
              bankTransfer: "pix",
            },
            visual: {
              style: { theme: "default" },
              defaultPaymentOption: { creditCardForm: true },
            },
          },
          callbacks: {
            onReady: () => {
              if (!active) return;
              setState("ready");
              setMessage("Escolha cartão de crédito ou Pix.");
            },
            onSubmit: ({ selectedPaymentMethod, formData }) => new Promise((resolve, reject) => {
              if (!active) return reject(new Error("checkout_closed"));
              setState("processing");
              setMessage("Confirmando com o Mercado Pago…");
              postJson("/api/payment", { ...pending, paymentData: formData, selectedPaymentMethod })
                .then((result) => {
                  if (!active) return;
                  const nextPaymentId = String(result?.paymentId ?? "");
                  savePendingCheckout({ ...pending, paymentId: nextPaymentId, paymentStatus: result.status, pix: result.pix });
                  setPaymentId(nextPaymentId);
                  trackCommercialEvent("mercadopago_payment_created", {
                    product_id: pending.productId,
                    order_id: pending.orderId,
                    payment_type: result?.paymentType ?? "",
                    status: result?.status ?? "",
                  });

                  if (result?.status === "approved" && result?.entitlement) {
                    savePaymentEntitlement(result.entitlement);
                    setState("approved");
                    setMessage("Pagamento aprovado. Liberando seu acesso…");
                    resolve();
                    window.setTimeout(() => returnWithPayment(navigate, pending, nextPaymentId), 250);
                    return;
                  }

                  if (result?.paymentMethod === "pix" && ['pending', 'in_process'].includes(result?.status)) {
                    setPix(result.pix ?? null);
                    setState("pix_pending");
                    setMessage("Pix criado. Assim que o Mercado Pago aprovar, o acesso será liberado.");
                    resolve();
                    return;
                  }

                  if (['pending', 'in_process', 'authorized'].includes(result?.status)) {
                    setState('card_pending');
                    setMessage('Pagamento em análise pelo Mercado Pago. Não é uma recusa; aguarde a confirmação.');
                    resolve();
                    return;
                  }

                  setState("rejected");
                  setMessage("O Mercado Pago não aprovou este pagamento. Você pode tentar novamente.");
                  // Retry a declined card using a new provider key, but keep
                  // the same purchase and stable key after a network error.
                  if (['rejected', 'cancelled'].includes(result?.status)) {
                    const retry = savePendingCheckout({ ...pending, retryPaymentId: nextPaymentId,
                      paymentId: '', paymentStatus: '', pix: null });
                    setPending(retry);
                  }
                  resolve();
                })
                .catch((error) => {
                  if (active) {
                    setState("error");
                    setMessage(checkoutErrorMessage(error?.code));
                  }
                  reject(error);
                });
            }),
            onError: () => {
              if (!active) return;
              setState("error");
              setMessage("O formulário seguro do Mercado Pago encontrou um erro. Recarregue a página e tente novamente.");
            },
          },
        });
      })
      .then((controller) => { controllerRef.current = controller ?? null; })
      .catch(() => {
        if (!active) return;
        setState("error");
        setMessage("Não foi possível carregar o checkout seguro do Mercado Pago.");
      });

    return () => {
      active = false;
      controllerRef.current?.unmount?.();
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, [navigate, pending, product]);

  useEffect(() => {
    if (!['pix_pending', 'card_pending'].includes(state) || !paymentId || !pending) return undefined;
    let active = true;
    const check = async () => {
      try {
        const result = await verifyHostedCheckout(paymentId, pending);
        if (!active) return;
        savePaymentEntitlement(result.entitlement);
        setState("approved");
        setMessage("Pagamento confirmado. Liberando seu acesso…");
        returnWithPayment(navigate, pending, paymentId);
      } catch (error) {
        if (!active) return;
        if (error?.code === "payment_not_confirmed") {
          pollRef.current = window.setTimeout(check, POLL_INTERVAL_MS);
          return;
        }
        setState("error");
        setMessage(checkoutErrorMessage(error?.code));
      }
    };
    pollRef.current = window.setTimeout(check, POLL_INTERVAL_MS);
    return () => {
      active = false;
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, [navigate, paymentId, pending, state]);

  async function copyPix() {
    if (!pix?.qrCode) return;
    try {
      await navigator.clipboard.writeText(pix.qrCode);
      setMessage("Código Pix copiado. Depois do pagamento, a confirmação é automática.");
    } catch {
      setMessage("Não foi possível copiar automaticamente. Selecione o código Pix abaixo.");
    }
  }

  if (!pending || !product) {
    return (
      <main className="payment-page-shell">
        <section className="payment-panel payment-panel-error">
          <span className="section-kicker">Pagamento</span>
          <h1>Essa compra não está mais aberta.</h1>
          <p>{message}</p>
          <Link className="button button-primary" to="/"><ArrowLeft size={16} /> Voltar ao Arcane911</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="payment-page-shell">
      <section className="payment-heading">
        <Link className="text-button" to={pending.returnPath || "/"}><ArrowLeft size={15} /> Voltar</Link>
        <span className="section-kicker">Checkout Arcane911</span>
        <h1>Pagamento protegido pelo <em>Mercado Pago.</em></h1>
        <p>{product.name} · <strong>{product.price}</strong></p>
        <div className="payment-trust-row">
          <span><ShieldCheck size={15} /> Mercado Pago</span>
          <span><LockKeyhole size={15} /> Dados do cartão não passam pelo Arcane</span>
          <span><Sparkles size={15} /> Liberação vinculada ao pedido</span>
        </div>
      </section>

      <section className="payment-panel">
        <p className="payment-order-code">Guarde o código da compra: <strong>{pending.orderId}</strong>. <Link to="/recuperar-compra">Recuperar compra</Link></p>
        <div className={`payment-status is-${state}`} aria-live="polite">
          {state === "approved" ? <Check size={18} /> : <span className="payment-status-dot" />}
          <span>{message}</span>
        </div>

        <div id="mercadopago-payment-brick" hidden={['pix_pending', 'card_pending', 'approved'].includes(state)} />

        {state === "pix_pending" ? (
          <div className="pix-pending-panel">
            <span className="section-kicker">Pix aguardando pagamento</span>
            <h2>Escaneie o QR Code ou copie o Pix.</h2>
            {pix?.qrCodeBase64 ? <img src={`data:image/png;base64,${pix.qrCodeBase64}`} alt="QR Code Pix do pedido" /> : null}
            {pix?.qrCode ? (
              <>
                <textarea readOnly value={pix.qrCode} aria-label="Código Pix copia e cola" />
                <button className="button button-primary" type="button" onClick={copyPix}><Copy size={16} /> Copiar Pix</button>
              </>
            ) : null}
            {pix?.ticketUrl ? <a className="text-button" href={pix.ticketUrl} target="_blank" rel="noreferrer">Abrir instruções do Pix</a> : null}
            <small>Pedido {pending.orderId}. Esta tela confirma automaticamente assim que o Mercado Pago aprovar.</small>
          </div>
        ) : null}
      </section>
    </main>
  );
}
