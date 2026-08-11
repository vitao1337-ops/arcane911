import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
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

function wrapFallback(reading, key) {
  return {
    answer: reading.synthesis,
    reading,
    followUps: [],
    conversationId: `essential-${key}`,
    questionsRemaining: 3,
    source: "essential",
  };
}

export default function Agent911Summary({
  cards,
  intentId,
  intentLabel,
  question,
  createdAt,
  variant = "opening",
  onResult,
}) {
  const cacheKey = useMemo(
    () => summaryCacheKey(createdAt, variant, cards),
    [cards, createdAt, variant],
  );
  const fallback = useMemo(
    () => wrapFallback(buildAgent911Fallback({ cards, intentId, question, variant }), cacheKey),
    [cacheKey, cards, intentId, question, variant],
  );
  const cached = useMemo(() => loadAgent911Summary(cacheKey), [cacheKey]);
  const [result, setResult] = useState(cached ?? fallback);
  const [loading, setLoading] = useState(!cached);
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
    if (stored) {
      setResult(stored);
      setLoading(false);
      onResultRef.current?.(stored);
      return () => { active = false; };
    }

    setResult(fallback);
    setLoading(true);
    onResultRef.current?.(fallback);

    const currentRequest = getPendingAgent911Summary(cacheKey) ?? setPendingAgent911Summary(
      cacheKey,
      requestAgent911(context, {
        action: variant === "complete" ? "complete_summary" : "opening_summary",
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
        });
        setResult(normalized);
        setLoading(false);
        onResultRef.current?.(normalized);
      })
      .catch((requestError) => {
        if (!active) return;
        trackCommercialEvent("agent911_summary_fallback", {
          variant,
          card_count: cards.length,
          reason: requestError?.code ?? "unknown",
        });
        setResult(fallback);
        setLoading(false);
        onResultRef.current?.(fallback);
      });

    return () => { active = false; };
  }, [cacheKey, context, fallback, variant]);

  const reading = result.reading;
  const isComplete = variant === "complete";

  return (
    <article
      className={`synthesis-card agent911-summary is-${variant}`}
      aria-labelledby={`agent911-summary-title-${variant}`}
      data-agent911-source={result.source ?? "live"}
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
        <p>{reading.synthesis}</p>
        <div className="agent911-summary-action">
          <Sparkles size={16} />
          <div><span>Seu próximo gesto</span><p>{reading.groundedAction}</p></div>
        </div>
        <small>Leitura simbólica e pessoal, não sentença nem substituto de orientação profissional.</small>
      </div>
    </article>
  );
}
