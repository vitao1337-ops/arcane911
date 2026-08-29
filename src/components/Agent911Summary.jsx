import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Sparkles } from "./MysticIcons";
import { agent911Config } from "../config/agent911";
import { normalizeAgent911ReadingMode } from "../config/agent911ReadingModes";
import {
  agent911ErrorMessage,
  createTarotAgentContext,
  requestAgent911,
} from "../lib/agent911";
import { trackCommercialEvent } from "../lib/checkout";
import {
  loadAgent911Summary,
  saveAgent911Summary,
  summaryCacheKey,
} from "../lib/agent911Session";
import "../agent911.css";

function wrapDevMockReading(reading, key) {
  return {
    answer: reading.synthesis,
    reading,
    followUps: [],
    conversationId: `essential-${key}`,
    questionsRemaining: 3,
    source: "mock",
  };
}

function canUseCachedSummary(cached) {
  if (!cached) return false;
  return agent911Config.devMockEnabled
    ? cached.source === "mock"
    : cached.source === "live" && ["gemini", "openai"].includes(cached.meta?.provider);
}

function splitTableVerdict(synthesis, readingMode) {
  const text = String(synthesis ?? "").trim();
  if (readingMode !== "sem_rodeios") return { text, verdict: "" };

  const match = text.match(/^Resposta da mesa:\s*(SIM|NÃO|INCONCLUSIVA)\.\s*/iu);
  if (!match) return { text, verdict: "" };
  return {
    text: text.slice(match[0].length).trim(),
    verdict: match[1].toLocaleUpperCase("pt-BR"),
  };
}

