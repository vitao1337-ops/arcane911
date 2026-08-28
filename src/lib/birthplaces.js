const cache = new Map();
const fold = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase().trim();

export async function searchLocalBirthplaces(query, signal) {
  const needle = fold(query);
  const prefix = needle.slice(0, 2);
  if (!/^[a-z]{2}$/u.test(prefix)) return [];
  let rows = cache.get(prefix);
  if (!rows) {
    const response = await fetch(`/geo/${prefix}.json`, { signal });
    if (response.status === 404) return [];
    if (!response.ok) throw new Error('Não foi possível carregar o índice de cidades.');
    rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('Índice de cidades indisponível.');
    cache.set(prefix, rows);
    while (cache.size > 5) cache.delete(cache.keys().next().value);
  }
  const countries = new Intl.DisplayNames(['pt-BR'], { type: 'region' });
  return rows.filter((row) => row[8].split('|').some((name) => name.startsWith(needle)))
    .sort((a, b) => Number(fold(b[1]) === needle) - Number(fold(a[1]) === needle)
      || Number(b[3] === 'BR') - Number(a[3] === 'BR') || b[7] - a[7])
    .slice(0, 8).map(([id, name, admin1, countryCode, latitude, longitude, timezone]) => ({
      id: `geonames-${id}`, name, admin1, countryCode, country: countries.of(countryCode) || countryCode,
      latitude, longitude, timezone,
    }));
}
