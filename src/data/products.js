export const specificReadings = [
  {
    slug: "amor",
    intentId: "amor",
    eyebrow: "Leitura específica · Amor",
    shortTitle: "O vínculo entre vocês",
    title: "O que existe entre desejo, medo e reciprocidade.",
    description: "Uma leitura desenhada para separar sentimento, projeção, disponibilidade e direção possível sem transformar o tarot em vigilância ou sentença.",
    cardCount: 5,
    futurePrice: "R$ 14,90",
    question: "O que esta relação realmente oferece — e o que ela pede de mim?",
    promise: "Vínculo, bloqueio, reciprocidade, limite e direção.",
    positions: ["O que une", "O que não foi dito", "O bloqueio", "O seu limite", "A direção"],
  },
  {
    slug: "caminhos",
    intentId: "caminhos",
    eyebrow: "Leitura específica · Caminhos",
    shortTitle: "A bifurcação",
    title: "Duas possibilidades. Um critério que ainda não apareceu.",
    description: "Uma abertura para comparar forças, custos e consequências quando dois caminhos parecem igualmente possíveis.",
    cardCount: 5,
    futurePrice: "R$ 14,90",
    question: "Qual escolha se aproxima mais da vida que quero construir?",
    promise: "Caminho A, caminho B, custo oculto, critério e travessia.",
    positions: ["Primeiro caminho", "Segundo caminho", "O custo oculto", "O critério", "A travessia"],
  },
  {
    slug: "trabalho",
    intentId: "trabalho",
    eyebrow: "Leitura específica · Trabalho",
    shortTitle: "Movimento profissional",
    title: "Onde existe oportunidade — e onde existe apenas urgência.",
    description: "Uma leitura prática sobre recursos, ambiente, risco e posicionamento para decisões profissionais ou financeiras.",
    cardCount: 5,
    futurePrice: "R$ 14,90",
    question: "Qual movimento profissional merece minha energia agora?",
    promise: "Recurso, oportunidade, risco, posicionamento e tendência.",
    positions: ["Seu recurso", "A oportunidade", "O risco", "O posicionamento", "A tendência"],
  },
  {
    slug: "decisao",
    intentId: "decisao",
    eyebrow: "Leitura específica · Decisão",
    shortTitle: "O peso da escolha",
    title: "O que muda quando você para de perguntar apenas o que é mais fácil.",
    description: "Uma estrutura para enxergar fato, desejo, medo e consequência antes de assumir uma direção.",
    cardCount: 5,
    futurePrice: "R$ 14,90",
    question: "O que deve pesar de verdade nesta decisão?",
    promise: "Fato, desejo, medo, consequência e escolha consciente.",
    positions: ["O fato", "O desejo", "O medo", "A consequência", "A escolha"],
  },
];

export const specificReadingsBySlug = Object.fromEntries(
  specificReadings.map((reading) => [reading.slug, reading]),
);

export function getReadingForIntent(intentId) {
  return specificReadings.find((reading) => reading.intentId === intentId)
    ?? specificReadings[0];
}
