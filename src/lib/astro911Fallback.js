const sectionIds = Object.freeze(["essencia", "afetos", "vocacao", "tensoes", "integracao"]);

function firstName(value) {
  return String(value ?? "").trim().split(/\s+/u)[0] || "Você";
}

function planet(chart, key) {
  return chart.planets.find((item) => item.key === key);
}

function placement(item) {
  return `${item.name} em ${item.sign.name}, na Casa ${item.house}`;
}

function aspectSentence(aspect) {
  return `${aspect.point1Name} e ${aspect.point2Name} em ${aspect.name.toLowerCase()}`;
}

function aspectId(aspect) {
  return `aspect:${aspect.point1Key}:${aspect.aspectKey}:${aspect.point2Key}`;
}

function factLabelMap(chart) {
  return Object.fromEntries([
    ...chart.planets.map((item) => [
      `planet:${item.key}`,
      `${item.name} em ${item.sign.name} ${item.degreeLabel} · Casa ${item.house}${item.retrograde ? " · retrógrado" : ""}`,
    ]),
    ["angle:ascendant", `Ascendente em ${chart.ascendant.sign.name} ${chart.ascendant.degreeLabel}`],
    ["angle:midheaven", `Meio do Céu em ${chart.midheaven.sign.name} ${chart.midheaven.degreeLabel}`],
    ...chart.aspects.map((item) => [
      aspectId(item),
      `${item.point1Name} ${item.name.toLowerCase()} ${item.point2Name} · orbe ${Number(item.orb).toFixed(2)}°`,
    ]),
  ]);
}

