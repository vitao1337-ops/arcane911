import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, LockKeyhole, Send, ShieldCheck, Sparkles } from "lucide-react";
import { agent911Config } from "../config/agent911";
import { normalizeAgent911ReadingMode } from "../config/agent911ReadingModes";
import {
  agent911ErrorMessage,
  createTarotAgentContext,
  requestAgent911,
  serializeAgent911Reading,
} from "../lib/agent911";
import {
  loadConsultationProfile,
  loadConsultationState,
  saveConsultationProfile,
  saveConsultationState,
  validateConsultationProfile,
} from "../lib/agent911Session";
import {
  checkoutErrorMessage,
  clearPendingCheckout,
  consumePaymentEntitlement,
  createCheckoutOrderId,
  createHostedCheckout,
  loadPaymentEntitlements,
  savePendingCheckout,
  trackCommercialEvent,
} from "../lib/checkout";

function resultFromFallback(reading, index, source = "mock") {
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
  readingMode = "acolhedora",
  createdAt,
  initialResult,
  parentSessionId = "",
}) {
  const normalizedReadingMode = normalizeAgent911ReadingMode(readingMode);
  const readingId = `${createdAt ?? "reading"}:complete:${normalizedReadingMode}`;
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
  const [connectionError, setConnectionError] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentState, setPaymentState] = useState("idle");
  const [activeEntitlement, setActiveEntitlement] = useState(null);
  const [retryDelayMs, setRetryDelayMs] = useState(0);
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

  useEffect(() => {
    if (retryDelayMs <= 0) return undefined;
    const timeout = globalThis.setTimeout(() => setRetryDelayMs(0), retryDelayMs);
    return () => globalThis.clearTimeout(timeout);
  }, [retryDelayMs]);

  useEffect(() => {
    const synchronizeCredit = () => {
      if (agent911Config.offer.devUnlocked) return;
      const entitlement = loadPaymentEntitlements().find((item) => (
        item.productId === agent911Config.offer.productId
        && item.readingId === createdAt
        && !item.consumedAt
      ));
      if (!entitlement) return;
      setActiveEntitlement(entitlement);
      setPaymentMessage(`Pagamento confirmado. Uma pergunta foi liberada. Código: ${entitlement.orderId}.`);
      setPaymentState("paid");
      setStage(profile ? "conversation" : "register");
    };
    synchronizeCredit();
    window.addEventListener("arcane911:entitlements-changed", synchronizeCredit);
    return () => window.removeEventListener("arcane911:entitlements-changed", synchronizeCredit);
  }, [createdAt, profile]);

  async function openConsultation() {
    trackCommercialEvent("agent911_consultation_opened", {
      intent: intentId,
      reading_id: createdAt,
      returning_profile: Boolean(profile),
      reading_mode: normalizedReadingMode,
    });
    if (agent911Config.offer.devUnlocked) {
      setPaymentMessage("");
      setStage(profile ? "conversation" : "register");
      return;
    }

    if (activeEntitlement) {
      setStage(profile ? "conversation" : "register");
      return;
    }

    if (paymentState === "opening") return;
    const pending = savePendingCheckout({
      orderId: createCheckoutOrderId(),
      productId: agent911Config.offer.productId,
      readingId: createdAt,
      questionNumber: responses.length + 1,
      parentSessionId,
      returnPath: "/tiragem-completa",
    });
    setPaymentState("opening");
    setPaymentMessage("Abrindo o pagamento seguro…");
    try {
      const checkout = await createHostedCheckout(pending);
      trackCommercialEvent("begin_checkout", {
        product_id: agent911Config.offer.productId,
        price_label: agent911Config.offer.price,
        reading_id: createdAt,
        question_number: responses.length + 1,
      });
      window.location.assign(checkout.checkoutUrl);
    } catch (error) {
      clearPendingCheckout(pending.orderId);
      setPaymentState("error");
      setPaymentMessage(checkoutErrorMessage(error?.code));
    }
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
      reading_mode: normalizedReadingMode,
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
    setConnectionError("");
    saveConsultationState(readingId, { responses: nextResponses, history: nextHistory });
    if (!agent911Config.offer.devUnlocked && activeEntitlement) {
      consumePaymentEntitlement(activeEntitlement.sessionId);
      setActiveEntitlement(null);
      setPaymentState("idle");
      setPaymentMessage("Resposta entregue. A próxima pergunta exige um novo pagamento.");
    }
  }

  async function submitQuestion(event) {
    event.preventDefault();
    const currentMessage = message.trim();
    if (!currentMessage || loading || requestInFlight.current || retryDelayMs > 0
        || questionsRemaining <= 0
        || (!agent911Config.offer.devUnlocked && !activeEntitlement)) return;

    const baseHistory = history.length
      ? history
      : initialResult?.reading
        ? [{ role: "assistant", content: serializeAgent911Reading(initialResult.reading) }]
        : [];
    trackCommercialEvent("agent911_consultation_question_sent", {
      intent: intentId,
      reading_id: createdAt,
      question_number: responses.length + 1,
      reading_mode: normalizedReadingMode,
    });
    requestInFlight.current = true;
    setLoading(true);
    setConnectionError("");
    let answerWasCommitted = false;

    try {
      if (import.meta.env.DEV && agent911Config.devMockEnabled) {
        const mockModule = await import("../lib/agent911Fallback");
        const reading = mockModule.buildAgent911FollowUpFallback({
          cards,
          message: currentMessage,
          question,
          intentId,
        });
        const result = resultFromFallback(reading, responses.length + 1, "mock");
        commitResponse(result, baseHistory, currentMessage);
        answerWasCommitted = true;
        trackCommercialEvent("agent911_consultation_question_answered", {
          intent: intentId,
          reading_id: createdAt,
          question_number: responses.length + 1,
          source: "mock",
          reading_mode: normalizedReadingMode,
        });
        return;
      }

      const result = await requestAgent911(context, {
        action: "follow_up",
        message: currentMessage,
        history: baseHistory,
        questionsUsed: responses.length,
        readingMode: normalizedReadingMode,
        memoryConsent: false,
        payment: activeEntitlement ? {
          sessionId: activeEntitlement.sessionId,
          productId: activeEntitlement.productId,
          readingId: activeEntitlement.readingId,
          questionNumber: activeEntitlement.questionNumber,
        } : null,
      });
      commitResponse({ ...result, source: "live" }, baseHistory, currentMessage);
      answerWasCommitted = true;
      trackCommercialEvent("agent911_consultation_question_answered", {
        intent: intentId,
        reading_id: createdAt,
        question_number: responses.length + 1,
        source: "live",
        provider: result.meta?.provider ?? "unknown",
        reading_mode: normalizedReadingMode,
      });
    } catch (requestError) {
      if (requestError?.code === "payment_credit_unavailable" && activeEntitlement) {
        consumePaymentEntitlement(activeEntitlement.sessionId);
        setActiveEntitlement(null);
        setPaymentState("idle");
        setPaymentMessage("Este crédito já foi usado. Uma nova pergunta exige outro pagamento.");
      }
      setConnectionError(requestError?.code ?? "unknown");
      setRetryDelayMs(requestError?.retryAfterMs ?? 0);
      trackCommercialEvent("agent911_consultation_question_unavailable", {
        intent: intentId,
        reading_id: createdAt,
        reason: requestError?.code ?? "unknown",
        question_consumed: false,
        reading_mode: normalizedReadingMode,
      });
    } finally {
      if (answerWasCommitted) setMessage("");
      setLoading(false);
      requestInFlight.current = false;
    }
  }

  return (
    <section
      className={`agent911-consultation is-${stage}`}
      aria-labelledby="agent911-consultation-title"
      data-agent911-reading-mode={normalizedReadingMode}
    >
      <div className="agent911-consultation-mark" aria-hidden="true"><span>✦</span><strong>911</strong></div>
      <div className="agent911-consultation-content">
        <span className="section-kicker">Consulta 911</span>
        <h3 id="agent911-consultation-title">
          {stage === "conversation" ? `A mesa continua com você, ${profile?.fullName?.split(" ")[0]}.` : "Quando a síntese toca num ponto real, a conversa pode continuar."}
        </h3>

        {stage === "offer" ? (
          <>
            <p>A consulta mantém esta Ferradura aberta. Você pode fazer até três perguntas conectadas à mesma história, adquiridas individualmente por {agent911Config.offer.price} cada.</p>
            <div className="agent911-consultation-benefits">
              <span><Check size={14} /> até 3 perguntas · {agent911Config.offer.price} cada</span>
              <span><Check size={14} /> contexto preservado</span>
              <span><Check size={14} /> respostas pessoais e ancoradas</span>
            </div>
            <button className="button button-primary button-large" type="button" onClick={openConsultation} disabled={paymentState === "opening"}>
              {agent911Config.offer.devUnlocked
                ? "Abrir consulta no modo DEV"
                : paymentState === "opening" ? "Abrindo pagamento…" : `Fazer uma pergunta · ${agent911Config.offer.price}`} <ArrowRight size={18} />
            </button>
            <small><LockKeyhole size={13} /> {agent911Config.offer.devUnlocked
              ? "DEV liberado: nenhuma cobrança é criada e a resposta usa mock local por padrão."
              : paymentMessage || "Pagamento único por pergunta. O texto escrito nunca é enviado ao pagamento."}</small>
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
            <p><ShieldCheck size={14} /> {agent911Config.offer.devUnlocked
              ? "No DEV, o cadastro fica somente neste dispositivo e os créditos de teste ficam liberados."
              : "Este cadastro fica neste dispositivo e mantém a resposta ligada à Ferradura atual."}</p>
          </form>
        ) : null}

        {stage === "conversation" ? (
          <div className="agent911-consultation-room">
            <div className="agent911-consultation-counter">
              <span>{questionsRemaining} de {agent911Config.offer.questionLimit} perguntas ainda possíveis</span>
              <small>{agent911Config.offer.devUnlocked
                ? "Créditos DEV liberados · custo zero."
                : activeEntitlement ? "1 crédito pago disponível agora." : `Cada nova pergunta custa ${agent911Config.offer.price}.`}</small>
            </div>

            {responses.length ? (
              <div className="agent911-consultation-responses" aria-live="polite">
                {responses.map((result, index) => (
                  <article
                    data-agent911-source={result.source ?? "live"}
                    data-agent911-provider={result.meta?.provider
                      ?? (result.source === "mock" ? "mock" : "unknown")}
                    key={`${result.conversationId}-${index}`}
                  >
                    <span>Resposta {index + 1}</span>
                    <h4>{result.reading.title}</h4>
                    {result.reading.sections?.map((section) => <p key={section.id}>{section.text}</p>)}
                    <p>{result.reading.synthesis}</p>
                    <div><Sparkles size={15} /><p><strong>Movimento possível</strong>{result.reading.groundedAction}</p></div>
                  </article>
                ))}
              </div>
            ) : null}

            {connectionError ? (
              <div className="agent911-consultation-retry" aria-live="polite" data-agent911-error={connectionError}>
                <Sparkles size={15} />
                <p><strong>O 911 não concluiu esta resposta.</strong> {agent911ErrorMessage(connectionError)} Nenhum texto automático entrou no lugar e sua pergunta não foi consumida.</p>
              </div>
            ) : null}

            {questionsRemaining > 0 && (agent911Config.offer.devUnlocked || activeEntitlement) ? (
              <form className="agent911-consultation-composer" onSubmit={submitQuestion}>
                <label htmlFor="agent911-consultation-question">O que você quer perguntar a partir desta leitura?</label>
                <textarea
                  id="agent911-consultation-question"
                  value={message}
                  onChange={(event) => setMessage(event.target.value.slice(0, 1_200))}
                  rows="4"
                  placeholder="Escreva do seu jeito. O 911 já conhece a pergunta e as sete posições."
                  disabled={loading || retryDelayMs > 0}
                />
                <div><small>{message.length}/1200</small><button className="button button-primary" type="submit" disabled={loading || retryDelayMs > 0 || !message.trim()}><Send size={16} /> {loading ? "Lendo a mesa…" : "Perguntar ao 911"}</button></div>
              </form>
            ) : questionsRemaining > 0 ? (
              <div className="agent911-question-credit">
                <div><LockKeyhole size={16} /><span><strong>Próxima pergunta</strong>Um novo crédito libera uma resposta conectada a esta mesma Ferradura.</span></div>
                <button className="button button-primary" type="button" onClick={openConsultation} disabled={paymentState === "opening"}>
                  {paymentState === "opening" ? "Abrindo pagamento…" : `Liberar por ${agent911Config.offer.price}`} <ArrowRight size={16} />
                </button>
                {paymentMessage ? <small role="status">{paymentMessage}</small> : null}
              </div>
            ) : (
              <div className="agent911-consultation-complete"><Check size={17} /><p><strong>Consulta concluída.</strong> As três respostas ficaram ligadas à mesma Ferradura.</p></div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
