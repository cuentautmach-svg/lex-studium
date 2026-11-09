import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const baseline = JSON.parse(await readFile(new URL('docs/legal-baseline.json', root), 'utf8'));
const base = baseline.base;
const current = await readFile(new URL('index.html', root), 'utf8');
const digest = value => createHash('sha256').update(value).digest('hex');
const section = (source, start, end) => {
  const first = source.indexOf(start); assert.ok(first >= 0, start);
  const last = source.indexOf(end, first + start.length); assert.ok(last >= 0, end);
  return source.slice(first, last).trim();
};
const results = baseline.checks.map(({name, start, end, sha256: originalDigest}) => {
  const currentDigest = digest(section(current, start, end));
  assert.equal(currentDigest, originalDigest, name + ' debe conservarse');
  console.log('✓ ' + name + ': sin cambios');
  return { name, sha256: currentDigest, preserved: true };
});
await mkdir(new URL('artifacts/diseno-v2/', root), { recursive: true });
await writeFile(new URL('artifacts/diseno-v2/contenido.json', root), JSON.stringify({ base, date: new Date().toISOString(), results }, null, 2));
