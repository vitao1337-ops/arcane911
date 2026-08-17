import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  MapPin,
  RotateCcw,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import Astral911Document from "../components/Astral911Document";
import NatalWheel from "../components/NatalWheel";
import { astro911Config } from "../config/astro911";
import { commerceConfig } from "../config/commerce";
import { astro911Fingerprint, clearCachedAstro911Document } from "../lib/astro911";
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
  savePaymentEntitlement,
  savePendingCheckout,
  trackCommercialEvent,
  verifyHostedCheckout,
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

function AstralDocumentGate({ product, paymentState, paymentMessage, onCheckout }) {
  const busy = paymentState === "opening" || paymentState === "verifying";
  return (
    <section className="astro-document astro-document-loading astro-document-access" aria-labelledby="astro-access-title">
      <div className="astro-document-seal" aria-hidden="true"><span>✦</span><strong>911</strong></div>
      <div>
        <span className="section-kicker">03 · Documento Astral 911</span>
        <h3 id="astro-access-title">Seu céu está calculado.<br />O documento completo está protegido.</h3>
        <p>
          A compra libera a leitura longa ancorada neste mapa, com cinco capítulos,
          retrato central, práticas de integração, perguntas de reflexão e versão para PDF.
        </p>
        <div className="astro-document-progress" aria-label="Conteúdo do Documento Astral">
          <span><FileText size={15} /> Cinco capítulos pessoais</span>
          <span><Sparkles size={15} /> Posições reais do mapa</span>
          <span><ShieldCheck size={15} /> Confirmação segura no servidor</span>
        </div>
        <button className="button button-primary astro-access-action" type="button" onClick={onCheckout} disabled={busy}>
          {busy ? "Confirmando acesso…" : `Liberar Documento Astral · ${product.price}`}
          <ArrowRight size={17} />
        </button>
        {paymentMessage ? <small className={`astro-payment-message is-${paymentState}`} role={paymentState === "error" ? "alert" : "status"}>{paymentMessage}</small> : null}
        <small>O cálculo básico permanece disponível. Dados de nascimento e texto do documento não são enviados ao pagamento.</small>
      </div>
    </section>
  );
}