export default function Agent911Summary({
  cards,
  intentId,
  intentLabel,
  question,
  readingMode = "acolhedora",
  createdAt,
  variant = "opening",
  spreadId = "",
  parentReadingId = "",
  entitlement = null,
  onResult,
}) {
  const normalizedReadingMode = normalizeAgent911ReadingMode(readingMode);
  const cacheKey = useMemo(
    () => `${summaryCacheKey(createdAt, variant, cards, normalizedReadingMode)}:${agent911Config.mode}`,
    [cards, createdAt, normalizedReadingMode, variant],
  );
  const cached = useMemo(() => loadAgent911Summary(cacheKey), [cacheKey]);
  const [result, setResult] = useState(() => (
    canUseCachedSummary(cached) ? cached : null
  ));
  const [loading, setLoading] = useState(!canUseCachedSummary(cached));
  const [errorCode, setErrorCode] = useState("");
  const [retryDelayMs, setRetryDelayMs] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const context = useMemo(() => createTarotAgentContext({
    cards,
    intentId,
    intentLabel,
    question,
    createdAt,
    spreadId,
    parentReadingId,
  }), [cards, createdAt, intentId, intentLabel, parentReadingId, question, spreadId]);

  useEffect(() => {
    let active = true;
    const stored = loadAgent911Summary(cacheKey);
    if (canUseCachedSummary(stored)) {
      setResult(stored);
      setLoading(false);
      setErrorCode("");
      setRetryDelayMs(0);
      onResultRef.current?.(stored);
      return () => { active = false; };
    }

    if (import.meta.env.DEV && agent911Config.devMockEnabled) {
      setResult(null);
      setLoading(true);
      setErrorCode("");
      const mockModule = import("../lib/agent911Fallback");
      mockModule.then(({ buildAgent911Fallback }) => {
        const mockResult = wrapDevMockReading(
          buildAgent911Fallback({ cards, intentId, question, variant, spreadId }),
          cacheKey,
        );
        saveAgent911Summary(cacheKey, mockResult);
        if (!active) return;
        setResult(mockResult);
        setLoading(false);
        setRetryDelayMs(0);
        onResultRef.current?.(mockResult);
        trackCommercialEvent("agent911_summary_ready", {
          variant,
          card_count: cards.length,
          source: "mock",
          reading_mode: normalizedReadingMode,
        });
      }).catch(() => {
        if (!active) return;
        setLoading(false);
        setErrorCode("unknown");
      });
      return () => { active = false; };
    }

    setResult(null);
    setLoading(true);
    setErrorCode("");
    onResultRef.current?.(null);

    const currentRequest = requestAgent911(context, {
      action: variant === "complete"
        ? "complete_summary"
        : variant === "specific" ? "specific_summary" : "opening_summary",
      readingMode: normalizedReadingMode,
      memoryConsent: false,
      payment: variant === "opening" ? null : entitlement,
    });

    currentRequest
      .then((liveResult) => {
        const normalized = { ...liveResult, source: "live" };
        saveAgent911Summary(cacheKey, normalized);
        if (!active) return;
        trackCommercialEvent("agent911_summary_ready", {
          variant,
          card_count: cards.length,
          source: "live",
          provider: liveResult.meta?.provider ?? "unknown",
          reading_mode: normalizedReadingMode,
        });
        setResult(normalized);
        setLoading(false);
        setRetryDelayMs(0);
        onResultRef.current?.(normalized);
      })
      .catch((requestError) => {
        if (!active) return;
        trackCommercialEvent("agent911_summary_unavailable", {
          variant,
          card_count: cards.length,
          reason: requestError?.code ?? "unknown",
          reading_mode: normalizedReadingMode,
        });
        setResult(null);
        setLoading(false);
        setErrorCode(requestError?.code ?? "unknown");
        setRetryDelayMs(requestError?.retryAfterMs ?? 0);
        onResultRef.current?.(null);
      });

    return () => { active = false; };
  }, [
    attempt,
    cacheKey,
    cards,
    context,
    entitlement?.productId,
    entitlement?.questionNumber,
    entitlement?.readingId,
    entitlement?.sessionId,
    normalizedReadingMode,
    variant,
  ]);

  useEffect(() => {
    if (retryDelayMs <= 0) return undefined;
    const timeout = globalThis.setTimeout(() => setRetryDelayMs(0), retryDelayMs);
    return () => globalThis.clearTimeout(timeout);
  }, [retryDelayMs]);

  const isComplete = variant === "complete";
  const isSpecific = variant === "specific";
  const summaryLabel = isComplete
    ? "Síntese pessoal da Ferradura"
    : isSpecific ? "Resposta pessoal da pergunta" : "Leitura pessoal do 911";

  if (!result) {
    return (
      <article
        className={`synthesis-card agent911-summary is-${variant} ${loading ? "is-loading" : "is-unavailable"}`}
        aria-labelledby={`agent911-summary-title-${variant}`}
        data-agent911-source={loading ? "pending" : "unavailable"}
        data-agent911-provider={loading ? "pending" : "none"}
        data-agent911-reading-mode={normalizedReadingMode}
      >
        <div className="synthesis-orb agent911-summary-orb" aria-hidden="true">
          <span>✦</span><strong>911</strong>
        </div>
        <div className="agent911-summary-copy">
          <div className="agent911-summary-meta">
            <span className="section-kicker">{summaryLabel}</span>
            <span className={loading ? "is-reading" : ""} role="status">
              <Sparkles size={13} /> {loading ? "lendo sua mesa…" : "leitura interrompida"}
            </span>
          </div>
          <div className="agent911-card-anchors" aria-label="Cartas desta leitura">
            {cards.map((card) => <span key={card.slug}>{card.name}</span>)}
          </div>
          <h3 id={`agent911-summary-title-${variant}`}>
            {loading
              ? isComplete
                ? "Sete posições estão virando uma história só."
                : isSpecific ? "Cinco posições estão respondendo à mesma pergunta." : "Sua pergunta está encontrando as três cartas."
              : "O 911 não concluiu esta leitura."}
          </h3>
          <q>{question}</q>
          {loading ? (
            <div className="agent911-reading-stage" aria-hidden="true">
              <span>Escutando o ponto vivo da pergunta</span>
              <span>Cruzando cartas, posições e tensões</span>
              <span>Lapidando uma resposta sem fórmulas prontas</span>
            </div>
          ) : (
            <div className="agent911-reading-retry">
              <p>{agent911ErrorMessage(errorCode)} Nenhum texto automático foi colocado no lugar.</p>
              <button
                className="button button-glass"
                type="button"
                disabled={retryDelayMs > 0}
                onClick={() => setAttempt((current) => current + 1)}
              >
                <RotateCcw size={15} /> Tentar a leitura novamente
              </button>
              <small data-agent911-error={errorCode}>
                {retryDelayMs > 0
                  ? "A nova tentativa será liberada após o intervalo seguro."
                  : "A tentativa não altera suas cartas nem consome uma pergunta."}
              </small>
            </div>
          )}
        </div>
      </article>
    );
  }

  const reading = result.reading;
  const tableVerdict = splitTableVerdict(reading.synthesis, normalizedReadingMode);
  const verdictClass = tableVerdict.verdict
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return (
    <article
      className={`synthesis-card agent911-summary is-${variant}`}
      aria-labelledby={`agent911-summary-title-${variant}`}
      data-agent911-source={result.source ?? "live"}
      data-agent911-provider={result.meta?.provider
        ?? (result.source === "mock" ? "mock" : "unknown")}
      data-agent911-reading-mode={normalizedReadingMode}
    >
      <div className="synthesis-orb agent911-summary-orb" aria-hidden="true">
        <span>✦</span><strong>911</strong>
      </div>
      <div className="agent911-summary-copy">
        <div className="agent911-summary-meta">
          <span className="section-kicker">{summaryLabel}</span>
          <span className={loading ? "is-reading" : ""} role="status">
            <Sparkles size={13} /> {loading ? "afinando a leitura…" : "leitura concluída"}
          </span>
        </div>
        <div className="agent911-card-anchors" aria-label="Cartas usadas nesta síntese">
          {cards.map((card) => <span key={card.slug}>{card.name}</span>)}
        </div>
        <h3 id={`agent911-summary-title-${variant}`}>{reading.title}</h3>
        <q>{reading.opening.replace(/^Você perguntou:\s*[“\"]?/i, "").replace(/[”\"]$/, "")}</q>
        {reading.sections?.map((section) => (
          <p className="agent911-summary-reading" key={section.id}>{section.text}</p>
        ))}
        {tableVerdict.verdict ? (
          <div className={`agent911-table-verdict is-${verdictClass}`}>
            <span>Resposta da mesa</span>
            <strong>{tableVerdict.verdict}</strong>
          </div>
        ) : null}
        <p>{tableVerdict.text}</p>
        <div className="agent911-summary-action">
          <Sparkles size={16} />
          <div><span>Seu próximo gesto</span><p>{reading.groundedAction}</p></div>
        </div>
        <small>Leitura simbólica e pessoal, não sentença nem substituto de orientação profissional.</small>
      </div>
    </article>
  );
}
