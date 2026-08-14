import { completePositions, positions, tarotBySlug, tarotCards } from "../src/data/tarot.js";

export const TAROT_CANON_VERSION = "911-major-arcana-2026.08.11";

const depthBySlug = Object.freeze({
  "o-louco": {
    function: "Autorizar o encontro com o desconhecido antes que exista garantia.",
    movement: "Sai de um mapa esgotado e testa uma possibilidade viva sem exigir domínio total.",
    lenses: {
      caminhos: "Um começo pede experiência e presença, não uma certeza impossível.",
      amor: "O vínculo precisa de espontaneidade, mas também de consciência sobre o risco assumido.",
      trabalho: "Experimentar em escala pequena é mais fértil do que esperar segurança absoluta.",
      decisao: "A escolha contém risco real; o ponto é distinguir coragem de fuga impulsiva.",
      interior: "Uma parte ainda não domesticada quer existir sem ser ridicularizada.",
    },
    avoid: "Não reduzir a irresponsabilidade, viagem ou novidade positiva automática.",
    vector: "threshold",
    verb: "abre",
  },
  "o-mago": {
    function: "Converter intenção em forma por meio de atenção, linguagem e habilidade.",
    movement: "Reúne recursos dispersos e cria um primeiro gesto verificável.",
    lenses: {
      caminhos: "O próximo passo depende menos de autorização e mais de uso consciente do que já existe.",
      amor: "Palavra, desejo e atitude precisam dizer a mesma coisa.",
      trabalho: "Competência disponível pede foco, demonstração e execução.",
      decisao: "A alternativa mais fértil é aquela sobre a qual você consegue agir de verdade.",
      interior: "Reconhecer a própria influência devolve potência e responsabilidade.",
    },
    avoid: "Não prometer manifestação mágica nem ignorar manipulação e performance vazia.",
    vector: "outward",
    verb: "materializa",
  },
  "a-sacerdotisa": {
    function: "Sustentar silêncio suficiente para perceber o que ainda não virou linguagem.",
    movement: "Recua da resposta apressada e lê repetição, corpo, ausência e subtexto.",
    lenses: {
      caminhos: "Há informação útil no intervalo entre perceber e concluir.",
      amor: "O não dito importa, mas não autoriza transformar sensação em prova.",
      trabalho: "Observar bastidores e timing evita uma exposição prematura.",
      decisao: "A decisão ainda precisa de escuta ou de uma informação que não amadureceu.",
      interior: "A intuição cresce quando não precisa competir com o ruído.",
    },
    avoid: "Não confirmar segredo, traição ou pressentimento como fato.",
    vector: "inward",
    verb: "escuta",
  },
  "a-imperatriz": {
    function: "Nutrir vida, prazer, vínculo e criação até que ganhem consistência.",
    movement: "Traz a pergunta ao corpo e verifica o que recebe cuidado concreto.",
    lenses: {
      caminhos: "O que você alimenta regularmente revela o caminho que realmente escolheu.",
      amor: "Afeto precisa circular sem virar maternagem, posse ou autoabandono.",
      trabalho: "Uma criação pode prosperar se receber recurso, ritmo e visibilidade.",
      decisao: "A melhor escolha tende a ampliar vida sem exigir que você se esvazie.",
      interior: "Prazer, criatividade e merecimento pedem espaço legítimo.",
    },
    avoid: "Não anunciar gravidez, riqueza ou crescimento inevitável.",
    vector: "outward",
    verb: "nutre",
  },
  "o-imperador": {
    function: "Dar contorno, limite e continuidade ao que precisa permanecer.",
    movement: "Transforma vontade em decisão, regra, responsabilidade e sustentação.",
    lenses: {
      caminhos: "Estrutura é o que permite ao impulso durar além do entusiasmo inicial.",
      amor: "Clareza de acordos protege o vínculo; controle excessivo o empobrece.",
      trabalho: "Autoridade, estratégia e processo precisam ocupar o lugar da improvisação crônica.",
      decisao: "Pergunte qual escolha você consegue sustentar e responder pelas consequências.",
      interior: "É hora de construir segurança interna sem endurecer a sensibilidade.",
    },
    avoid: "Não tratar rigidez, autoritarismo ou figura masculina como destino.",
    vector: "outward",
    verb: "estrutura",
  },
  "o-hierofante": {
    function: "Relacionar experiência pessoal a valores, tradição, ensino e pertencimento.",
    movement: "Procura uma referência confiável e pergunta se ela ainda transmite sentido.",
    lenses: {
      caminhos: "Método ou mentoria ajudam, desde que não substituam consciência.",
      amor: "Valores compartilhados e acordos explícitos pesam mais do que aparência de compromisso.",
      trabalho: "Formação, instituição ou validação técnica podem organizar o avanço.",
      decisao: "A escolha revela a quais princípios você realmente pertence.",
      interior: "Uma crença herdada precisa ser escolhida de novo ou devolvida.",
    },
    avoid: "Não impor moral, casamento ou obediência institucional.",
    vector: "balancing",
    verb: "transmite",
  },
  "os-enamorados": {
    function: "Revelar identidade por meio de vínculo, desejo e escolha coerente.",
    movement: "Coloca atração e valor frente a frente para que a decisão não seja terceirizada.",
    lenses: {
      caminhos: "Dois impulsos competem; escolher também significa renunciar.",
      amor: "Existe potencial de encontro, mas reciprocidade e escolha consciente precisam ser observadas.",
      trabalho: "Parceria ou bifurcação exige alinhamento de valores, não apenas entusiasmo.",
      decisao: "O centro não é qual opção seduz mais, mas qual preserva integridade.",
      interior: "Partes distintas de si procuram uma escolha que não as traia.",
    },
    avoid: "Não confirmar alma gêmea, reconciliação ou terceira pessoa.",
    vector: "balancing",
    verb: "escolhe",
  },
  "o-carro": {
    function: "Conduzir forças divergentes sob uma direção consciente.",
    movement: "Define norte, reúne energia e troca velocidade desordenada por avanço sustentado.",
    lenses: {
      caminhos: "O movimento começa quando prioridades incompatíveis deixam de comandar juntas.",
      amor: "O vínculo precisa saber para onde vai e como atravessará diferenças.",
      trabalho: "Direção e disciplina favorecem avanço, deslocamento ou conquista.",
      decisao: "Escolha a direção que organiza suas forças, não a que apenas acelera ansiedade.",
      interior: "Autodomínio significa condução, não guerra contra si.",
    },
    avoid: "Não prometer vitória, viagem ou veículo como acontecimento literal.",
    vector: "outward",
    verb: "conduz",
  },
  "a-forca": {
    function: "Relacionar-se com instinto e intensidade sem esmagar nem ser dominado por eles.",
    movement: "Troca coerção por firmeza gentil e transforma reação em presença.",
    lenses: {
      caminhos: "A travessia pede constância emocional mais do que força bruta.",
      amor: "Desejo e vulnerabilidade precisam ser acolhidos sem jogos de poder.",
      trabalho: "Pressão pode ser sustentada melhor com ritmo, tato e autocontrole.",
      decisao: "A escolha madura não nasce do pico emocional, mas da capacidade de permanecer presente.",
      interior: "Uma emoção intensa quer relação e linguagem, não repressão.",
    },
    avoid: "Não confundir força com suportar abuso, calar ou insistir indefinidamente.",
    vector: "inward",
    verb: "regula",
  },
  "o-eremita": {
    function: "Separar voz própria de ruído coletivo por meio de recolhimento consciente.",
    movement: "Reduz estímulo, procura essência e ilumina apenas o próximo passo.",
    lenses: {
      caminhos: "Uma pausa de discernimento pode valer mais do que muitos conselhos.",
      amor: "Distância pode esclarecer necessidades, mas não deve virar desaparecimento punitivo.",
      trabalho: "Pesquisa, especialização ou estratégia silenciosa antecedem exposição.",
      decisao: "Você precisa ouvir a resposta sem a plateia que costuma influenciá-la.",
      interior: "Solidão fértil é diferente de isolamento defensivo.",
    },
    avoid: "Não prescrever afastamento total nem romantizar abandono e ruminação.",
    vector: "inward",
    verb: "discerne",
  },
  "a-roda-da-fortuna": {
    function: "Reconhecer ciclos, contingência e o ponto em que uma resposta pode mudar a repetição.",
    movement: "Mostra o giro que já começou e procura margem de escolha dentro dele.",
    lenses: {
      caminhos: "O cenário muda; flexibilidade consciente vale mais do que tentar congelá-lo.",
      amor: "Um padrão retorna para ser percebido, não necessariamente repetido.",
      trabalho: "Oportunidade e instabilidade coexistem; timing precisa encontrar preparação.",
      decisao: "Parte da situação não está sob controle, mas sua forma de participar está.",
      interior: "A repetição revela uma aprendizagem ainda incompleta.",
    },
    avoid: "Não anunciar sorte, azar ou destino inevitável.",
    vector: "threshold",
    verb: "gira",
  },
  "a-justica": {
    function: "Distinguir fato, interpretação, desejo e consequência.",
    movement: "Retira excesso emocional da balança sem retirar humanidade da decisão.",
    lenses: {
      caminhos: "Clareza sobre causa e consequência corrige a direção.",
      amor: "Reciprocidade, acordos e responsabilidade precisam ser medidos por atos.",
      trabalho: "Contratos, critérios e prestação de contas pedem precisão.",
      decisao: "A resposta madura aceita o preço da escolha e a própria participação.",
      interior: "Autocrítica precisa virar responsabilidade, não condenação.",
    },
    avoid: "Não prometer vitória jurídica nem transformar a carta em punição moral.",
    vector: "balancing",
    verb: "mede",
  },
  "o-enforcado": {
    function: "Suspender esforço automático para permitir outra perspectiva.",
    movement: "Interrompe a insistência, tolera o não controle e muda o ponto de observação.",
    lenses: {
      caminhos: "O avanço depende de deixar uma estratégia antiga perder força.",
      amor: "Esperar pode revelar algo, mas sacrifício unilateral não é prova de amor.",
      trabalho: "Revisão, atraso ou mudança de perspectiva evitam insistência improdutiva.",
      decisao: "Ainda não escolher pode ser consciente se houver propósito e limite.",
      interior: "Uma identidade baseada em esforço ou martírio precisa relaxar.",
    },
    avoid: "Não glorificar paralisia, submissão ou sofrimento como obrigação espiritual.",
    vector: "inward",
    verb: "suspende",
  },
  "a-morte": {
    function: "Encerrar uma forma esgotada para liberar energia de transformação.",
    movement: "Nomeia o fim, atravessa o luto simbólico e abre espaço sem apressar substituição.",
    lenses: {
      caminhos: "Continuar exige deixar de alimentar uma configuração que já terminou.",
      amor: "Uma dinâmica precisa acabar; isso não define sozinho se o vínculo termina ou se transforma.",
      trabalho: "Ciclo, função ou estratégia pede encerramento e transição consciente.",
      decisao: "A escolha real talvez seja aceitar o fim que você vem tentando negociar.",
      interior: "Uma versão de si perdeu função e precisa ser honrada antes de ser solta.",
    },
    avoid: "Nunca associar a morte física ou anunciar tragédia.",
    vector: "threshold",
    verb: "encerra",
  },
  "a-temperanca": {
    function: "Criar uma terceira medida por integração, ritmo e ajuste contínuo.",
    movement: "Mistura diferenças sem apagá-las e procura uma proporção sustentável.",
    lenses: {
      caminhos: "A saída nasce de composição paciente, não de um extremo vencedor.",
      amor: "Diálogo e ajuste podem curar se ambos participarem sem se apagar.",
      trabalho: "Processo, parceria e iteração produzem mais do que pressa.",
      decisao: "Talvez exista uma combinação ou sequência que a lógica binária ainda não viu.",
      interior: "Partes aparentemente opostas podem aprender um novo ritmo juntas.",
    },
    avoid: "Não vender reconciliação automática nem recomendar tolerância sem limite.",
    vector: "balancing",
    verb: "integra",
  },
  "o-diabo": {
    function: "Tornar visível o acordo secreto entre desejo, recompensa, medo e aprisionamento.",
    movement: "Olha para a corrente e pergunta qual benefício mantém o padrão ativo.",
    lenses: {
      caminhos: "Uma escolha sedutora cobra um preço que precisa ser nomeado.",
      amor: "Química, dependência, posse e medo de perder podem se misturar ao afeto.",
      trabalho: "Ambição, dinheiro ou poder podem motivar e aprisionar ao mesmo tempo.",
      decisao: "A alternativa mais compulsiva não é necessariamente a mais desejada em liberdade.",
      interior: "Vergonha perde força quando o desejo pode ser reconhecido sem obediência automática.",
    },
    avoid: "Não acusar vício, traição, magia, obsessão espiritual ou maldade de terceiros.",
    vector: "inward",
    verb: "expõe",
  },
  "a-torre": {
    function: "Romper uma estrutura sustentada por premissa que já não suporta realidade.",
    movement: "Acelera revelação, derruba aparência e separa perda de libertação.",
    lenses: {
      caminhos: "Uma verdade desconfortável impede continuar construindo sobre base falsa.",
      amor: "Revelação ou ruptura de dinâmica exige segurança e honestidade, não catastrofismo.",
      trabalho: "Plano ou estrutura precisa ser revisto rapidamente para proteger o essencial.",
      decisao: "A opção baseada em negação tende a perder sustentação.",
      interior: "Uma defesa antiga racha para que algo mais verdadeiro apareça.",
    },
    avoid: "Não prever acidente, desastre, demissão ou separação como certeza.",
    vector: "threshold",
    verb: "rompe",
  },
  "a-estrela": {
    function: "Restaurar confiança simples e orientação depois que uma defesa caiu.",
    movement: "Desarma, reidrata esperança e protege um sinal de vida ainda delicado.",
    lenses: {
      caminhos: "Uma direção limpa reaparece quando você para de exigir resultado imediato.",
      amor: "Vulnerabilidade e verdade podem reabrir confiança com tempo e reciprocidade.",
      trabalho: "Propósito e autenticidade renovam energia, mas ainda pedem continuidade.",
      decisao: "A escolha que permite respirar e permanecer verdadeiro merece atenção.",
      interior: "Esperança pode ser prática, discreta e corporal.",
    },
    avoid: "Não prometer cura, sucesso ou reconciliação inevitável.",
    vector: "outward",
    verb: "restaura",
  },
  "a-lua": {
    function: "Atravessar ambiguidade distinguindo percepção, projeção, memória e evidência.",
    movement: "Desacelera conclusão e usa o sentimento como informação, não como sentença factual.",
    lenses: {
      caminhos: "O caminho existe, mas contornos ainda mudam sob medo e imaginação.",
      amor: "Insegurança e sinais mistos pedem conversa e verificação, não investigação compulsiva.",
      trabalho: "Informação incompleta ou ansiedade distorce avaliação; avance com checagem.",
      decisao: "Não decida apenas para acabar com a angústia de não saber.",
      interior: "Sonhos, memórias e medo trazem material psíquico que precisa ser escutado com chão.",
    },
    avoid: "Nunca confirmar paranoia, traição, perseguição ou pressentimento como prova.",
    vector: "inward",
    verb: "embaça",
  },
  "o-sol": {
    function: "Tornar visível o que pode existir com clareza, vitalidade e presença inteira.",
    movement: "Ilumina fato, simplifica subtexto e autoriza reconhecimento compartilhado.",
    lenses: {
      caminhos: "Clareza e energia disponível favorecem expressão aberta.",
      amor: "Afeto pode ser visto em reciprocidade, alegria e verdade cotidiana.",
      trabalho: "Visibilidade, reconhecimento e confiança ajudam quando sustentados por realidade.",
      decisao: "A opção mais clara não é sempre a mais fácil, mas costuma exigir menos autoengano.",
      interior: "Uma parte espontânea quer ocupar espaço sem pedir desculpa por existir.",
    },
    avoid: "Não prometer felicidade, gravidez, fama ou desfecho positivo garantido.",
    vector: "outward",
    verb: "ilumina",
  },
  "o-julgamento": {
    function: "Revisar o passado de um lugar mais inteiro e responder a um chamado atual.",
    movement: "Integra aprendizado, interrompe autocondenação e pede resposta adulta.",
    lenses: {
      caminhos: "Algo recorrente solicita uma decisão que encerre a versão antiga.",
      amor: "Retorno ou revisão só importa se houver consciência e atitude diferentes.",
      trabalho: "Vocação, avaliação ou retomada pede alinhamento com o que se tornou impossível ignorar.",
      decisao: "A escolha precisa responder ao que você já aprendeu, não repetir o antigo tribunal.",
      interior: "Perdão responsável libera energia presa na revisão infinita.",
    },
    avoid: "Não anunciar retorno de pessoa, chamado sobrenatural ou absolvição inevitável.",
    vector: "threshold",
    verb: "desperta",
  },
  "o-mundo": {
    function: "Reconhecer conclusão, integração e pertencimento depois de uma travessia.",
    movement: "Fecha o gesto final, recolhe aprendizado e abre espaço sem apagar o caminho.",
    lenses: {
      caminhos: "Um ciclo pode ser concluído antes que o próximo precise ser conhecido.",
      amor: "Inteireza e maturidade permitem celebrar, consolidar ou encerrar com consciência.",
      trabalho: "Entrega, domínio ou fechamento de ciclo pede reconhecimento e passagem.",
      decisao: "A escolha madura pode ser completar o que falta em vez de reabrir o que já cumpriu função.",
      interior: "Partes antes fragmentadas começam a caber numa identidade mais ampla.",
    },
    avoid: "Não prometer final feliz, viagem ou perfeição definitiva.",
    vector: "balancing",
    verb: "integra",
  },
});

