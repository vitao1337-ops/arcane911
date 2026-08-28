import './prepare-runtime.mjs';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile, readdir, unlink } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const root = new URL('../', import.meta.url);
const compressed = await readFile(new URL('data/birthplaces-geonames.json.gz', root));
const checksum = createHash('sha256').update(compressed).digest('hex');
const output = new URL('public/geo/', root);
const stamp = new URL('version.txt', output);
if ((await readFile(stamp, 'utf8').catch(() => '')) !== checksum) {
  const rows = JSON.parse(gunzipSync(compressed));
  const shards = new Map();
  for (const row of rows) {
    const keys = new Set(row[8].split('|').map((name) => name.slice(0, 2)).filter((key) => /^[a-z]{2}$/u.test(key)));
    for (const key of keys) {
      if (!shards.has(key)) shards.set(key, []);
      shards.get(key).push(row);
    }
  }
  await mkdir(output, { recursive: true });
  for (const name of await readdir(output)) {
    if (/^[a-z]{2}\.json$/u.test(name) && !shards.has(name.slice(0, 2))) await unlink(new URL(name, output));
  }
  for (const [key, values] of shards) {
    values.sort((a, b) => b[7] - a[7]);
    await writeFile(new URL(`${key}.json`, output), JSON.stringify(values));
  }
  await writeFile(stamp, checksum);
  console.info(`[Arcane911] ${rows.length} cidades preparadas localmente; nenhuma consulta externa.`);
}
