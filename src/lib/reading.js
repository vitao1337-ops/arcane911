import { completePositions, positions, tarotCards } from "../data/tarot.js";

const intentFrames = {
  caminhos: "Seu caminho não aparece como uma ordem, mas como uma sequência de reconhecimentos.",
  amor: "No campo dos vínculos, a leitura observa reciprocidade, limite e verdade emocional.",
  trabalho: "Na vida profissional, as cartas separam ambição, estrutura e sentido.",
  decisao: "Diante de uma decisão, o tarot não escolhe por você; ele torna visíveis os pesos da escolha.",
  interior: "Esta leitura volta o olhar para dentro, onde desejo, defesa e potência conversam.",
};

function secureRandomUnit() {
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const value = new Uint32Array(1);
    globalThis.crypto.getRandomValues(value);
    return value[0] / 4294967296;
  }

  return Math.random();
}

function shuffledCopy(deck, random) {
  const shuffled = [...deck];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const rawValue = Number(random());
    const unit = Number.isFinite(rawValue)
      ? Math.min(Math.max(rawValue, 0), 0.9999999999999999)
      : secureRandomUnit();
    const swapIndex = Math.floor(unit * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function drawPoolDistance(candidate, previousCards) {
  const previousSlugs = new Set(previousCards.map((card) => card?.slug).filter(Boolean));
  const overlap = candidate.filter((card) => previousSlugs.has(card.slug)).length;
  const samePositions = candidate.filter(
    (card, index) => card.slug === previousCards[index]?.slug,
  ).length;
  return { overlap, samePositions };
}

export function createRandomDrawPool(
  deck = tarotCards,
  requestedCount = 9,
  previousCards = [],
  random = secureRandomUnit,
) {
  const uniqueDeck = deck.filter(
    (card, index, cards) => card?.slug
      && cards.findIndex((candidate) => candidate?.slug === card.slug) === index,
  );
  const count = Math.min(Math.max(Number(requestedCount) || 0, 0), uniqueDeck.length);
  if (!count) return [];

  const comparablePrevious = Array.isArray(previousCards) ? previousCards.slice(0, count) : [];
  if (!comparablePrevious.length) return shuffledCopy(uniqueDeck, random).slice(0, count);

  const minimumPossibleOverlap = Math.max(0, count * 2 - uniqueDeck.length);
  const maximumPreferredOverlap = Math.max(
    minimumPossibleOverlap,
    Math.floor(count * (uniqueDeck.length < count * 2 ? 2 / 3 : 1 / 2)),
  );
  let bestCandidate = [];
  let bestScore = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = shuffledCopy(uniqueDeck, random).slice(0, count);
    const distance = drawPoolDistance(candidate, comparablePrevious);
    const score = distance.overlap * 2 + distance.samePositions * 4;

    if (score < bestScore) {
      bestCandidate = candidate;
      bestScore = score;
    }
    if (distance.overlap <= maximumPreferredOverlap && distance.samePositions <= 1) {
      return candidate;
    }
  }

  return bestCandidate;
}

export function buildCompleteSpreadFromSelections(openingCards, selectedCards) {
  const uniqueOpeningCards = openingCards.filter(
    (card, index, cards) => card && cards.findIndex((item) => item?.slug === card.slug) === index,
  );
  const openingSlugs = new Set(uniqueOpeningCards.map((card) => card.slug));
  const uniqueSelectedCards = selectedCards.filter(
    (card, index, cards) => card
      && !openingSlugs.has(card.slug)
      && cards.findIndex((item) => item?.slug === card.slug) === index,
  );

  if (uniqueOpeningCards.length !== 3 || uniqueSelectedCards.length !== 4) return [];

  const [hidden, obstacle, external, outcome] = uniqueSelectedCards;

  return [
    uniqueOpeningCards[0],
    uniqueOpeningCards[1],
    hidden,
    obstacle,
    external,
    uniqueOpeningCards[2],
    outcome,
  ];
}

export function cardReading(card, positionId) {
  const positionOpenings = {
    root: `${card.name} mostra a raiz desta história: ${card.archetype.toLowerCase()}.`,
    mirror: `${card.name} ocupa o centro e funciona como espelho: ${card.archetype.toLowerCase()}.`,
    movement: `${card.name} aponta a qualidade do próximo movimento: ${card.archetype.toLowerCase()}.`,
  };

  return `${positionOpenings[positionId]} ${card.message}`;
}

export function completeCardReading(card, positionId) {
  const readings = {
    past: `${card.name} aparece na origem da questão como ${card.archetype.toLowerCase()}. ${card.message}`,
    present: `${card.name} descreve o presente e pede contato com ${card.keywords[0]}. ${card.message}`,
    hidden: `${card.name} atua abaixo do que está evidente. O tema oculto passa por ${card.keywords[1]}: ${card.message}`,
    obstacle: `${card.name} ocupa o nó central desta Ferradura. Aqui, a atenção vai para a sombra da carta: ${card.shadow}`,
    external: `${card.name} mostra a força do ambiente sobre a pergunta. Pessoas, circunstâncias ou expectativas externas ativam ${card.archetype.toLowerCase()}. ${card.message}`,
    action: `${card.name} aponta a resposta mais fértil ao cenário. O movimento concreto é este: ${card.action}`,
    outcome: `${card.name} encerra a Ferradura como direção provável, não como destino fixo. ${card.message}`,
  };

  return readings[positionId] ?? card.message;
}

export function buildSynthesis(cards, intentId) {
  const [root, mirror, movement] = cards;
  const frame = intentFrames[intentId] ?? intentFrames.caminhos;

  return `${frame} A sequência vai de ${root.keywords[0]} para ${mirror.keywords[0]} e encontra saída em ${movement.keywords[0]}. O ponto decisivo não é prever o que acontecerá, mas perceber o que muda quando você pratica isto: ${movement.action}`;
}

export function buildCompleteSynthesis(cards, intentId) {
  if (cards.length !== 7) return "";

  const [past, present, hidden, obstacle, external, action, outcome] = cards;
  const frame = intentFrames[intentId] ?? intentFrames.caminhos;

  const terrain = `${frame} ${past.name} mostra que a pergunta nasce de ${past.keywords[0]}, enquanto ${present.name} coloca ${present.keywords[0]} no centro do agora. O presente não apaga a origem; ele revela qual parte dela ainda está ativa.`;
  const undercurrent = `Por baixo do que está evidente, ${hidden.name} movimenta ${hidden.keywords[1]}. O nó aparece em ${obstacle.name}, especialmente quando ${obstacle.shadow.toLowerCase()} Ao redor, ${external.name} lembra que o cenário também é atravessado por ${external.keywords[0]} — nem tudo começou ou termina somente em você.`;
  const crossing = `A travessia se torna concreta com ${action.name}: ${action.action} Se esse gesto for sustentado, ${outcome.name} aponta uma direção de ${outcome.keywords[0]}. Trate essa última carta como tendência do caminho atual e como medida para escolher conscientemente o próximo passo.`;

  return [terrain, undercurrent, crossing].join("\n\n");
}

export function formatReading({ cards, intentId, intentLabel, question, createdAt }) {
  const date = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(createdAt));

  const cardLines = cards
    .map((card, index) => {
      const position = positions[index];
      return `${position.eyebrow} — ${card.name}\n${cardReading(card, position.id)}\nConvite: ${card.action}`;
    })
    .join("\n\n");

  return `ARCANE911 · LEITURA DE ${intentLabel.toUpperCase()}\n${date}\n\nPergunta: ${question}\n\n${cardLines}\n\nSíntese\n${buildSynthesis(cards, intentId)}\n\nUse a leitura como reflexão, não como sentença.`;
}

export function formatCompleteReading({ cards, intentId, intentLabel, question, createdAt }) {
  const date = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(createdAt));

  const cardLines = cards
    .map((card, index) => {
      const position = completePositions[index];
      return `${position.number} · ${position.eyebrow} — ${card.name}\n${completeCardReading(card, position.id)}\nPergunta-chave: ${position.prompt}\nConvite: ${card.action}`;
    })
    .join("\n\n");

  return `ARCANE911 · FERRADURA DE 7 CARTAS · ${intentLabel.toUpperCase()}\n${date}\n\nPergunta: ${question}\n\n${cardLines}\n\nSíntese completa\n${buildCompleteSynthesis(cards, intentId)}\n\nUse a leitura como reflexão, não como sentença.`;
}
