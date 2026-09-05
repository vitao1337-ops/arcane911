import { fallbackLocations } from "../data/birthplaces.js";
import { resolveBirthInstant } from "./birthTime.js";
import * as horoscopeModule from "circular-natal-horoscope-js/dist/index.js";
import { Body, Ecliptic, GeoVector } from "astronomy-engine";

export { fallbackLocations } from "../data/birthplaces.js";
export { searchBirthplaces } from "./birthplaceSearch.js";

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
  const totalMinutes = Math.floor(Math.max(0, Number(value) || 0) * 60);
  const degrees = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${degrees}°${String(minutes).padStart(2, "0")}'`;
}

function daysInMonth(year, month) {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function localDateKey(date = new Date()) {
  return Number(`${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`);
}

function cleanLocationText(value, maximumLength) {
  return String(value ?? "").replace(/\s+/gu, " ").trim().slice(0, maximumLength);
}

function normalizeLocation(location) {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);
  const name = cleanLocationText(location?.name, 100);
  const country = cleanLocationText(location?.country ?? location?.countryCode, 80);
  if (!name || !country || !Number.isFinite(latitude) || !Number.isFinite(longitude)
      || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("Escolha uma cidade válida antes de calcular o mapa.");
  }
  return {
    id: cleanLocationText(location?.id, 100) || `${latitude}:${longitude}`,
    name,
    admin1: cleanLocationText(location?.admin1, 100),
    country,
    countryCode: cleanLocationText(location?.countryCode, 8).toUpperCase(),
    latitude,
    longitude,
    timezone: cleanLocationText(location?.timezone, 100),
  };
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

export function calculateNatalChart({ name, date, time, location, utcOffsetMinutes }) {
  const normalizedName = String(name ?? "").replace(/\s+/gu, " ").trim().slice(0, 60);
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(String(date ?? ""));
  const timeMatch = /^(\d{2}):(\d{2})$/u.exec(String(time ?? ""));
  if (normalizedName.length < 2 || !dateMatch || !timeMatch) {
    throw new Error("Preencha nome completo, data e horário de nascimento.");
  }

  const [, yearText, monthText, dayText] = dateMatch;
  const [, hourText, minuteText] = timeMatch;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const dateKey = Number(`${yearText}${monthText}${dayText}`);
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)
      || hour < 0 || hour > 23 || minute < 0 || minute > 59 || dateKey > localDateKey()) {
    throw new Error("Informe uma data de nascimento válida, entre 1900 e hoje, e confira o horário.");
  }

  const normalizedLocation = normalizeLocation(location);

  const origin = new Origin({
    year,
    month: month - 1,
    date: day,
    hour,
    minute,
    latitude: normalizedLocation.latitude,
    longitude: normalizedLocation.longitude,
  });

  const timezone = normalizedLocation.timezone || origin.timezone.name;
  const instant = resolveBirthInstant({ date, time, timezone, utcOffsetMinutes });
  const deltaMs = instant.date.getTime() - origin.utcTime.valueOf();
  origin.utcTime = origin.utcTime.clone().add(deltaMs, 'milliseconds');
  origin.utcTimeFormatted = origin.utcTime.format();
  origin.localTime = origin.utcTime.clone().utcOffset(instant.offset);
  origin.localTimeFormatted = origin.localTime.format();
  origin.timezone = { name: timezone };
  origin.julianDate += deltaMs / 86400000;
  origin.localSiderealTime = normalizeDegrees(origin.localSiderealTime + 360.98564736629 * deltaMs / 86400000);

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
  if (planets.length !== 10 || !sun || !moon || !ascendantSign || !midheavenSign
      || planets.some((planet) => !planet.sign || !Number.isFinite(planet.longitude))) {
    throw new Error("O cálculo do mapa não foi concluído. Confira os dados e tente novamente.");
  }

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
  if (houses.length !== 12 || new Set(houses.map((house) => house.number)).size !== 12
      || aspects.length < 3 || !Number.isFinite(maximumDelta)) {
    throw new Error("O cálculo do mapa chegou incompleto. Confira os dados e tente novamente.");
  }

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
    person: normalizedName,
    birth: { date: `${yearText}-${monthText}-${dayText}`, time: `${hourText}:${minuteText}`,
      utcOffsetMinutes: instant.offset, utc: instant.date.toISOString() },
    location: {
      ...normalizedLocation,
      timezone: origin.timezone?.name ?? normalizedLocation.timezone,
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
      label: maximumDelta <= 0.05 ? "Posições planetárias conferidas em dois motores" : "Cálculo disponível para revisão",
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
