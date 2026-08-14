import { completePositions, positions } from "../data/tarot.js";
import { buildSpecificLayout, specificReadingsBySlug } from "../data/products.js";
import { buildRelationshipMap, getCanonicalCard } from "../../server/tarot-canon.js";

const intentLabels = {
  caminhos: "o caminho que você está tentando escolher",
  amor: "esse vínculo",
  trabalho: "seu movimento profissional",
  decisao: "essa decisão",
  interior: "o que está acontecendo dentro de você",
};

const stopWords = new Set([
  "agora", "ainda", "alguma", "algum", "antes", "aquela", "aquele", "aquilo",
  "como", "coisa", "comigo", "depois", "dessa", "desse", "disso", "entao",
  "essa", "esse", "esta", "este", "estou", "fazer", "isso", "mais", "mesmo",
  "minha", "muito", "nessa", "nesse", "nisso", "onde", "outra", "outro",
  "para", "pela", "pelo", "porque", "preciso", "qual", "quando", "quero",
  "saber", "seria", "sobre", "tenho", "tentar", "toda", "todo", "vale", "voce",
]);

const titleBanks = {
  return: [
    "Voltar só faz sentido se a forma antiga não voltar junto.",
    "A saudade não pode decidir o que os fatos ainda não sustentam.",
    "Esse vínculo pede mudança concreta, não apenas reaproximação.",
  ],
  ending: [
    "O fim mais difícil é aquele que ainda recebe pequenas esperanças.",
    "Seguir em frente começa quando o limite deixa de ser negociado.",
    "Nem todo vínculo precisa continuar para ter sido verdadeiro.",
  ],
  trust: [
    "Sensação merece escuta; certeza exige evidência.",
    "O que inquieta você precisa de clareza, não de investigação infinita.",
    "A verdade dessa história será medida por atos.",
  ],
  work: [
    "O próximo passo profissional precisa caber na vida que você quer viver.",
    "Crescer não é aceitar qualquer preço em nome da oportunidade.",
    "Seu trabalho pede direção antes de pedir velocidade.",
  ],
  money: [
    "Dinheiro resolve uma parte; o preço invisível decide o resto.",
    "A proposta só é boa quando o ganho e o custo podem ser nomeados.",
    "Não confunda alívio imediato com escolha sustentável.",
  ],
  friendship: [
    "Afeto sem limite pode virar uma forma silenciosa de desgaste.",
    "Essa amizade precisa comportar reciprocidade, não apenas disponibilidade.",
    "O limite revela se existe vínculo ou apenas acesso a você.",
  ],
  family: [
    "Pertencer não exige carregar sozinho o peso da família.",
    "O vínculo familiar também precisa reconhecer seus limites.",
    "Cuidar não é desaparecer dentro da necessidade do outro.",
  ],
  creation: [
    "A criação travou onde cobrança e desejo deixaram de conversar.",
    "Seu projeto não precisa nascer perfeito; precisa voltar a respirar.",
    "O bloqueio perde força quando a criação volta a ser gesto.",
  ],
  inner: [
    "O que você sente não precisa ser julgado antes de ser compreendido.",
    "Uma parte sua cansou de existir apenas sob controle.",
    "A resposta começa onde você para de se abandonar.",
  ],
  decision: [
    "A escolha real está no preço que cada caminho cobra.",
    "Decidir também é parar de negociar com o que já ficou claro.",
    "Não é só escolher um lado; é escolher o que você consegue sustentar.",
  ],
  path: [
    "O próximo passo aparece quando o conflito ganha um nome.",
    "A mesa não pede pressa; pede uma posição que você consiga sustentar.",
    "A direção muda quando você deixa de pedir garantia ao caminho.",
  ],
};

