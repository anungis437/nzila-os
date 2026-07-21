import fs from 'node:fs';
import path from 'node:path';

const primitives = ['badge','button','card','input','label','progress','separator','sheet','tabs','textarea'];
const ROOT = 'apps/union-eyes';

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.turbo') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|cjs|js)$/.test(entry.name)) out.push(p);
  }
  return out;
}

const files = walk(ROOT);
console.log(`operational files scanned: ${files.length}`);

const counts = Object.fromEntries(primitives.map(p => [p, { files: 0, imports: 0 }]));
const filesByPrim = Object.fromEntries(primitives.map(p => [p, new Set()]));

for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  for (const p of primitives) {
    const re = new RegExp(`from\\s+['"]@/components/ui/${p}['"]`, 'g');
    const m = c.match(re);
    if (m) {
      counts[p].files += 1;
      counts[p].imports += m.length;
      filesByPrim[p].add(f);
    }
  }
}

for (const p of primitives) {
  console.log(`  ${p.padEnd(12)} ${String(counts[p].files).padStart(4)} files  ${String(counts[p].imports).padStart(4)} imports`);
}
const total = new Set();
for (const p of primitives) for (const f of filesByPrim[p]) total.add(f);
console.log(`\ntotal operational files touching these primitives: ${total.size}`);
