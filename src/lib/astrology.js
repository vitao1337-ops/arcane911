import * as horoscopeModule from "circular-natal-horoscope-js/dist/index.js";
import { Body, Ecliptic, GeoVector } from "astronomy-engine";

const horoscopePackage = horoscopeModule.default?.default
  ?? horoscopeModule.default
  ?? horoscopeModule;
const Horoscope = horoscopeModule.Horoscope ?? horoscopePackage.Horoscope;
const Origin = horoscopeModule.Origin ?? horoscopePackage.Origin;

export const zodiacSigns = [
  { key: "aries", name: "Áries", glyph: "♈", element: "Fogo", modality: "Cardinal", essence: "iniciativa, desejo direto e coragem para inaugurar", identity: "Você se reconhece quando pode começar, decidir e colocar energia em movimento.", emotion: "Seu mundo emocional reage rápido e precisa de espaço para sentir sem transformar toda sensação em urgência.", rising: "Você chega ao mundo com presença franca, ritmo próprio e uma impressão de movimento antes mesmo de explicar suas intenções." },
  { key: "taurus", name: "Touro", glyph: "♉", element: "Terra", modality: "Fixo", essence: "constância, sensorialidade e construção paciente", identity: "Você se fortalece quando transforma valor em algo concreto, estável e habitável.", emotion: "Seu afeto busca segurança, continuidade e tempo suficiente para confiar no que sente.", rising: "Você chega ao mundo com firmeza, cuidado com o ritmo e uma presença que prefere consistência a espetáculo." },
  { key: "gemini", name: "Gêmeos", glyph: "♊", element: "Ar", modality: "Mutável", essence: "curiosidade, troca e movimento mental", identity: "Você se reconhece quando pode perguntar, conectar informações e experimentar mais de uma perspectiva.", emotion: "Seu mundo emocional precisa de linguagem; nomear, conversar e circular ajuda você a compreender o que sente.", rising: "Você chega ao mundo com agilidade, curiosidade e uma impressão de abertura para tudo que ainda pode ser descoberto." },
  { key: "cancer", name: "Câncer", glyph: "♋", element: "Água", modality: "Cardinal", essence: "proteção, memória e inteligência afetiva", identity: "Você se fortalece quando pode criar pertencimento e proteger o que considera íntimo e verdadeiro.", emotion: "Seu mundo emocional registra atmosfera, memória e nuance; sentir segurança muda completamente a sua resposta.", rising: "Você chega ao mundo percebendo primeiro o clima do ambiente e só depois decide quanto de si será mostrado." },
  { key: "leo", name: "Leão", glyph: "♌", element: "Fogo", modality: "Fixo", essence: "expressão, vitalidade e autoria", identity: "Você se reconhece quando pode colocar coração, criatividade e assinatura própria no que faz.", emotion: "Seu afeto precisa de calor, lealdade e reconhecimento sincero para não se esconder atrás do orgulho.", rising: "Você chega ao mundo com calor, presença e uma impressão de que existe algo único querendo ocupar espaço." },
  { key: "virgo", name: "Virgem", glyph: "♍", element: "Terra", modality: "Mutável", essence: "discernimento, cuidado e aperfeiçoamento", identity: "Você se fortalece quando observa detalhes e transforma percepção em utilidade, método ou cuidado real.", emotion: "Seu mundo emocional tenta organizar o que sente; o desafio é não exigir perfeição para permitir vulnerabilidade.", rising: "Você chega ao mundo com atenção fina, leitura rápida do que precisa ser ajustado e uma presença discretamente precisa." },
  { key: "libra", name: "Libra", glyph: "♎", element: "Ar", modality: "Cardinal", essence: "relação, proporção e escolha compartilhada", identity: "Você se reconhece ao criar pontes, beleza e acordos que respeitem mais de um ponto de vista.", emotion: "Seu afeto procura reciprocidade e harmonia, mas precisa lembrar que paz não é o mesmo que evitar conflito.", rising: "Você chega ao mundo com elegância relacional, percepção do outro e uma impressão de abertura para o encontro." },
  { key: "scorpio", name: "Escorpião", glyph: "♏", element: "Água", modality: "Fixo", essence: "profundidade, desejo e transformação", identity: "Você se fortalece quando atravessa a superfície e encontra a verdade emocional que realmente move uma situação.", emotion: "Seu mundo emocional é intenso, seletivo e profundamente leal; confiança muda a profundidade da entrega.", rising: "Você chega ao mundo com magnetismo, reserva e uma impressão de que observa mais do que escolhe revelar." },
  { key: "sagittarius", name: "Sagitário", glyph: "♐", element: "Fogo", modality: "Mutável", essence: "sentido, expansão e busca", identity: "Você se reconhece quando existe horizonte, aprendizado e liberdade para crescer além da versão atual.", emotion: "Seu mundo emocional precisa de perspectiva e movimento, mas nem toda dor se resolve apenas olhando para longe.", rising: "Você chega ao mundo com franqueza, amplitude e uma impressão de que a vida sempre pode oferecer outro caminho." },
  { key: "capricorn", name: "Capricórnio", glyph: "♑", element: "Terra", modality: "Cardinal", essence: "estrutura, responsabilidade e construção de longo prazo", identity: "Você se fortalece quando assume autoria, sustenta um processo e vê o tempo transformar esforço em consistência.", emotion: "Seu mundo emocional busca confiabilidade e pode demorar a baixar a guarda; sentir não diminui sua competência.", rising: "Você chega ao mundo com sobriedade, direção e uma impressão de que leva a realidade e as consequências a sério." },
  { key: "aquarius", name: "Aquário", glyph: "♒", element: "Ar", modality: "Fixo", essence: "originalidade, visão coletiva e independência", identity: "Você se reconhece quando pode pensar diferente e colocar sua singularidade a serviço de algo maior.", emotion: "Seu mundo emocional precisa de espaço e perspectiva; compreender racionalmente não substitui viver o sentimento.", rising: "Você chega ao mundo com autonomia, imprevisibilidade e uma impressão de que não veio apenas para repetir estruturas." },
  { key: "pisces", name: "Peixes", glyph: "♓", element: "Água", modality: "Mutável", essence: "sensibilidade, imaginação e permeabilidade", identity: "Você se fortalece quando transforma percepção sutil em criação, compaixão ou sentido.", emotion: "Seu mundo emocional capta o que nem sempre foi dito; limites ajudam a distinguir intuição, desejo e atmosfera alheia.", rising: "Você chega ao mundo com delicadeza, imaginação e uma impressão de abertura para aquilo que não cabe em explicações rápidas." },
];

