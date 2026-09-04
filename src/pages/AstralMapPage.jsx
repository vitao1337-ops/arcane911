import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  MapPin,
  Mail,
  RotateCcw,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "../components/MysticIcons";
import Astral911Document from "../components/Astral911Document";
import Astral911Questions from "../components/Astral911Questions";
import NatalWheel from "../components/NatalWheel";
import { astro911Config } from "../config/astro911";
import {
  astralQuestionnaireGroups,
  normalizeAstralQuestionnaire,
} from "../config/astralQuestionnaire";
import { commerceConfig } from "../config/commerce";
import { astro911Fingerprint, clearCachedAstro911Document } from "../lib/astro911";
import {
  clearAstralOrderDraft,
  fetchAstralPdfDownload,
  fetchAstralOrderStatus,
  loadAstralOrderDraft,
  registerAstralOrder,
  saveAstralOrderDraft,
} from "../lib/astralOrder";
import {
  buildAstroShareText,
  calculateNatalChart,
  fallbackLocations,
  searchBirthplaces,
} from "../lib/astrology";
import {
  checkoutErrorMessage,
  clearPendingCheckout,
  createCheckoutOrderId,
  createHostedCheckout,
  findPaymentEntitlement,
  loadPendingCheckout,
  removePaymentEntitlement,
  savePaymentEntitlement,
  savePendingCheckout,
  trackCommercialEvent,
  verifyHostedCheckout,
  verifyStoredPaymentEntitlement,
} from "../lib/checkout";

const ASTRO_STORAGE_KEY = "arcane911.astral.v2";
const LEGACY_ASTRO_STORAGE_KEY = "arcane911.astral.v1";
const ASTRO_STORAGE_MAX_AGE_MS = 12 * 60 * 60 * 1_000;
const ASTRAL_OFFER_CONTEXT = "astral_document";

function formatLocation(location) {
  return [location.name, location.admin1, location.country].filter(Boolean).join(" · ");
}

function formatDateValue(value) {
  const [year, month, day] = String(value).split("-");
  return year && month && day ? [day, month, year].join("/") : "Escolha no calendário";
}

function formatTimeValue(value) {
  return String(value).length >= 5 ? String(value).slice(0, 5) : "Escolha o horário";
}

function TemporalPickerField({
  id,
  type,
  label,
  value,
  onChange,
  max,
  helper,
  action,
  icon: Icon,
}) {
  const helperId = id + "-helper";
  const displayValue = type === "date" ? formatDateValue(value) : formatTimeValue(value);

  function openNativePicker(event) {
    try {
      event.currentTarget.showPicker?.();
    } catch {
      // O clique nativo continua funcionando quando o navegador não permite showPicker().
    }
  }

  return (
    <label className="astro-field astro-temporal-field" htmlFor={id}>
      <span><Icon size={16} /> {label}</span>
      <span className={"astro-picker-surface " + (value ? "has-value" : "")}>
        <span className="astro-picker-value" aria-hidden="true">
          <strong>{displayValue}</strong>
          <small>{type === "date" ? "dia · mês · ano" : "horário do local de nascimento"}</small>
        </span>
        <span className="astro-picker-action" aria-hidden="true">
          {action}
          <Icon size={17} />
        </span>
        <input
          className="astro-native-picker"
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          onClick={openNativePicker}
          max={max}
          aria-describedby={helperId}
          required
        />
      </span>
      <small className="astro-picker-helper" id={helperId}>{helper}</small>
    </label>
  );
}

function chartIsComplete(chart) {
  return chart?.planets?.length === 10 && chart?.houses?.length === 12 && chart?.aspects?.length >= 3;
}

