const viteEnv = typeof import.meta.env === "object" ? import.meta.env : {};

function clean(value, fallback = "") {
  return String(value ?? fallback).trim().slice(0, 180);
}

const supportEmailCandidate = clean(viteEnv.VITE_SUPPORT_EMAIL).toLowerCase();
const supportEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(supportEmailCandidate)
  ? supportEmailCandidate
  : "";

export const legalConfig = Object.freeze({
  operatorName: clean(viteEnv.VITE_LEGAL_OPERATOR_NAME, "Arcane911"),
  supportEmail,
  siteUrl: clean(viteEnv.VITE_PUBLIC_SITE_URL),
  revisedAt: "28 de agosto de 2026",
  ready: Boolean(supportEmail && clean(viteEnv.VITE_LEGAL_OPERATOR_NAME)),
});
