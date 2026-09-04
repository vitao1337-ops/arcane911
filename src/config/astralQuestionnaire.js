export const astralQuestionnaireGroups = Object.freeze([
  Object.freeze({
    id: "clarity",
    question: "Qual área mais pede clareza na sua vida hoje?",
    options: Object.freeze([
      Object.freeze({ id: "work_money", label: "Trabalho e dinheiro" }),
      Object.freeze({ id: "love_reciprocity", label: "Amor e reciprocidade" }),
      Object.freeze({ id: "identity_purpose", label: "Identidade e propósito" }),
      Object.freeze({ id: "routine_energy", label: "Rotina e energia" }),
    ]),
  }),
  Object.freeze({
    id: "patterns",
    question: "Qual padrão você mais percebe se repetindo?",
    options: Object.freeze([
      Object.freeze({ id: "urgency_all_or_nothing", label: "Urgência e tudo ou nada" }),
      Object.freeze({ id: "excessive_demand", label: "Cobrança excessiva" }),
      Object.freeze({ id: "need_confirmation", label: "Precisar de confirmação" }),
      Object.freeze({ id: "overgiving", label: "Dar mais do que recebo" }),
    ]),
  }),
  Object.freeze({
    id: "traits",
    question: "Como você se reconhece e o que gostaria que entendessem sobre você?",
    options: Object.freeze([
      Object.freeze({ id: "determined_intense", label: "Determinado e intenso" }),
      Object.freeze({ id: "creative_visionary", label: "Criativo e visionário" }),
      Object.freeze({ id: "loyal_protective", label: "Leal e protetor" }),
      Object.freeze({ id: "analytical_demanding", label: "Analítico e exigente" }),
    ]),
  }),
]);

const allowedByGroup = new Map(astralQuestionnaireGroups.map((group) => [
  group.id,
  new Set(group.options.map((option) => option.id)),
]));

export function normalizeAstralQuestionnaire(value, { requireAnswers = false } = {}) {
  const normalized = {};
  for (const group of astralQuestionnaireGroups) {
    const source = Array.isArray(value?.[group.id]) ? value[group.id] : [];
    normalized[group.id] = [...new Set(source
      .map((item) => String(item ?? "").trim())
      .filter((item) => allowedByGroup.get(group.id).has(item)))]
      .slice(0, group.options.length);
    if (requireAnswers && normalized[group.id].length === 0) {
      const error = new Error("astral_questionnaire_incomplete");
      error.code = "astral_questionnaire_incomplete";
      throw error;
    }
  }
  return normalized;
}

export function labelAstralQuestionnaire(value) {
  const normalized = normalizeAstralQuestionnaire(value);
  return Object.fromEntries(astralQuestionnaireGroups.map((group) => {
    const chosen = new Set(normalized[group.id]);
    return [group.id, group.options.filter((option) => chosen.has(option.id)).map((option) => option.label)];
  }));
}
