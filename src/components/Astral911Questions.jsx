import { useEffect, useMemo, useState } from "react";
import { ArrowRight, MessageCircleQuestion, ShieldCheck, Sparkles } from "./MysticIcons";
import { askAstralQuestion, astralQuestionErrorMessage } from "../lib/astralQuestions.js";

export default function Astral911Questions({ chart, entitlement, deliveryStatus, onStatus, onRefresh }) {
  const delivered = deliveryStatus?.status === "delivered";
  const available = Number(deliveryStatus?.questionsAvailable) || 0;
  const used = Number(deliveryStatus?.questionsUsed) || 0;
  const remaining = Math.max(0, available - used);
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState([]);
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");
  const counter = useMemo(() => `${remaining} de ${available || 5} disponíveis`, [available, remaining]);

  useEffect(() => {
    setAnswers(Array.isArray(deliveryStatus?.answers) ? deliveryStatus.answers : []);
  }, [entitlement?.sessionId, deliveryStatus?.answers]);

  if (!delivered) return null;

  async function submit(event) {
    event.preventDefault();
    if (state === "asking" || remaining <= 0) return;
    setError("");
    setState("asking");
    onStatus?.("Agent911 está cruzando sua pergunta com os fatos do seu mapa…");
    try {
      const result = await askAstralQuestion({ entitlement, chart, question });
      setAnswers((current) => [...current.filter((item) => item.slot !== result.slot), {
        id: result.id || `answer-${result.slot}`,
        question: question.trim(),
        answer: result.answer,
        slot: result.slot,
      }]);
      setQuestion("");
      setState("done");
      onStatus?.("Resposta concluída. O crédito foi registrado somente após a resposta ficar pronta.");
      await onRefresh?.();
    } catch (requestError) {
      const remote = await onRefresh?.();
      if (remote?.answers?.some((item) => item.question === question.trim())) {
        setAnswers(remote.answers);
        setQuestion('');
        setError('');
        setState('done');
        onStatus?.('A resposta foi recuperada com segurança, sem consumir outro crédito.');
        return;
      }
      const message = astralQuestionErrorMessage(requestError?.code);
      setError(message);
      setState("error");
      onStatus?.(message);
    }
  }

  return (
    <section className="astro-question-room" aria-labelledby="astro-question-room-title">
      <div className="astro-question-room-head">
        <div>
          <span className="section-kicker">Agent911 · pós-síntese</span>
          <h3 id="astro-question-room-title">Agora você pode perguntar ao seu próprio mapa.</h3>
          <p>
            A síntese já foi entregue. Use suas perguntas para aprofundar pontos específicos do mapa,
            sempre com o Agent911 preso às posições, casas e aspectos desta compra.
          </p>
        </div>
        <div className="astro-question-credit" aria-label={counter}>
          <MessageCircleQuestion size={20} />
          <span><strong>{remaining}</strong><small>de {available || 5} perguntas</small></span>
        </div>
      </div>

      {remaining > 0 ? (
        <form className="astro-question-form" onSubmit={submit}>
          <label htmlFor="astral-specific-question">
            <span>Sua pergunta</span>
            <textarea
              id="astral-specific-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value.slice(0, 700))}
              placeholder="Ex.: O que no meu mapa fala sobre a forma como eu vivo relacionamentos?"
              minLength={5}
              maxLength={700}
              required
              disabled={state === "asking"}
            />
          </label>
          <div className="astro-question-form-foot">
            <small><ShieldCheck size={14} /> O crédito só é consumido quando uma resposta válida é concluída.</small>
            <button className="button button-primary" type="submit" disabled={state === "asking" || question.trim().length < 5}>
              {state === "asking" ? "Interpretando…" : "Perguntar ao Agent911"}
              {state === "asking" ? <Sparkles size={17} /> : <ArrowRight size={17} />}
            </button>
          </div>
          {error ? <p className="astro-question-error" role="alert">{error}</p> : null}
        </form>
      ) : (
        <div className="astro-question-empty">
          <ShieldCheck size={20} />
          <div><strong>As 5 perguntas desta síntese foram utilizadas.</strong><p>Suas respostas ficam salvas e podem ser recuperadas com o código da compra.</p></div>
        </div>
      )}

      {answers.length ? (
        <div className="astro-question-history" aria-label="Respostas da sua compra">
          {answers.map((item, index) => (
            <article key={item.id}>
              <span className="astro-question-number">Pergunta {index + 1}{item.slot ? ` · crédito ${item.slot}` : ""}</span>
              <h4>{item.question}</h4>
              <div className="astro-question-answer">{item.answer.split(/\n{2,}/u).map((paragraph, paragraphIndex) => <p key={`${item.id}-${paragraphIndex}`}>{paragraph}</p>)}</div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
