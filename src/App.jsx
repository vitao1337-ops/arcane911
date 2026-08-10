import { useEffect, useMemo, useRef, useState } from "react";
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
import { intents, positions, tarotBySlug, tarotCards } from "./data/tarot";
import { salesConfig } from "./config/sales";
import {
  buildCheckoutUrl,
  isCheckoutConfigured,
  trackCommercialEvent,
} from "./lib/checkout";
import {
  buildSynthesis,
  cardReading,
  formatReading,
  hashString,
} from "./lib/reading";

const STORAGE_KEY = "arcane911.readings.v1";

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
    eyebrow: "Carta oculta",
    title: "O padrão que opera por baixo da pergunta",
  },
  {
    eyebrow: "Tensão central",
    title: "O ponto que pode repetir ou travar o movimento",
  },
  {
    eyebrow: "Integração",
    title: "Uma direção prática para os próximos sete dias",
  },
];

function getStoredJournal() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(stored) ? stored : [];
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
  const [phase, setPhase] = useState("intent");
  const [intentId, setIntentId] = useState("caminhos");
  const [question, setQuestion] = useState("");
  const [drawPool, setDrawPool] = useState([]);
  const [selectedCards, setSelectedCards] = useState([]);
  const [spread, setSpread] = useState([]);
  const [isShuffling, setIsShuffling] = useState(false);
  const [createdAt, setCreatedAt] = useState(null);
  const [journal, setJournal] = useState(getStoredJournal);
  const [journalOpen, setJournalOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeCard, setActiveCard] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [status, setStatus] = useState("");
  const timerRef = useRef(null);
  const ritualRef = useRef(null);

  const selectedIntent = useMemo(
    () => intents.find((intent) => intent.id === intentId) ?? intents[0],
    [intentId],
  );

  const resolvedQuestion = question.trim() || selectedIntent.prompt;
  const readingSaved = createdAt ? journal.some((record) => record.id === createdAt) : false;
  const checkoutConfigured = isCheckoutConfigured(salesConfig.checkoutUrl);

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
    setDrawPool([]);
    setSelectedCards([]);
    setSpread([]);
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
    const seed = `${resolvedQuestion}-${intentId}-${Date.now()}`;

    timerRef.current = window.setTimeout(() => {
      const orderedDeck = [...tarotCards]
        .sort(
          (cardA, cardB) =>
            hashString(`${seed}-${cardA.slug}`) - hashString(`${seed}-${cardB.slug}`),
        )
        .slice(0, 9);
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
    trackCommercialEvent("free_reading_completed", {
      intent: intentId,
      cards: selectedCards.map((card) => card.slug).join(","),
    });
    moveToRitual();
  }

  function restartReading() {
    setPhase("intent");
    setQuestion("");
    setDrawPool([]);
    setSelectedCards([]);
    setSpread([]);
    setCreatedAt(null);
    setStatus("");
    moveToRitual();
  }

  function saveReading() {
    if (!createdAt || spread.length !== 3 || readingSaved) return;

    const record = {
      id: createdAt,
      createdAt,
      intentId,
      question: resolvedQuestion,
      cards: spread.map((card) => card.slug),
    };
    const nextJournal = [record, ...journal].slice(0, 24);
    setJournal(nextJournal);
    saveStoredJournal(nextJournal);
    setStatus("Leitura guardada neste dispositivo.");
  }

  async function shareReading() {
    if (!createdAt || spread.length !== 3) return;
    const text = formatReading({
      cards: spread,
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
              onChange={(event) => setQuestion(event.target.value.slice(0, 220))}
              placeholder={selectedIntent.prompt}
              rows="4"
            />
            <small>{question.length}/220 · se deixar em branco, usamos a pergunta sugerida</small>
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

        <article className="synthesis-card">
          <div className="synthesis-orb" aria-hidden="true">✦</div>
          <div>
            <span className="section-kicker">Síntese Arcane911</span>
            <h3>O desenho entre as cartas</h3>
            <p>{buildSynthesis(spread, intentId)}</p>
            <small>Tarot é linguagem de reflexão, não sentença nem substituto de orientação profissional.</small>
          </div>
        </article>

        <section className="conversion-gate" aria-labelledby="deep-reading-title">
          <div className="premium-preview" aria-hidden="true">
            <div className="premium-preview-orbit"><Gem size={22} /></div>
            {premiumLayers.map((layer, index) => (
              <article key={layer.eyebrow} style={{ "--premium-index": index }}>
                <span><LockKeyhole size={14} /></span>
                <div>
                  <small>{layer.eyebrow}</small>
                  <strong>{layer.title}</strong>
                </div>
              </article>
            ))}
          </div>

          <div className="conversion-copy">
            <span className="section-kicker">Sua leitura gratuita termina aqui</span>
            <h3 id="deep-reading-title">O sinal apareceu.<br />Agora falta entender o movimento inteiro.</h3>
            <p>
              A leitura profunda continua exatamente desta pergunta e destas três cartas. Ela revela o padrão oculto, a tensão que pode repetir a história e uma direção prática para os próximos sete dias.
            </p>

            <ul>
              {salesConfig.offer.features.map((feature) => (
                <li key={feature}><Check size={15} /> {feature}</li>
              ))}
            </ul>

            <div className="offer-line">
              <div>
                <small>{salesConfig.offer.paymentLabel}</small>
                <strong>{salesConfig.offer.price}</strong>
              </div>
              <button className="button button-primary button-large" type="button" onClick={openCheckout}>
                Aprofundar esta leitura
                <ArrowRight size={18} />
              </button>
            </div>

            <div className="offer-trust">
              <span><ShieldCheck size={14} /> Sem assinatura</span>
              <span><CreditCard size={14} /> Pagamento único</span>
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

  return (
    <div className="app-shell">
      <a className="skip-link" href="#ritual">Pular para a leitura</a>
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      <header className="topbar">
        <a className="brand" href="#top" aria-label="Arcane911, início">
          <span className="brand-mark" aria-hidden="true"><span>✦</span></span>
          <span>
            <strong>Arcane911</strong>
            <small>Projeto Arcano · 10.08.26</small>
          </span>
        </a>

        <nav className="desktop-nav" aria-label="Navegação principal">
          <a href="#ritual">Leitura gratuita</a>
          <a href="#metodo">A origem</a>
          <a href="#baralho">Os 22 Arcanos</a>
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

        <section className="ritual-section" id="ritual" ref={ritualRef}>
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
                const currentIndex = phase === "intent" ? 0 : phase === "deck" ? 1 : 2;
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

            {phase === "intent" ? renderIntentPhase() : null}
            {phase === "deck" ? renderDeckPhase() : null}
            {phase === "reading" ? renderReadingPhase() : null}

            <p className="live-status" aria-live="polite">{status}</p>
          </div>
        </section>

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

      <footer>
        <a className="brand footer-brand" href="#top">
          <span className="brand-mark" aria-hidden="true"><span>✦</span></span>
          <span><strong>Arcane911</strong><small>Projeto Arcano · Fase 1</small></span>
        </a>
        <p>Uma experiência de reflexão simbólica criada no universo Sorriso Marcado.</p>
        <span>© 2026 · 22 Arcanos Maiores</span>
      </footer>

      {mobileNavOpen ? (
        <div className="overlay" role="presentation" onMouseDown={() => setMobileNavOpen(false)}>
          <nav className="mobile-nav" aria-label="Navegação móvel" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setMobileNavOpen(false)} aria-label="Fechar menu"><X /></button>
            <a href="#ritual" onClick={() => setMobileNavOpen(false)}>Leitura gratuita <ArrowRight size={18} /></a>
            <a href="#metodo" onClick={() => setMobileNavOpen(false)}>A origem <ArrowRight size={18} /></a>
            <a href="#baralho" onClick={() => setMobileNavOpen(false)}>Os 22 Arcanos <ArrowRight size={18} /></a>
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
                        <span>{recordIntent.label}</span>
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
                <p>Depois de revelar três cartas, você pode guardar a leitura neste dispositivo.</p>
                <button className="button button-primary" type="button" onClick={() => setJournalOpen(false)}>Fazer leitura gratuita</button>
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
              <button className="button button-primary" type="button" onClick={() => { setActiveCard(null); document.getElementById("ritual")?.scrollIntoView({ behavior: "smooth" }); }}>
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