function cleanQuestion(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > 240 ? `${text.slice(0, 237).trimEnd()}…` : text;
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function lowerFirst(value) {
  const text = String(value ?? "").trim();
  return text ? `${text.charAt(0).toLowerCase()}${text.slice(1)}` : "";
}

function sentence(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return /[.!?…]$/.test(text) ? text : `${text}.`;
}

function clause(value) {
  return lowerFirst(value).replace(/[.!?…]+$/u, "");
}

function inSituation(value) {
  const text = String(value ?? "").trim();
  const replacements = [
    [/^a\s+/i, "na "],
    [/^as\s+/i, "nas "],
    [/^o\s+/i, "no "],
    [/^os\s+/i, "nos "],
    [/^essa\s+/i, "nessa "],
    [/^esse\s+/i, "nesse "],
    [/^esta\s+/i, "nesta "],
    [/^este\s+/i, "neste "],
    [/^sua\s+/i, "na sua "],
    [/^seu\s+/i, "no seu "],
  ];
  const match = replacements.find(([pattern]) => pattern.test(text));
  return match ? text.replace(match[0], match[1]) : `em ${text}`;
}

function ofSituation(value) {
  const text = String(value ?? "").trim();
  const replacements = [
    [/^a\s+/i, "da "],
    [/^as\s+/i, "das "],
    [/^o\s+/i, "do "],
    [/^os\s+/i, "dos "],
    [/^essa\s+/i, "dessa "],
    [/^esse\s+/i, "desse "],
    [/^esta\s+/i, "desta "],
    [/^este\s+/i, "deste "],
    [/^sua\s+/i, "da sua "],
    [/^seu\s+/i, "do seu "],
  ];
  const match = replacements.find(([pattern]) => pattern.test(text));
  return match ? text.replace(match[0], match[1]) : `de ${text}`;
}

function stableIndex(seed, length) {
  let hash = 2166136261;
  for (const character of String(seed)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % Math.max(1, length);
}

function pick(bank, seed) {
  return bank[stableIndex(seed, bank.length)];
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

function questionTerms(text) {
  return normalize(text)
    .replace(/[^a-z0-9ç\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !stopWords.has(word))
    .slice(0, 5);
}

function analyzeQuestion(question, intentId = "caminhos") {
  const original = cleanQuestion(question);
  const text = normalize(original);
  const terms = questionTerms(original);
  const anchor = original
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .find((word) => terms.includes(normalize(word))) ?? "";
  const has = (pattern) => pattern.test(text);
  let theme = intentId === "amor" ? "relationship"
    : intentId === "trabalho" ? "work"
      : intentId === "interior" ? "inner"
        : intentId === "decisao" ? "decision"
          : "path";

  if (has(/\b(amig|amizade)\w*/)) theme = "friendship";
  else if (has(/\b(famil|mae|pai|irma|filh)\w*/)) theme = "family";
  else if (has(/\b(criar|criativ|projeto|obra|escrever|arte)\w*/)) theme = "creation";
  else if (has(/\b(dinheiro|financeir|salario|paga|renda|divida|proposta)\w*/)) theme = "money";
  else if (has(/\b(trabalho|emprego|carreira|profissional|cliente|negocio)\w*/)) theme = "work";
  else if (has(/\b(relacao|relacionamento|amor|namor|ex\b|casamento|vinculo)\w*/)) theme = "relationship";

  let situation = intentLabels[intentId] ?? intentLabels.caminhos;
  let titleKey = theme;
  if (has(/\b(voltar|retomar|reatar|reconcili)\w*/)) {
    situation = "a possibilidade de retomar esse vínculo";
    titleKey = "return";
  } else if (has(/\b(terminar|separar|encerrar|seguir em frente|deixar para tras)\b/)) {
    situation = "o limite entre insistir e seguir em frente";
    titleKey = "ending";
  } else if (has(/\b(trai|menti|segredo|confia|senha|suspeit)\w*/)) {
    situation = "a diferença entre o que você sente e o que consegue verificar nesse vínculo";
    titleKey = "trust";
  } else if (has(/\b(proposta|salario|dinheiro|paga mais|financeir)\w*/)) {
    situation = "a escolha implicada nessa proposta entre ganho material e custo pessoal";
    titleKey = "money";
  } else if (has(/\b(carreira|emprego|trabalho|profissional)\w*/)) {
    situation = has(/\b(carreira)\w*/) ? "essa mudança de carreira" : "esse movimento profissional";
    titleKey = "work";
  } else if (theme === "friendship") {
    situation = "a dinâmica de limite e reciprocidade nessa amizade";
  } else if (theme === "family") {
    situation = "o peso que você assumiu nessa relação familiar";
  } else if (theme === "creation") {
    situation = "o bloqueio que separa sua vontade desse projeto criativo";
  } else if (theme === "relationship") {
    situation = "a reciprocidade e o limite nesse vínculo";
  } else if (theme === "inner") {
    situation = "a parte sua que está pedindo escuta";
  }

  if (has(/\b(conversa|dialog|falar)\w*/) && !has(/\b(trai|menti|segredo|confia|suspeit)\w*/)) {
    situation = "a conversa que você vem evitando";
  } else if (situation === (intentLabels[intentId] ?? intentLabels.caminhos) && anchor) {
    situation = `${situation} em torno de “${anchor}”`;
  }
  const mode = has(/\b(por que|porque)\b/) ? "cause"
    : has(/\b(como)\b/) ? "method"
      : has(/\b(devo|vale a pena|entre|escolh|decid|ou)\w*/) ? "decision"
        : has(/\b(vai|quando|futuro|acontecer)\w*/) ? "future"
          : "insight";
  if (titleKey === "path" && mode === "decision") titleKey = "decision";

  let pressure = "sem entregar sua escolha à ansiedade por uma resposta definitiva";
  if (has(/\b(desgast|cansa|esgota|suga)\w*/)) pressure = "sem repetir o desgaste que você já conseguiu reconhecer";
  else if (has(/\b(medo|receio|insegur|ansied)\w*/)) pressure = "sem deixar o medo decidir sozinho";
  else if (has(/\b(paz|saude|sono|corpo)\w*/)) pressure = "sem pagar com a sua paz pelo resultado";
  else if (has(/\b(adiando|procrast|travando|bloque)\w*/)) pressure = "sem confundir proteção com paralisia";
  else if (has(/\b(culpa|obrig|dever)\w*/)) pressure = "sem transformar culpa em compromisso";
  if (anchor && !terms.some((term) => normalize(`${situation} ${pressure}`).includes(term))) {
    situation = `${situation}, especialmente no ponto de “${anchor}”`;
  }

  return {
    original,
    text,
    terms,
    theme,
    titleKey,
    mode,
    situation,
    pressure,
  };
}

function canonicalCards(cards, intentId) {
  return cards.map((card) => ({ card, canon: getCanonicalCard(card.slug, intentId) }));
}

function relationshipSentence(cards, intentId, preferredIndexes = []) {
  const relationships = buildRelationshipMap(cards.map((card) => card.slug), intentId);
  const preferredSlugs = new Set(preferredIndexes.map((index) => cards[index]?.slug).filter(Boolean));
  const ordered = [...relationships].sort((first, second) => {
    const firstScore = first.curated ? 20 : first.cards.filter((slug) => preferredSlugs.has(slug)).length * 4;
    const secondScore = second.curated ? 20 : second.cards.filter((slug) => preferredSlugs.has(slug)).length * 4;
    return secondScore - firstScore;
  });
  return ordered[0]?.note ?? "As cartas formam uma passagem que precisa ser lida como conjunto.";
}

function buildOpeningReading(selected, intentId, profile) {
  const [{ card: root, canon: rootCanon }, { card: mirror, canon: mirrorCanon }, { card: movement, canon: movementCanon }] = canonicalCards(selected, intentId);
  const slugs = selected.map((card) => card.slug);
  const seed = `${profile.original}:${slugs.join(":")}`;
  const relation = relationshipSentence(selected, intentId, [1, 2]);
  const modeLead = {
    cause: "O “por quê” da sua pergunta não aponta para falta de vontade; aponta para a função que esse impasse ainda cumpre.",
    method: "O “como” não começa numa fórmula pronta, mas no ponto em que você recupera margem de ação.",
    decision: `A mesa não escolhe por você: ela revela o critério que impede ${profile.situation} de virar apenas impulso.`,
    future: "As cartas não fecham o futuro; mostram o tipo de escolha que está construindo a direção atual.",
    insight: `O centro desta leitura não é adivinhar um resultado, mas enxergar o mecanismo que mantém ${profile.situation}.`,
  }[profile.mode];

  const title = pick(titleBanks[profile.titleKey] ?? titleBanks.path, seed);
  const sectionText = `${root.name}, na raiz, ${clause(rootCanon?.movement ?? root.message)}. ${mirror.name} muda o foco: ${clause(mirrorCanon?.intentLens ?? mirror.message)}. ${relation}`;
  const synthesis = `${modeLead} ${root.name} mostra de onde a história ganhou força; ${mirror.name} expõe o ponto que você já percebe, mas talvez ainda tente resolver só pela cabeça. ${movement.name} desloca a leitura para um gesto: ${sentence(clause(movementCanon?.movement ?? movement.action))} É ${inSituation(profile.situation)} que você precisa testar esse movimento, ${profile.pressure}.`;

  return {
    responseMode: "reading",
    title,
    opening: profile.original ? `Você perguntou: “${profile.original}”` : "Esta foi a pergunta colocada diante da mesa.",
    sections: [{ id: "abertura", title: "O ponto vivo da mesa", text: sectionText, cardSlugs: slugs }],
    synthesis,
    groundedAction: `${sentence(movement.action)} Use esse gesto diante ${ofSituation(profile.situation)}.`,
    closingQuestion: positions[2].title,
    suggestedQuestions: [],
    safetyMessage: "",
    memoryUpdate: emptyMemoryUpdate(),
    audit: { usedCardSlugs: slugs, confidence: "grounded", unsupportedCertainty: false },
  };
}

function buildCompleteReading(selected, intentId, profile) {
  const interpreted = canonicalCards(selected, intentId);
  const [origin, present, hidden, obstacle, external, action, outcome] = interpreted;
  const slugs = selected.map((card) => card.slug);
  const seed = `${profile.original}:${slugs.join(":")}:complete`;
  const undergroundRelation = relationshipSentence(selected, intentId, [2, 3, 4]);
  const directionRelation = relationshipSentence([selected[3], selected[5], selected[6]], intentId, [0, 1, 2]);
  const title = pick(titleBanks[profile.titleKey] ?? titleBanks.path, seed);
  const sectionText = `${origin.card.name} e ${present.card.name} mostram a passagem entre o que formou a pergunta e o que exige resposta agora. No subsolo, ${hidden.card.name}, ${obstacle.card.name} e ${external.card.name} se cruzam: ${undergroundRelation} A saída liga ${action.card.name} a ${outcome.card.name}; ${directionRelation}`;
  const modeLead = {
    cause: "A origem do impasse não está apenas no que aconteceu, mas no que você aprendeu a fazer para não perder controle.",
    method: "A Ferradura responde ao “como” em sequência: primeiro separar o que é seu do que vem do ambiente; depois agir sem pedir uma garantia impossível.",
    decision: "A decisão deixa de ser “qual opção dói menos agora?” e passa a ser “qual consequência eu consigo sustentar sem me abandonar?”.",
    future: "A direção provável não é sentença: ela é o resultado mais coerente se o padrão atual continuar recebendo as mesmas respostas.",
    insight: "A mesa inteira converge num ponto: compreender já não basta se a compreensão não muda sua posição.",
  }[profile.mode];

  const synthesis = `${modeLead} É ${inSituation(profile.situation)} que ${origin.card.name} revela a marca que você traz; ${present.card.name} mostra que o presente já pede uma medida diferente. ${hidden.card.name} nomeia o impulso silencioso, enquanto ${obstacle.card.name} mostra onde ele vira repetição. ${external.card.name} impede que você coloque toda a responsabilidade em si. A virada está em ${action.card.name}: ${sentence(clause(action.canon?.intentLens ?? action.card.action))} Se esse gesto for sustentado, ${outcome.card.name} indica um caminho que ${clause(outcome.canon?.movement ?? outcome.card.message)}. É uma possibilidade construída, não uma promessa — e precisa acontecer ${profile.pressure}.`;

  return {
    responseMode: "reading",
    title,
    opening: profile.original ? `Você perguntou: “${profile.original}”` : "Esta foi a pergunta colocada diante da mesa.",
    sections: [{ id: "ferradura", title: "O movimento inteiro", text: sectionText, cardSlugs: slugs }],
    synthesis,
    groundedAction: `${sentence(action.card.action)} Aplique isso diante ${ofSituation(profile.situation)} antes de interpretar ${outcome.card.name} como destino.`,
    closingQuestion: completePositions[5].prompt ?? "",
    suggestedQuestions: [],
    safetyMessage: "",
    memoryUpdate: emptyMemoryUpdate(),
    audit: { usedCardSlugs: slugs, confidence: "grounded", unsupportedCertainty: false },
  };
}

function buildSpecificReading(selected, intentId, profile, spreadId) {
  const reading = specificReadingsBySlug[spreadId];
  const layout = buildSpecificLayout(reading);
  if (!reading || layout.length !== 5) return null;

  const interpreted = canonicalCards(selected, intentId);
  const slugs = selected.map((card) => card.slug);
  const relation = relationshipSentence(selected, intentId, [2, 3, 4]);
  const title = pick(
    titleBanks[profile.titleKey] ?? titleBanks.path,
    `${profile.original}:${slugs.join(":")}:${spreadId}:specific`,
  );
  const positionStory = interpreted.map(({ card, canon }, index) => (
    `${card.name}, em ${layout[index].eyebrow.toLocaleLowerCase("pt-BR")}, ${clause(canon?.intentLens ?? card.message)}`
  ));

  return {
    responseMode: "reading",
    title,
    opening: profile.original ? `Você perguntou: “${profile.original}”` : "Esta foi a pergunta colocada diante da mesa.",
    sections: [{
      id: "pergunta-especifica",
      title: reading.shortTitle,
      text: `${positionStory.slice(0, 2).join("; ")}. ${relation} ${positionStory.slice(2).join("; ")}.`,
      cardSlugs: slugs,
    }],
    synthesis: `A resposta não está numa carta isolada. ${selected[0].name} abre o tema, ${selected[1].name} traz o que ainda precisa ser reconhecido e ${selected[2].name} localiza o ponto de tensão. A mudança passa por ${selected[3].name}; ${selected[4].name} oferece a direção condicional desta leitura. É ${inSituation(profile.situation)} que esse conjunto precisa ser medido, ${profile.pressure}.`,
    groundedAction: `${sentence(selected[4].action)} Use esse gesto para testar a resposta no mundo real.`,
    closingQuestion: layout[4].prompt,
    suggestedQuestions: [],
    safetyMessage: "",
    memoryUpdate: emptyMemoryUpdate(),
    audit: { usedCardSlugs: slugs, confidence: "grounded", unsupportedCertainty: false },
  };
}

export function buildAgent911Fallback({ cards, intentId, question, variant = "opening", spreadId = "" }) {
  const selected = Array.isArray(cards) ? cards.filter(Boolean) : [];
  const personalQuestion = cleanQuestion(question);
  if (needsImmediateSafety(personalQuestion)) return buildSafetyFallback(personalQuestion);

  const profile = analyzeQuestion(personalQuestion, intentId);
  if (variant === "complete" && selected.length === 7) return buildCompleteReading(selected, intentId, profile);
  if (variant === "specific" && selected.length === 5) {
    return buildSpecificReading(selected, intentId, profile, spreadId);
  }
  if (selected.length !== 3) return null;
  return buildOpeningReading(selected, intentId, profile);
}

export function buildAgent911FollowUpFallback({ cards, message, question, intentId = "caminhos" }) {
  const selected = Array.isArray(cards) ? cards.filter(Boolean) : [];
  const personalMessage = cleanQuestion(message);
  if (needsImmediateSafety(personalMessage)) return buildSafetyFallback(personalMessage);

  const profile = analyzeQuestion(personalMessage || question, intentId);
  const slugs = selected.map((card) => card.slug);
  const tension = selected.length === 7 ? selected[3] : selected[1];
  const anchor = selected.length === 7 ? selected[5] : selected.at(-1);
  const direction = selected.length === 7 ? selected[6] : selected.at(-1);
  if (!tension || !anchor) return null;

  const tensionCanon = getCanonicalCard(tension.slug, intentId);
  const anchorCanon = getCanonicalCard(anchor.slug, intentId);
  const title = pick(titleBanks[profile.titleKey] ?? titleBanks.path, `${personalMessage}:${slugs.join(":")}:follow-up`);
  const relation = relationshipSentence([tension, anchor, direction].filter(Boolean), intentId, [0, 1]);
  const synthesis = `Sua pergunta agora toca ${profile.situation}. ${tension.name} mostra o ponto em que ${clause(tensionCanon?.intentLens ?? tension.shadow)}; isso não prova o que outra pessoa pensa ou fará, mas revela o padrão que você precisa medir. ${anchor.name} devolve sua margem de escolha: ${sentence(clause(anchorCanon?.movement ?? anchor.action))} ${direction && direction.slug !== anchor.slug ? `${direction.name} mostra a consequência simbólica desse movimento, não uma garantia.` : ""} A resposta fica mais limpa quando você age ${profile.pressure}.`;

  return {
    responseMode: "reading",
    title,
    opening: personalMessage ? `Você trouxe agora: “${personalMessage}”` : "Você voltou à mesma mesa por outro ângulo.",
    sections: [{
      id: "retorno",
      title: "O que a Ferradura responde agora",
      text: `${relation} Nesta pergunta, o nó é ${tension.name}; a alavanca é ${anchor.name}.`,
      cardSlugs: [tension, anchor, direction].filter(Boolean).map((card) => card.slug),
    }],
    synthesis,
    groundedAction: `${sentence(anchor.action)} Direcione esse gesto para ${profile.situation}.`,
    closingQuestion: "O que mudaria se você medisse essa situação pelos atos, e não pela expectativa?",
    suggestedQuestions: [],
    safetyMessage: "",
    memoryUpdate: emptyMemoryUpdate(),
    audit: { usedCardSlugs: slugs, confidence: "grounded", unsupportedCertainty: false },
  };
}

export function extractAgent911QuestionTerms(question) {
  return questionTerms(question);
}
