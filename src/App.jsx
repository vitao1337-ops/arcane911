import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronRight,
  Clock3,
  CreditCard,
  Eye,
  Gem,
  History,
  LockKeyhole,
  Menu,
  RotateCcw,
  Share2,
  ShieldCheck,
  Shuffle,
  Sparkles,
  X,
} from "lucide-react";
import { completePositions, intents, positions, tarotBySlug, tarotCards } from "./data/tarot";
import { getReadingForIntent, specificReadings } from "./data/products";
import { agent911Config } from "./config/agent911";
import { salesConfig } from "./config/sales";
import Agent911Consultation from "./components/Agent911Consultation";
import Agent911Summary from "./components/Agent911Summary";
import NatalWheel from "./components/NatalWheel";
import {
  buildCheckoutUrl,
  isCheckoutConfigured,
  trackCommercialEvent,
} from "./lib/checkout";
import {
  buildCompleteSpreadFromSelections,
  cardReading,
  completeCardReading,
  createRandomDrawPool,
  formatCompleteReading,
  formatReading,
} from "./lib/reading";

const AstralMapPage = lazy(() => import("./pages/AstralMapPage"));
const SpecificReadingPage = lazy(() => import("./pages/SpecificReadingPage"));

const STORAGE_KEY = "arcane911.readings.v1";
const READING_SESSION_KEY = "arcane911.active-reading.v1";

function getStoredReadingSession() {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(READING_SESSION_KEY) ?? "null");
    if (!stored || !Array.isArray(stored.openingCards)) return null;
    return stored;
  } catch {
    return null;
  }
}

function saveReadingSession(session) {
  try {
    window.sessionStorage.setItem(READING_SESSION_KEY, JSON.stringify(session));
  } catch {
    // A leitura segue aberta mesmo em navegadores que bloqueiam armazenamento de sessão.
  }
}

function clearReadingSession() {
  try {
    window.sessionStorage.removeItem(READING_SESSION_KEY);
  } catch {
    // Sem impacto no ritual atual.
  }
}

const evolution = [
  {
    era: "Século XV",
    title: "Imagem e jogo",
    text: "Nas cortes italianas, os triunfos já organizavam figuras, virtudes e viradas humanas em uma sequência visual.",
  },
  {
    era: "Fim do século XVIII",
    title: "Leitura e destino",
    text: "A cartomancia transforma as cartas em linguagem de consulta e acrescenta camadas esotéricas à tradição.",
  },
  {
    era: "1909",
    title: "Símbolo intuitivo",
    text: "Pamela Colman Smith ilustra cada cena do baralho Rider–Waite–Smith e muda para sempre a leitura pela imagem.",
  },
  {
    era: "Agora",
    title: "Consciência em movimento",
    text: "O Arcane911 preserva os arquétipos e usa o digital para criar pausa, contexto e uma ação possível.",
  },
];

const premiumLayers = [
  {
    eyebrow: "Influência oculta",
    title: "O padrão que opera por baixo da pergunta",
  },
  {
    eyebrow: "Nó central",
    title: "O ponto que pode repetir ou travar o movimento",
  },
  {
    eyebrow: "Direção provável",
    title: "A tendência criada pelo caminho que está aberto",
  },
];

const completeReadingGroups = [
  {
    id: "terreno",
    kicker: "Camada I · O terreno",
    title: "De onde isso vem e onde está agora.",
    text: "As duas primeiras posições conectam a origem da pergunta ao presente sem apagar o que ainda exerce influência.",
    indexes: [0, 1],
  },
  {
    id: "subsolo",
    kicker: "Camada II · O que opera",
    title: "O oculto, o nó e o mundo ao redor.",
    text: "O centro da Ferradura separa padrão interno, obstáculo principal e forças externas para a leitura não colocar tudo na mesma conta.",
    indexes: [2, 3, 4],
  },
  {
    id: "travessia",
    kicker: "Camada III · A travessia",
    title: "O gesto possível e a direção que ele cria.",
    text: "As duas últimas posições transformam compreensão em escolha: primeiro a melhor ação, depois a tendência do caminho atual.",
    indexes: [5, 6],
  },
];

const preservedOpeningPositions = [0, 1, 5];
const completeSelectionPositions = [2, 3, 4, 6];

function getStoredJournal() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(stored)
      ? stored.filter(
        (record) => record
          && typeof record.id === "string"
          && typeof record.createdAt === "string"
          && typeof record.question === "string"
          && Array.isArray(record.cards),
      )
      : [];
  } catch {
    return [];
  }
}

function saveStoredJournal(records) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // A experiência principal continua funcionando quando o navegador bloqueia armazenamento.
  }
}

function TarotCardVisual({ card, className = "", eager = false, onClick }) {
  const content = (
    <>
      <img
        src={card.image}
        alt={`Carta ${card.name}`}
        width="1024"
        height="1536"
        loading={eager ? "eager" : "lazy"}
        draggable="false"
      />
      <span className="tarot-roman" aria-hidden="true">
        {card.roman}
      </span>
      <span className="tarot-name" aria-hidden="true">
        {card.name}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        className={`tarot-card tarot-card-button ${className}`}
        type="button"
        onClick={onClick}
        aria-label={`Abrir detalhes de ${card.name}`}
      >
        {content}
      </button>
    );
  }

  return <div className={`tarot-card ${className}`}>{content}</div>;
}