export const zodiacByKey = Object.fromEntries(zodiacSigns.map((sign) => [sign.key, sign]));

export const planetData = {
  sun: { name: "Sol", glyph: "☉", role: "identidade, vitalidade e direção consciente", astronomyBody: Body.Sun },
  moon: { name: "Lua", glyph: "☽", role: "necessidades emocionais, memória e resposta instintiva", astronomyBody: Body.Moon },
  mercury: { name: "Mercúrio", glyph: "☿", role: "pensamento, linguagem e forma de compreender", astronomyBody: Body.Mercury },
  venus: { name: "Vênus", glyph: "♀", role: "afeto, prazer, valores e modo de se vincular", astronomyBody: Body.Venus },
  mars: { name: "Marte", glyph: "♂", role: "desejo, coragem, conflito e capacidade de agir", astronomyBody: Body.Mars },
  jupiter: { name: "Júpiter", glyph: "♃", role: "expansão, confiança, aprendizado e oportunidade", astronomyBody: Body.Jupiter },
  saturn: { name: "Saturno", glyph: "♄", role: "limite, responsabilidade, tempo e maturação", astronomyBody: Body.Saturn },
  uranus: { name: "Urano", glyph: "♅", role: "ruptura, liberdade, invenção e mudança de padrão", astronomyBody: Body.Uranus },
  neptune: { name: "Netuno", glyph: "♆", role: "imaginação, idealização, espiritualidade e dissolução", astronomyBody: Body.Neptune },
  pluto: { name: "Plutão", glyph: "♇", role: "poder, crise, profundidade e transformação irreversível", astronomyBody: Body.Pluto },
};

export const planetOrder = Object.keys(planetData);

export const houseThemes = [
  "Identidade, corpo e modo de iniciar",
  "Recursos, valores e sustentação",
  "Comunicação, aprendizado e entorno",
  "Raízes, intimidade e pertencimento",
  "Criatividade, prazer e expressão",
  "Rotina, trabalho cotidiano e cuidado",
  "Parcerias, contratos e espelhos",
  "Intimidade, crise e transformação",
  "Crenças, expansão e visão de mundo",
  "Vocação, responsabilidade e imagem pública",
  "Amizades, redes e projetos futuros",
  "Inconsciente, recolhimento e encerramentos",
];