export default function AstralMapPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", date: "", time: "", city: "" });
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locations, setLocations] = useState([]);
  const [searching, setSearching] = useState(false);
  const [chart, setChart] = useState(readStoredChart);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [astralEntitlement, setAstralEntitlement] = useState(null);
  const [paymentState, setPaymentState] = useState("idle");
  const [paymentMessage, setPaymentMessage] = useState("");
  const controllerRef = useRef(null);
  const resultRef = useRef(null);
  const checkoutVerificationRef = useRef("");
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
  const astralAccessGranted = !astralProduct.accessRequired
    || commerceConfig.devUnlocked
    || Boolean(
      astralEntitlement
      && astralEntitlement.productId === astralProduct.id
      && astralEntitlement.readingId === chartFingerprint
      && astralEntitlement.offerContext === ASTRAL_OFFER_CONTEXT,
    );

  useEffect(() => () => controllerRef.current?.abort(), []);

  useEffect(() => {
    if (!chartFingerprint) {
      setAstralEntitlement(null);
      return;
    }
    setAstralEntitlement(findPaymentEntitlement({
      productId: astralProduct.id,
      readingId: chartFingerprint,
      offerContext: ASTRAL_OFFER_CONTEXT,
    }));
  }, [astralProduct.id, chartFingerprint]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const checkoutState = params.get("checkout");
    if (!checkoutState) return;

    if (checkoutState === "cancelled") {
      clearPendingCheckout();
      setPaymentState("idle");
      setPaymentMessage("Pagamento cancelado. Seu mapa calculado continua disponível.");
      setStatus("Pagamento cancelado. Nenhum valor foi confirmado por esta tela.");
      navigate("/mapa-astral", { replace: true });
      return;
    }

    const sessionId = params.get("session_id") ?? "";
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
        setStatus(`O Documento Astral está sendo preparado. Guarde o código ${pending.orderId}.`);
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

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
    if (field === "city") setSelectedLocation(null);
  }

  function chooseLocation(location) {
    setSelectedLocation(location);
    setForm((current) => ({ ...current, city: formatLocation(location) }));
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

  function createChart(event) {
    event.preventDefault();
    setError("");

    try {
      const nextChart = calculateNatalChart({ ...form, location: selectedLocation });
      setChart(nextChart);
      storeChart(nextChart);
      setPaymentState("idle");
      setPaymentMessage("");
      setStatus("Mapa calculado e guardado temporariamente nesta sessão.");
      window.requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (chartError) {
      setError(chartError.message);
    }
  }

  async function proceedToAstralCheckout() {
    if (!astralProduct.accessRequired || paymentState === "opening" || paymentState === "verifying") return;
    if (!chartFingerprint) {
      setPaymentState("error");
      setPaymentMessage("Calcule novamente o mapa antes de abrir o pagamento.");
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
      readingId: chartFingerprint,
      offerContext: ASTRAL_OFFER_CONTEXT,
      returnPath: "/mapa-astral",
    });
    setPaymentState("opening");
    setPaymentMessage("Abrindo o pagamento seguro…");

    try {
      const checkout = await createHostedCheckout(pending);
      trackCommercialEvent("begin_checkout", {
        product_id: astralProduct.id,
        price_label: astralProduct.price,
        reading_id: chartFingerprint,
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
    setForm({ name: "", date: "", time: "", city: "" });
    setSelectedLocation(null);
    setLocations([]);
    setAstralEntitlement(null);
    setPaymentState("idle");
    setPaymentMessage("");
    setError("");
    setStatus("Pronto para um novo mapa.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="astro-page" id="astro-top">
      <section className="astro-hero">
        <div className="astro-hero-copy">
          <div className="eyebrow"><span /> Mapa natal · cálculo real</div>
          <h1>O céu do instante em que <em>você chegou.</em></h1>
          <p>
            Data, horário e cidade transformados em um mapa completo: Sol, Lua, Ascendente,
            planetas, casas e aspectos — e um documento pessoal escrito a partir do seu céu real.
          </p>
          <div className="astro-test-access">
            <FileText size={17} />
            <span>
              <strong>{commerceConfig.devUnlocked ? "Modo DEV completo e gratuito." : "Documento premium em validação."}</strong>
              {commerceConfig.devUnlocked && astro911Config.devMockEnabled
                ? " Leitura local com o mesmo contrato, sem chamadas pagas."
                : astralProduct.accessRequired
                  ? ` O cálculo abre primeiro; o documento completo custa ${astralProduct.price}.`
                  : " Acesso aberto enquanto o preço próprio do Documento Astral é definido."}
            </span>
          </div>
          <div className="astro-hero-notes">
            <span><CheckCircle2 size={16} /> 10 planetas</span>
            <span><CheckCircle2 size={16} /> 12 casas</span>
            <span><CheckCircle2 size={16} /> Aspectos maiores</span>
          </div>
          <a className="button button-primary button-large" href="#criar-mapa">
            Criar meu mapa
            <ArrowRight size={18} />
          </a>
        </div>
        <div className="astro-hero-wheel">
          <span className="astro-orbit-note"><Sparkles size={14} /> sua arquitetura celeste</span>
          <NatalWheel chart={chart} preview={!chart} />
        </div>
      </section>

      <section className="astro-form-section" id="criar-mapa">
        <div className="astro-form-intro">
          <span className="section-kicker">01 · Coordenadas de nascimento</span>
          <h2>Precisão começa no dado certo.</h2>
          <p>
            Use o horário registrado. Alguns minutos podem alterar graus e, perto de uma cúspide,
            mudar o Ascendente ou a distribuição das casas.
          </p>
          <div className="astro-privacy-card">
            <ShieldCheck size={20} />
            <div>
              <strong>Privacidade por minimização.</strong>
              <span>
                O cálculo fica no navegador. Para escrever o documento, o 911 recebe somente
                seu primeiro nome e as posições calculadas — nunca data, horário ou cidade.
              </span>
            </div>
          </div>
        </div>

        <form className="astro-form" onSubmit={createChart} noValidate>
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

          {error ? <p className="astro-error astro-field-wide" role="alert">{error}</p> : null}

          <button className="button button-primary button-large astro-submit astro-field-wide" type="submit">
            Calcular meu céu
            <Sparkles size={18} />
          </button>
          <p className="astro-form-source astro-field-wide">
            Coordenadas por Open-Meteo · efemérides verificadas em dois motores independentes ·
            interpretação conectada pelo 911.
          </p>
        </form>
      </section>

      {chart ? (
        <section className="astro-result" ref={resultRef} aria-labelledby="astro-result-title">
          <div className="astro-result-header">
            <div>
              <span className="section-kicker">02 · Seu mapa está aberto</span>
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

          {astralAccessGranted ? (
            <Astral911Document chart={chart} entitlement={astralEntitlement} onStatus={updateStatus} />
          ) : (
            <AstralDocumentGate
              product={astralProduct}
              paymentState={paymentState}
              paymentMessage={paymentMessage}
              onCheckout={proceedToAstralCheckout}
            />
          )}

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
