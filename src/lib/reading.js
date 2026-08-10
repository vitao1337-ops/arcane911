import { positions, tarotCards } from "../data/tarot.js";

const intentFrames = {
  caminhos: "Seu caminho não aparece como uma ordem, mas como uma sequência de reconhecimentos.",
  amor: "No campo dos vínculos, a leitura observa reciprocidade, limite e verdade emocional.",
  trabalho: "Na vida profissional, as cartas separam ambição, estrutura e sentido.",
  decisao: "Diante de uma decisão, o tarot não escolhe por você; ele torna visíveis os pesos da escolha.",
  interior: "Esta leitura volta o olhar para dentro, onde desejo, defesa e potência conversam.",
};

export function hashString(value) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed;

  return () => {
    state += 0x6d2b79f5;
    let result = state;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickSpread(seedSource, deck = tarotCards) {
  const random = mulberry32(hashString(String(seedSource)));
  const shuffled = [...deck];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled.slice(0, 3);
}

export function cardReading(card, positionId) {
  const positionOpenings = {
    root: `${card.name} mostra a raiz desta história: ${card.archetype.toLowerCase()}.`,
    mirror: `${card.name} ocupa o centro e funciona como espelho: ${card.archetype.toLowerCase()}.`,
    movement: `${card.name} aponta a qualidade do próximo movimento: ${card.archetype.toLowerCase()}.`,
  };

  return `${positionOpenings[positionId]} ${card.message}`;
}

export function buildSynthesis(cards, intentId) {
  const [root, mirror, movement] = cards;
  const frame = intentFrames[intentId] ?? intentFrames.caminhos;

  return `${frame} A sequência vai de ${root.keywords[0]} para ${mirror.keywords[0]} e encontra saída em ${movement.keywords[0]}. O ponto decisivo não é prever o que acontecerá, mas perceber o que muda quando você pratica isto: ${movement.action}`;
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