const aspectData = {
  conjunction: { name: "Conjunção", symbol: "☌", tone: "fusão", sentence: "concentra essas duas forças no mesmo ponto e aumenta a necessidade de integrá-las conscientemente" },
  opposition: { name: "Oposição", symbol: "☍", tone: "polaridade", sentence: "coloca essas forças em lados opostos e pede relação, medida e negociação entre elas" },
  square: { name: "Quadratura", symbol: "□", tone: "tensão", sentence: "produz atrito e movimento; aquilo que incomoda também força desenvolvimento" },
  trine: { name: "Trígono", symbol: "△", tone: "fluidez", sentence: "faz essas forças cooperarem com naturalidade, embora o talento precise ser usado para não ficar apenas potencial" },
  sextile: { name: "Sextil", symbol: "✶", tone: "oportunidade", sentence: "abre uma possibilidade de cooperação que cresce quando recebe iniciativa e prática" },
};

export const fallbackLocations = [
  { id: "br-sao-paulo", name: "São Paulo", admin1: "São Paulo", country: "Brasil", countryCode: "BR", latitude: -23.5505, longitude: -46.6333, timezone: "America/Sao_Paulo" },
  { id: "br-rio", name: "Rio de Janeiro", admin1: "Rio de Janeiro", country: "Brasil", countryCode: "BR", latitude: -22.9068, longitude: -43.1729, timezone: "America/Sao_Paulo" },
  { id: "br-belo-horizonte", name: "Belo Horizonte", admin1: "Minas Gerais", country: "Brasil", countryCode: "BR", latitude: -19.9167, longitude: -43.9345, timezone: "America/Sao_Paulo" },
  { id: "br-brasilia", name: "Brasília", admin1: "Distrito Federal", country: "Brasil", countryCode: "BR", latitude: -15.7939, longitude: -47.8828, timezone: "America/Sao_Paulo" },
  { id: "br-salvador", name: "Salvador", admin1: "Bahia", country: "Brasil", countryCode: "BR", latitude: -12.9777, longitude: -38.5016, timezone: "America/Bahia" },
  { id: "br-curitiba", name: "Curitiba", admin1: "Paraná", country: "Brasil", countryCode: "BR", latitude: -25.4284, longitude: -49.2733, timezone: "America/Sao_Paulo" },
  { id: "br-porto-alegre", name: "Porto Alegre", admin1: "Rio Grande do Sul", country: "Brasil", countryCode: "BR", latitude: -30.0346, longitude: -51.2177, timezone: "America/Sao_Paulo" },
  { id: "br-recife", name: "Recife", admin1: "Pernambuco", country: "Brasil", countryCode: "BR", latitude: -8.0476, longitude: -34.877, timezone: "America/Recife" },
  { id: "br-fortaleza", name: "Fortaleza", admin1: "Ceará", country: "Brasil", countryCode: "BR", latitude: -3.7319, longitude: -38.5267, timezone: "America/Fortaleza" },
  { id: "br-manaus", name: "Manaus", admin1: "Amazonas", country: "Brasil", countryCode: "BR", latitude: -3.119, longitude: -60.0217, timezone: "America/Manaus" },
];

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function angularDifference(first, second) {
  const difference = Math.abs(normalizeDegrees(first) - normalizeDegrees(second));
  return Math.min(difference, 360 - difference);
}

function degreeWithinSign(longitude) {
  return normalizeDegrees(longitude) % 30;
}

function formatDegree(value) {
  const degrees = Math.floor(value);
  const minutes = Math.round((value - degrees) * 60);
  return `${degrees}°${String(minutes === 60 ? 0 : minutes).padStart(2, "0")}'`;
}

function pointName(key) {
  if (planetData[key]) return planetData[key].name;
  if (key === "ascendant") return "Ascendente";
  if (key === "midheaven") return "Meio do Céu";
  return key;
}

function interpretPlanet(planet, sign, house) {
  return `${planet.name} fala de ${planet.role}. Em ${sign.name}, essa função procura ${sign.essence}. Na Casa ${house}, o aprendizado se manifesta principalmente em ${houseThemes[house - 1].toLowerCase()}.`;
}

function interpretAspect(aspect) {
  const definition = aspectData[aspect.aspectKey] ?? aspectData.conjunction;
  return `${pointName(aspect.point1Key)} e ${pointName(aspect.point2Key)} formam uma ${definition.name.toLowerCase()}: ${definition.sentence}.`;
}