function safeSessionStorage() {
  try {
    return typeof window === "object" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function storeChart(chart) {
  try {
    safeSessionStorage()?.setItem(ASTRO_STORAGE_KEY, JSON.stringify({
      savedAt: new Date().toISOString(),
      chart,
    }));
  } catch {
    // O mapa atual continua aberto mesmo quando a sessão bloqueia armazenamento.
  }
}

function clearStoredChart() {
  try {
    safeSessionStorage()?.removeItem(ASTRO_STORAGE_KEY);
    window.localStorage?.removeItem(LEGACY_ASTRO_STORAGE_KEY);
  } catch {
    // O estado em memória ainda é limpo.
  }
}

function readStoredChart() {
  try {
    const session = safeSessionStorage();
    const stored = JSON.parse(session?.getItem(ASTRO_STORAGE_KEY) ?? "null");
    const age = Date.now() - new Date(stored?.savedAt ?? 0).getTime();
    if (chartIsComplete(stored?.chart) && age >= 0 && age <= ASTRO_STORAGE_MAX_AGE_MS) {
      return stored.chart;
    }
    session?.removeItem(ASTRO_STORAGE_KEY);

    // Preserva uma sessão recente de versões anteriores e remove a retenção
    // persistente dos dados natais completos.
    const legacy = JSON.parse(window.localStorage?.getItem(LEGACY_ASTRO_STORAGE_KEY) ?? "null");
    window.localStorage?.removeItem(LEGACY_ASTRO_STORAGE_KEY);
    const legacyAge = Date.now() - new Date(legacy?.createdAt ?? 0).getTime();
    if (chartIsComplete(legacy) && legacyAge >= 0 && legacyAge <= ASTRO_STORAGE_MAX_AGE_MS) {
      storeChart(legacy);
      return legacy;
    }
  } catch {
    try {
      window.localStorage?.removeItem(LEGACY_ASTRO_STORAGE_KEY);
    } catch {
      // Nada a fazer quando o navegador bloqueia armazenamento.
    }
  }
  return null;
}

function AstralPurchaseGate({ product, paymentState, paymentMessage, onCheckout }) {
  const busy = paymentState === "opening" || paymentState === "verifying";
  return (
    <section className="astro-document astro-document-loading astro-document-access astro-purchase-gate" aria-labelledby="astro-access-title">
      <div className="astro-document-seal" aria-hidden="true"><span>✦</span><strong>911</strong></div>
      <div>
        <span className="section-kicker">Documento Astral 911 · acesso premium</span>
        <h3 id="astro-access-title">Seus dados estão prontos.<br />O mapa só abre após o pagamento.</h3>
        <p>
          Nenhuma posição, Ascendente ou interpretação é exibida antes da confirmação. Após a compra,
          o mapa completo e a leitura automática do 911 abrem imediatamente nesta sessão.
        </p>
        <div className="astro-document-progress" aria-label="O que está incluído">
          <span><Sparkles size={15} /> Mapa + leitura automática imediatamente</span>
          <span><FileText size={15} /> Síntese em PDF em 1–2 dias úteis</span>
          <span><ShieldCheck size={15} /> 5 perguntas sobre o mapa após a entrega</span>
        </div>
        <button className="button button-primary astro-access-action" type="button" onClick={onCheckout} disabled={busy}>
          {busy ? "Abrindo pagamento…" : "Continuar para pagamento"}
          <ArrowRight size={17} />
        </button>
        {paymentMessage ? <small className={`astro-payment-message is-${paymentState}`} role={paymentState === "error" ? "alert" : "status"}>{paymentMessage}</small> : null}
        <small>O e-mail informado no formulário será usado para a entrega da síntese em PDF.</small>
      </div>
    </section>
  );
}

function HumanSynthesisStatus({ product, entitlement, deliveryStatus, deliveryError, onRefresh, onDownload, downloading }) {
  const delivered = deliveryStatus?.status === "delivered";
  const questionsAvailable = Number(deliveryStatus?.questionsAvailable) || 0;
  const questionsUsed = Number(deliveryStatus?.questionsUsed) || 0;
  const questionsRemaining = Math.max(0, questionsAvailable - questionsUsed);
  return (
    <section className={`astro-human-delivery ${delivered ? "is-delivered" : ""}`} aria-labelledby="astro-human-delivery-title">
      <div className="astro-human-delivery-head">
        <span className="section-kicker">Próxima camada · síntese individual</span>
        <h3 id="astro-human-delivery-title">{delivered ? "Sua síntese foi marcada como entregue." : "A leitura imediata é só a primeira entrega."}</h3>
        <p>
          {delivered
            ? `O PDF já foi concluído. ${questionsRemaining} de ${product.includedSpecificQuestions || 5} perguntas sobre o seu mapa estão disponíveis para a próxima etapa do Agent911.`
            : "Uma síntese aprofundada do seu mapa será preparada individualmente, revisada por um astrólogo e enviada em PDF para o e-mail cadastrado em até 1 a 2 dias úteis."}
        </p>
      </div>
      <div className="astro-human-delivery-grid">
        <article>
          <span>01</span>
          <strong>Agora</strong>
          <p>Seu mapa e a interpretação automática do Agent911 ficam disponíveis imediatamente.</p>
        </article>
        <article>
          <span>02</span>
          <strong>{delivered ? "PDF entregue" : "Em 1–2 dias úteis"}</strong>
          <p>{delivered ? "A síntese aprofundada já passou pela etapa individual de revisão." : "Você recebe por e-mail a síntese aprofundada em PDF, revisada individualmente."}</p>
        </article>
        <article>
          <span>03</span>
          <strong>{delivered ? `${questionsRemaining} perguntas disponíveis` : "Depois da síntese"}</strong>
          <p>{delivered ? "As perguntas ficam vinculadas a esta compra e a este mapa." : `${product.includedSpecificQuestions || 5} perguntas específicas sobre o seu próprio mapa são liberadas no Agent911 após a entrega.`}</p>
        </article>
      </div>
      <div className="astro-human-delivery-foot">
        {entitlement?.orderId ? <small>Código da compra: <strong>{entitlement.orderId}</strong>. Guarde este código para suporte e entrega.</small> : null}
        {deliveryError ? <small className="is-error">{deliveryError}</small> : null}
        {delivered && deliveryStatus?.downloadAvailable ? (
          <button className="button button-primary" type="button" onClick={onDownload} disabled={downloading}>
            <FileText size={15} /> {downloading ? "Abrindo PDF…" : "Baixar minha síntese em PDF"}
          </button>
        ) : null}
        <button className="text-button" type="button" onClick={onRefresh}><RotateCcw size={14} /> Atualizar status da síntese</button>
      </div>
    </section>
  );
}

export default function AstralMapPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: loadAstralOrderDraft()?.email ?? "", date: "", time: "", city: "" });
  const [questionnaire, setQuestionnaire] = useState(() => normalizeAstralQuestionnaire(loadAstralOrderDraft()?.questionnaire));
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [offsetOptions, setOffsetOptions] = useState([]);
  const [locations, setLocations] = useState([]);
  const [searching, setSearching] = useState(false);
  const [chart, setChart] = useState(readStoredChart);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [astralEntitlement, setAstralEntitlement] = useState(null);
  const [paymentState, setPaymentState] = useState("idle");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [astralOrderStatus, setAstralOrderStatus] = useState(null);
  const [astralOrderError, setAstralOrderError] = useState("");
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const controllerRef = useRef(null);
  const resultRef = useRef(null);
  const checkoutVerificationRef = useRef("");
  const entitlementRestoreRef = useRef({ key: "", promise: null });
  const updateStatus = useMemo(() => (message) => setStatus(message), []);

  const maxDate = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);
  const featuredCities = fallbackLocations.slice(0, 5);
  const astralProduct = commerceConfig.products.astralDocument;
  const chartFingerprint = useMemo(() => {
    try {
      return chart ? astro911Fingerprint(chart) : "";
    } catch {
      return "";
    }
  }, [chart]);
  const astralAccessGranted = astralProduct.available && (
    !astralProduct.accessRequired
    || commerceConfig.devUnlocked
    || Boolean(
      astralEntitlement
      && astralEntitlement.productId === astralProduct.id
      && astralEntitlement.readingId === chartFingerprint
      && astralEntitlement.offerContext === ASTRAL_OFFER_CONTEXT,
    )
  );

  useEffect(() => () => controllerRef.current?.abort(), []);

  useEffect(() => {
    if (!chartFingerprint) {
      setAstralEntitlement(null);
      return undefined;
    }
    if (!astralProduct.accessRequired || commerceConfig.devUnlocked) return undefined;

    const candidate = findPaymentEntitlement({
      productId: astralProduct.id,
      readingId: chartFingerprint,
      offerContext: ASTRAL_OFFER_CONTEXT,
    });
    setAstralEntitlement(null);
    if (!candidate) return undefined;

    const restoreKey = `${candidate.sessionId}:${chartFingerprint}`;
    if (entitlementRestoreRef.current.key !== restoreKey) {
      entitlementRestoreRef.current = {
        key: restoreKey,
        promise: verifyStoredPaymentEntitlement(candidate, {
          productId: astralProduct.id,
          readingId: chartFingerprint,
          offerContext: ASTRAL_OFFER_CONTEXT,
        }),
      };
    }

    let subscribed = true;
    entitlementRestoreRef.current.promise
      .then((serverEntitlement) => {
        if (!subscribed) return;
        const entitlement = savePaymentEntitlement(serverEntitlement);
        if (entitlement) setAstralEntitlement(entitlement);
      })
      .catch((restoreError) => {
        if (!subscribed) return;
        setAstralEntitlement(null);
        if (["invalid_order", "payment_credit_unavailable", "payment_mismatch", "purchase_not_found"].includes(restoreError?.code)) {
          removePaymentEntitlement(candidate.sessionId);
        }
      });
    return () => {
      subscribed = false;
    };
  }, [astralProduct.accessRequired, astralProduct.id, chartFingerprint]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const checkoutState = params.get("checkout");
    if (!checkoutState) return;

    if (checkoutState === "cancelled") {
      clearPendingCheckout();
      setPaymentState("idle");
      setPaymentMessage("Pagamento cancelado. Nenhuma parte do mapa foi aberta.");
      setStatus("Pagamento cancelado. Nenhum valor foi confirmado e o mapa continua protegido.");
      navigate("/mapa-astral", { replace: true });
      return;
    }

    const sessionId = params.get("payment_id") ?? "";
    if (checkoutState !== "success" || !sessionId || checkoutVerificationRef.current === sessionId) return;
    if (!chartFingerprint) {
      clearPendingCheckout();
      setPaymentState("error");
      setPaymentMessage("Não foi possível recuperar o mapa desta compra nesta sessão.");
      navigate("/mapa-astral", { replace: true });
      return;
    }

    checkoutVerificationRef.current = sessionId;
    const pending = loadPendingCheckout();
    if (!pending || pending.productId !== astralProduct.id
        || pending.readingId !== chartFingerprint
        || pending.offerContext !== ASTRAL_OFFER_CONTEXT) {
      clearPendingCheckout();
      setPaymentState("error");
      setPaymentMessage("Não foi possível vincular este pagamento ao mapa atual.");
      setStatus("O pagamento não foi vinculado. Nenhum documento foi liberado.");
      navigate("/mapa-astral", { replace: true });
      return;
    }

    setPaymentState("verifying");
    setPaymentMessage("Confirmando o pagamento…");
    verifyHostedCheckout(sessionId, pending)
      .then((result) => {
        const entitlement = savePaymentEntitlement(result.entitlement);
        clearPendingCheckout(pending.orderId);
        setAstralEntitlement(entitlement);
        setPaymentState("paid");
        setPaymentMessage(`Pagamento confirmado. Código do pedido: ${pending.orderId}`);
        setStatus(`Seu mapa foi liberado. A síntese em PDF entra agora na fila de preparação. Guarde o código ${pending.orderId}.`);
        trackCommercialEvent("astral_document_payment_confirmed", {
          product_id: pending.productId,
          reading_id: pending.readingId,
        });
        navigate("/mapa-astral", { replace: true });
      })
      .catch((checkoutError) => {
        setPaymentState("error");
        setPaymentMessage(checkoutErrorMessage(checkoutError?.code));
        setStatus(checkoutErrorMessage(checkoutError?.code));
        checkoutVerificationRef.current = "";
        navigate("/mapa-astral", { replace: true });
      });
  }, [astralProduct.id, chartFingerprint, location.search, navigate]);

  async function syncAstralOrder(entitlement = astralEntitlement) {
    if (!entitlement || !chart) return null;
    setAstralOrderError("");
    try {
      let remote = await fetchAstralOrderStatus(entitlement);
      if (remote?.found !== true) {
        const draft = loadAstralOrderDraft();
        if (!draft?.email) {
          setAstralOrderError("A entrega ainda não foi cadastrada. Reabra esta compra no mesmo navegador ou use o código do pedido no suporte.");
          return null;
        }
        await registerAstralOrder(entitlement, chart, draft.email, { questionnaire: draft.questionnaire });
        clearAstralOrderDraft();
        remote = await fetchAstralOrderStatus(entitlement);
      }
      setAstralOrderStatus(remote?.found === true ? remote : null);
      return remote;
    } catch {
      setAstralOrderError("Seu mapa continua liberado, mas não foi possível atualizar agora o status da síntese em PDF.");
      return null;
    }
  }

  useEffect(() => {
    if (!astralEntitlement || !chart) return undefined;
    let active = true;
    syncAstralOrder(astralEntitlement).then((remote) => {
      if (!active || !remote?.found) return;
      setAstralOrderStatus(remote);
    });
    return () => { active = false; };
  }, [astralEntitlement?.sessionId, chartFingerprint]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value,
      ...(["date", "time", "city"].includes(field) ? { utcOffsetMinutes: "" } : {}),
    }));
    if (["date", "time", "city"].includes(field)) setOffsetOptions([]);
    setError("");
    if (field === "city") setSelectedLocation(null);
  }

  function toggleQuestionnaire(groupId, optionId) {
    setQuestionnaire((current) => {
      const selected = new Set(current[groupId] || []);
      if (selected.has(optionId)) selected.delete(optionId);
      else selected.add(optionId);
      return { ...current, [groupId]: [...selected] };
    });
    setError("");
  }

  function chooseLocation(location) {
    setSelectedLocation(location);
    setForm((current) => ({ ...current, city: formatLocation(location), utcOffsetMinutes: '' }));
    setOffsetOptions([]);
    setLocations([]);
    setError("");
    setStatus(`Cidade confirmada: ${formatLocation(location)}.`);
  }

  async function findLocations() {
    if (form.city.trim().length < 2) {
      setError("Digite pelo menos duas letras para buscar a cidade.");
      return;
    }

    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    setSearching(true);
    setError("");
    setStatus("Buscando cidades e fusos horários…");

    try {
      const matches = await searchBirthplaces(form.city, controllerRef.current.signal);
      setLocations(matches);
      setStatus(matches.length ? "Escolha a cidade correta na lista." : "Nenhuma cidade encontrada.");
      if (!matches.length) setError("Não encontramos essa cidade. Confira a escrita ou escolha uma sugestão.");
    } catch (searchError) {
      if (searchError?.name !== "AbortError") setError(searchError.message);
    } finally {
      setSearching(false);
    }
  }

  async function createChart(event) {
    event.preventDefault();
    setError("");

    try {
      if (!saveAstralOrderDraft({ email: form.email, questionnaire })) {
        const hasValidEmail = /^\S+@\S+\.\S+$/u.test(form.email.trim());
        throw new Error(hasValidEmail
          ? "Marque ao menos uma resposta em cada pergunta de personalização."
          : "Informe um e-mail válido para receber a síntese em PDF.");
      }
      const nextChart = calculateNatalChart({ ...form, location: selectedLocation });
      setChart(nextChart);
      storeChart(nextChart);
      setPaymentState("idle");
      setPaymentMessage("");
      setStatus("Dados validados. Preparando o pagamento seguro antes de abrir o mapa.");
      await proceedToAstralCheckout(nextChart);
    } catch (chartError) {
      setOffsetOptions(chartError.offsetOptions || []);
      setError(chartError.message);
    }
  }

  async function proceedToAstralCheckout(chartOverride = null) {
    if (!astralProduct.accessRequired || paymentState === "opening" || paymentState === "verifying") return;
    const targetChart = chartOverride || chart;
    let targetFingerprint = "";
    try {
      targetFingerprint = targetChart ? astro911Fingerprint(targetChart) : "";
    } catch {
      targetFingerprint = "";
    }
    if (!targetFingerprint) {
      setPaymentState("error");
      setPaymentMessage("Confira os dados de nascimento antes de abrir o pagamento.");
      return;
    }

    if (commerceConfig.devUnlocked) {
      setPaymentState("paid");
      setPaymentMessage("Modo DEV: acesso liberado sem cobrança.");
      return;
    }

    const pending = savePendingCheckout({
      orderId: createCheckoutOrderId(),
      productId: astralProduct.id,
      readingId: targetFingerprint,
      offerContext: ASTRAL_OFFER_CONTEXT,
      returnPath: "/mapa-astral",
    });
    setPaymentState("opening");
    setPaymentMessage("Abrindo o pagamento seguro…");

    try {
      const checkout = await createHostedCheckout(pending, { fulfillment: {
        name: targetChart.person,
        email: loadAstralOrderDraft()?.email || form.email,
        date: targetChart.birth.date,
        time: targetChart.birth.time,
        utcOffsetMinutes: targetChart.birth.utcOffsetMinutes,
        location: targetChart.location,
        questionnaire: loadAstralOrderDraft()?.questionnaire || questionnaire,
      } });
      trackCommercialEvent("begin_checkout", {
        product_id: astralProduct.id,
        price_label: astralProduct.price,
        reading_id: targetFingerprint,
      });
      window.location.assign(checkout.checkoutUrl);
    } catch (checkoutError) {
      clearPendingCheckout(pending.orderId);
      setPaymentState("error");
      setPaymentMessage(checkoutErrorMessage(checkoutError?.code));
      trackCommercialEvent("checkout_unavailable", {
        product_id: astralProduct.id,
        reason: checkoutError?.code ?? "unknown",
      });
    }
  }

  async function shareChart() {
    if (!chart) return;
    const text = buildAstroShareText(chart);

    try {
      if (navigator.share) {
        await navigator.share({ title: `Mapa Astral · ${chart.person}`, text });
        setStatus("Mapa compartilhado.");
      } else {
        await navigator.clipboard.writeText(text);
        setStatus("Resumo do mapa copiado.");
      }
    } catch (shareError) {
      if (shareError?.name !== "AbortError") setStatus("Não foi possível compartilhar agora.");
    }
  }

  function startAgain() {
    clearCachedAstro911Document(chart);
    clearStoredChart();
    setChart(null);
    setForm({ name: "", email: "", date: "", time: "", city: "" });
    setQuestionnaire(normalizeAstralQuestionnaire(null));
    clearAstralOrderDraft();
    setSelectedLocation(null);
    setOffsetOptions([]);
    setLocations([]);
    setAstralEntitlement(null);
    setPaymentState("idle");
    setPaymentMessage("");
    setAstralOrderStatus(null);
    setAstralOrderError("");
    setError("");
    setStatus("Pronto para um novo mapa.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function downloadAstralPdf() {
    if (!astralEntitlement || pdfDownloading) return;
    setPdfDownloading(true);
    setAstralOrderError("");
    try {
      const result = await fetchAstralPdfDownload(astralEntitlement);
      if (!result?.url) throw new Error("astral_pdf_unavailable");
      window.location.assign(result.url);
    } catch {
      setAstralOrderError("O PDF está entregue, mas o link privado não pôde ser aberto agora. Tente atualizar em instantes.");
    } finally {
      setPdfDownloading(false);
    }
  }

  return (
    <main className="astro-page" id="astro-top">
      <section className="astro-hero">
        <div className="astro-hero-copy">
          <div className="eyebrow"><span /> Documento Astral 911 · experiência premium</div>
          <h1>O céu do instante em que <em>você chegou.</em></h1>
          <p>
            Um mapa natal completo com leitura imediata do Agent911 e uma segunda camada humana:
            síntese aprofundada em PDF, enviada por e-mail em até 1 a 2 dias úteis.
          </p>
          <div className="astro-test-access astro-premium-access">
            <FileText size={17} />
            <span>
              <strong>Uma entrega imediata. Uma segunda leitura feita com tempo.</strong>
              {commerceConfig.devUnlocked && astro911Config.devMockEnabled
                ? " O modo DEV mantém a cobrança destravada apenas localmente para auditoria."
                : " Após a compra, seu mapa e a leitura do Agent911 abrem na hora. A síntese aprofundada é revisada individualmente e enviada em PDF por e-mail em 1 a 2 dias úteis."}
            </span>
          </div>
          <div className="astro-hero-notes">
            <span><CheckCircle2 size={16} /> Mapa + leitura na hora</span>
            <span><CheckCircle2 size={16} /> PDF em 1–2 dias úteis</span>
            <span><CheckCircle2 size={16} /> 5 perguntas após o PDF</span>
          </div>
          <a className="button button-primary button-large" href="#criar-mapa">
            Solicitar meu Documento Astral
            <ArrowRight size={18} />
          </a>
        </div>
        <div className="astro-hero-wheel">
          <span className="astro-orbit-note"><Sparkles size={14} /> sua arquitetura celeste</span>
          <NatalWheel chart={astralAccessGranted ? chart : null} preview={!astralAccessGranted || !chart} />
        </div>
      </section>

      <section className="astro-form-section" id="criar-mapa">
        <div className="astro-form-intro">
          <span className="section-kicker">01 · O seu céu começa aqui</span>
          <h2>Seu nascimento deixou uma assinatura no céu.<br /><em>Agora você pode lê-la.</em></h2>
          <p>
            Data, hora e cidade posicionam Sol, Lua, Ascendente, casas e aspectos de um mapa que é só seu.
            Depois da compra, o Arcane911 revela o mapa completo e a leitura do Agent911 imediatamente.
            Em 1 a 2 dias úteis, uma síntese aprofundada revisada por um astrólogo chega ao seu e-mail.
          </p>
        </div>

        <div className="astro-form-assurance">
          <div className="astro-form-offer" aria-label="O que está incluído no Documento Astral 911">
            <span><Sparkles size={16} /><strong>Na hora</strong> mapa natal completo + leitura do Agent911</span>
            <span><FileText size={16} /><strong>Depois</strong> síntese aprofundada em PDF, revisada individualmente</span>
            <span><Sparkles size={16} /><strong>Após o PDF</strong> 5 perguntas sobre o seu próprio mapa</span>
          </div>
          <div className="astro-privacy-card">
            <ShieldCheck size={20} />
            <div>
              <strong>Seus dados ficam protegidos.</strong>
              <span>
                O mapa só é revelado após o pagamento. Nome, e-mail e dados de nascimento são usados apenas
                para calcular o mapa, preparar a síntese contratada e fazer a entrega.
              </span>
            </div>
          </div>
        </div>

        <form className="astro-form" onSubmit={createChart} noValidate>
          {offsetOptions.length > 1 ? (
            <label className="astro-field astro-field-wide">
              <span>Confirmação do horário de verão</span>
              <select value={form.utcOffsetMinutes ?? ""} onChange={(event) => updateField("utcOffsetMinutes", event.target.value)} required>
                <option value="">Selecione somente após conferir seu registro</option>
                {offsetOptions.map((option) => <option key={option.minutes} value={option.minutes}>{option.label}</option>)}
              </select>
              <small>Se não souber qual ocorrência é a correta, confirme o horário antes de comprar.</small>
            </label>
          ) : null}
          <label className="astro-field astro-field-wide">
            <span><UserRound size={16} /> Nome completo</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => updateField("name", event.target.value.slice(0, 60))}
              placeholder="Digite seu nome completo"
              autoComplete="name"
              required
            />
          </label>

          <label className="astro-field astro-field-wide">
            <span><Mail size={16} /> E-mail para receber a síntese</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value.slice(0, 150))}
              placeholder="voce@exemplo.com"
              autoComplete="email"
              required
            />
            <small className="astro-picker-helper">A síntese em PDF será enviada para este endereço em até 1 a 2 dias úteis.</small>
          </label>

          <TemporalPickerField
            id="birth-date"
            type="date"
            label="Data de nascimento"
            value={form.date}
            onChange={(event) => updateField("date", event.target.value)}
            max={maxDate}
            helper="Clique em qualquer ponto do campo para abrir o calendário."
            action="Calendário"
            icon={CalendarDays}
          />

          <TemporalPickerField
            id="birth-time"
            type="time"
            label="Horário de nascimento"
            value={form.time}
            onChange={(event) => updateField("time", event.target.value)}
            helper="Use o horário registrado na certidão, quando souber."
            action="Relógio"
            icon={Clock3}
          />

          <div className="astro-field astro-field-wide astro-location-field">
            <label htmlFor="birth-city"><MapPin size={16} /> Cidade de nascimento</label>
            <div className="astro-location-search">
              <input
                id="birth-city"
                type="search"
                value={form.city}
                onChange={(event) => updateField("city", event.target.value.slice(0, 100))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    findLocations();
                  }
                }}
                placeholder="Ex.: Campinas, São Paulo"
                autoComplete="off"
              />
              <button className="button button-glass" type="button" onClick={findLocations} disabled={searching}>
                <Search size={17} /> {searching ? "Buscando…" : "Buscar"}
              </button>
            </div>

            {locations.length ? (
              <div className="location-results" role="listbox" aria-label="Cidades encontradas">
                {locations.map((location) => (
                  <button type="button" role="option" key={location.id} onClick={() => chooseLocation(location)}>
                    <MapPin size={16} />
                    <span><strong>{location.name}</strong><small>{[location.admin1, location.country].filter(Boolean).join(" · ")}</small></span>
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            ) : null}

            <div className="city-shortcuts" aria-label="Cidades mais usadas">
              <small>Atalhos</small>
              {featuredCities.map((location) => (
                <button type="button" key={location.id} onClick={() => chooseLocation(location)}>{location.name}</button>
              ))}
            </div>
          </div>

          {selectedLocation ? (
            <div className="selected-location astro-field-wide">
              <CheckCircle2 size={17} />
              <span><strong>Local confirmado</strong>{formatLocation(selectedLocation)} · {selectedLocation.timezone}</span>
            </div>
          ) : null}

          <fieldset className="astro-questionnaire astro-field-wide">
            <legend>Para a leitura falar de você — e não de “qualquer pessoa”</legend>
            <p>Marque uma ou mais respostas em cada bloco. Isso vira autorrelato na leitura; não altera o cálculo do seu mapa.</p>
            {astralQuestionnaireGroups.map((group, groupIndex) => (
              <section key={group.id}>
                <span>{String(groupIndex + 1).padStart(2, "0")} · {group.question}</span>
                <div>
                  {group.options.map((option) => {
                    const selected = questionnaire[group.id]?.includes(option.id);
                    return (
                      <label className={selected ? "is-selected" : ""} key={option.id}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleQuestionnaire(group.id, option.id)}
                        />
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </fieldset>

          {error ? <p className="astro-error astro-field-wide" role="alert">{error}</p> : null}

          <button className="button button-primary button-large astro-submit astro-field-wide" type="submit" disabled={paymentState === "opening" || paymentState === "verifying"}>
            {paymentState === "opening" ? "Abrindo pagamento…" : "Continuar para pagamento"}
            <Sparkles size={18} />
          </button>
          <p className="astro-form-source astro-field-wide">
            O mapa só é revelado após o pagamento. Coordenadas por GeoNames · efemérides verificadas
            em dois motores independentes · interpretação imediata conectada pelo 911.
          </p>
        </form>
      </section>

      {chart && !astralAccessGranted ? (
        <AstralPurchaseGate
          product={astralProduct}
          paymentState={paymentState}
          paymentMessage={paymentMessage}
          onCheckout={() => proceedToAstralCheckout(chart)}
        />
      ) : null}

      {chart && astralAccessGranted ? (
        <section className="astro-result" ref={resultRef} aria-labelledby="astro-result-title">
          <div className="astro-result-header">
            <div>
              <span className="section-kicker">02 · Pagamento confirmado · seu mapa está aberto</span>
              <h2 id="astro-result-title">O céu de {chart.person}.</h2>
              <p>
                {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(`${chart.birth.date}T12:00:00`))}
                {` às ${chart.birth.time} · ${chart.location.name}, ${chart.location.country}`}
              </p>
            </div>
            <div className={`precision-badge is-${chart.precision.status}`}>
              <CheckCircle2 size={18} />
              <span><strong>{chart.precision.label}</strong><small>desvio máximo {chart.precision.maximumDelta.toFixed(3)}°</small></span>
            </div>
          </div>

          <div className="astro-chart-stage">
            <NatalWheel chart={chart} />
            <article className="astro-synthesis">
              <span className="section-kicker">Síntese inicial</span>
              <h3>Três camadas, uma mesma pessoa.</h3>
              <p>{chart.synthesis}</p>
              <div className="element-score">
                {Object.entries(chart.elementScores).map(([element, score]) => (
                  <span className={element === chart.dominantElement ? "is-dominant" : ""} key={element}>
                    <small>{element}</small><strong>{score}</strong>
                  </span>
                ))}
              </div>
              <small>Elemento dominante: <strong>{chart.dominantElement}</strong>. Predominância indica disponibilidade, não superioridade.</small>
            </article>
          </div>

          <Astral911Document chart={chart} entitlement={astralEntitlement} onStatus={updateStatus} />
          <HumanSynthesisStatus
            product={astralProduct}
            entitlement={astralEntitlement}
            deliveryStatus={astralOrderStatus}
            deliveryError={astralOrderError}
            onRefresh={() => syncAstralOrder()}
            onDownload={downloadAstralPdf}
            downloading={pdfDownloading}
          />
          <Astral911Questions
            chart={chart}
            entitlement={astralEntitlement}
            deliveryStatus={astralOrderStatus}
            onStatus={updateStatus}
            onRefresh={() => syncAstralOrder()}
          />

          <section className="big-three-section" aria-labelledby="big-three-title">
            <div className="astro-section-heading">
              <span className="section-kicker">O trio essencial</span>
              <h3 id="big-three-title">Identidade, emoção e presença.</h3>
            </div>
            <div className="big-three-grid">
              {chart.bigThree.map((point) => (
                <article key={point.key}>
                  <span className="big-three-glyph">{point.glyph}</span>
                  <small>{point.eyebrow}</small>
                  <h4>{point.title}</h4>
                  <b>{point.degreeLabel}</b>
                  <p>{point.text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="astro-detail-section" aria-labelledby="planets-title">
            <div className="astro-section-heading split-heading">
              <div><span className="section-kicker">Planetas</span><h3 id="planets-title">Dez funções em movimento.</h3></div>
              <p>O signo mostra como a função se expressa. A casa mostra onde ela encontra experiência concreta.</p>
            </div>
            <div className="planet-grid">
              {chart.planets.map((planet) => (
                <article key={planet.key}>
                  <div className="planet-heading">
                    <span>{planet.glyph}</span>
                    <div><h4>{planet.name}</h4><small>{planet.role}</small></div>
                  </div>
                  <div className="planet-position">
                    <strong>{planet.sign.glyph} {planet.sign.name} {planet.degreeLabel}</strong>
                    <span>Casa {planet.house}{planet.retrograde ? " · retrógrado" : ""}</span>
                  </div>
                  <p>{planet.interpretation}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="astro-detail-section" aria-labelledby="aspects-title">
            <div className="astro-section-heading split-heading">
              <div><span className="section-kicker">Aspectos maiores</span><h3 id="aspects-title">Onde as forças conversam.</h3></div>
              <p>Linhas de cooperação, tensão e integração calculadas pela distância angular entre os pontos.</p>
            </div>
            <div className="aspect-list">
              {chart.aspects.map((aspect, index) => (
                <article key={`${aspect.point1Key}-${aspect.point2Key}-${index}`}>
                  <span className={`aspect-symbol is-${aspect.tone}`}>{aspect.symbol}</span>
                  <div>
                    <small>{aspect.name} · orbe {Number(aspect.orb).toFixed(2)}°</small>
                    <h4>{aspect.point1Name} × {aspect.point2Name}</h4>
                    <p>{aspect.interpretation}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="astro-detail-section" aria-labelledby="houses-title">
            <div className="astro-section-heading split-heading">
              <div><span className="section-kicker">As doze casas</span><h3 id="houses-title">Os territórios da experiência.</h3></div>
              <p>O Ascendente abre a Casa 1. A partir dele, o mapa distribui temas e planetas em doze campos.</p>
            </div>
            <div className="house-grid">
              {chart.houses.map((house) => (
                <article key={house.number}>
                  <span>{String(house.number).padStart(2, "0")}</span>
                  <div>
                    <small>{house.sign.glyph} {house.sign.name} · {house.degreeLabel}</small>
                    <h4>{house.theme}</h4>
                    <p>{house.planets.length ? house.planets.map((key) => chart.planets.find((planet) => planet.key === key)?.name).join(" · ") : "Sem planetas — o tema continua ativo pelo signo da cúspide."}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="astro-result-actions">
            <button className="button button-primary" type="button" onClick={shareChart}><Share2 size={17} /> Compartilhar resumo</button>
            <button className="button button-glass" type="button" onClick={startAgain}><RotateCcw size={16} /> Criar outro mapa</button>
            <Link className="text-button" to="/tiragem-gratis">Levar uma pergunta ao tarot <ArrowRight size={15} /></Link>
          </div>
          <p className="astro-disclaimer">
            Astrologia é uma linguagem simbólica de autoconhecimento. O mapa não determina acontecimentos nem substitui orientação médica, jurídica, psicológica ou financeira.
          </p>
        </section>
      ) : null}

      <p className="live-status astro-live-status" aria-live="polite">{status}</p>
    </main>
  );
}
