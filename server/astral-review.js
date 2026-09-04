import { labelAstralQuestionnaire, normalizeAstralQuestionnaire } from "../src/config/astralQuestionnaire.js";

const TEMPLATE_VERSION = "arcane911-pdf-v31";
const cards = Object.freeze([
  "21-o-mundo.webp", "00-o-louco.webp", "01-o-mago.webp", "02-a-sacerdotisa.webp",
  "10-a-roda-da-fortuna.webp", "11-a-justica.webp", "04-o-imperador.webp", "13-a-morte.webp",
  "03-a-imperatriz.webp", "06-os-enamorados.webp", "08-a-forca.webp", "07-o-carro.webp",
  "14-a-temperanca.webp", "09-o-eremita.webp", "17-a-estrela.webp", "19-o-sol.webp",
  "16-a-torre.webp", "14-a-temperanca.webp", "02-a-sacerdotisa.webp", "20-o-julgamento.webp",
  "17-a-estrela.webp",
]);
const pointNames = Object.freeze({ sun: "Sol", moon: "Lua", mercury: "Mercúrio", venus: "Vênus", mars: "Marte", jupiter: "Júpiter", saturn: "Saturno", uranus: "Urano", neptune: "Netuno", pluto: "Plutão", ascendant: "Ascendente", midheaven: "Meio do Céu" });
const signNames = Object.freeze({ aries: "Áries", taurus: "Touro", gemini: "Gêmeos", cancer: "Câncer", leo: "Leão", virgo: "Virgem", libra: "Libra", scorpio: "Escorpião", sagittarius: "Sagitário", capricorn: "Capricórnio", aquarius: "Aquário", pisces: "Peixes" });

function clean(value, max = 12_000) {
  return String(value ?? "").replace(/\r\n?/gu, "\n").trim().slice(0, max);
}

function firstName(value) {
  return clean(value, 80).split(/\s+/u)[0] || "Você";
}

function page(number, section, title, body, callout = "", subtitle = "") {
  return { number, section: clean(section, 80), title: clean(title, 180), subtitle: clean(subtitle, 320), body: clean(body), callout: clean(callout, 1_200), card: cards[number - 1] };
}

function section(document, id) {
  return document?.sections?.find((item) => item?.id === id) || {};
}

function joinPractices(practices) {
  return practices.map((practice, index) => (
    `${index + 1}. ${clean(practice?.title, 140)}\n${clean(practice?.action, 1_900)}\nPor quê: ${clean(practice?.purpose, 1_100)}`
  )).join("\n\n");
}

function chartSignature(context) {
  const planets = Array.isArray(context?.planets) ? context.planets : [];
  const planetLines = planets.map((planet) => (
    `${pointNames[planet.key] || planet.key}: ${signNames[planet.signKey] || planet.signKey} ${planet.degreeLabel || ""} · Casa ${planet.house}${planet.retrograde ? " · retrógrado" : ""}`
  ));
  const angles = [context?.ascendant, context?.midheaven].filter(Boolean).map((angle) => (
    `${pointNames[angle.key] || angle.key}: ${signNames[angle.signKey] || angle.signKey} ${angle.degreeLabel || ""}`
  ));
  return [...planetLines, ...angles].join("\n");
}

function selfReportText(questionnaire) {
  const labels = labelAstralQuestionnaire(questionnaire);
  return [
    `Onde a clareza é mais necessária agora\n${labels.clarity.join(" · ") || "Não informado"}`,
    `Padrões que a própria pessoa percebe\n${labels.patterns.join(" · ") || "Não informado"}`,
    `Como ela se reconhece\n${labels.traits.join(" · ") || "Não informado"}`,
  ].join("\n\n");
}