function chartSynthesis({ sun, moon, ascendant, dominantElement }) {
  return `Seu mapa combina um Sol em ${sun.sign.name}, que busca ${sun.sign.essence}, com uma Lua em ${moon.sign.name}, cujo modo de sentir passa por ${moon.sign.essence}. O Ascendente em ${ascendant.sign.name} é a porta pela qual essa combinação encontra o mundo. A predominância de ${dominantElement} mostra a linguagem mais disponível no mapa; ela é potência, mas também pede espaço para os outros elementos não virarem território desconhecido.`;
}

function astronomyLongitude(body, date) {
  return normalizeDegrees(Ecliptic(GeoVector(body, date, true)).elon);
}

export function calculateNatalChart({ name, date, time, location }) {
  const [year, month, day] = String(date).split("-").map(Number);
  const [hour, minute] = String(time).split(":").map(Number);

  if (!name?.trim() || !year || !month || !day || !Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error("Preencha nome, data e horário de nascimento.");
  }

  if (!location || !Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude))) {
    throw new Error("Escolha uma cidade válida antes de calcular o mapa.");
  }

  const origin = new Origin({
    year,
    month: month - 1,
    date: day,
    hour,
    minute,
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
  });

  const horoscope = new Horoscope({
    origin,
    houseSystem: "equal-house",
    zodiac: "tropical",
    aspectPoints: ["bodies", "angles"],
    aspectWithPoints: ["bodies", "angles"],
    aspectTypes: ["major"],
  });

  const utcDate = origin.utcTime.toDate();
  const planets = planetOrder.map((key) => {
    const source = horoscope.CelestialBodies[key];
    const longitude = normalizeDegrees(source.ChartPosition.Ecliptic.DecimalDegrees);
    const sign = zodiacByKey[source.Sign.key];
    const house = source.House?.id ?? 1;
    const verificationLongitude = astronomyLongitude(planetData[key].astronomyBody, utcDate);
    const precisionDelta = angularDifference(longitude, verificationLongitude);

    return {
      key,
      name: planetData[key].name,
      glyph: planetData[key].glyph,
      role: planetData[key].role,
      longitude,
      degree: degreeWithinSign(longitude),
      degreeLabel: formatDegree(degreeWithinSign(longitude)),
      sign,
      house,
      retrograde: Boolean(source.isRetrograde),
      precisionDelta,
      interpretation: interpretPlanet(planetData[key], sign, house),
    };
  });

  const ascendantLongitude = normalizeDegrees(horoscope.Ascendant.ChartPosition.Ecliptic.DecimalDegrees);
  const midheavenLongitude = normalizeDegrees(horoscope.Midheaven.ChartPosition.Ecliptic.DecimalDegrees);
  const ascendantSign = zodiacByKey[horoscope.Ascendant.Sign.key];
  const midheavenSign = zodiacByKey[horoscope.Midheaven.Sign.key];
  const sun = planets.find((planet) => planet.key === "sun");
  const moon = planets.find((planet) => planet.key === "moon");

  const houses = horoscope.Houses.map((house) => {
    const cusp = normalizeDegrees(house.ChartPosition.StartPosition.Ecliptic.DecimalDegrees);
    const sign = zodiacSigns[Math.floor(cusp / 30) % 12];
    return {
      number: house.id,
      cusp,
      degreeLabel: formatDegree(degreeWithinSign(cusp)),
      sign,
      theme: houseThemes[house.id - 1],
      planets: planets.filter((planet) => planet.house === house.id).map((planet) => planet.key),
    };
  });

  const allowedAspectPoints = new Set([...planetOrder, "ascendant", "midheaven"]);
  const aspects = horoscope.Aspects.all
    .filter(
      (aspect) => allowedAspectPoints.has(aspect.point1Key)
        && allowedAspectPoints.has(aspect.point2Key)
        && aspectData[aspect.aspectKey],
    )
    .sort((first, second) => first.orb - second.orb)
    .slice(0, 14)
    .map((aspect) => ({
      ...aspect,
      name: aspectData[aspect.aspectKey].name,
      symbol: aspectData[aspect.aspectKey].symbol,
      tone: aspectData[aspect.aspectKey].tone,
      point1Name: pointName(aspect.point1Key),
      point2Name: pointName(aspect.point2Key),
      interpretation: interpretAspect(aspect),
    }));

  const elementScores = { Fogo: 0, Terra: 0, Ar: 0, Água: 0 };
  planets.forEach((planet) => {
    elementScores[planet.sign.element] += ["sun", "moon"].includes(planet.key) ? 2 : 1;
  });
  elementScores[ascendantSign.element] += 2;
  const dominantElement = Object.entries(elementScores).sort(([, first], [, second]) => second - first)[0][0];
  const maximumDelta = Math.max(...planets.map((planet) => planet.precisionDelta));

  const ascendant = {
    key: "ascendant",
    name: "Ascendente",
    glyph: "ASC",
    longitude: ascendantLongitude,
    degree: degreeWithinSign(ascendantLongitude),
    degreeLabel: formatDegree(degreeWithinSign(ascendantLongitude)),
    sign: ascendantSign,
  };

  const midheaven = {
    key: "midheaven",
    name: "Meio do Céu",
    glyph: "MC",
    longitude: midheavenLongitude,
    degree: degreeWithinSign(midheavenLongitude),
    degreeLabel: formatDegree(degreeWithinSign(midheavenLongitude)),
    sign: midheavenSign,
  };

  const chart = {
    id: `astro-${Date.now()}`,
    createdAt: new Date().toISOString(),
    person: name.trim(),
    birth: { date, time },
    location: {
      ...location,
      timezone: origin.timezone?.name ?? location.timezone,
    },
    method: "Zodíaco tropical · Casas Iguais",
    planets,
    houses,
    aspects,
    ascendant,
    midheaven,
    bigThree: [
      { key: "sun", eyebrow: "Identidade", title: `Sol em ${sun.sign.name}`, glyph: "☉", degreeLabel: sun.degreeLabel, text: sun.sign.identity },
      { key: "moon", eyebrow: "Mundo emocional", title: `Lua em ${moon.sign.name}`, glyph: "☽", degreeLabel: moon.degreeLabel, text: moon.sign.emotion },
      { key: "ascendant", eyebrow: "Primeira impressão", title: `Ascendente em ${ascendantSign.name}`, glyph: "ASC", degreeLabel: ascendant.degreeLabel, text: ascendantSign.rising },
    ],
    elementScores,
    dominantElement,
    precision: {
      status: maximumDelta <= 0.05 ? "verified" : "review",
      maximumDelta,
      label: maximumDelta <= 0.05 ? "Cálculo duplo verificado" : "Cálculo disponível para revisão",
    },
  };

  chart.synthesis = chartSynthesis({ sun, moon, ascendant, dominantElement });
  return chart;
}