export function buildAstro911MockPayload(chart) {
  const name = firstName(chart.person);
  const sun = planet(chart, "sun");
  const moon = planet(chart, "moon");
  const mercury = planet(chart, "mercury");
  const venus = planet(chart, "venus");
  const mars = planet(chart, "mars");
  const jupiter = planet(chart, "jupiter");
  const saturn = planet(chart, "saturn");
  const aspects = chart.aspects.slice(0, 5);
  const firstAspect = aspects[0];
  const secondAspect = aspects[1] ?? aspects[0];
  const thirdAspect = aspects[2] ?? aspects[0];
  const factLabels = factLabelMap(chart);

  const document = {
    title: "Entre estrutura interna e movimento vivo",
    subtitle: `Um retrato simbólico de ${name}, construído a partir das combinações reais deste mapa.`,
    opening: `${name}, o eixo central do seu mapa reúne ${placement(sun)}, ${placement(moon)} e um Ascendente em ${chart.ascendant.sign.name}. Essa combinação aproxima direção consciente, necessidade emocional e a forma como você chega às situações, mas não obriga essas três camadas a desejarem a mesma coisa no mesmo momento. A presença de ${chart.dominantElement} como elemento dominante dá um idioma recorrente às suas escolhas, enquanto ${aspectSentence(firstAspect)} mostra onde o movimento pede relação entre forças diferentes. O valor deste desenho não está em produzir uma definição fechada sobre você. Ele está em revelar como capacidade, proteção, desejo e responsabilidade podem se organizar — ou disputar espaço — quando uma decisão concreta exige presença.`,
    portrait: {
      centralStrength: `Sua força central aparece quando a direção de ${sun.name} encontra a percepção de ${moon.name} sem tentar apagar uma das duas. Você pode construir com consistência e, ao mesmo tempo, perceber nuances que uma leitura apenas racional deixaria passar.`,
      centralTension: `${aspectSentence(firstAspect)} sugere uma tensão fértil entre necessidades que não se resolvem por vitória de um lado. Quando a pressão aumenta, o desafio pode ser diferenciar urgência, expectativa e escolha antes de reagir.`,
      integration: `O caminho de integração passa pelo modo como o Ascendente em ${chart.ascendant.sign.name} apresenta sua sensibilidade ao mundo e pela possibilidade de transformar percepção em acordos, rotina e gesto observável.`,
    },
    sections: [
      {
        id: "essencia",
        title: "A identidade que se constrói em camadas",
        body: `${placement(sun)} coloca autoria e direção consciente no centro de experiências ligadas a ${sun.role}. ${placement(moon)}, por outro lado, mostra que a resposta emocional pode obedecer a outro ritmo e pedir condições diferentes para se sentir segura. O Ascendente em ${chart.ascendant.sign.name} acrescenta a forma como você inicia contatos, lê ambientes e é percebido antes que sua intenção esteja completamente explicada. Juntas, essas posições sugerem que presença não é apenas mostrar força: é permitir que intenção, emoção e expressão externa conversem. O predomínio de ${chart.dominantElement} tende a oferecer recursos recorrentes, mas também pode fazer você insistir numa mesma estratégia mesmo quando a situação pede outra linguagem. A integração começa ao observar qual dessas camadas está conduzindo cada escolha e qual ficou sem voz.`,
        anchors: ["planet:sun", "planet:moon", "angle:ascendant"],
        practicalDirection: "Durante uma semana, escolha uma decisão por dia e registre três linhas separadas: o que você quer construir, o que precisa emocionalmente e como está apresentando isso ao mundo. Compare as três antes de agir.",
      },
      {
        id: "afetos",
        title: "Afeto, desejo e reciprocidade precisam de tradução",
        body: `${placement(moon)} descreve necessidades emocionais e a maneira mais instintiva de buscar proteção. ${placement(venus)} mostra como prazer, valor e vínculo ganham forma, enquanto ${placement(mars)} acrescenta desejo, iniciativa e reação diante de obstáculos. Essas três funções não são sinônimas: você pode sentir de um jeito, demonstrar de outro e agir sob pressão por uma terceira via. ${aspectSentence(secondAspect)} amplia essa dinâmica e indica um ponto em que facilidade ou tensão precisa ser usada conscientemente, em vez de virar automatismo. O mapa não revela o pensamento de outra pessoa nem prova reciprocidade; ele ajuda a reconhecer o que você oferece, o que espera e como reage quando não recebe uma resposta clara. Relações ficam mais legíveis quando expectativa, acordo e comportamento observável deixam de ocupar a mesma frase.`,
        anchors: ["planet:moon", "planet:venus", "planet:mars", aspectId(secondAspect)],
        practicalDirection: "Ao conversar sobre vínculo, substitua uma suposição por três dados: o comportamento que você observou, o efeito que ele teve em você e o acordo que gostaria de construir. Repare se sua ação pede proximidade, confirmação ou limite.",
      },
      {
        id: "vocacao",
        title: "Expressão, responsabilidade e assinatura própria",
        body: `O Meio do Céu em ${chart.midheaven.sign.name} descreve a direção simbólica da sua presença pública e dos papéis em que você deseja ser reconhecido. ${placement(mercury)} mostra como pensamento e linguagem entram na construção desse caminho; ${placement(jupiter)} fala de expansão, confiança e aprendizado; e ${placement(saturn)} revela onde tempo, limite e responsabilidade exigem consistência. O conjunto não determina uma profissão. Ele oferece critérios para perceber em quais ambientes você tende a produzir melhor: aqueles que permitem transformar conhecimento em entrega, sustentar desenvolvimento e reconhecer o custo real de cada ambição. Quando crescimento e estrutura se escutam, autoridade não precisa virar rigidez e liberdade não precisa virar dispersão. A assinatura profissional nasce do modo como você repete escolhas de qualidade, não de um único momento de inspiração.`,
        anchors: ["angle:midheaven", "planet:mercury", "planet:jupiter", "planet:saturn"],
        practicalDirection: "Escolha um projeto atual e escreva qual competência ele expande, qual responsabilidade ele exige e qual evidência concreta mostrará progresso em trinta dias. Se nenhum dos três pontos estiver claro, reduza o projeto até caber numa ação verificável.",
      },
      {
        id: "tensoes",
        title: "O conflito que também pode virar recurso",
        body: `${aspectSentence(firstAspect)} e ${aspectSentence(thirdAspect)} mostram que algumas forças do mapa pedem negociação contínua. Um aspecto não é defeito nem promessa: é uma relação dinâmica entre funções que podem competir, colaborar ou alternar o comando conforme o contexto. Sob pressão, você pode tentar resolver rapidamente uma ambivalência que precisava primeiro ser nomeada. A mesma tensão, quando reconhecida, oferece capacidade de comparação, adaptação e escolha consciente. Planetas retrógrados, quando presentes, indicam processos cuja elaboração pode ser mais interna ou revisada; não significam atraso obrigatório. O ponto prático é perceber quando uma reação protege um valor real e quando apenas repete uma defesa antiga. O recurso nasce ao criar intervalo suficiente para que duas necessidades legítimas sejam consideradas antes de uma decisão maior.`,
        anchors: [aspectId(firstAspect), aspectId(thirdAspect), "planet:saturn"],
        practicalDirection: "Quando surgir um conflito recorrente, escreva os dois lados como necessidades válidas, sem decidir imediatamente qual está certo. Depois escolha uma ação pequena que teste a realidade sem comprometer toda a decisão.",
      },
      {
        id: "integracao",
        title: "Transformar símbolo em escolha observável",
        body: `Integrar este mapa não significa eliminar contradições. Significa construir uma relação mais consciente entre ${sun.name}, ${moon.name}, ${venus.name}, ${mars.name} e os eixos do Ascendente e do Meio do Céu. A força de ${chart.dominantElement} pode oferecer continuidade, percepção ou impulso conforme o seu desenho, mas ganha maturidade quando encontra espaço para elementos menos enfatizados. ${aspectSentence(secondAspect)} sugere um recurso que cresce com uso deliberado: aquilo que parece natural também precisa de direção para não ficar apenas como potencial. O mapa se torna útil quando ajuda você a reconhecer padrões antes de chamá-los de destino. Seu critério final continua sendo a experiência concreta, a qualidade dos acordos e a margem de escolha disponível em cada situação.`,
        anchors: ["planet:sun", "planet:venus", aspectId(secondAspect), "angle:ascendant"],
        practicalDirection: "Escolha uma prática simples para os próximos sete dias: pausar antes de responder, registrar decisões, pedir um acordo claro ou concluir uma tarefa pequena. No fim do período, avalie o efeito real em vez de buscar confirmação simbólica.",
      },
    ],
    practices: [
      { title: "Três vozes da decisão", action: "Divida uma página em intenção, emoção e expressão externa. Preencha cada campo antes de uma escolha importante e procure onde existe acordo ou contradição.", purpose: "Aproximar Sol, Lua e Ascendente sem reduzir uma camada à outra." },
      { title: "Fato, expectativa e acordo", action: "Em uma situação afetiva, registre o que aconteceu, o que você imaginou e o que foi realmente combinado. Use essa separação antes da próxima conversa.", purpose: "Dar linguagem concreta às funções de Lua, Vênus e Marte." },
      { title: "Progresso visível", action: "Transforme uma ambição em uma entrega pequena com prazo e critério de conclusão. Observe se consistência produz mais clareza do que pressão.", purpose: "Usar Meio do Céu, Júpiter e Saturno como orientação de processo." },
      { title: "Intervalo entre forças", action: "Diante de um impasse, nomeie duas necessidades legítimas e espere alguns minutos antes de decidir. Escolha então um teste reversível.", purpose: "Converter a tensão dos aspectos em capacidade de negociação." },
      { title: "Revisão de sete dias", action: "No fim de cada dia, anote uma escolha, o resultado observado e o ajuste possível. Revise o conjunto depois de uma semana sem procurar perfeição.", purpose: "Levar a integração do mapa para uma experiência verificável." },
    ],
    reflectionQuestions: [
      "Em quais situações sua intenção consciente e sua necessidade emocional pedem caminhos diferentes?",
      "O que você costuma oferecer nos vínculos e o que espera que a outra pessoa adivinhe?",
      "Qual responsabilidade fortalece sua vocação e qual apenas consome energia sem direção?",
      "Que tensão recorrente pode ser tratada como negociação, em vez de falha pessoal?",
      "Qual gesto pequeno tornaria sua integração mais visível durante os próximos sete dias?",
    ],
    closing: `${name}, este documento é um mapa de relações simbólicas, não uma sentença sobre quem você é nem uma previsão de acontecimentos futuros. Voltar a ele pode ajudar a nomear padrões, comparar escolhas e reconhecer recursos que ficam invisíveis quando tudo parece urgente. A leitura ganha valor quando conversa com fatos, limites, vínculos e experiências reais. Você continua sendo a pessoa que observa, testa, recusa, escolhe e atribui sentido ao próprio caminho.`,
    audit: {
      usedFactIds: Object.keys(factLabels),
      factualConsistency: true,
      deterministicClaims: false,
    },
  };

  return {
    document,
    factLabels,
    meta: {
      schemaVersion: "2026-08-13.2",
      grounded: true,
      provider: "mock",
      model: "local-development",
      usedFallbackModel: false,
      rawBirthDataSent: false,
    },
  };
}

export { sectionIds as ASTRO911_MOCK_SECTION_IDS };