const curatedPairs = Object.freeze({
  "a-lua|a-justica": "Sentimento e evidência precisam ser separados sem desqualificar nenhum dos dois.",
  "a-lua|o-sol": "O que estava ambíguo procura clareza; a passagem exige verificação, não pressa.",
  "a-morte|a-estrela": "O encerramento abre uma reconstrução delicada; esperança só cresce onde o fim foi reconhecido.",
  "a-morte|o-julgamento": "O passado retorna para integração, não para ressuscitar automaticamente a forma antiga.",
  "a-sacerdotisa|o-mago": "Escuta e ação formam um circuito: perceber antes de agir, agir sem trair o percebido.",
  "a-temperanca|a-torre": "Uma estrutura pode precisar romper antes que uma nova proporção se torne possível.",
  "a-temperanca|o-diabo": "Regulação consciente confronta o ciclo de excesso, privação e recompensa compulsiva.",
  "a-torre|a-estrela": "Depois da verdade que rompe, a reconstrução começa sem armadura e sem pressa.",
  "a-torre|o-imperador": "Estrutura e ruptura disputam o centro; é preciso distinguir sustentação de rigidez.",
  "a-forca|o-diabo": "Firmeza gentil encontra o padrão compulsivo e devolve escolha onde havia reação.",
  "o-carro|o-enforcado": "Avanço e suspensão criam tensão produtiva: nem acelerar por ansiedade, nem parar por medo.",
  "o-diabo|os-enamorados": "Desejo e escolha precisam ser separados para que química não seja confundida com coerência.",
  "o-enforcado|a-morte": "A pausa deixa de ser espera quando aceita o encerramento que já se tornou necessário.",
  "o-eremita|a-lua": "Recolhimento pode esclarecer a ambiguidade, desde que não vire ruminação fechada.",
  "o-hierofante|os-enamorados": "Valor herdado encontra escolha pessoal; compromisso só é vivo quando é escolhido.",
  "o-louco|a-justica": "Liberdade encontra consequência: o salto ganha maturidade quando o risco é nomeado.",
  "o-louco|a-morte": "Um começo verdadeiro depende de não carregar adiante a forma que já terminou.",
  "o-louco|o-mago": "A abertura ao possível encontra recurso e intenção para produzir o primeiro gesto.",
  "o-louco|o-mundo": "Fim e início encostam um no outro; concluir bem muda a qualidade do próximo salto.",
  "o-sol|a-estrela": "Clareza fortalece a esperança quando celebra o que já é real sem inflar promessa.",
  "o-sol|o-diabo": "Prazer livre e prazer compulsivo precisam ser distinguidos pelo efeito que deixam depois.",
});

