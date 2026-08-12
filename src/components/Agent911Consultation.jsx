import { useMemo, useRef, useState } from "react";
import { ArrowRight, Check, LockKeyhole, Send, ShieldCheck, Sparkles } from "lucide-react";
import { agent911Config } from "../config/agent911";
import {
  createTarotAgentContext,
  requestAgent911,
  serializeAgent911Reading,
} from "../lib/agent911";
import { buildAgent911FollowUpFallback } from "../lib/agent911Fallback";
import {
  loadConsultationProfile,
  loadConsultationState,
  saveConsultationProfile,
  saveConsultationState,
  validateConsultationProfile,
} from "../lib/agent911Session";
import { trackCommercialEvent } from "../lib/checkout";

function resultFromFallback(reading, index, source = "local") {
  return {
    answer: reading.synthesis,
    reading,
    followUps: [],
    conversationId: `essential-follow-up-${index}`,
    questionsRemaining: Math.max(0, agent911Config.offer.questionLimit - index),
    source,
  };
}

export default function Agent911Consultation({
  cards,
  intentId,
  intentLabel,
  question,
  createdAt,
  initialResult,
}) {
  const readingId = `${createdAt ?? "reading"}:complete`;
  const persistedConversation = useMemo(() => loadConsultationState(readingId), [readingId]);
  const [stage, setStage] = useState("offer");
  const [profile, setProfile] = useState(loadConsultationProfile);
  const [form, setForm] = useState(() => ({
    fullName: profile?.fullName ?? "",
    email: profile?.email ?? "",
  }));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [responses, setResponses] = useState(persistedConversation.responses);
  const [history, setHistory] = useState(persistedConversation.history);
  const [temporaryResult, setTemporaryResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const requestInFlight = useRef(false);
  const questionsRemaining = agent911Config.offer.questionLimit - responses.length;

  const context = useMemo(() => createTarotAgentContext({
    cards,
    intentId,
    intentLabel,
    question,
    createdAt,
  }), [cards, createdAt, intentId, intentLabel, question]);

  function openConsultation() {
    trackCommercialEvent("agent911_consultation_opened", {
      intent: intentId,
      reading_id: createdAt,
      returning_profile: Boolean(profile),
    });
    setStage(profile ? "conversation" : "register");
  }

  function register(event) {
    event.preventDefault();
    const validation = validateConsultationProfile(form);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    const saved = saveConsultationProfile(validation.value);
    trackCommercialEvent("agent911_consultation_registered", {
      intent: intentId,
      reading_id: createdAt,
    });
    setProfile(saved);
    setErrors({});
    setStage("conversation");
  }

  function commitResponse(result, baseHistory, currentMessage) {
    const nextResponses = [...responses, result];
    const nextHistory = [
      ...baseHistory,
      { role: "user", content: currentMessage },
      { role: "assistant", content: serializeAgent911Reading(result.reading) },
    ].slice(-8);
    setResponses(nextResponses);
    setHistory(nextHistory);
    setTemporaryResult(null);
    saveConsultationState(readingId, { responses: nextResponses, history: nextHistory });
  }

  async function submitQuestion(event) {
    event.preventDefault();
    const currentMessage = message.trim();
    if (!currentMessage || loading || requestInFlight.current || questionsRemaining <= 0) return;

    const baseHistory = history.length
      ? history
      : initialResult?.reading
        ? [{ role: "assistant", content: serializeAgent911Reading(initialResult.reading) }]
        : [];
    trackCommercialEvent("agent911_consultation_question_sent", {
      intent: intentId,
      reading_id: createdAt,
      question_number: responses.length + 1,
    });
    requestInFlight.current = true;
    setLoading(true);
    setTemporaryResult(null);
    let answerWasCommitted = false;

    try {
      if (!agent911Config.remoteEnabled) {
        const reading = buildAgent911FollowUpFallback({
          cards,
          message: currentMessage,
          question,
          intentId,
        });
        const result = resultFromFallback(reading, responses.length + 1, "local");
        commitResponse(result, baseHistory, currentMessage);
        answerWasCommitted = true;
        trackCommercialEvent("agent911_consultation_question_answered", {
          intent: intentId,
          reading_id: createdAt,
          question_number: responses.length + 1,
          source: "local",
        });
        return;
      }

      const result = await requestAgent911(context, {
        action: "follow_up",
        message: currentMessage,
        history: baseHistory,
        questionsUsed: responses.length,
        memoryConsent: false,
      });
      commitResponse({ ...result, source: "live" }, baseHistory, currentMessage);
      answerWasCommitted = true;
      trackCommercialEvent("agent911_consultation_question_answered", {
        intent: intentId,
        reading_id: createdAt,
        question_number: responses.length + 1,
        source: "live",
      });
    } catch (requestError) {
      const reading = buildAgent911FollowUpFallback({
        cards,
        message: currentMessage,
        question,
        intentId,
      });
      setTemporaryResult(resultFromFallback(reading, responses.length, "fallback"));
      trackCommercialEvent("agent911_consultation_question_fallback", {
        intent: intentId,
        reading_id: createdAt,
        reason: requestError?.code ?? "unknown",
        question_consumed: false,
      });
    } finally {
      if (answerWasCommitted) setMessage("");
      setLoading(false);
      requestInFlight.current = false;
    }
  }

  return (
    <section className={`agent911-consultation is-${stage}`} aria-labelledby="agent911-consultation-title">
      <div className="agent911-consultation-mark" aria-hidden="true"><span>✦</span><strong>911</strong></div>
      <div className="agent911-consultation-content">
        <span className="section-kicker">Consulta 911</span>
        <h3 id="agent911-consultation-title">
          {stage === "conversation" ? `A mesa continua com você, ${profile?.fullName?.split(" ")[0]}.` : "Quando a síntese toca num ponto real, a conversa pode continuar."}
        </h3>

        {stage === "offer" ? (
          <>
            <p>A consulta mantém esta Ferradura aberta e permite três perguntas conectadas à mesma história. O cadastro só é pedido aqui — sua leitura continua livre sem ele.</p>
            <div className="agent911-consultation-benefits">
              <span><Check size={14} /> 3 perguntas na mesma mesa</span>
              <span><Check size={14} /> contexto preservado</span>
              <span><Check size={14} /> respostas pessoais e ancoradas</span>
            </div>
            <button className="button button-primary button-large" type="button" onClick={openConsultation}>
              Fazer uma consulta com o 911 <ArrowRight size={18} />
            </button>
            <small><LockKeyhole size={13} /> Cadastro somente ao iniciar a consulta. Pagamento preparado para a próxima fase.</small>
          </>
        ) : null}

        {stage === "register" ? (
          <form className="agent911-registration" onSubmit={register} noValidate>
            <div>
              <label htmlFor="consultation-full-name">Nome completo</label>
              <input
                id="consultation-full-name"
                value={form.fullName}
                onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value.slice(0, 120) }))}
                autoComplete="name"
                aria-invalid={Boolean(errors.fullName)}
              />
              {errors.fullName ? <small role="alert">{errors.fullName}</small> : null}
            </div>
            <div>
              <label htmlFor="consultation-email">Seu melhor e-mail</label>
              <input
                id="consultation-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value.slice(0, 180) }))}
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email ? <small role="alert">{errors.email}</small> : null}
            </div>
            <button className="button button-primary" type="submit">Entrar na consulta <ArrowRight size={17} /></button>
            <p><ShieldCheck size={14} /> Nesta fase beta, seu cadastro fica somente neste dispositivo. A integração de conta e pagamento já tem ponto isolado no código.</p>
          </form>
        ) : null}

        {stage === "conversation" ? (
          <div className="agent911-consultation-room">
            <div className="agent911-consultation-counter">
              <span>{questionsRemaining} de {agent911Config.offer.questionLimit} perguntas disponíveis</span>
              <small>As respostas continuam ancoradas nestas sete cartas.</small>
            </div>

            {responses.length ? (
              <div className="agent911-consultation-responses" aria-live="polite">
                {responses.map((result, index) => (
                  <article data-agent911-source={result.source ?? "live"} key={`${result.conversationId}-${index}`}>
                    <span>Resposta {index + 1}</span>
                    <h4>{result.reading.title}</h4>
                    {result.reading.sections?.map((section) => <p key={section.id}>{section.text}</p>)}
                    <p>{result.reading.synthesis}</p>
                    <div><Sparkles size={15} /><p><strong>Movimento possível</strong>{result.reading.groundedAction}</p></div>
                  </article>
                ))}
              </div>
            ) : null}

            {temporaryResult ? (
              <div className="agent911-consultation-responses is-temporary" aria-live="polite">
                <article data-agent911-source="fallback">
                  <span>Leitura essencial · tentativa não consumida</span>
                  <h4>{temporaryResult.reading.title}</h4>
                  {temporaryResult.reading.sections?.map((section) => <p key={section.id}>{section.text}</p>)}
                  <p>{temporaryResult.reading.synthesis}</p>
                  <div><Sparkles size={15} /><p><strong>Movimento possível</strong>{temporaryResult.reading.groundedAction}</p></div>
                </article>
              </div>
            ) : null}

            {questionsRemaining > 0 ? (
              <form className="agent911-consultation-composer" onSubmit={submitQuestion}>
                <label htmlFor="agent911-consultation-question">O que você quer perguntar a partir desta leitura?</label>
                <textarea
                  id="agent911-consultation-question"
                  value={message}
                  onChange={(event) => setMessage(event.target.value.slice(0, 1_200))}
                  rows="4"
                  placeholder="Escreva do seu jeito. O 911 já conhece a pergunta e as sete posições."
                  disabled={loading}
                />
                <div><small>{message.length}/1200</small><button className="button button-primary" type="submit" disabled={loading || !message.trim()}><Send size={16} /> {loading ? "Lendo a mesa…" : "Perguntar ao 911"}</button></div>
              </form>
            ) : (
              <div className="agent911-consultation-complete"><Check size={17} /><p><strong>Consulta concluída.</strong> As três respostas ficaram ligadas à mesma Ferradura.</p></div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