export function buildAstralReviewDraft({ order, snapshot, generated }) {
  const document = generated?.document;
  if (!document || !Array.isArray(document.sections) || document.sections.length !== 8) throw new Error("astral_generation_required");
  const name = clean(order?.fullName || snapshot?.chart?.person, 80);
  const first = firstName(name);
  const chart = snapshot?.context || {};
  const questionnaire = normalizeAstralQuestionnaire(order?.questionnaire || snapshot?.questionnaire);
  const practices = Array.isArray(document.practices) ? document.practices : [];
  const questions = Array.isArray(document.reflectionQuestions) ? document.reflectionQuestions : [];
  const essence = section(document, "essencia");
  const personality = section(document, "personalidade");
  const affects = section(document, "afetos");
  const vocation = section(document, "vocacao");
  const money = section(document, "dinheiro");
  const potentials = section(document, "potenciais");
  const tensions = section(document, "tensoes");
  const integration = section(document, "integracao");
  const birth = snapshot?.chart?.birth || {};
  const location = snapshot?.chart?.location || {};
  const pages = [
    page(1, "Documento Astral 911", name || first, "Uma leitura de arquitetura natal construída pelo Agent911 e atravessada por curadoria humana.", "Isto não é um texto sobre o seu signo. É um encontro com a combinação que só existe no seu mapa.", document.subtitle),
    page(2, "Antes da leitura", "Este documento não veio para te definir.", "Ele foi construído para oferecer linguagem às tensões, recursos e escolhas que aparecem quando o seu céu natal encontra a vida concreta.\n\nA astrologia aqui é usada como tradição simbólica de autoconhecimento. Nada nestas páginas determina destino, substitui conversa, terapia, medicina ou orientação financeira. Você continua sendo maior do que qualquer interpretação.", "Leia devagar. Quando uma frase tocar, procure a cena real da sua vida à qual ela pertence."),
    page(3, "Abertura", document.title, document.opening, document.subtitle, `O primeiro retrato de ${first}`),
    page(4, "Sua voz dentro do mapa", `${first}, você também entrou nesta leitura.`, selfReportText(questionnaire), "Estas respostas são autorrelato, não conclusão astrológica. Elas apontam onde a leitura precisa encontrar a sua vida de agora."),
    page(5, "Arquitetura natal", "As coordenadas da sua assinatura.", chartSignature(chart), `${birth.date || "Data registrada"} · ${birth.time || "Horário registrado"} · ${[location.name, location.admin1, location.country].filter(Boolean).join(", ")}`, chart.method || "Zodíaco tropical · Casas Iguais"),
    page(6, "Retrato central", "A força que merece ser reconhecida.", document.portrait?.centralStrength, "Potência não é obrigação de dar conta de tudo. É matéria-prima que ganha valor quando encontra escolha e limite."),
    page(7, "Retrato central", "A tensão que pede nome.", document.portrait?.centralTension, "Contradição não é defeito de fabricação. Muitas vezes, é justamente o lugar onde a consciência fica mais refinada."),
    page(8, "Retrato central", "O gesto de integração.", document.portrait?.integration, "Integrar não significa eliminar um lado. Significa criar uma vida em que as duas necessidades possam negociar."),
    page(9, "Essência", essence.title, essence.body, essence.practicalDirection),
    page(10, "Personalidade", personality.title, personality.body, personality.practicalDirection),
    page(11, "Afeto e reciprocidade", affects.title, affects.body, affects.practicalDirection),
    page(12, "Vocação e expressão", vocation.title, vocation.body, vocation.practicalDirection),
    page(13, "Dinheiro e valor", money.title, money.body, money.practicalDirection),
    page(14, "Potenciais", potentials.title, potentials.body, potentials.practicalDirection),
    page(15, "Tensões", tensions.title, tensions.body, tensions.practicalDirection),
    page(16, "Integração", integration.title, integration.body, integration.practicalDirection),
    page(17, "Práticas 01–02", "O mapa precisa encontrar o cotidiano.", joinPractices(practices.slice(0, 2)), "Uma prática pequena e repetida revela mais do que uma promessa intensa que não encontra rotina."),
    page(18, "Práticas 03–05", "Experimentos para uma vida observável.", joinPractices(practices.slice(2, 5)), "Não faça tudo de uma vez. Escolha a prática que conversa com o seu momento e observe o que muda."),
    page(19, "Cinco perguntas", "O que este mapa devolve para você?", questions.map((question, index) => `${index + 1}. ${clean(question, 360)}`).join("\n\n"), "Uma pergunta boa não te diminui. Ela amplia o espaço entre impulso e escolha."),
    page(20, "Fechamento", "Você não termina esta leitura igual a quem começou.", document.closing, "Agent911 construiu a leitura a partir do cálculo natal e do seu autorrelato. A versão final passou por revisão humana do tarólogo responsável."),
    page(21, "Código 911", "Guarde o que te reconheceu. Compartilhe o que pode reconhecer alguém.", `Pedido ${clean(order?.orderId, 120)}\n\nEste documento foi preparado individualmente para ${name || first}. Depois da entrega, as cinco perguntas incluídas na compra ficam disponíveis no próprio Arcane911.`, "Uma indicação verdadeira nasce quando a experiência parece ter sido escrita para uma pessoa — porque foi."),
  ];
  return sanitizeAstralDraft({ templateVersion: TEMPLATE_VERSION, person: name, orderId: clean(order?.orderId, 120), generatedAt: new Date().toISOString(), pages });
}

export function sanitizeAstralDraft(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.pages) || value.pages.length !== 21) throw new Error("astral_draft_invalid");
  return {
    templateVersion: TEMPLATE_VERSION,
    person: clean(value.person, 80),
    orderId: clean(value.orderId, 120),
    generatedAt: clean(value.generatedAt, 40) || new Date().toISOString(),
    pages: value.pages.map((raw, index) => page(index + 1, raw?.section, raw?.title, raw?.body, raw?.callout, raw?.subtitle)),
  };
}

export const ASTRAL_REVIEW_TEMPLATE_VERSION = TEMPLATE_VERSION;