export function buildAstroShareText(chart) {
  const planetLines = chart.planets
    .slice(0, 6)
    .map((planet) => `${planet.name}: ${planet.sign.name} ${planet.degreeLabel} · Casa ${planet.house}`)
    .join("\n");

  return `ARCANE911 · MAPA ASTRAL\n${chart.person}\n${chart.birth.date} às ${chart.birth.time} · ${chart.location.name}, ${chart.location.country}\n\nSol em ${chart.bigThree[0].title.replace("Sol em ", "")}\nLua em ${chart.bigThree[1].title.replace("Lua em ", "")}\nAscendente em ${chart.bigThree[2].title.replace("Ascendente em ", "")}\n\n${planetLines}\n\nSíntese\n${chart.synthesis}\n\nMétodo: ${chart.method}. Use o mapa como linguagem de autoconhecimento, não como sentença.`;
}

export async function searchBirthplaces(query, signal) {
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  if (normalizedQuery.length < 2) return [];

  const localMatches = fallbackLocations.filter((location) =>
    `${location.name} ${location.admin1} ${location.country}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery),
  );

  try {
    const endpoint = new URL("https://geocoding-api.open-meteo.com/v1/search");
    endpoint.searchParams.set("name", query.trim());
    endpoint.searchParams.set("count", "6");
    endpoint.searchParams.set("language", "pt");
    endpoint.searchParams.set("format", "json");

    const response = await fetch(endpoint, { signal });
    if (!response.ok) throw new Error("Falha ao consultar cidades.");
    const payload = await response.json();
    const remoteMatches = (payload.results ?? []).map((location) => ({
      id: String(location.id),
      name: location.name,
      admin1: location.admin1 ?? "",
      country: location.country ?? location.country_code,
      countryCode: location.country_code,
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      timezone: location.timezone,
    }));

    const seen = new Set();
    return [...remoteMatches, ...localMatches].filter((location) => {
      const key = `${location.name}-${location.latitude}-${location.longitude}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 6);
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    if (localMatches.length) return localMatches;
    throw new Error("Não foi possível buscar essa cidade agora. Tente novamente em instantes.");
  }
}
