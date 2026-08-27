export const astro911Sections = Object.freeze([
  Object.freeze({ id: "essencia", eyebrow: "I · Essência e presença" }),
  Object.freeze({ id: "personalidade", eyebrow: "II · Personalidade e expressão" }),
  Object.freeze({ id: "afetos", eyebrow: "III · Amor e relacionamentos" }),
  Object.freeze({ id: "vocacao", eyebrow: "IV · Carreira e vocação" }),
  Object.freeze({ id: "dinheiro", eyebrow: "V · Dinheiro e valores" }),
  Object.freeze({ id: "potenciais", eyebrow: "VI · Potenciais e expansão" }),
  Object.freeze({ id: "tensoes", eyebrow: "VII · Sombras e recursos" }),
  Object.freeze({ id: "integracao", eyebrow: "VIII · Síntese e integração" }),
]);

export const astro911SectionIds = Object.freeze(astro911Sections.map(({ id }) => id));

export const astro911SectionEyebrows = Object.freeze(Object.fromEntries(
  astro911Sections.map(({ id, eyebrow }) => [id, eyebrow]),
));