function pairKey(firstSlug, secondSlug) {
  return [firstSlug, secondSlug].sort().join("|");
}

function relationKind(first, second) {
  if (first.vector === second.vector) return "reforço";
  if (first.vector === "threshold" || second.vector === "threshold") return "passagem";
  if ([first.vector, second.vector].includes("balancing")) return "integração";
  return "tensão criativa";
}

function withoutTerminal(value) {
  return String(value ?? "").trim().replace(/[.!?…]+$/u, "");
}

function generatedRelationNote(first, second, kind) {
  if (kind === "reforço") {
    return `${first.name} e ${second.name} intensificam o mesmo vetor: ${withoutTerminal(first.intentLens)}; ${withoutTerminal(second.intentLens)}.`;
  }
  if (kind === "passagem") {
    return `${first.name} abre uma passagem para ${second.name}: ${withoutTerminal(first.movement)}; em seguida, ${withoutTerminal(second.movement)}.`;
  }
  if (kind === "integração") {
    return `${first.name} e ${second.name} pedem uma terceira medida entre dois movimentos: ${withoutTerminal(first.intentLens)}; ${withoutTerminal(second.intentLens)}.`;
  }
  return `${first.name} e ${second.name} criam uma tensão fértil: ${withoutTerminal(first.movement)}, enquanto ${withoutTerminal(second.movement)}.`;
}

