import { completePositions, positions } from "../data/tarot.js";

const intentVoice = {
  caminhos: "a direção que você procura",
  amor: "o vínculo que ocupa sua pergunta",
  trabalho: "o movimento profissional que está em jogo",
  decisao: "a escolha que você tenta organizar",
  interior: "o processo interno que pede nome",
};

function cleanQuestion(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > 190 ? `${text.slice(0, 187).trimEnd()}…` : text;
}

function emptyMemoryUpdate() {
  return { summary: "", themes: [], people: [] };
}

function needsImmediateSafety(text) {
  return /(?:suic[ií]d|me matar|tirar minha vida|matar alguém|agredir alguém|estou em perigo|risco imediato|violência agora)/iu.test(text);
}

function buildSafetyFallback(personalText) {
  return {
    responseMode: "safety",
    title: "Sua segurança vem antes da leitura.",
    opening: personalText ? `Você trouxe: “${personalText}”` : "O que você trouxe pede apoio humano agora.",
    sections: [],
    synthesis: "O tarot não é a ferramenta certa para atravessar um risco imediato. Afaste-se do perigo, procure agora uma pessoa de confiança que possa ficar com você e acione o serviço de emergência da sua região.",
    groundedAction: "Não fique só com isso: peça companhia e ajuda humana imediata.",
    closingQuestion: "",
    suggestedQuestions: [],
    safetyMessage: "Em uma emergência, interrompa a consulta e procure ajuda local agora.",
    memoryUpdate: emptyMemoryUpdate(),
    audit: { usedCardSlugs: [], confidence: "needs_context", unsupportedCertainty: false },
  };
}

export function buildAgent911Fallback({ cards, intentId, question, variant = "opening" }) {
  const selected = Array.isArray(cards) ? cards.filter(Boolean) : [];
  const slugs = selected.map((card) => card.slug);
  const personalQuestion = cleanQuestion(question);
  const field = intentVoice[intentId] ?? intentVoice.caminhos;

  if (needsImmediateSafety(personalQuestion)) return buildSafetyFallback(personalQuestion);

  if (variant === "complete" && selected.length === 7) {
    const [origin, present, hidden, obstacle, external, action, outcome] = selected;
    return {
      responseMode: "reading",
      title: "Sua pergunta não pede pressa. Pede posição.",
      opening: personalQuestion ? `Você perguntou: “${personalQuestion}”` : "Esta foi a pergunta colocada diante da mesa.",
      sections: [{
        id: "ferradura",
        title: "O movimento inteiro",
        text: `${origin.name} e ${present.name} ligam a origem ao agora; ${hidden.name}, ${obstacle.name} e ${external.name} mostram o que atua por baixo e ao redor; ${action.name} abre o gesto que conduz a ${outcome.name}.`,
        cardSlugs: slugs,
      }],
      synthesis: `${origin.name} mostra que ${field} nasceu de ${origin.keywords[0]}, mas ${present.name} desloca o centro para ${present.keywords[0]}. O ponto mais íntimo da mesa está entre ${hidden.name} e ${obstacle.name}: existe algo operando em silêncio que perde força quando você deixa de tratá-lo como inevitável. ${external.name} lembra que nem toda pressão é sua. A resposta mais fértil vem de ${action.name}; sustentada na prática, ela abre em ${outcome.name} uma direção de ${outcome.keywords[0]}, não como promessa, mas como consequência possível do caminho escolhido.`,
      groundedAction: action.action,
      closingQuestion: completePositions[5].prompt ?? "",
      suggestedQuestions: [],
      safetyMessage: "",
      memoryUpdate: emptyMemoryUpdate(),
      audit: { usedCardSlugs: slugs, confidence: "grounded", unsupportedCertainty: false },
    };
  }

  const [root, mirror, movement] = selected;
  if (!root || !mirror || !movement) return null;

  return {
    responseMode: "reading",
    title: "O centro da sua pergunta já mudou.",
    opening: personalQuestion ? `Você perguntou: “${personalQuestion}”` : "Esta foi a pergunta colocada diante da mesa.",
    sections: [{
      id: "abertura",
      title: "O desenho das três cartas",
      text: `${root.name}, ${mirror.name} e ${movement.name} formam uma passagem única.`,
      cardSlugs: slugs,
    }],
    synthesis: `${root.name} mostra que ${field} começa em ${root.keywords[0]}; ${mirror.name}, no centro, revela que o impasse verdadeiro toca ${mirror.keywords[0]}. A saída não está em forçar uma certeza. ${movement.name} pede que você transforme a percepção em gesto: sua pergunta deixa de buscar apenas um resultado e passa a mostrar o que depende de você agora.`,
    groundedAction: movement.action,
    closingQuestion: positions[2].prompt ?? "",
    suggestedQuestions: [],
    safetyMessage: "",
    memoryUpdate: emptyMemoryUpdate(),
    audit: { usedCardSlugs: slugs, confidence: "grounded", unsupportedCertainty: false },
  };
}

export function buildAgent911FollowUpFallback({ cards, message }) {
  const selected = Array.isArray(cards) ? cards.filter(Boolean) : [];
  const anchor = selected.length === 7 ? selected[5] : selected.at(-1);
  const tension = selected.length === 7 ? selected[3] : selected[1];
  const personalMessage = cleanQuestion(message);
  if (needsImmediateSafety(personalMessage)) return buildSafetyFallback(personalMessage);
  const slugs = [tension, anchor].filter(Boolean).map((card) => card.slug);

  return {
    responseMode: "reading",
    title: "A sua pergunta volta ao ponto de escolha.",
    opening: personalMessage ? `Você trouxe agora: “${personalMessage}”` : "Você voltou à mesma mesa por outro ângulo.",
    sections: [{
      id: "retorno",
      title: "O que a mesa mantém",
      text: `${tension?.name ?? "A carta central"} preserva a tensão; ${anchor?.name ?? "a carta de movimento"} mostra onde sua agência reaparece.`,
      cardSlugs: slugs,
    }],
    synthesis: `A mesa não transforma sua sensação em prova sobre outra pessoa. Ela mostra que ${tension?.keywords?.[0] ?? "o conflito"} precisa ser separado do que você de fato observou. A resposta fica mais nítida quando você usa ${anchor?.name ?? "o movimento final"} como medida para decidir o próximo gesto, sem esperar uma garantia impossível.`,
    groundedAction: anchor?.action ?? "Escreva o que é fato, o que é receio e qual limite você consegue sustentar agora.",
    closingQuestion: "Qual parte dessa situação depende de uma conversa, e qual depende de um limite seu?",
    suggestedQuestions: [],
    safetyMessage: "",
    memoryUpdate: emptyMemoryUpdate(),
    audit: { usedCardSlugs: slugs, confidence: "grounded", unsupportedCertainty: false },
  };
}
