import { fallbackLocations } from "../data/birthplaces.js";
import { searchLocalBirthplaces } from "./birthplaces.js";

const fold = (value) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "")
  .toLocaleLowerCase("pt-BR")
  .trim();

export async function searchBirthplaces(query, signal) {
  const normalizedQuery = fold(query);
  if (normalizedQuery.length < 2) return [];

  const localMatches = fallbackLocations.filter((location) =>
    fold(`${location.name} ${location.admin1} ${location.country}`).includes(normalizedQuery),
  );
  const exactLocalMatches = localMatches.filter((location) => fold(location.name) === normalizedQuery);

  // As capitais em destaque já têm coordenadas e fuso revisados. Não há motivo
  // para baixar um índice mundial de megabytes quando o nome é uma correspondência exata.
  if (exactLocalMatches.length) return exactLocalMatches;

  try {
    const remoteMatches = await searchLocalBirthplaces(query, signal);

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