export function getCanonicalCard(slug, intentId = "caminhos") {
  const card = tarotBySlug[slug];
  const depth = depthBySlug[slug];
  if (!card || !depth) return null;

  return {
    slug: card.slug,
    name: card.name,
    roman: card.roman,
    archetype: card.archetype,
    keywords: [...card.keywords],
    symbols: card.symbols,
    coreMessage: card.message,
    shadow: card.shadow,
    possibleAction: card.action,
    psychologicalFunction: depth.function,
    movement: depth.movement,
    intentLens: depth.lenses[intentId] ?? depth.lenses.caminhos,
    interpretiveBoundary: depth.avoid,
    vector: depth.vector,
    relationalVerb: depth.verb,
  };
}

export function buildRelationshipMap(slugs, intentId = "caminhos") {
  const cards = slugs.map((slug) => getCanonicalCard(slug, intentId)).filter(Boolean);
  const relations = [];

  for (let firstIndex = 0; firstIndex < cards.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < cards.length; secondIndex += 1) {
      const first = cards[firstIndex];
      const second = cards[secondIndex];
      const curated = curatedPairs[pairKey(first.slug, second.slug)];
      const kind = relationKind(first, second);
      relations.push({
        cards: [first.slug, second.slug],
        curated: Boolean(curated),
        kind,
        note: curated
          ?? generatedRelationNote(first, second, kind),
      });
    }
  }

  return relations;
}

