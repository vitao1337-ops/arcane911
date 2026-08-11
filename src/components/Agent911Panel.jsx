import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { agent911Config } from "../config/agent911";
import {
  createTarotAgentContext,
  requestAgent911,
  serializeAgent911Reading,
} from "../lib/agent911";
import {
  applyAgent911MemoryUpdate,
  forgetAgent911Memory,
  hasAgent911MemoryConsent,
  hasRememberedAgent911Context,
  loadAgent911Conversation,
  loadAgent911Memory,
  saveAgent911Conversation,
  setAgent911MemoryConsent,
} from "../lib/agent911Memory";
import "../agent911.css";

function AgentResponse({ response, cards, sequence }) {
  const namesBySlug = useMemo(
    () => Object.fromEntries(cards.map((card) => [card.slug, card.name])),
    [cards],
  );

  return (
    <article className="agent911-response" aria-labelledby={`agent911-response-${sequence}`}>
      <header className="agent911-response-header">
        <span>{sequence === 1 ? "Leitura viva" : `Aprofundamento ${sequence - 1}`}</span>
        <h4 id={`agent911-response-${sequence}`}>{response.title}</h4>
        <p>{response.opening}</p>
      </header>

      {response.responseMode === "safety" && response.safetyMessage ? (
        <div className="agent911-safety"><ShieldCheck size={17} /> <p>{response.safetyMessage}</p></div>
      ) : null}

      <div className="agent911-interpretation-grid">
        {response.sections.map((section) => (
          <section key={`${sequence}-${section.id}`}>
            <div className="agent911-grounding">
              {section.cardSlugs.map((slug) => <span key={slug}>{namesBySlug[slug] ?? slug}</span>)}
            </div>
            <h5>{section.title}</h5>
            <p>{section.text}</p>
          </section>
        ))}
      </div>

      <div className="agent911-synthesis">
        <span>Síntese 911</span>
        <p>{response.synthesis}</p>
      </div>

      <div className="agent911-grounded-action">
        <Sparkles size={17} />
        <div><span>Movimento possível</span><p>{response.groundedAction}</p></div>
      </div>

      {response.closingQuestion ? <q className="agent911-closing-question">{response.closingQuestion}</q> : null}
    </article>
  );
}

