import { cacheAstro911Document } from './astro911.js';

// The server authorizes recovery; browser records are only hints for the page
// to revalidate. No payment is granted from these records alone.
export function restorePaidPurchase(payload) {
  const content = payload?.content;
  const entitlement = payload?.entitlement;
  if (!content?.authorized || !entitlement) return false;
  try {
    const storage = window.sessionStorage;
    const chart = content.snapshot?.chart;
    if (chart) {
      storage.setItem('arcane911.astral.v2', JSON.stringify({ savedAt: new Date().toISOString(), chart }));
      const document = content.results?.find((item) => item.scope === 'single')?.payload;
      if (document) cacheAstro911Document(chart, document);
      return true;
    }
    const results = content.results || [];
    const reading = results.find((item) => item.input?.reading?.cardSlugs?.length === 7)?.input.reading;
    const draft = content.snapshot?.reading;
    if (draft?.kind === 'specific') {
      storage.setItem(`arcane911.specific-reading.v1:${draft.slug}:${draft.parentReadingId || 'standalone'}`, JSON.stringify(draft));
    }
    if (reading || draft?.openingCards?.length === 3) {
      const session = reading ? {
        createdAt: reading.createdAt, intentId: reading.intentId, question: reading.question,
        readingMode: reading.readingMode || 'acolhedora',
        openingCards: [reading.cardSlugs[0], reading.cardSlugs[1], reading.cardSlugs[5]],
        completeCards: reading.cardSlugs,
      } : draft;
      storage.setItem('arcane911.active-reading.v1', JSON.stringify(session));
      storage.setItem(`arcane911.included-specific.v1:${entitlement.readingId}`,
        JSON.stringify(results.filter((item) => item.scope === 'specific_summary').map((item) => item.slot)));
    }
    const specific = results.find((item) => item.input?.reading?.cardSlugs?.length === 5)?.input.reading;
    if (specific && entitlement.readingSlug) {
      const parent = entitlement.offerContext === 'complete_reading' ? specific.parentReadingId : '';
      storage.setItem(`arcane911.specific-reading.v1:${entitlement.readingSlug}:${parent || 'standalone'}`,
        JSON.stringify({ readingId: specific.createdAt, question: specific.question, phase: 'reading', cards: specific.cardSlugs }));
    }
    return true;
  } catch { return false; }
}
