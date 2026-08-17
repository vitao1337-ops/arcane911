import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpenText,
  Check,
  Download,
  FileText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  formatAstro911Document,
  readCachedAstro911Document,
  requestAstro911Document,
} from "../lib/astro911";

const sectionEyebrows = Object.freeze({
  essencia: "I · Essência e presença",
  afetos: "II · Vínculos e afetos",
  vocacao: "III · Vocação e expressão",
  tensoes: "IV · Tensões e recursos",
  integracao: "V · Integração consciente",
});

function firstName(value) {
  return String(value ?? "").trim().split(/\s+/u)[0] || "você";
}

export default function Astral911Document({ chart, entitlement, onStatus }) {
  const initialCache = useMemo(() => readCachedAstro911Document(chart), [chart]);
  const paymentSessionId = entitlement?.sessionId ?? "";
  const paymentProductId = entitlement?.productId ?? "";
  const paymentReadingId = entitlement?.readingId ?? "";
  const payment = useMemo(() => paymentSessionId ? {
    sessionId: paymentSessionId,
    productId: paymentProductId,
    readingId: paymentReadingId,
  } : null, [paymentProductId, paymentReadingId, paymentSessionId]);
  const [payload, setPayload] = useState(initialCache);
  const [phase, setPhase] = useState(initialCache ? "ready" : "loading");
  const [error, setError] = useState("");
  const [retryDelayMs, setRetryDelayMs] = useState(0);
  const activeRef = useRef(true);

  useEffect(() => {
    if (retryDelayMs <= 0) return undefined;
    const timeout = globalThis.setTimeout(() => setRetryDelayMs(0), retryDelayMs);
    return () => globalThis.clearTimeout(timeout);
  }, [retryDelayMs]);

  useEffect(() => {
    const cached = readCachedAstro911Document(chart);
    if (cached) {
      setPayload(cached);
      setPhase("ready");
      setError("");
      return undefined;
    }

    let active = true;
    activeRef.current = true;
    setPayload(null);
    setPhase("loading");
    setError("");
    onStatus?.("O 911 está cruzando posições, casas e aspectos do mapa…");
    requestAstro911Document(chart, { payment })
      .then((nextPayload) => {
        if (!active) return;
        setPayload(nextPayload);
        setPhase("ready");
        setRetryDelayMs(0);
        onStatus?.("Documento Astral concluído e guardado temporariamente nesta sessão.");
      })
      .catch((requestError) => {
        if (!active) return;
        setPhase("error");
        setError(requestError.message);
        setRetryDelayMs(requestError?.retryAfterMs ?? 0);
        onStatus?.("O mapa calculado continua disponível. O documento pode ser tentado novamente.");
      });

    return () => {
      active = false;
      activeRef.current = false;
    };
  }, [chart, onStatus, payment]);

  function retry() {
    if (retryDelayMs > 0) return;
    activeRef.current = true;
    setPhase("loading");
    setError("");
    requestAstro911Document(chart, { payment })
      .then((nextPayload) => {
        if (!activeRef.current) return;
        setPayload(nextPayload);
        setPhase("ready");
        setRetryDelayMs(0);
        onStatus?.("Documento Astral concluído e guardado temporariamente nesta sessão.");
      })
      .catch((requestError) => {
        if (!activeRef.current) return;
        setPhase("error");
        setError(requestError.message);
        setRetryDelayMs(requestError?.retryAfterMs ?? 0);
      });
  }

  async function copyDocument() {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(formatAstro911Document(payload, chart));
      onStatus?.("Documento Astral copiado.");
    } catch {
      onStatus?.("Não foi possível copiar agora.");
    }
  }

  function printDocument() {
    onStatus?.("Abrindo a impressão. No celular, escolha “Salvar como PDF”.");
    window.print();
  }

  if (phase === "loading") {
    return (
      <section className="astro-document astro-document-loading" aria-labelledby="astro-document-loading-title">
        <div className="astro-document-seal" aria-hidden="true"><span>✦</span><strong>911</strong></div>
        <div>
          <span className="section-kicker">03 · Documento Astral 911</span>
          <h3 id="astro-document-loading-title">O mapa já foi calculado.<br />Agora ele está sendo lido.</h3>
          <p>
            O 911 cruza o seu trio central, planetas, casas e aspectos. Nada aparece como
            provisório: a leitura só abre depois de passar pela auditoria das posições reais.
          </p>
          <div className="astro-document-progress" aria-label="Etapas da geração">
            <span><Sparkles size={15} /> Cruzando os eixos do mapa</span>
            <span><BookOpenText size={15} /> Construindo a narrativa pessoal</span>
            <span><ShieldCheck size={15} /> Conferindo fatos e limites</span>
          </div>
        </div>
      </section>
    );
  }

  if (phase === "error") {
    return (
      <section className="astro-document astro-document-error" aria-labelledby="astro-document-error-title">
        <div className="astro-document-seal" aria-hidden="true"><span>✦</span><strong>911</strong></div>
        <div>
          <span className="section-kicker">03 · Seu mapa continua seguro</span>
          <h3 id="astro-document-error-title">O texto conectado não abriu.</h3>
          <p>{error}</p>
          <button className="button button-primary" type="button" onClick={retry} disabled={retryDelayMs > 0}>
            <RefreshCw size={16} /> {retryDelayMs > 0 ? "Aguarde para tentar novamente" : "Tentar leitura novamente"}
          </button>
          <small>O cálculo do mapa não foi perdido e uma tentativa falha não cria documento genérico.</small>
        </div>
      </section>
    );
  }

  const document = payload.document;
  const factLabels = payload.factLabels ?? {};
  const name = firstName(chart.person);

  return (
    <section className="astro-document" aria-labelledby="astro-document-title" data-astro911-provider={payload.meta.provider}>
      <header className="astro-document-cover">
        <div className="astro-document-seal" aria-hidden="true"><span>✦</span><strong>911</strong></div>
        <div className="astro-document-cover-copy">
          <div className="astro-document-meta">
            <span>Documento Astral · {name}</span>
            <span><Check size={14} /> Estrutura auditada</span>
          </div>
          <h3 id="astro-document-title">{document.title}</h3>
          <p className="astro-document-subtitle">{document.subtitle}</p>
          <p className="astro-document-opening">{document.opening}</p>
          <div className="astro-document-badges">
            <span><FileText size={15} /> Documento premium completo</span>
            <span><Sparkles size={15} /> {payload.meta.provider === "mock" ? "Modo DEV local · custo zero" : "Leitura ancorada no seu mapa"}</span>
          </div>
        </div>
      </header>

      <section className="astro-document-portrait" aria-label="Retrato central do mapa">
        <article>
          <small>Força central</small>
          <p>{document.portrait.centralStrength}</p>
        </article>
        <article>
          <small>Tensão central</small>
          <p>{document.portrait.centralTension}</p>
        </article>
        <article>
          <small>Integração</small>
          <p>{document.portrait.integration}</p>
        </article>
      </section>

      <div className="astro-document-chapters">
        {document.sections.map((section) => (
          <article className="astro-document-chapter" key={section.id}>
            <span className="section-kicker">{sectionEyebrows[section.id]}</span>
            <h4>{section.title}</h4>
            <p>{section.body}</p>
            <div className="astro-document-anchors" aria-label="Posições usadas nesta interpretação">
              {section.anchors.map((anchor) => (
                <span key={anchor}>{factLabels[anchor] ?? anchor}</span>
              ))}
            </div>
            <aside>
              <small>Direção prática</small>
              <p>{section.practicalDirection}</p>
            </aside>
          </article>
        ))}
      </div>

      <section className="astro-document-practices" aria-labelledby="astro-practices-title">
        <div className="astro-section-heading split-heading">
          <div>
            <span className="section-kicker">Manual de integração</span>
            <h3 id="astro-practices-title">Levar o símbolo para a vida real.</h3>
          </div>
          <p>Cinco experiências concretas nascidas deste mapa — sem tentar consertar quem você é.</p>
        </div>
        <div className="astro-practice-grid">
          {document.practices.map((practice, index) => (
            <article key={`${practice.title}-${index}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h4>{practice.title}</h4>
                <p>{practice.action}</p>
                <small>{practice.purpose}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="astro-document-reflection" aria-labelledby="astro-reflection-title">
        <span className="section-kicker">Perguntas para voltar</span>
        <h3 id="astro-reflection-title">O mapa não encerra a conversa.</h3>
        <ol>
          {document.reflectionQuestions.map((question) => <li key={question}>{question}</li>)}
        </ol>
        <p>{document.closing}</p>
      </section>

      <footer className="astro-document-footer">
        <div>
          <strong>Como este documento foi feito</strong>
          <p>
            Zodíaco tropical e Casas Iguais, com posições calculadas no seu aparelho. O motor
            interpretativo recebeu apenas o primeiro nome e os fatos do mapa — não recebeu data,
            hora nem cidade.
          </p>
          <p className="astro-history-note">
            A estrutura planeta–signo–casa–aspecto segue a astrologia horoscópica desenvolvida no
            mundo helenístico a partir de tradições anteriores. A interpretação é contemporânea,
            simbólica e não tem validação científica. <a href="https://iep.utm.edu/hellenistic-astrology/" target="_blank" rel="noreferrer">Base histórica</a>
            {" · "}<a href="https://www.britishmuseum.org/collection/object/W_1885-0430-15" target="_blank" rel="noreferrer">origem do zodíaco</a>.
          </p>
        </div>
        <div className="astro-document-actions">
          <button className="button button-primary" type="button" onClick={printDocument}>
            <Download size={16} /> Salvar como PDF
          </button>
          <button className="button button-glass" type="button" onClick={copyDocument}>
            <FileText size={16} /> Copiar documento
          </button>
        </div>
        <small>
          Leitura simbólica e não determinista. Não substitui orientação médica, psicológica,
          jurídica ou financeira.
        </small>
      </footer>
    </section>
  );
}
