import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';

// astronomy-engine 2.1.19 publishes its ESM entry as .js without a module
// package boundary. Vercel disables Node's automatic syntax detection.
// Declare only that ESM directory as a module; leave its CJS entry untouched.
const require = createRequire(import.meta.url);
const root = dirname(require.resolve('astronomy-engine'));
const entry = await readFile(join(root, 'esm', 'astronomy.js'), 'utf8');
if (!entry.includes('export ')) throw new Error('Unexpected astronomy-engine ESM entry.');
const file = join(root, 'esm', 'package.json');
const existing = JSON.parse(await readFile(file, 'utf8').catch(() => '{}'));
if (existing.type !== 'module') {
  await writeFile(file, `${JSON.stringify({ ...existing, type: 'module' }, null, 2)}\n`);
}