function CardBack({ selectedOrder, isDisabled, onClick, style }) {
  return (
    <button
      className={`card-back ${selectedOrder ? "is-selected" : ""}`}
      type="button"
      onClick={onClick}
      disabled={isDisabled}
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

function MysticField({ compact = false }) {
  const viewBox = compact ? "0 0 1200 480" : "0 0 1200 720";
  const rosetteTransform = compact ? "translate(152 392)" : "translate(152 584)";
  const rightConstellationTransform = compact ? "translate(0 -118)" : undefined;

  return (
    <div className={`mystic-field ${compact ? "is-compact" : ""}`} aria-hidden="true">
      <svg
        className="mystic-lace"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <g className="mystic-lace-threads">
          <path d="M-80 170C145 36 314 278 560 160S930 36 1285 214" />
          <path d="M-110 604C128 458 336 674 596 542S966 402 1290 568" />
          <path d="M194-46C322 118 220 266 350 396S596 578 510 778" />
        </g>

        <g className="mystic-lace-constellation constellation-left">
          <path d="M78 248L164 190L252 234L334 126" />
          <circle cx="78" cy="248" r="3" />
          <circle cx="164" cy="190" r="2.5" />
          <circle cx="252" cy="234" r="3.5" />
          <circle cx="334" cy="126" r="2.5" />
        </g>

        <g
          className="mystic-lace-constellation constellation-right"
          transform={rightConstellationTransform}
        >
          <path d="M868 496L948 428L1034 470L1132 354" />
          <circle cx="868" cy="496" r="2.5" />
          <circle cx="948" cy="428" r="3.5" />
          <circle cx="1034" cy="470" r="2.5" />
          <circle cx="1132" cy="354" r="3" />
        </g>

        <g className="mystic-lace-sigil sigil-crescent">
          <circle cx="1080" cy="126" r="58" />
          <path d="M1097 84C1068 96 1052 129 1067 158C1076 176 1092 186 1110 188C1078 200 1040 185 1026 151C1011 115 1029 74 1066 59C1083 52 1102 53 1118 59C1109 64 1102 73 1097 84Z" />
          <path d="M1080 46V28M1080 224V206M990 126H972M1188 126H1170" />
        </g>

        <g className="mystic-lace-sigil sigil-rosette" transform={rosetteTransform}>
          <circle r="46" />
          <path d="M0-34C12-26 13-11 0 0C-13-11-12-26 0-34Z" />
          <path d="M0-34C12-26 13-11 0 0C-13-11-12-26 0-34Z" transform="rotate(60)" />
          <path d="M0-34C12-26 13-11 0 0C-13-11-12-26 0-34Z" transform="rotate(120)" />
          <path d="M0-34C12-26 13-11 0 0C-13-11-12-26 0-34Z" transform="rotate(180)" />
          <path d="M0-34C12-26 13-11 0 0C-13-11-12-26 0-34Z" transform="rotate(240)" />
          <path d="M0-34C12-26 13-11 0 0C-13-11-12-26 0-34Z" transform="rotate(300)" />
          <circle r="5" />
        </g>
      </svg>

      <span className="mystic-star star-one">✦</span>
      <span className="mystic-star star-two">✧</span>
      <span className="mystic-star star-three">✦</span>
      <span className="mystic-star star-four">✧</span>
    </div>
  );
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const route = location.pathname.replace(/\/+$/, "") || "/";
  const initialSession = useMemo(getStoredReadingSession, []);
  const initialOpening = useMemo(
    () => (initialSession?.openingCards ?? []).map((slug) => tarotBySlug[slug]).filter(Boolean),
    [initialSession],
  );
  const initialComplete = useMemo(
    () => (initialSession?.completeCards ?? []).map((slug) => tarotBySlug[slug]).filter(Boolean),
    [initialSession],
  );
  const [phase, setPhase] = useState(() => {
    if (route === "/tiragem-completa" && initialComplete.length === 7) return "complete";
    if (route === "/tiragem-completa" && initialOpening.length === 3) return "complete-deck";
    if (["/", "/tiragem-gratis"].includes(route) && initialOpening.length === 3) return "reading";
    return "intent";
  });
  const [intentId, setIntentId] = useState(initialSession?.intentId ?? "caminhos");
  const [question, setQuestion] = useState(initialSession?.question ?? "");
  const [drawPool, setDrawPool] = useState([]);
  const [selectedCards, setSelectedCards] = useState([]);
  const [spread, setSpread] = useState(initialOpening);
  const [completeSpread, setCompleteSpread] = useState(initialComplete);
  const [completeDrawPool, setCompleteDrawPool] = useState([]);
  const [completeSelectedCards, setCompleteSelectedCards] = useState([]);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isCompleteShuffling, setIsCompleteShuffling] = useState(false);
  const [createdAt, setCreatedAt] = useState(initialSession?.createdAt ?? null);
  const [journal, setJournal] = useState(getStoredJournal);
  const [journalOpen, setJournalOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeCard, setActiveCard] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [agentSummaries, setAgentSummaries] = useState({ opening: null, complete: null });
  const [status, setStatus] = useState("");
  const timerRef = useRef(null);
  const ritualRef = useRef(null);
  const isLanding = route === "/";
  const isFreeRoute = route === "/tiragem-gratis";
  const isCompleteRoute = route === "/tiragem-completa";
  const isAstroRoute = route === "/mapa-astral";
  const isSpecificRoute = route.startsWith("/leituras/");
  const featuredSpecificReading = getReadingForIntent(intentId);

  const selectedIntent = useMemo(
    () => intents.find((intent) => intent.id === intentId) ?? intents[0],
    [intentId],
  );

  const resolvedQuestion = question.trim() || selectedIntent.prompt;
  const activeReadingCards = isCompleteRoute && completeSpread.length === 7
    ? completeSpread
    : spread;
  const readingSaved = createdAt
    ? journal.some((record) => {
      if (record.id !== createdAt || !Array.isArray(record.cards)) return false;

      if (activeReadingCards.length === 3 && record.cards.length === 7) {
        return record.cards[0] === activeReadingCards[0]?.slug
          && record.cards[1] === activeReadingCards[1]?.slug
          && record.cards[5] === activeReadingCards[2]?.slug;
      }

      return record.cards.length === activeReadingCards.length
        && record.cards.every((slug, index) => slug === activeReadingCards[index]?.slug);
    })
    : false;
  const checkoutConfigured = isCheckoutConfigured(salesConfig.checkoutUrl);

  useEffect(() => {
    const queryIntent = new URLSearchParams(location.search).get("intencao");
    if (queryIntent && intents.some((intent) => intent.id === queryIntent)) {
      clearReadingSession();
      setIntentId(queryIntent);
      setQuestion("");
      setDrawPool([]);
      setSelectedCards([]);
      setSpread([]);
      setCompleteSpread([]);
      setCompleteDrawPool([]);
      setCompleteSelectedCards([]);
      setIsCompleteShuffling(false);
      setCreatedAt(null);
      setAgentSummaries({ opening: null, complete: null });
      setPhase("intent");
      setStatus("Uma nova intenção está pronta para ser selada.");
    }
  }, [location.search]);

  useEffect(() => {
    if (isCompleteRoute && completeSpread.length === 7) setPhase("complete");
    if (isCompleteRoute && spread.length === 3 && completeSpread.length !== 7) setPhase("complete-deck");
    if (!isCompleteRoute && ["complete", "complete-deck"].includes(phase)) {
      setPhase(spread.length === 3 ? "reading" : "intent");
    }
    const firstFrame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
    });
    return () => window.cancelAnimationFrame(firstFrame);
  }, [route]);

  useEffect(() => {
    const titles = {
      "/": "Arcane911 · Tarot como espelho",
      "/tiragem-gratis": "Tiragem gratuita · Arcane911",
      "/tiragem-completa": "Ferradura completa · Arcane911",
      "/mapa-astral": "Mapa Astral · Arcane911",
    };
    document.title = titles[route]
      ?? (isSpecificRoute ? "Leitura específica · Arcane911" : "Arcane911");
  }, [isSpecificRoute, route]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setActiveCard(null);
        setJournalOpen(false);
        setMobileNavOpen(false);
        setCheckoutOpen(false);
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    const overlayIsOpen = Boolean(activeCard || journalOpen || mobileNavOpen || checkoutOpen);
    document.body.style.overflow = overlayIsOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [activeCard, checkoutOpen, journalOpen, mobileNavOpen]);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  function moveToRitual() {
    window.requestAnimationFrame(() => {
      ritualRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function beginRitual() {
    if (!question.trim()) setQuestion(selectedIntent.prompt);
    clearReadingSession();
    setDrawPool([]);
    setSelectedCards([]);
    setSpread([]);
    setCompleteSpread([]);
    setCompleteDrawPool([]);
    setCompleteSelectedCards([]);
    setIsCompleteShuffling(false);
    setStatus("");
    setPhase("deck");
    trackCommercialEvent("free_reading_started", {
      intent: intentId,
    });
    moveToRitual();
  }

  function shuffleDeck() {
    setIsShuffling(true);
    setSelectedCards([]);
    setStatus("As imagens estão encontrando uma ordem.");
    timerRef.current = window.setTimeout(() => {
      const orderedDeck = createRandomDrawPool(tarotCards, 9, drawPool);
      setDrawPool(orderedDeck);
      setIsShuffling(false);
      setStatus("Escolha três cartas na ordem em que chamarem você.");
    }, 1250);
  }

  function selectCard(card) {
    setSelectedCards((current) => {
      if (current.some((selected) => selected.slug === card.slug)) {
        return current.filter((selected) => selected.slug !== card.slug);
      }

      if (current.length === 3) return current;
      return [...current, card];
    });
  }

  function revealReading() {
    if (selectedCards.length !== 3) return;
    const timestamp = new Date().toISOString();
    setSpread(selectedCards);
    setCreatedAt(timestamp);
    setPhase("reading");
    setStatus("A leitura está aberta.");
    saveReadingSession({
      intentId,
      question: resolvedQuestion,
      openingCards: selectedCards.map((card) => card.slug),
      completeCards: [],
      createdAt: timestamp,
    });
    trackCommercialEvent("free_reading_completed", {
      intent: intentId,
      cards: selectedCards.map((card) => card.slug).join(","),
    });
    moveToRitual();
  }

  function restartReading() {
    clearReadingSession();
    setPhase("intent");
    setQuestion("");
    setDrawPool([]);
    setSelectedCards([]);
    setSpread([]);
    setCompleteSpread([]);
    setCompleteDrawPool([]);
    setCompleteSelectedCards([]);
    setIsCompleteShuffling(false);
    setCreatedAt(null);
    setAgentSummaries({ opening: null, complete: null });
    setStatus("");
    if (isCompleteRoute) {
      navigate("/tiragem-gratis");
    } else {
      moveToRitual();
    }
  }

  function saveReading() {
    if (!createdAt || ![3, 7].includes(activeReadingCards.length) || readingSaved) return;

    const record = {
      id: createdAt,
      createdAt,
      intentId,
      question: resolvedQuestion,
      kind: activeReadingCards.length === 7 ? "horseshoe" : "opening",
      cards: activeReadingCards.map((card) => card.slug),
    };
    const nextJournal = [record, ...journal.filter((item) => item.id !== createdAt)].slice(0, 24);
    setJournal(nextJournal);
    saveStoredJournal(nextJournal);
    setStatus(
      activeReadingCards.length === 7
        ? "Ferradura completa guardada neste dispositivo."
        : "Leitura guardada neste dispositivo.",
    );
  }

  async function shareReading() {
    if (!createdAt || ![3, 7].includes(activeReadingCards.length)) return;
    const formatter = activeReadingCards.length === 7 ? formatCompleteReading : formatReading;
    const text = formatter({
      cards: activeReadingCards,
      intentId,
      intentLabel: selectedIntent.label,
      question: resolvedQuestion,
      createdAt,
    });

    try {
      if (navigator.share) {
        await navigator.share({ title: "Minha leitura Arcane911", text });
        setStatus("Leitura compartilhada.");
      } else {
        await navigator.clipboard.writeText(text);
        setStatus("Leitura copiada para a área de transferência.");
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        setStatus("Não foi possível compartilhar agora. Sua leitura continua aqui.");
      }
    }
  }

  function openCompleteReading() {
    if (!createdAt || spread.length !== 3) return;

    if (completeSpread.length === 7) {
      setPhase("complete");
      navigate("/tiragem-completa");
      return;
    }

    if (timerRef.current) window.clearTimeout(timerRef.current);
    setCompleteDrawPool([]);
    setCompleteSelectedCards([]);
    setIsCompleteShuffling(false);
    setPhase("complete-deck");
    setStatus("Suas três cartas foram seladas. O novo baralho está pronto.");
    saveReadingSession({
      intentId,
      question: resolvedQuestion,
      openingCards: spread.map((card) => card.slug),
      completeCards: [],
      createdAt,
    });
    trackCommercialEvent("complete_reading_started", {
      intent: intentId,
      reading_id: createdAt,
      opening_cards: spread.map((card) => card.slug).join(","),
    });
    navigate("/tiragem-completa");
  }

  function shuffleCompleteDeck() {
    if (spread.length !== 3) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);

    setIsCompleteShuffling(true);
    setCompleteSelectedCards([]);
    setStatus("Os dezenove Arcanos restantes estão encontrando uma nova ordem.");

    const openingSlugs = new Set(spread.map((card) => card.slug));
    timerRef.current = window.setTimeout(() => {
      const remainingDeck = tarotCards.filter((card) => !openingSlugs.has(card.slug));
      const orderedDeck = createRandomDrawPool(remainingDeck, 12, completeDrawPool);

      setCompleteDrawPool(orderedDeck);
      setIsCompleteShuffling(false);
      setStatus("Escolha quatro cartas. A ordem define as novas posições da Ferradura.");
      trackCommercialEvent("complete_deck_shuffled", {
        intent: intentId,
        reading_id: createdAt,
      });
    }, 1150);
  }

  function selectCompleteCard(card) {
    setCompleteSelectedCards((current) => {
      if (current.some((selected) => selected.slug === card.slug)) {
        return current.filter((selected) => selected.slug !== card.slug);
      }

      if (current.length === 4) return current;
      return [...current, card];
    });
  }

  function revealCompleteReading() {
    const nextSpread = buildCompleteSpreadFromSelections(spread, completeSelectedCards);

    if (nextSpread.length !== 7) {
      setStatus("Escolha quatro cartas diferentes para completar a Ferradura.");
      return;
    }

    setCompleteSpread(nextSpread);
    setPhase("complete");
    setStatus("A Ferradura de sete cartas está aberta.");
    saveReadingSession({
      intentId,
      question: resolvedQuestion,
      openingCards: spread.map((card) => card.slug),
      completeCards: nextSpread.map((card) => card.slug),
      createdAt,
    });
    trackCommercialEvent("complete_reading_opened", {
      intent: intentId,
      reading_id: createdAt,
      cards: nextSpread.map((card) => card.slug).join(","),
    });
    moveToRitual();
  }

  function openCheckout() {
    trackCommercialEvent("offer_opened", {
      product_id: salesConfig.productId,
      intent: intentId,
      reading_id: createdAt,
    });
    setCheckoutOpen(true);
  }

  function proceedToCheckout() {
    if (!checkoutConfigured) {
      trackCommercialEvent("checkout_missing_configuration", {
        product_id: salesConfig.productId,
      });
      setStatus("Checkout preparado no código. Conecte VITE_CHECKOUT_URL antes de publicar.");
      setCheckoutOpen(false);
      return;
    }

    const checkoutUrl = buildCheckoutUrl(salesConfig.checkoutUrl, {
      product_id: salesConfig.productId,
      reading_id: createdAt,
      intent: intentId,
      cards: spread.map((card) => card.slug).join(","),
      utm_source: "arcane911",
      utm_medium: "free_reading",
      utm_campaign: "leitura_profunda",
    });

    trackCommercialEvent("begin_checkout", {
      product_id: salesConfig.productId,
      price_label: salesConfig.offer.price,
      intent: intentId,
      reading_id: createdAt,
    });
    window.location.assign(checkoutUrl);
  }

  function renderIntentPhase() {
    return (
      <div className="ritual-intent">
        <div className="ritual-heading">
          <span className="section-kicker">01 · Intenção</span>
          <h2>Comece pelo que está vivo.</h2>
          <p>Você não precisa formular bonito. Precisa formular com verdade.</p>
        </div>

        <div className="intent-form">
          <fieldset>
            <legend>Onde você quer colocar luz?</legend>
            <div className="intent-chips">
              {intents.map((intent) => (
                <button
                  className={`intent-chip ${intent.id === intentId ? "is-active" : ""}`}
                  type="button"
                  key={intent.id}
                  onClick={() => setIntentId(intent.id)}
                  aria-pressed={intent.id === intentId}
                >
                  {intent.id === intentId ? <Check size={15} strokeWidth={2.4} /> : null}
                  {intent.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="question-field">
            <span>Sua pergunta</span>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value.slice(0, 800))}
              placeholder={selectedIntent.prompt}
              rows="4"
            />
            <small>
              {question.length}/800 · {agent911Config.remoteEnabled
                ? "ao revelar, esta pergunta e as cartas seguem ao 911 conectado, sem cadastro"
                : "ao revelar, esta pergunta e as cartas ficam neste dispositivo, sem cadastro"}
            </small>
          </label>

          <button className="button button-primary button-large" type="button" onClick={beginRitual}>
            Selar a pergunta
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  function renderDeckPhase() {
    const deckIsReady = drawPool.length > 0 && !isShuffling;

    return (
      <div className="ritual-deck">
        <div className="ritual-heading ritual-heading-centered">
          <span className="section-kicker">02 · Encontro</span>
          <h2>{deckIsReady ? "Não racionalize a escolha." : "Tire o ruído da frente."}</h2>
          <p>
            {deckIsReady
              ? "Toque em três cartas. A primeira é a raiz, a segunda é o espelho, a terceira é o movimento."
              : "Respire uma vez pensando na pergunta. Depois, embaralhe."}
          </p>
        </div>

        {!deckIsReady ? (
          <div className={`shuffle-stage ${isShuffling ? "is-shuffling" : ""}`}>
            <div className="shuffle-stack" aria-hidden="true">
              <CardBack style={{ "--stack-index": 0 }} isDisabled />
              <CardBack style={{ "--stack-index": 1 }} isDisabled />
              <CardBack style={{ "--stack-index": 2 }} isDisabled />
            </div>
            <button
              className="button button-primary button-large"
              type="button"
              onClick={shuffleDeck}
              disabled={isShuffling}
            >
              <Shuffle size={18} className={isShuffling ? "spin-icon" : ""} />
              {isShuffling ? "Embaralhando…" : "Embaralhar os 22 Arcanos"}
            </button>
          </div>
        ) : (
          <>
            <div className="draw-grid">
              {drawPool.map((card, index) => {
                const selectedIndex = selectedCards.findIndex(
                  (selected) => selected.slug === card.slug,
                );
                const selectionOrder = selectedIndex >= 0 ? selectedIndex + 1 : null;
                const selectionFull = selectedCards.length === 3 && !selectionOrder;

                return (
                  <CardBack
                    key={card.slug}
                    selectedOrder={selectionOrder}
                    isDisabled={selectionFull}
                    onClick={() => selectCard(card)}
                    style={{ "--draw-index": index }}
                  />
                );
              })}
            </div>

            <div className="draw-actions">
              <span>{selectedCards.length}/3 escolhidas</span>
              <button
                className="button button-primary"
                type="button"
                onClick={revealReading}
                disabled={selectedCards.length !== 3}
              >
                Revelar a leitura
                <Sparkles size={17} />
              </button>
              <button className="text-button" type="button" onClick={shuffleDeck}>
                <RotateCcw size={15} />
                Embaralhar de novo
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  function renderReadingPhase() {
    return (
      <div className="reading-result">
        <div className="reading-header">
          <div>
            <span className="section-kicker">03 · Leitura aberta</span>
            <h2>Três imagens. Uma direção.</h2>
          </div>
          <div className="reading-question">
            <span>{selectedIntent.label}</span>
            <q>{resolvedQuestion}</q>
          </div>
        </div>

        <div className="spread-grid">
          {spread.map((card, index) => {
            const position = positions[index];
            return (
              <article className="spread-card" key={card.slug} style={{ "--reveal-index": index }}>
                <div className="spread-position">
                  <span>{position.number}</span>
                  <div>
                    <strong>{position.eyebrow}</strong>
                    <small>{position.title}</small>
                  </div>
                </div>

                <TarotCardVisual card={card} eager />

                <div className="spread-copy">
                  <div className="keyword-row">
                    {card.keywords.map((keyword) => (
                      <span key={keyword}>{keyword}</span>
                    ))}
                  </div>
                  <h3>{card.archetype}</h3>
                  <p>{cardReading(card, position.id)}</p>
                  <details>
                    <summary>Olhar a sombra <ChevronRight size={15} /></summary>
                    <p>{card.shadow}</p>
                  </details>
                  <div className="card-invitation">
                    <span>Convite</span>
                    <p>{card.action}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {renderAgent911Summary("opening")}

        <section className="conversion-gate" aria-labelledby="deep-reading-title">
          <div className="premium-preview" aria-hidden="true">
            <div className="premium-preview-orbit"><Gem size={22} /></div>
            {premiumLayers.map((layer, index) => (
              <article key={layer.eyebrow} style={{ "--premium-index": index }}>
                <span><Sparkles size={14} /></span>
                <div>
                  <small>{layer.eyebrow}</small>
                  <strong>{layer.title}</strong>
                </div>
              </article>
            ))}
          </div>

          <div className="conversion-copy">
            <span className="section-kicker">Tiragem completa liberada</span>
            <h3 id="deep-reading-title">O sinal apareceu.<br />Agora falta entender o movimento inteiro.</h3>
            <p>
              O 911 já encontrou o ponto vivo da sua pergunta. A Ferradura continua exatamente desta mesa: quatro novos Arcanos revelam o padrão oculto, o nó central, o campo ao redor e a direção provável do caminho atual.
            </p>

            <ul>
              {salesConfig.offer.features.map((feature) => (
                <li key={feature}><Check size={15} /> {feature}</li>
              ))}
            </ul>

            <div className="offer-line">
              <div>
                <small>experiência liberada</small>
                <strong>7 cartas</strong>
              </div>
              <button className="button button-primary button-large" type="button" onClick={openCompleteReading}>
                Abrir tiragem completa
                <ArrowRight size={18} />
              </button>
            </div>

            <div className="offer-trust">
              <span><ShieldCheck size={14} /> Sem cadastro</span>
              <span><CreditCard size={14} /> Sem cartão</span>
              <span><Bookmark size={14} /> Mantém suas três cartas</span>
            </div>
          </div>
        </section>

        <div className="reading-actions">
          <button
            className="button button-glass"
            type="button"
            onClick={saveReading}
            disabled={readingSaved}
          >
            {readingSaved ? <Check size={17} /> : <Bookmark size={17} />}
            {readingSaved ? "Guardada no diário" : "Guardar no diário"}
          </button>
          <button className="button button-glass" type="button" onClick={shareReading}>
            <Share2 size={17} />
            Compartilhar
          </button>
          <button className="text-button" type="button" onClick={restartReading}>
            <RotateCcw size={15} />
            Nova pergunta
          </button>
        </div>
      </div>
    );
  }

  function renderCompleteSpecificTeasers() {
    const orderedReadings = [
      featuredSpecificReading,
      ...specificReadings.filter((item) => item.slug !== featuredSpecificReading.slug),
    ];

    return (
      <section className="specific-teasers" aria-labelledby="complete-specific-teasers-title">
        <div className="specific-teasers-heading">
          <div>
            <span className="section-kicker">Depois do panorama, uma pergunta direta</span>
            <h3 id="complete-specific-teasers-title">Aprofunde o ponto que a Ferradura revelou.</h3>
          </div>
          <p>Se você não precisa da síntese inteira nem de uma consulta, escolha uma lente direta para vínculo, decisão, trabalho ou caminho. Estas leituras ficam como uma alternativa menor.</p>
        </div>

        <div className="specific-teasers-grid">
          {orderedReadings.map((reading, index) => (
            <Link
              className={"specific-teaser-card " + (index === 0 ? "is-featured" : "")}
              to={"/leituras/" + reading.slug}
              key={reading.slug}
            >
              <span className="specific-teaser-icon">
                {index === 0 ? <Sparkles size={17} /> : <LockKeyhole size={16} />}
              </span>
              <small>{index === 0 ? "Resposta direta" : reading.eyebrow.replace("Leitura específica · ", "")}</small>
              <strong>{reading.shortTitle}</strong>
              <p>{reading.promise}</p>
              <b>Conhecer estrutura <ArrowRight size={15} /></b>
            </Link>
          ))}
        </div>
      </section>
    );
  }

  function renderAgent911Summary(variant) {
    const agentCards = variant === "complete" ? completeSpread : spread;
    if (!createdAt || ![3, 7].includes(agentCards.length)) return null;

    return (
      <Agent911Summary
        key={`${createdAt}-${variant}`}
        cards={agentCards}
        intentId={intentId}
        intentLabel={selectedIntent.label}
        question={resolvedQuestion}
        createdAt={createdAt}
        variant={variant}
        onResult={(result) => setAgentSummaries((current) => (
          current[variant] === result ? current : { ...current, [variant]: result }
        ))}
      />
    );
  }

  function renderAgent911Consultation() {
    if (!createdAt || completeSpread.length !== 7) return null;

    return (
      <Agent911Consultation
        key={`${createdAt}-consultation`}
        cards={completeSpread}
        intentId={intentId}
        intentLabel={selectedIntent.label}
        question={resolvedQuestion}
        createdAt={createdAt}
        initialResult={agentSummaries.complete}
      />
    );
  }

  function renderCompleteDeckPhase() {
    const deckIsReady = completeDrawPool.length > 0 && !isCompleteShuffling;

    return (
      <div className="complete-deck-phase">
        <div className="reading-header complete-deck-header">
          <div>
            <span className="section-kicker">04 · Segundo baralho</span>
            <h2>Três cartas seladas.<br />Quatro encontros novos.</h2>
          </div>
          <div className="reading-question">
            <span>{selectedIntent.label}</span>
            <q>{resolvedQuestion}</q>
          </div>
        </div>

        <section className="preserved-opening" aria-labelledby="preserved-opening-title">
          <div className="preserved-opening-heading">
            <div>
              <span className="section-kicker">O fio permanece</span>
              <h3 id="preserved-opening-title">As três escolhas gratuitas não voltam para o monte.</h3>
            </div>
            <p>Elas ocupam origem, presente e melhor ação. O novo baralho contém somente os dezenove Arcanos que ainda não apareceram.</p>
          </div>

          <div className="preserved-opening-grid">
            {preservedOpeningPositions.map((positionIndex, openingIndex) => {
              const card = spread[openingIndex];
              const position = completePositions[positionIndex];

              return (
                <article key={position.id}>
                  <span className="preserved-opening-number">{position.number}</span>
                  <TarotCardVisual card={card} className="preserved-opening-card" eager />
                  <div>
                    <small>{position.eyebrow}</small>
                    <strong>{card.name}</strong>
                    <span>preservada</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="complete-deck-table" aria-labelledby="complete-deck-title">
          <div className="ritual-heading ritual-heading-centered">
            <span className="section-kicker">O que ainda falta aparecer</span>
            <h2 id="complete-deck-title">
              {deckIsReady ? "Escolha sem tentar adivinhar." : "Agora, o baralho muda."}
            </h2>
            <p>
              {deckIsReady
                ? "Toque em quatro cartas. Elas entram como influência oculta, nó central, campo externo e direção provável."
                : "Respire novamente com a mesma pergunta. Embaralhe os dezenove Arcanos restantes e abra uma nova mesa."}
            </p>
          </div>

          {!deckIsReady ? (
            <div className={"shuffle-stage complete-shuffle-stage " + (isCompleteShuffling ? "is-shuffling" : "")}>
              <div className="shuffle-stack" aria-hidden="true">
                <CardBack style={{ "--stack-index": 0 }} isDisabled />
                <CardBack style={{ "--stack-index": 1 }} isDisabled />
                <CardBack style={{ "--stack-index": 2 }} isDisabled />
              </div>
              <button
                className="button button-primary button-large"
                type="button"
                onClick={shuffleCompleteDeck}
                disabled={isCompleteShuffling}
              >
                <Shuffle size={18} className={isCompleteShuffling ? "spin-icon" : ""} />
                {isCompleteShuffling ? "Embaralhando o novo baralho…" : "Embaralhar os 19 restantes"}
              </button>
            </div>
          ) : (
            <>
              <div className="complete-position-guide" aria-label="Ordem das quatro novas posições">
                {completeSelectionPositions.map((positionIndex, index) => {
                  const position = completePositions[positionIndex];
                  return (
                    <span className={completeSelectedCards[index] ? "is-filled" : ""} key={position.id}>
                      <b>{index + 1}</b>
                      <small>{position.eyebrow}</small>
                    </span>
                  );
                })}
              </div>

              <div className="draw-grid complete-draw-grid">
                {completeDrawPool.map((card, index) => {
                  const selectedIndex = completeSelectedCards.findIndex(
                    (selected) => selected.slug === card.slug,
                  );
                  const selectionOrder = selectedIndex >= 0 ? selectedIndex + 1 : null;
                  const selectionFull = completeSelectedCards.length === 4 && !selectionOrder;

                  return (
                    <CardBack
                      key={card.slug}
                      selectedOrder={selectionOrder}
                      isDisabled={selectionFull}
                      onClick={() => selectCompleteCard(card)}
                      style={{ "--draw-index": index }}
                    />
                  );
                })}
              </div>

              <div className="draw-actions complete-draw-actions">
                <span>{completeSelectedCards.length}/4 escolhidas</span>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={revealCompleteReading}
                  disabled={completeSelectedCards.length !== 4}
                >
                  Abrir a Ferradura completa
                  <Sparkles size={17} />
                </button>
                <button className="text-button" type="button" onClick={shuffleCompleteDeck}>
                  <RotateCcw size={15} />
                  Embaralhar de novo
                </button>
              </div>
            </>
          )}

          <button
            className="text-button complete-back-opening"
            type="button"
            onClick={() => {
              setPhase("reading");
              setStatus("Suas três cartas iniciais continuam abertas.");
              navigate("/tiragem-gratis");
            }}
          >
            <ChevronRight size={15} />
            Voltar às três cartas
          </button>
        </section>
      </div>
    );
  }

  function renderCompleteReadingPhase() {
    return (
      <div className="reading-result complete-reading-result">
        <div className="reading-header">
          <div>
            <span className="section-kicker">04 · Ferradura completa</span>
            <h2>Sete posições. O movimento inteiro.</h2>
          </div>
          <div className="reading-question">
            <span>{selectedIntent.label}</span>
            <q>{resolvedQuestion}</q>
          </div>
        </div>

        <section className="complete-map" aria-labelledby="complete-map-title">
          <div className="complete-map-heading">
            <div>
              <span className="section-kicker">Mapa da tiragem</span>
              <h3 id="complete-map-title">A Ferradura de 7 cartas</h3>
            </div>
            <p>
              A leitura percorre origem, presente, forças invisíveis e escolha até chegar à direção provável. Toque em uma posição para ir ao detalhe.
            </p>
          </div>

          <div className="complete-horseshoe" role="list" aria-label="As sete posições da Ferradura">
            {completeSpread.map((card, index) => {
              const position = completePositions[index];
              return (
                <a
                  className="complete-horseshoe-item"
                  href={`#complete-card-${position.id}`}
                  key={position.id}
                  role="listitem"
                  style={{ "--horseshoe-index": index }}
                >
                  <span className="complete-horseshoe-number">{position.number}</span>
                  <TarotCardVisual card={card} className="complete-horseshoe-card" />
                  <span className="complete-horseshoe-label">
                    <strong>{position.eyebrow}</strong>
                    <small>{card.name}</small>
                  </span>
                </a>
              );
            })}
          </div>
        </section>

        <div className="complete-reading-body">
          {completeReadingGroups.map((group) => (
            <section
              className="complete-reading-group"
              aria-labelledby={`complete-group-${group.id}`}
              key={group.id}
            >
              <div className="complete-group-heading">
                <div>
                  <span className="section-kicker">{group.kicker}</span>
                  <h3 id={`complete-group-${group.id}`}>{group.title}</h3>
                </div>
                <p>{group.text}</p>
              </div>

              <div className={`complete-reading-grid has-${group.indexes.length}-cards`}>
                {group.indexes.map((cardIndex) => {
                  const card = completeSpread[cardIndex];
                  const position = completePositions[cardIndex];

                  return (
                    <article
                      className="spread-card complete-spread-card"
                      id={`complete-card-${position.id}`}
                      key={position.id}
                      style={{ "--reveal-index": cardIndex }}
                    >
                      <div className="spread-position">
                        <span>{position.number}</span>
                        <div>
                          <strong>{position.eyebrow}</strong>
                          <small>{position.title}</small>
                        </div>
                      </div>

                      <TarotCardVisual card={card} />

                      <div className="spread-copy">
                        <div className="keyword-row">
                          {card.keywords.map((keyword) => (
                            <span key={keyword}>{keyword}</span>
                          ))}
                        </div>
                        <h3>{card.archetype}</h3>
                        <p>{completeCardReading(card, position.id)}</p>
                        <details>
                          <summary>Olhar a sombra <ChevronRight size={15} /></summary>
                          <p>{card.shadow}</p>
                        </details>
                        <div className="card-invitation complete-invitation">
                          <span>Pergunta de integração</span>
                          <p>{position.prompt}</p>
                          <small><strong>Movimento possível</strong>{card.action}</small>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {renderAgent911Summary("complete")}

        {renderAgent911Consultation()}

        {renderCompleteSpecificTeasers()}

        <div className="reading-actions complete-reading-actions">
          <button
            className="button button-glass"
            type="button"
            onClick={saveReading}
            disabled={readingSaved}
          >
            {readingSaved ? <Check size={17} /> : <Bookmark size={17} />}
            {readingSaved ? "Ferradura no diário" : "Guardar Ferradura"}
          </button>
          <button className="button button-glass" type="button" onClick={shareReading}>
            <Share2 size={17} />
            Compartilhar leitura
          </button>
          <button
            className="button button-glass"
            type="button"
            onClick={() => {
              setPhase("reading");
              setStatus("Suas três cartas iniciais continuam abertas.");
              navigate("/tiragem-gratis");
            }}
          >
            Voltar às 3 cartas
          </button>
          <button className="text-button" type="button" onClick={restartReading}>
            <RotateCcw size={15} />
            Nova pergunta
          </button>
        </div>
      </div>
    );
  }

  function renderRitualSection(standalone = false) {
    const visiblePhase = phase === "complete" ? "reading" : phase;

    return (
      <section className={`ritual-section ${standalone ? "is-standalone" : ""}`} id="ritual" ref={ritualRef}>
        <div className="ritual-shell">
          <MysticField />
          <div className="free-reading-badge">
            <span aria-hidden="true">✦</span>
            <div>
              <strong>Leitura de apresentação</strong>
              <small>Três cartas + síntese, sem cadastro</small>
            </div>
            <b>Gratuita</b>
          </div>
          <div className="ritual-progress" aria-label="Etapas da leitura">
            {["Intenção", "Escolha", "Leitura"].map((label, index) => {
              const currentIndex = visiblePhase === "intent" ? 0 : visiblePhase === "deck" ? 1 : 2;
              return (
                <div
                  className={`${index === currentIndex ? "is-current" : ""} ${index < currentIndex ? "is-complete" : ""}`}
                  key={label}
                >
                  <span>{index < currentIndex ? <Check size={13} /> : index + 1}</span>
                  <small>{label}</small>
                </div>
              );
            })}
          </div>

          {visiblePhase === "intent" ? renderIntentPhase() : null}
          {visiblePhase === "deck" ? renderDeckPhase() : null}
          {visiblePhase === "reading" ? renderReadingPhase() : null}
          <p className="live-status" aria-live="polite">{status}</p>
        </div>
      </section>
    );
  }

  function renderFreeRoute() {
    return (
      <main className="experience-route-main" id="free-reading-top">
        <section className="experience-route-hero">
          <div>
            <span className="section-kicker">Ritual gratuito · 3 cartas</span>
            <h1>Uma pergunta.<br /><em>Três pontos de verdade.</em></h1>
          </div>
          <p>
            Raiz, espelho e movimento. A mesma experiência da landing, agora em um espaço próprio para você entrar sem distração e continuar depois na Ferradura completa.
          </p>
        </section>
        {renderRitualSection(true)}
      </main>
    );
  }

  function renderCompleteRoute() {
    if (spread.length !== 3 || !createdAt) {
      return (
        <main className="complete-route-main complete-route-empty" id="complete-reading-top">
          <section>
            <div className="complete-empty-symbol" aria-hidden="true"><span>✦</span></div>
            <span className="section-kicker">Ferradura de 7 cartas</span>
            <h1>Esta leitura começa<br /><em>nas três cartas anteriores.</em></h1>
            <p>
              Para manter a pergunta e o fio simbólico, abra primeiro a tiragem gratuita. As quatro novas cartas entram depois, sem trocar nenhuma das escolhas iniciais.
            </p>
            <Link className="button button-primary button-large" to="/tiragem-gratis">
              Começar pelas 3 cartas
              <ArrowRight size={18} />
            </Link>
            <small><ShieldCheck size={15} /> Liberada para testes · sem cadastro e sem cobrança</small>
          </section>
        </main>
      );
    }

    const readingIsComplete = completeSpread.length === 7;

    return (
      <main className="complete-route-main" id="complete-reading-top">
        <section className="complete-route-intro">
          <div>
            <span className="section-kicker">Tiragem completa · Ferradura</span>
            <h1>
              {readingIsComplete ? "O movimento inteiro," : "A mesma pergunta,"}<br />
              <em>{readingIsComplete ? "sem quebrar o fio." : "um novo baralho."}</em>
            </h1>
          </div>
          <p>
            {readingIsComplete
              ? "As três cartas escolhidas foram preservadas. Quatro novos Arcanos completam a leitura em uma página feita para atravessar cada camada com calma."
              : "As três cartas gratuitas continuam seladas. Agora você embaralha os dezenove Arcanos restantes e escolhe, com a própria mão, as quatro posições que completam a leitura."}
          </p>
        </section>
        <section className="ritual-section complete-route-ritual" id="ritual" ref={ritualRef}>
          <div className="ritual-shell">
            <MysticField />
            <div className="free-reading-badge complete-reading-badge">
              <span aria-hidden="true">✦</span>
              <div>
                <strong>{readingIsComplete ? "Ferradura completa" : "Segundo baralho"}</strong>
                <small>{readingIsComplete ? "Sete cartas + síntese integrada" : "3 preservadas + 4 novas escolhas"}</small>
              </div>
              <b>Liberada</b>
            </div>
            {readingIsComplete ? renderCompleteReadingPhase() : renderCompleteDeckPhase()}
            <p className="live-status" aria-live="polite">{status}</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell" data-agent911-ready="true">
      <a className="skip-link" href={isAstroRoute ? "#criar-mapa" : isCompleteRoute ? "#complete-reading-top" : isSpecificRoute ? "#specific-reading-top" : "#ritual"}>
        {isAstroRoute ? "Pular para criar o mapa" : isSpecificRoute ? "Pular para o conteúdo" : "Pular para a leitura"}
      </a>
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      <header className="topbar">
        <Link className="brand" to="/" aria-label="Arcane911, início">
          <span className="brand-mark" aria-hidden="true"><span>✦</span></span>
          <span>
            <strong>Arcane911</strong>
            <small>Projeto Arcano · 10.08.26</small>
          </span>
        </Link>

        <nav className="desktop-nav" aria-label="Navegação principal">
          <Link to="/tiragem-gratis" aria-current={isFreeRoute ? "page" : undefined}>Tarot gratuito</Link>
          <Link to="/mapa-astral" aria-current={isAstroRoute ? "page" : undefined}>Mapa Astral</Link>
          <a href="/#baralho">Os 22 Arcanos</a>
        </nav>

        <div className="topbar-actions">
          <button className="journal-button" type="button" onClick={() => setJournalOpen(true)}>
            <History size={17} />
            <span>Diário</span>
            {journal.length ? <b>{journal.length}</b> : null}
          </button>
          <button
            className="mobile-menu-button"
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={21} />
          </button>
        </div>
      </header>

      {isLanding ? (
      <main>
        <section className="hero" id="top">
          <div className="hero-copy">
            <div className="eyebrow"><span /> Experiência gratuita · Arcanos Maiores</div>
            <h1>O que você ainda não nomeou <em>já deixou um sinal.</em></h1>
            <p className="hero-lead">
              Faça uma leitura de apresentação com três cartas. Sem cadastro, sem cartão e sem respostas genéricas.
            </p>
            <div className="hero-actions">
              <a className="button button-primary button-large" href="#ritual">
                Fazer leitura gratuita
                <ArrowRight size={18} />
              </a>
              <a className="button button-glass button-large" href="#baralho">
                Conhecer o baralho
              </a>
            </div>
            <div className="hero-proof">
              <div><strong>Grátis</strong><span>para sentir a experiência</span></div>
              <div><strong>3</strong><span>posições de leitura</span></div>
              <div><strong>4 min</strong><span>sem cadastro ou cartão</span></div>
            </div>
          </div>

          <div className="hero-visual" aria-label="Cartas A Lua, A Estrela e O Mago">
            <div className="hero-orbit orbit-outer" aria-hidden="true" />
            <div className="hero-orbit orbit-inner" aria-hidden="true" />
            <div className="hero-glow" aria-hidden="true">✦</div>
            <div className="hero-card hero-card-left">
              <TarotCardVisual card={tarotCards[18]} eager />
            </div>
            <div className="hero-card hero-card-center">
              <TarotCardVisual card={tarotCards[17]} eager />
            </div>
            <div className="hero-card hero-card-right">
              <TarotCardVisual card={tarotCards[1]} eager />
            </div>
            <span className="hero-caption"><Sparkles size={14} /> Sistema simbólico Rider–Waite–Smith</span>
          </div>
        </section>

        {renderRitualSection()}

        <section className="origin-section" id="metodo">
          <div className="section-heading split-heading">
            <div>
              <span className="section-kicker">Da corte ao espelho</span>
              <h2>O tarot sempre mudou de forma.<br />A imagem nunca perdeu a função.</h2>
            </div>
            <p>
              O Arcane911 não inventa novos arquétipos. Ele preserva a estrutura dos 22 Arcanos Maiores e redesenha o ritual para a linguagem de agora.
            </p>
          </div>

          <div className="evolution-grid">
            {evolution.map((item, index) => (
              <article key={item.era}>
                <div className="evolution-index">0{index + 1}</div>
                <span>{item.era}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>

          <a
            className="source-link"
            href="https://www.vam.ac.uk/articles/tarot-cards"
            target="_blank"
            rel="noreferrer"
          >
            Base histórica curatorial · Victoria and Albert Museum
            <ArrowUpRight size={15} />
          </a>
        </section>

        <section className="deck-section" id="baralho">
          <div className="section-heading split-heading">
            <div>
              <span className="section-kicker">Coleção I · Arcanos Maiores</span>
              <h2>Vinte e duas portas.<br />A mesma jornada humana.</h2>
            </div>
            <p>
              Cada carta mantém os símbolos canônicos que tornam a leitura intuitiva. Toque em qualquer uma para enxergar a camada de luz, sombra e ação.
            </p>
          </div>

          <div className="deck-gallery">
            {tarotCards.map((card, index) => (
              <div className="gallery-item" key={card.slug} style={{ "--gallery-index": index }}>
                <TarotCardVisual
                  card={card}
                  className="gallery-card"
                  onClick={() => setActiveCard(card)}
                />
              </div>
            ))}
          </div>
          <div className="deck-order" aria-label="Ordem do baralho">
            <span>0 · O Louco</span>
            <i />
            <strong>22 Arcanos · composição ritual 7 · 8 · 7</strong>
            <i />
            <span>XXI · O Mundo</span>
          </div>
        </section>

        <section className="astro-entry-section" id="mapa-astral">
          <div className="astro-entry-copy">
            <span className="section-kicker">Novo espaço · Mapa Astral</span>
            <h2>As cartas capturam o agora.<br /><em>O mapa guarda o instante de chegada.</em></h2>
            <p>
              Descubra Sol, Lua, Ascendente, planetas, casas e aspectos em uma experiência separada — calculada com data, horário e cidade reais.
            </p>
            <div className="astro-entry-proof">
              <span><Check size={15} /> Cálculo real</span>
              <span><ShieldCheck size={15} /> Dados no navegador</span>
              <span><Sparkles size={15} /> Leitura inicial gratuita</span>
            </div>
            <Link className="button button-primary button-large" to="/mapa-astral">
              Criar meu mapa astral
              <ArrowRight size={18} />
            </Link>
          </div>
          <div className="astro-entry-wheel">
            <NatalWheel preview />
          </div>
        </section>

        <section className="closing-section">
          <MysticField compact />
          <div className="closing-symbol" aria-hidden="true"><span>✦</span></div>
          <span className="section-kicker">Sua primeira leitura começa aqui</span>
          <h2>As cartas não decidem.<br />Elas acendem.</h2>
          <p>Experimente três cartas gratuitamente. Se a leitura tocar no ponto certo, aprofunde a mesma pergunta sem começar do zero.</p>
          <a className="button button-primary button-large" href="#ritual">
            Fazer leitura gratuita
            <ArrowRight size={18} />
          </a>
        </section>
      </main>
      ) : null}

      {isFreeRoute ? renderFreeRoute() : null}
      {isCompleteRoute ? renderCompleteRoute() : null}
      {isAstroRoute ? (
        <Suspense fallback={<div className="route-loading"><span>✦</span><p>Alinhando o céu…</p></div>}>
          <AstralMapPage />
        </Suspense>
      ) : null}
      {isSpecificRoute ? (
        <Suspense fallback={<div className="route-loading"><span>✦</span><p>Abrindo a estrutura…</p></div>}>
          <SpecificReadingPage slug={route.split("/")[2]} />
        </Suspense>
      ) : null}
      {!["/", "/tiragem-gratis", "/tiragem-completa", "/mapa-astral"].includes(route) && !isSpecificRoute ? <Navigate to="/" replace /> : null}

      <footer>
        <Link className="brand footer-brand" to="/">
          <span className="brand-mark" aria-hidden="true"><span>✦</span></span>
          <span><strong>Arcane911</strong><small>Projeto Arcano · Fase 1</small></span>
        </Link>
        <p>Uma experiência de reflexão simbólica criada no universo Sorriso Marcado.</p>
        <div className="footer-links">
          <Link to="/tiragem-gratis">Tarot gratuito</Link>
          <Link to="/mapa-astral">Mapa Astral</Link>
          <span>© 2026 · Arcane911</span>
        </div>
      </footer>

      {mobileNavOpen ? (
        <div className="overlay" role="presentation" onMouseDown={() => setMobileNavOpen(false)}>
          <nav className="mobile-nav" aria-label="Navegação móvel" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setMobileNavOpen(false)} aria-label="Fechar menu"><X /></button>
            <Link to="/tiragem-gratis" onClick={() => setMobileNavOpen(false)}>Tarot gratuito <ArrowRight size={18} /></Link>
            <Link to="/mapa-astral" onClick={() => setMobileNavOpen(false)}>Mapa Astral <ArrowRight size={18} /></Link>
            <a href="/#metodo" onClick={() => setMobileNavOpen(false)}>A origem <ArrowRight size={18} /></a>
            <a href="/#baralho" onClick={() => setMobileNavOpen(false)}>Os 22 Arcanos <ArrowRight size={18} /></a>
          </nav>
        </div>
      ) : null}

      {journalOpen ? (
        <div className="overlay" role="presentation" onMouseDown={() => setJournalOpen(false)}>
          <aside className="journal-drawer" role="dialog" aria-modal="true" aria-label="Diário de leituras" onMouseDown={(event) => event.stopPropagation()}>
            <div className="drawer-header">
              <div><span className="section-kicker">Seu rastro</span><h2>Diário de leituras</h2></div>
              <button type="button" onClick={() => setJournalOpen(false)} aria-label="Fechar diário"><X /></button>
            </div>
            {journal.length ? (
              <div className="journal-list">
                {journal.map((record) => {
                  const recordIntent = intents.find((intent) => intent.id === record.intentId) ?? intents[0];
                  const recordCards = record.cards.map((slug) => tarotBySlug[slug]).filter(Boolean);
                  return (
                    <article key={record.id}>
                      <div className="journal-meta">
                        <span>{recordIntent.label}{recordCards.length === 7 ? " · Ferradura" : ""}</span>
                        <small><Clock3 size={13} /> {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(record.createdAt))}</small>
                      </div>
                      <q>{record.question}</q>
                      <div className="journal-cards">
                        {recordCards.map((card) => <span key={card.slug}>{card.name}</span>)}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-journal">
                <History size={28} />
                <h3>Seu diário ainda está em silêncio.</h3>
                <p>Depois de revelar três cartas ou completar a Ferradura, você pode guardar a leitura neste dispositivo.</p>
                <button className="button button-primary" type="button" onClick={() => { setJournalOpen(false); navigate("/tiragem-gratis"); }}>Fazer leitura gratuita</button>
              </div>
            )}
          </aside>
        </div>
      ) : null}

      {checkoutOpen ? (
        <div className="overlay checkout-overlay" role="presentation" onMouseDown={() => setCheckoutOpen(false)}>
          <article
            className="checkout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" type="button" onClick={() => setCheckoutOpen(false)} aria-label="Fechar oferta">
              <X />
            </button>

            <div className="checkout-emblem" aria-hidden="true"><Gem size={28} /></div>
            <span className="section-kicker">{salesConfig.offer.name}</span>
            <h2 id="checkout-title">Continue sem quebrar o fio.</h2>
            <p>{salesConfig.offer.promise}</p>

            {spread.length ? (
              <div className="checkout-reading-context">
                <span>{selectedIntent.label}</span>
                <div>{spread.map((card) => <strong key={card.slug}>{card.name}</strong>)}</div>
              </div>
            ) : null}

            <ul>
              {salesConfig.offer.features.map((feature) => (
                <li key={feature}><Check size={16} /> {feature}</li>
              ))}
            </ul>

            <div className="checkout-total">
              <div><small>Total</small><strong>{salesConfig.offer.price}</strong></div>
              <span>{salesConfig.offer.paymentLabel}<br />sem recorrência</span>
            </div>

            {!checkoutConfigured ? (
              <div className="checkout-setup-note">
                <LockKeyhole size={17} />
                <span><strong>Modo de preparação</strong>Defina <code>VITE_CHECKOUT_URL</code> para ativar o redirecionamento sem alterar o componente.</span>
              </div>
            ) : null}

            <button
              className="button button-primary button-large checkout-button"
              type="button"
              onClick={proceedToCheckout}
              disabled={!checkoutConfigured}
            >
              {checkoutConfigured ? "Ir para o pagamento" : "Checkout pronto para conectar"}
              <ArrowRight size={18} />
            </button>
            <small className="checkout-footnote"><ShieldCheck size={14} /> A pergunta não é enviada ao checkout; apenas o identificador da leitura.</small>
          </article>
        </div>
      ) : null}

      {activeCard ? (
        <div className="overlay card-modal-overlay" role="presentation" onMouseDown={() => setActiveCard(null)}>
          <article className="card-modal" role="dialog" aria-modal="true" aria-label={`Detalhes de ${activeCard.name}`} onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setActiveCard(null)} aria-label="Fechar detalhes"><X /></button>
            <TarotCardVisual card={activeCard} eager />
            <div className="card-modal-copy">
              <span className="section-kicker">{activeCard.roman} · Arcano Maior</span>
              <h2>{activeCard.name}</h2>
              <h3>{activeCard.archetype}</h3>
              <div className="keyword-row">
                {activeCard.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}
              </div>
              <p>{activeCard.message}</p>
              <div className="modal-insight"><span>Sombra</span><p>{activeCard.shadow}</p></div>
              <div className="modal-insight"><span>Convite</span><p>{activeCard.action}</p></div>
              <small><Eye size={14} /> {activeCard.symbols}</small>
              <button className="button button-primary" type="button" onClick={() => {
                setActiveCard(null);
                if (isLanding || isFreeRoute) {
                  document.getElementById("ritual")?.scrollIntoView({ behavior: "smooth" });
                } else {
                  navigate("/tiragem-gratis");
                }
              }}>
                Levar ao ritual <ArrowRight size={17} />
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </div>
  );
}

export default App;
