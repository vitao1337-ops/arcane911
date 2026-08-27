import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  RotateCcw,
  ShieldCheck,
  Shuffle,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import Agent911Summary from "../components/Agent911Summary";
import { commerceConfig } from "../config/commerce";
import { buildSpecificLayout, specificReadingsBySlug } from "../data/products";
import { tarotBySlug, tarotCards } from "../data/tarot";
import {
  checkoutErrorMessage,
  clearPendingCheckout,
  consumePaymentEntitlement,
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
import {
  buildSpecificSynthesis,
  createRandomDrawPool,
  specificCardReading,
} from "../lib/reading";

const DRAFT_PREFIX = "arcane911.specific-reading.v1:";
const INCLUDED_USAGE_PREFIX = "arcane911.included-specific.v1:";

function safeSession() {
  return typeof window === "object" ? window.sessionStorage : null;
}

function draftKey(slug, parentReadingId) {
  return `${DRAFT_PREFIX}${slug}:${parentReadingId || "standalone"}`;
}

function includedUsageKey(parentReadingId) {
  return `${INCLUDED_USAGE_PREFIX}${parentReadingId}`;
}

function loadIncludedQuestionSlots(parentReadingId) {
  if (!parentReadingId) return [];
  try {
    const slots = JSON.parse(safeSession()?.getItem(includedUsageKey(parentReadingId)) ?? "[]");
    return Array.isArray(slots)
      ? [...new Set(slots.map(Number).filter((slot) => Number.isInteger(slot) && slot >= 1 && slot <= 5))].sort()
      : [];
  } catch {
    return [];
  }
}

function markIncludedQuestionSlot(parentReadingId, slot) {
  if (!parentReadingId || !Number.isInteger(slot) || slot < 1 || slot > 5) return [];
  const next = [...new Set([...loadIncludedQuestionSlots(parentReadingId), slot])].sort();
  try {
    safeSession()?.setItem(includedUsageKey(parentReadingId), JSON.stringify(next));
  } catch {
    // O servidor continua sendo a autoridade do limite mesmo sem cache local.
  }
  return next;
}

function loadDraft(slug, parentReadingId) {
  try {
    const draft = JSON.parse(safeSession()?.getItem(draftKey(slug, parentReadingId)) ?? "null");
    if (!draft?.readingId) return null;
    return {
      readingId: String(draft.readingId),
      question: String(draft.question ?? "").slice(0, 800),
      phase: ["offer", "deck", "reading"].includes(draft.phase) ? draft.phase : "offer",
      cards: Array.isArray(draft.cards) ? draft.cards.slice(0, 5) : [],
      includedSlot: Number.isInteger(Number(draft.includedSlot))
        && Number(draft.includedSlot) >= 1
        && Number(draft.includedSlot) <= 5
        ? Number(draft.includedSlot)
        : 0,
    };
  } catch {
    return null;
  }
}

function saveDraft(slug, parentReadingId, draft) {
  try {
    safeSession()?.setItem(draftKey(slug, parentReadingId), JSON.stringify(draft));
  } catch {
    // A leitura atual continua funcionando mesmo quando a sessão é bloqueada.
  }
}

function clearDraft(slug, parentReadingId) {
  try {
    safeSession()?.removeItem(draftKey(slug, parentReadingId));
  } catch {
    // Nada precisa ser feito quando o navegador bloqueia a sessão.
  }
}

function createSpecificReadingId() {
  return `specific-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function SpecificCardBack({ selectedOrder, disabled, onClick, style }) {
  return (
    <button
      className={`card-back ${selectedOrder ? "is-selected" : ""}`}
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={style}
      aria-label={selectedOrder ? `Carta escolhida na posição ${selectedOrder}` : "Escolher esta carta"}
    >
      <span className="card-back-frame" aria-hidden="true">
        <span className="card-back-orbit orbit-one" />
        <span className="card-back-orbit orbit-two" />
        <span className="card-back-star">✦</span>
        <span className="card-back-word">A911</span>
      </span>
      {selectedOrder ? <span className="selection-order">{selectedOrder}</span> : null}
    </button>
  );
}

function SpecificTarotCard({ card }) {
  const compactNameLength = Math.max(5, card.name.replace(/\s+/gu, "").length);
  return (
    <div
      className="tarot-card specific-tarot-card"
      data-tarot-card={card.slug}
      style={{
        "--tarot-name-length": compactNameLength,
        "--tarot-name-scale": `${Math.min(14.5, Math.max(5.2, 90 / compactNameLength))}cqw`,
      }}
    >
      <img src={card.image} alt={`Carta ${card.name}`} width="1024" height="1536" loading="lazy" draggable="false" />
      <span className="tarot-roman" aria-hidden="true">{card.roman}</span>
      <span className="tarot-name" aria-hidden="true">{card.name}</span>
    </div>
  );
}

function SpecificReadingExperience({
  reading,
  slug,
  insideCompleteReading = false,
  parentReadingId = "",
  parentEntitlement = null,
  sourceQuestion = "",
  sourceIntentLabel = "",
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const timerRef = useRef(null);
  const verificationRef = useRef("");
  const restorePromiseRef = useRef({ key: "", promise: null });

  const completeEntitlement = parentEntitlement;
  const discounted = insideCompleteReading
    && (commerceConfig.devUnlocked || Boolean(
      completeEntitlement
      && completeEntitlement.productId === commerceConfig.products.completeReading.id
      && completeEntitlement.readingId === parentReadingId,
    ));
  const offer = discounted
    ? commerceConfig.products.specificQuestionComplete
    : commerceConfig.products.specificQuestionStandalone;
  const offerContext = discounted ? "complete_reading" : "standalone";
  const initialDraft = useMemo(
    () => loadDraft(slug, discounted ? parentReadingId : ""),
    [discounted, parentReadingId, slug],
  );
  const initialEntitlement = useMemo(() => findPaymentEntitlement({
    productId: offer.id,
    readingId: initialDraft?.readingId,
    readingSlug: reading.slug,
  }), [initialDraft?.readingId, offer.id, reading.slug]);
  const initialSpread = useMemo(
    () => (initialDraft?.cards ?? []).map((cardSlug) => tarotBySlug[cardSlug]).filter(Boolean),
    [initialDraft],
  );
  const includedQuestionLimit = commerceConfig.products.completeReading.includedSpecificQuestions;
  const initialIncludedSlot = discounted ? Number(initialDraft?.includedSlot) || 0 : 0;
  const canRestorePaidPhase = commerceConfig.devUnlocked || Boolean(initialIncludedSlot && completeEntitlement);
  const restoredPhase = canRestorePaidPhase && initialDraft?.phase === "reading" && initialSpread.length === 5
    ? "reading"
    : canRestorePaidPhase && initialDraft?.phase === "deck" ? "deck" : "offer";

  const contextualQuestion = String(sourceQuestion ?? "").trim().slice(0, 800);
  const contextLabel = sourceIntentLabel || reading.eyebrow.replace(/^Leitura específica · /u, "");
  const [readingId, setReadingId] = useState(initialDraft?.readingId ?? createSpecificReadingId);
  const [question, setQuestion] = useState(initialDraft?.question ?? contextualQuestion);
  const [phase, setPhase] = useState(restoredPhase);
  const [drawPool, setDrawPool] = useState([]);
  const [selectedCards, setSelectedCards] = useState([]);
  const [spread, setSpread] = useState(initialSpread.length === 5 ? initialSpread : []);
  const [specificEntitlement, setSpecificEntitlement] = useState(
    initialIncludedSlot && completeEntitlement
      ? { ...completeEntitlement, questionNumber: initialIncludedSlot }
      : commerceConfig.devUnlocked ? initialEntitlement : null,
  );
  const [activeIncludedSlot, setActiveIncludedSlot] = useState(initialIncludedSlot);
  const [includedQuestionsUsed, setIncludedQuestionsUsed] = useState(() => Math.max(
    Number(completeEntitlement?.includedQuestionsUsed) || 0,
    loadIncludedQuestionSlots(parentReadingId).length,
  ));
  const [isShuffling, setIsShuffling] = useState(false);
  const [status, setStatus] = useState("");
  const [paymentState, setPaymentState] = useState("idle");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [questionError, setQuestionError] = useState("");
  const layout = buildSpecificLayout(reading);
  const returnPath = `/leituras/${reading.slug}${discounted ? "?origem=tiragem-completa" : ""}`;
  const backPath = discounted ? "/tiragem-completa" : "/tiragem-gratis";
  const includedQuestionAvailable = discounted && includedQuestionsUsed < includedQuestionLimit;
  const nextIncludedSlot = includedQuestionAvailable ? includedQuestionsUsed + 1 : 0;

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    if (commerceConfig.devUnlocked || initialIncludedSlot || !initialEntitlement || !initialDraft?.readingId) return undefined;
    const restoreKey = `${initialEntitlement.sessionId}:${offer.id}:${initialDraft.readingId}`;
    if (restorePromiseRef.current.key !== restoreKey) {
      restorePromiseRef.current = {
        key: restoreKey,
        promise: verifyStoredPaymentEntitlement(initialEntitlement, {
          productId: offer.id,
          readingId: initialDraft.readingId,
          readingSlug: reading.slug,
          offerContext,
        }),
      };
    }

    let subscribed = true;
    restorePromiseRef.current.promise
      .then((serverEntitlement) => {
        if (!subscribed) return;
        const entitlement = savePaymentEntitlement(serverEntitlement);
        if (!entitlement) return;
        setSpecificEntitlement(entitlement);
        if (initialDraft.phase === "reading" && initialSpread.length === 5) {
          setSpread(initialSpread);
          setPhase("reading");
        } else if (initialDraft.phase === "deck") {
          setPhase("deck");
        }
      })
      .catch((error) => {
        if (!subscribed) return;
        setSpecificEntitlement(null);
        setPhase("offer");
        if (["invalid_order", "payment_credit_unavailable", "payment_mismatch", "purchase_not_found"].includes(error?.code)) {
          removePaymentEntitlement(initialEntitlement.sessionId);
        }
      });
    return () => {
      subscribed = false;
    };
  }, [initialDraft, initialEntitlement, initialIncludedSlot, initialSpread, offer.id, offerContext, reading.slug]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [phase]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const checkoutState = params.get("checkout");
    if (!checkoutState) return;

    if (checkoutState === "cancelled") {
      clearPendingCheckout();
      setPaymentState("idle");
      setPaymentMessage("Pagamento cancelado. Sua pergunta continua aqui.");
      navigate(returnPath, { replace: true });
      return;
    }

    const sessionId = params.get("payment_id") ?? "";
    if (checkoutState !== "success" || !sessionId || verificationRef.current === sessionId) return;
    verificationRef.current = sessionId;
    const pending = loadPendingCheckout();
    if (!pending || pending.productId !== offer.id || pending.readingId !== readingId
        || pending.readingSlug !== reading.slug) {
      setPaymentState("error");
      setPaymentMessage("Não foi possível vincular o retorno do pagamento a esta pergunta.");
      navigate(returnPath, { replace: true });
      return;
    }

    setPaymentState("verifying");
    setPaymentMessage("Confirmando o pagamento…");
    verifyHostedCheckout(sessionId, pending)
      .then((result) => {
        const entitlement = savePaymentEntitlement(result.entitlement);
        setSpecificEntitlement(entitlement);
        setPhase("deck");
        setPaymentState("paid");
        setPaymentMessage(`Pagamento confirmado. Código do pedido: ${pending.orderId}`);
        setStatus(`Sua mesa está liberada. Guarde o código ${pending.orderId}.`);
        saveDraft(reading.slug, discounted ? parentReadingId : "", {
          readingId,
          question,
          phase: "deck",
          cards: [],
        });
        clearPendingCheckout(pending.orderId);
        trackCommercialEvent("specific_question_payment_confirmed", {
          product_id: offer.id,
          reading_slug: reading.slug,
          offer_context: offerContext,
        });
        navigate(returnPath, { replace: true });
        window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
      })
      .catch((error) => {
        setPaymentState("error");
        setPaymentMessage(checkoutErrorMessage(error?.code));
        verificationRef.current = "";
        navigate(returnPath, { replace: true });
      });
  }, [discounted, location.search, navigate, offer.id, offerContext, parentReadingId, question, reading.slug, readingId, returnPath]);

  function persist(nextPhase, cards = spread, includedSlot = activeIncludedSlot) {
    saveDraft(reading.slug, discounted ? parentReadingId : "", {
      readingId,
      question: question.trim(),
      phase: nextPhase,
      cards: cards.map((card) => card.slug),
      includedSlot,
    });
  }

  function validateQuestion() {
    const normalized = question.trim();
    if (normalized.length < 8) {
      setQuestionError("Escreva a pergunta com um pouco mais de contexto.");
      return false;
    }
    setQuestionError("");
    return true;
  }

  function unlockDevReading() {
    setPhase("deck");
    setPaymentState("paid");
    setPaymentMessage("Modo DEV: compra simulada e leitura liberada sem cobrança.");
    persist("deck", []);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  async function proceedToSpecificCheckout() {
    if (!validateQuestion() || paymentState === "opening" || paymentState === "verifying") return;
    trackCommercialEvent("specific_question_offer_opened", {
      product_id: offer.id,
      reading_slug: reading.slug,
      offer_context: offerContext,
    });

    if (commerceConfig.devUnlocked) {
      unlockDevReading();
      return;
    }

    if (includedQuestionAvailable && completeEntitlement) {
      const slot = nextIncludedSlot;
      setActiveIncludedSlot(slot);
      setSpecificEntitlement({ ...completeEntitlement, questionNumber: slot });
      setPhase("deck");
      setPaymentState("paid");
      setPaymentMessage(`Pergunta ${slot} de ${includedQuestionLimit} incluída na sua Ferradura.`);
      setStatus("Sua pergunta incluída está pronta para o embaralhamento.");
      persist("deck", [], slot);
      trackCommercialEvent("included_specific_question_opened", {
        product_id: completeEntitlement.productId,
        reading_slug: reading.slug,
        question_slot: slot,
      });
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
      return;
    }

    const pending = savePendingCheckout({
      orderId: createCheckoutOrderId(),
      productId: offer.id,
      readingId,
      readingSlug: reading.slug,
      offerContext,
      parentSessionId: discounted ? completeEntitlement?.sessionId : "",
      returnPath,
    });
    persist("offer", []);
    setPaymentState("opening");
    setPaymentMessage("Abrindo o pagamento seguro…");

    try {
      const checkout = await createHostedCheckout(pending);
      trackCommercialEvent("begin_checkout", {
        product_id: offer.id,
        reading_slug: reading.slug,
        offer_context: offerContext,
        price_label: offer.price,
      });
      window.location.assign(checkout.checkoutUrl);
    } catch (error) {
      clearPendingCheckout(pending.orderId);
      setPaymentState("error");
      setPaymentMessage(checkoutErrorMessage(error?.code));
    }
  }

  function shuffleSpecificDeck() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setIsShuffling(true);
    setSelectedCards([]);
    setStatus("Os 22 Arcanos estão encontrando uma ordem para esta pergunta.");
    timerRef.current = window.setTimeout(() => {
      setDrawPool(createRandomDrawPool(tarotCards, 10, drawPool));
      setIsShuffling(false);
      setStatus("Escolha cinco cartas na ordem em que chamarem você.");
    }, 900);
  }

  function selectSpecificCard(card) {
    setSelectedCards((current) => {
      if (current.some((selected) => selected.slug === card.slug)) {
        return current.filter((selected) => selected.slug !== card.slug);
      }
      if (current.length === 5) return current;
      return [...current, card];
    });
  }

  function revealSpecificReading() {
    if (selectedCards.length !== 5) return;
    setSpread(selectedCards);
    setPhase("reading");
    setStatus("Sua pergunta específica está aberta.");
    persist("reading", selectedCards);
    if (!commerceConfig.devUnlocked && specificEntitlement
        && specificEntitlement.productId !== commerceConfig.products.completeReading.id
        && !specificEntitlement.consumedAt) {
      const consumed = consumePaymentEntitlement(specificEntitlement.sessionId);
      if (consumed) setSpecificEntitlement(consumed);
    }
    trackCommercialEvent("specific_question_reading_opened", {
      product_id: offer.id,
      reading_slug: reading.slug,
      offer_context: offerContext,
      cards: selectedCards.map((card) => card.slug).join(","),
    });
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function restartSpecificReading() {
    clearDraft(reading.slug, discounted ? parentReadingId : "");
    setReadingId(createSpecificReadingId());
    setQuestion(contextualQuestion);
    setPhase("offer");
    setDrawPool([]);
    setSelectedCards([]);
    setSpread([]);
    setSpecificEntitlement(null);
    setActiveIncludedSlot(0);
    setStatus("");
    setPaymentState("idle");
    setPaymentMessage("");
    setQuestionError("");
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function handleSpecificSummaryResult(result) {
    if (!result || !activeIncludedSlot || !parentReadingId || commerceConfig.devUnlocked) return;
    const usedSlots = markIncludedQuestionSlot(parentReadingId, activeIncludedSlot);
    const used = Math.max(includedQuestionsUsed, usedSlots.length, activeIncludedSlot);
    setIncludedQuestionsUsed(used);
    if (completeEntitlement) {
      savePaymentEntitlement({ ...completeEntitlement, includedQuestionsUsed: used });
    }
  }

  if (phase === "deck") {
    const deckReady = drawPool.length > 0 && !isShuffling;
    return (
      <main className="specific-reading-page specific-flow-page" id="specific-reading-top">
        <section className="specific-flow-shell">
          <Link className="specific-back-link" to={backPath}><ArrowLeft size={15} /> Voltar à leitura anterior</Link>
          <div className="specific-flow-intro">
            <div className="specific-flow-heading">
              <span className="section-kicker">{reading.eyebrow} · 5 cartas</span>
              <h1>{deckReady ? "Escolha cinco cartas." : "Embaralhe pensando na pergunta."}</h1>
              <p>{deckReady
                ? "Toque nas cartas uma a uma. A ordem da escolha define as cinco posições abaixo."
                : "Primeiro embaralhe os 22 Arcanos. Depois você escolherá cinco cartas, sem cartas automáticas."}</p>
            </div>
            <div className="specific-flow-question">
              <small>Tema mantido · {contextLabel}</small>
              <q>{question}</q>
            </div>
          </div>

          <div className="specific-position-guide" aria-label="Ordem das cinco posições">
            {layout.map((position, index) => (
              <span className={selectedCards[index] ? "is-filled" : ""} key={position.id}>
                <b>{position.number}</b><small>{position.eyebrow}</small>
              </span>
            ))}
          </div>

          {!deckReady ? (
            <div className={`shuffle-stage specific-shuffle-stage ${isShuffling ? "is-shuffling" : ""}`}>
              <div className="shuffle-stack" aria-hidden="true">
                <SpecificCardBack disabled />
                <SpecificCardBack disabled />
                <SpecificCardBack disabled />
              </div>
              <button className="button button-primary button-large" type="button" onClick={shuffleSpecificDeck} disabled={isShuffling}>
                <Shuffle size={18} className={isShuffling ? "spin-icon" : ""} />
                {isShuffling ? "Embaralhando os Arcanos…" : "Embaralhar para esta pergunta"}
              </button>
            </div>
          ) : (
            <>
              <div className="draw-grid specific-draw-grid">
                {drawPool.map((card, index) => {
                  const selectedIndex = selectedCards.findIndex((selected) => selected.slug === card.slug);
                  const selectedOrder = selectedIndex >= 0 ? selectedIndex + 1 : null;
                  return (
                    <SpecificCardBack
                      key={card.slug}
                      selectedOrder={selectedOrder}
                      disabled={selectedCards.length === 5 && !selectedOrder}
                      onClick={() => selectSpecificCard(card)}
                      style={{ "--draw-index": index }}
                    />
                  );
                })}
              </div>
              <div className="draw-actions specific-draw-actions">
                <span>{selectedCards.length}/5 escolhidas</span>
                <button className="button button-primary" type="button" onClick={revealSpecificReading} disabled={selectedCards.length !== 5}>
                  Revelar as 5 cartas <Sparkles size={17} />
                </button>
                <button className="text-button" type="button" onClick={shuffleSpecificDeck}>
                  <RotateCcw size={15} /> Embaralhar novamente
                </button>
              </div>
            </>
          )}
          <p className="live-status" aria-live="polite">{status}</p>
        </section>
      </main>
    );
  }

  if (phase === "reading" && spread.length === 5) {
    return (
      <main className="specific-reading-page specific-result-page" id="specific-reading-top">
        <section className="specific-result-hero">
          <Link className="specific-back-link" to={backPath}><ArrowLeft size={15} /> Voltar à leitura anterior</Link>
          <span className="section-kicker">{reading.eyebrow}</span>
          <h1>{reading.shortTitle}</h1>
          <q>{question}</q>
          <span><Check size={15} /> cinco posições abertas na ordem escolhida</span>
        </section>

        <section className="specific-result-grid" aria-label="As cinco cartas da pergunta específica">
          {spread.map((card, index) => {
            const position = layout[index];
            return (
              <article className="spread-card specific-result-card" key={position.id} style={{ "--reveal-index": index }}>
                <div className="spread-position">
                  <span>{position.number}</span>
                  <div><strong>{position.eyebrow}</strong><small>{card.name}</small></div>
                </div>
                <SpecificTarotCard card={card} />
                <div className="spread-copy">
                  <div className="keyword-row">{card.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div>
                  <h3>{card.archetype}</h3>
                  <p>{specificCardReading(card, position.eyebrow, index)}</p>
                  <details><summary>Olhar a sombra <ChevronRight size={15} /></summary><p>{card.shadow}</p></details>
                  <div className="card-invitation"><span>Movimento possível</span><p>{card.action}</p></div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="specific-local-synthesis">
          <span className="section-kicker">Primeiro fechamento</span>
          <h2>As cinco cartas como uma resposta só.</h2>
          <p>{buildSpecificSynthesis(spread, reading)}</p>
        </section>

        <Agent911Summary
          cards={spread}
          intentId={reading.intentId}
          intentLabel={reading.eyebrow.replace(/^Leitura específica · /u, "")}
          question={question}
          createdAt={readingId}
          variant="specific"
          spreadId={reading.slug}
          parentReadingId={activeIncludedSlot ? parentReadingId : ""}
          entitlement={specificEntitlement}
          onResult={handleSpecificSummaryResult}
        />

        <div className="specific-result-actions">
          <button className="button button-primary" type="button" onClick={restartSpecificReading}>
            Nova pergunta específica <ArrowRight size={17} />
          </button>
          <Link className="button button-glass" to={backPath}>Voltar à leitura anterior</Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className="specific-reading-page"
      id="specific-reading-top"
      data-product={offer.id}
      data-price-cents={offer.priceCents}
      data-offer-context={offerContext}
    >
      <section className="specific-reading-hero">
        <div className="specific-reading-copy">
          <Link className="specific-back-link" to={backPath}><ArrowLeft size={15} /> Voltar à leitura anterior</Link>
          <span className="section-kicker">{reading.eyebrow}</span>
          <h1>{reading.shortTitle}</h1>
          <p>{reading.description}</p>
          <div className="specific-origin-badge">
            <Check size={16} />
            <span><small>Tema vindo da tiragem</small><strong>{contextLabel}</strong></span>
          </div>
        </div>

        <div className="intent-form specific-intent-form">
          <fieldset>
            <legend>Onde esta mesa vai colocar luz?</legend>
            <div className="intent-chips">
              <span className="intent-chip is-active"><Check size={15} strokeWidth={2.4} /> {contextLabel}</span>
            </div>
          </fieldset>

          <label className="question-field specific-question-field" htmlFor={`specific-question-${reading.slug}`}>
            <span>Sua pergunta</span>
            <textarea
              id={`specific-question-${reading.slug}`}
              value={question}
              onChange={(event) => {
                setQuestion(event.target.value.slice(0, 800));
                if (questionError) setQuestionError("");
              }}
              rows="4"
              placeholder={reading.question}
              aria-invalid={Boolean(questionError)}
            />
            <small>{question.length}/800 · a pergunta não é enviada ao pagamento</small>
            <p className="question-context-note">
              Escreva do mesmo jeito que na tiragem principal. A pergunta orienta a leitura,
              mas não interfere no embaralhamento nem escolhe as cartas.
            </p>
            {questionError ? <b role="alert">{questionError}</b> : null}
          </label>

          <div className="specific-form-positions">
            <small>As cinco posições desta resposta</small>
            <div>
              {layout.map((position) => (
                <span key={position.id}><b>{position.number}</b>{position.eyebrow}</span>
              ))}
            </div>
          </div>

          <div className="specific-reading-actions">
            <button
              className="button button-primary button-large"
              type="button"
              onClick={proceedToSpecificCheckout}
              disabled={paymentState === "opening" || paymentState === "verifying"}
            >
              {commerceConfig.devUnlocked
                ? "Continuar no DEV · sem cobrança"
                : includedQuestionAvailable
                  ? `Continuar · pergunta ${nextIncludedSlot} de ${includedQuestionLimit} incluída`
                  : paymentState === "opening" ? "Abrindo pagamento…" : `Continuar por ${offer.price}`}
              <ArrowRight size={18} />
            </button>
            <span><ShieldCheck size={15} /> {includedQuestionAvailable
              ? `${includedQuestionLimit - includedQuestionsUsed} pergunta${includedQuestionLimit - includedQuestionsUsed === 1 ? "" : "s"} incluída${includedQuestionLimit - includedQuestionsUsed === 1 ? "" : "s"} restante${includedQuestionLimit - includedQuestionsUsed === 1 ? "" : "s"}`
              : discounted
                ? `${offer.price} para perguntas adicionais após as ${includedQuestionLimit} incluídas`
              : commerceConfig.devUnlocked
                ? `${offer.price} em produção · aqui a compra é simulada`
                : `${offer.price} · pagamento único · leitura de 5 cartas`}</span>
            {paymentMessage ? <small className="specific-payment-message" role="status">{paymentMessage}</small> : null}
          </div>
        </div>
      </section>

      <section className="specific-structure">
        <div className="astro-section-heading split-heading">
          <div><span className="section-kicker">O que você recebe</span><h2>Cinco posições. Uma resposta conectada.</h2></div>
          <p>{reading.promise}</p>
        </div>
        <div className="specific-position-grid">
          {layout.map((position) => (
            <article key={position.id}>
              <span>{position.number}</span><Sparkles size={17} /><h3>{position.eyebrow}</h3>
              <p>Cada posição será lida em relação à sua pergunta e às outras quatro cartas, não como significado isolado.</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default function SpecificReadingPage(props) {
  const reading = specificReadingsBySlug[props.slug];
  if (!reading) return <Navigate to="/" replace />;
  return <SpecificReadingExperience {...props} reading={reading} />;
}