function selectReadingRelationships(slugs, intentId, maximum) {
  const indexBySlug = new Map(slugs.map((slug, index) => [slug, index]));
  return buildRelationshipMap(slugs, intentId)
    .map((relation) => {
      const [firstIndex, secondIndex] = relation.cards.map((slug) => indexBySlug.get(slug));
      const touchesDecision = [firstIndex, secondIndex].some((index) => [3, 5, 6].includes(index));
      const bridgesActionAndOutcome = [firstIndex, secondIndex].includes(5)
        && [firstIndex, secondIndex].includes(6);
      const adjacent = Math.abs(firstIndex - secondIndex) === 1;
      return {
        relation,
        score: (relation.curated ? 100 : 0)
          + (bridgesActionAndOutcome ? 30 : 0)
          + (touchesDecision ? 12 : 0)
          + (adjacent ? 6 : 0),
      };
    })
    .sort((first, second) => second.score - first.score)
    .slice(0, maximum)
    .map(({ relation }) => relation);
}

export function buildCanonicalReading(slugs, intentId, experience, customLayout = []) {
  const isComplete = slugs.length === 7;
  const isSpecific = slugs.length === 5;
  const layout = isComplete ? completePositions : isSpecific ? customLayout : positions;
  if (layout.length !== slugs.length) return null;
  const cards = slugs.map((slug, index) => {
    const canonical = getCanonicalCard(slug, intentId);
    return canonical ? { ...canonical, position: layout[index] } : null;
  });

  if (cards.some((card) => !card)) return null;

  return {
    canonVersion: TAROT_CANON_VERSION,
    tradition: "Arcanos Maiores na estrutura Rider–Waite–Smith, leitura simbólica, relacional e orientada à autonomia.",
    experience,
    cards,
    relationships: selectReadingRelationships(slugs, intentId, isComplete ? 6 : isSpecific ? 5 : 3),
    layoutRule: isComplete
      ? "Leia a Ferradura como narrativa: origem → presente → influência oculta → nó → campo externo → ação → direção provável. A direção é condicional, nunca destino."
      : isSpecific
        ? "Leia as cinco posições como resposta focada à pergunta. Faça as cartas conversarem, respeite a função de cada posição e trate a última como direção condicional, nunca sentença."
        : "Leia as três cartas como narrativa: raiz → espelho → movimento. Nenhuma carta deve ser interpretada isoladamente.",
  };
}

export function isCanonicalSlug(slug) {
  return Boolean(tarotBySlug[slug]);
}

export function findUnselectedCardNames(text, selectedSlugs) {
  const selected = new Set(selectedSlugs);
  return tarotCards
    .filter((card) => !selected.has(card.slug))
    .filter((card) => String(text).includes(card.name))
    .map((card) => card.name);
}
