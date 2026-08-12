import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Sparkles } from "lucide-react";
import { agent911Config } from "../config/agent911";
import { normalizeAgent911ReadingMode } from "../config/agent911ReadingModes";
import { createTarotAgentContext, requestAgent911 } from "../lib/agent911";
import { buildAgent911Fallback } from "../lib/agent911Fallback";
import { trackCommercialEvent } from "../lib/checkout";
import {
  getPendingAgent911Summary,
  loadAgent911Summary,
  saveAgent911Summary,
  setPendingAgent911Summary,
  summaryCacheKey,
} from "../lib/agent911Session";
import "../agent911.css";

function wrapLocalReading(reading, key) {
  return {
    answer: reading.synthesis,
    reading,
    followUps: [],
    conversationId: `essential-${key}`,
    questionsRemaining: 3,
    source: "local",
  };
}

function canUseCachedSummary(cached) {
  if (!cached) return false;
  return !agent911Config.remoteEnabled
    ? cached.source === "local"
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
  onResult,
}) {
  const normalizedReadingMode = normalizeAgent911ReadingMode(readingMode);
  const cacheKey = useMemo(
    () => `${summaryCacheKey(createdAt, variant, cards, normalizedReadingMode)}:${agent911Config.mode}`,
    [cards, createdAt, normalizedReadingMode, variant],
  );
  const localResult = useMemo(
    () => !agent911Config.remoteEnabled
      ? wrapLocalReading(buildAgent911Fallback({ cards, intentId, question, variant }), cacheKey)
      : null,
    [cacheKey, cards, intentId, question, variant],
  );
  const cached = useMemo(() => loadAgent911Summary(cacheKey), [cacheKey]);
  const [result, setResult] = useState(() => (
    canUseCachedSummary(cached) ? cached : localResult
  ));
  const [loading, setLoading] = useState(
    agent911Config.remoteEnabled && !canUseCachedSummary(cached),
  );
  const [errorCode, setErrorCode] = useState("");
  const [attempt, setAttempt] = useState(0);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const context = useMemo(() => createTarotAgentContext({
    cards,
    intentId,
    intentLabel,
    question,
    createdAt,
  }), [cards, createdAt, intentId, intentLabel, question]);

  useEffect(() => {
    let active = true;
    const stored = loadAgent911Summary(cacheKey);
    if (canUseCachedSummary(stored)) {
      setResult(stored);
      setLoading(false);
      setErrorCode("");
      onResultRef.current?.(stored);
      return () => { active = false; };
    }

    if (!agent911Config.remoteEnabled) {
      setResult(localResult);
      setLoading(false);
      setErrorCode("");
      saveAgent911Summary(cacheKey, localResult);
      onResultRef.current?.(localResult);
      trackCommercialEvent("agent911_summary_ready", {
        variant,
        card_count: cards.length,
        source: "local",
        reading_mode: normalizedReadingMode,
      });
      setLoading(false);
      return () => { active = false; };
    }

    setResult(null);
    setLoading(true);
    setErrorCode("");
    onResultRef.current?.(null);

    const pendingKey = `${cacheKey}:connected:${attempt}`;
    const currentRequest = getPendingAgent911Summary(pendingKey) ?? setPendingAgent911Summary(
      pendingKey,
      requestAgent911(context, {
        action: variant === "complete" ? "complete_summary" : "opening_summary",
        readingMode: normalizedReadingMode,
        memoryConsent: false,
      }),
    );

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
        onResultRef.current?.(null);
      });

    return () => { active = false; };
  }, [attempt, cacheKey, cards.length, context, localResult, normalizedReadingMode, variant]);

  const isComplete = variant === "complete";

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
            <span className="section-kicker">{isComplete ? "Síntese pessoal da Ferradura" : "Leitura pessoal do 911"}</span>
            <span className={loading ? "is-reading" : ""} role="status">
              <Sparkles size={13} /> {loading ? "lendo sua mesa…" : "leitura interrompida"}
            </span>
          </div>
          <div className="agent911-card-anchors" aria-label="Cartas desta leitura">
            {cards.map((card) => <span key={card.slug}>{card.name}</span>)}
          </div>
          <h3 id={`agent911-summary-title-${variant}`}>
            {loading
              ? isComplete ? "Sete posições estão virando uma história só." : "Sua pergunta está encontrando as três cartas."
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
              <p>Nenhum texto automático foi colocado no lugar. Sua mesa continua aberta; tente novamente para receber a leitura conectada.</p>
              <button className="button button-glass" type="button" onClick={() => setAttempt((current) => current + 1)}>
                <RotateCcw size={15} /> Tentar a leitura novamente
              </button>
              <small data-agent911-error={errorCode}>A tentativa não altera suas cartas nem consome uma pergunta.</small>
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
        ?? (result.source === "local" ? "local" : result.source === "fallback" ? "fallback" : "unknown")}
      data-agent911-reading-mode={normalizedReadingMode}
    >
      <div className="synthesis-orb agent911-summary-orb" aria-hidden="true">
        <span>✦</span><strong>911</strong>
      </div>
      <div className="agent911-summary-copy">
        <div className="agent911-summary-meta">
          <span className="section-kicker">{isComplete ? "Síntese pessoal da Ferradura" : "Leitura pessoal do 911"}</span>
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