export default function Agent911Panel({
  cards,
  intentId,
  intentLabel,
  question,
  createdAt,
  variant = "complete",
  onOpenComplete,
}) {
  const readingId = `${createdAt ?? "reading"}:${variant}`;
  const [responses, setResponses] = useState([]);
  const [history, setHistory] = useState(() => loadAgent911Conversation(readingId));
  const [memoryConsent, setMemoryConsentState] = useState(hasAgent911MemoryConsent);
  const [hasMemory, setHasMemory] = useState(hasRememberedAgent911Context);
  const [followUp, setFollowUp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgetArmed, setForgetArmed] = useState(false);
  const questionsUsed = Math.min(
    agent911Config.offer.questionLimit,
    history.filter((entry) => entry.role === "user").length,
  );
  const questionsRemaining = Math.max(0, agent911Config.offer.questionLimit - questionsUsed);
  const isOpening = variant === "opening";
  const latestResponse = responses.at(-1)?.reading;

  const context = useMemo(() => createTarotAgentContext({
    cards,
    intentId,
    intentLabel,
    question,
    createdAt,
  }), [cards, createdAt, intentId, intentLabel, question]);

  function toggleMemory() {
    const next = !memoryConsent;
    setAgent911MemoryConsent(next);
    setMemoryConsentState(next);
    setForgetArmed(false);
  }

  function removeMemory() {
    if (!forgetArmed) {
      setForgetArmed(true);
      return;
    }
    forgetAgent911Memory();
    setMemoryConsentState(false);
    setHasMemory(false);
    setForgetArmed(false);
  }

  function persistResponseMemory(result) {
    if (!memoryConsent) return;
    const updated = applyAgent911MemoryUpdate(result.reading.memoryUpdate, {
      createdAt,
      intentLabel,
      question,
      cards: cards.map((card) => card.slug),
      insight: result.reading.synthesis,
    });
    if (updated) setHasMemory(true);
  }

  async function askAgent(message = "") {
    if (loading) return;
    const isFollowUp = Boolean(message.trim());
    if (isFollowUp && (isOpening || questionsRemaining === 0)) return;

    setLoading(true);
    setError("");
    try {
      const result = await requestAgent911(context, {
        action: isFollowUp ? "follow_up" : "initial_reading",
        message,
        history,
        questionsUsed,
        memoryConsent,
        memory: memoryConsent ? loadAgent911Memory() : {},
      });
      setResponses((current) => [...current, result]);

      const nextHistory = isFollowUp
        ? [
          ...history,
          { role: "user", content: message.trim() },
          { role: "assistant", content: serializeAgent911Reading(result.reading) },
        ].slice(-8)
        : [
          ...history,
          { role: "assistant", content: serializeAgent911Reading(result.reading) },
        ].slice(-8);
      setHistory(nextHistory);
      saveAgent911Conversation(readingId, nextHistory);
      persistResponseMemory(result);
      setFollowUp("");
    } catch (requestError) {
      setError(requestError?.message ?? "A leitura não conseguiu atravessar agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function submitFollowUp(event) {
    event.preventDefault();
    const message = followUp.trim();
    if (!message) return;
    askAgent(message);
  }

  return (
    <section
      className={`agent911-bridge agent911-experience is-${variant}`}
      aria-labelledby={`agent911-title-${variant}`}
      data-agent911-status={loading ? "reading" : responses.length ? "answered" : "ready"}
    >
      <div className="agent911-mark" aria-hidden="true">
        <span>✦</span>
        <strong>911</strong>
      </div>

      <div className="agent911-copy">
        <span className="section-kicker">{isOpening ? "Uma camada viva da sua abertura" : "Agente 911 · leitura profunda"}</span>
        <h3 id={`agent911-title-${variant}`}>
          {responses.length ? "As cartas responderam." : isOpening ? "O desenho pode falar mais perto." : <>A leitura termina.<br />A conversa não.</>}
        </h3>

        {!responses.length ? (
          <p>
            {isOpening
              ? "O 911 lê a relação entre suas três cartas e a pergunta que você trouxe. Não entrega um significado pronto: procura o ponto de tensão, a força disponível e o próximo gesto possível."
              : "O 911 atravessa as sete posições como uma taróloga diante da mesa: relaciona origem, presente, padrão oculto, obstáculo, ambiente, ação e direção provável sem trocar nenhuma carta."}
          </p>
        ) : null}

        {!responses.length ? (
          <div className="agent911-readiness" aria-label="Contexto preparado para o Agente 911">
            <span><Check size={15} /> {cards.length} cartas preservadas</span>
            <span><Check size={15} /> Pergunta e posições</span>
            <span><Check size={15} /> Auditoria antes de exibir</span>
          </div>
        ) : null}

        <div className="agent911-memory-row">
          <button
            className={`agent911-memory-toggle ${memoryConsent ? "is-active" : ""}`}
            type="button"
            role="switch"
            aria-checked={memoryConsent}
            onClick={toggleMemory}
          >
            <span aria-hidden="true"><i /></span>
            <div>
              <strong>{memoryConsent ? "O 911 pode se lembrar de mim" : "Permitir que o 911 se lembre de mim"}</strong>
              <small>Memória privada neste dispositivo. Você pode apagar quando quiser.</small>
            </div>
          </button>
          {hasMemory ? (
            <button className={`agent911-forget ${forgetArmed ? "is-armed" : ""}`} type="button" onClick={removeMemory}>
              <Trash2 size={14} /> {forgetArmed ? "Confirmar exclusão" : "Apagar lembranças"}
            </button>
          ) : null}
        </div>

        {!responses.length ? (
          <button
            className="button button-primary button-large agent911-start"
            type="button"
            onClick={() => askAgent()}
            disabled={loading || !agent911Config.enabled}
          >
            <Sparkles size={18} className={loading ? "agent911-reading-star" : ""} />
            {loading ? "O 911 está lendo o desenho…" : "Ouvir a leitura do 911"}
          </button>
        ) : null}

        {loading && responses.length ? (
          <div className="agent911-inline-loading" role="status">
            <span className="agent911-reading-star">✦</span> O 911 está voltando à mesa…
          </div>
        ) : null}

        {error ? (
          <div className="agent911-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => askAgent(responses.length ? followUp.trim() : "")}>Tentar novamente</button>
          </div>
        ) : null}

        {responses.length ? (
          <div className="agent911-responses" aria-live="polite">
            {responses.map((result, index) => (
              <AgentResponse
                key={`${result.conversationId}-${index}`}
                response={result.reading}
                cards={cards}
                sequence={index + 1}
              />
            ))}
          </div>
        ) : null}

        {isOpening && responses.length ? (
          <div className="agent911-opening-next">
            <div><span>O panorama apareceu</span><strong>Quatro cartas ainda podem revelar o que opera por baixo.</strong></div>
            <button className="button button-primary" type="button" onClick={onOpenComplete}>
              Continuar na Ferradura <ArrowRight size={17} />
            </button>
          </div>
        ) : null}

        {!isOpening && latestResponse && questionsRemaining > 0 ? (
          <div className="agent911-conversation">
            <div className="agent911-conversation-heading">
              <div><MessageCircle size={17} /><span>Converse sobre o que tocou</span></div>
              <small>{questionsRemaining} de {agent911Config.offer.questionLimit} perguntas disponíveis</small>
            </div>

            <div className="agent911-suggestions">
              {latestResponse.suggestedQuestions.map((suggestion) => (
                <button type="button" key={suggestion} onClick={() => setFollowUp(suggestion)} disabled={loading}>
                  {suggestion}
                </button>
              ))}
            </div>

            <form className="agent911-composer" onSubmit={submitFollowUp}>
              <label htmlFor={`agent911-follow-up-${variant}`}>Conte o que aconteceu ou faça uma pergunta específica</label>
              <textarea
                id={`agent911-follow-up-${variant}`}
                value={followUp}
                onChange={(event) => setFollowUp(event.target.value.slice(0, 1_200))}
                rows="4"
                placeholder="Ex.: o que eu ainda não estou conseguindo admitir sobre essa relação?"
                disabled={loading}
              />
              <div><small>{followUp.length}/1200</small><button className="button button-primary" type="submit" disabled={loading || !followUp.trim()}><Send size={16} /> Perguntar ao 911</button></div>
            </form>
          </div>
        ) : null}

        {!isOpening && responses.length && questionsRemaining === 0 ? (
          <div className="agent911-cycle-complete"><Check size={17} /><p><strong>Ciclo concluído.</strong> As três perguntas ficaram ligadas à mesma mesa e à mesma história.</p></div>
        ) : null}

        <small className="agent911-privacy"><ShieldCheck size={14} /> Tarot é reflexão simbólica, não prova factual nem substituto de orientação profissional.</small>
      </div>
    </section>
  );
}
