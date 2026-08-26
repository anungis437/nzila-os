import fs from 'node:fs';
import path from 'node:path';

const primitives = ['badge','button','card','input','label','progress','separator','sheet','tabs','textarea'];
const ROOT = 'apps/union-eyes-demo';

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
let changed = 0;
let touchedFiles = 0;
for (const f of files) {
  let src = fs.readFileSync(f, 'utf8');
  let hadChange = false;
  for (const p of primitives) {
    // Match single or double quoted import from @/components/ui/<primitive>
    const patterns = [
      new RegExp(`(from\\s+)"@/components/ui/${p}"`, 'g'),
      new RegExp(`(from\\s+)'@/components/ui/${p}'`, 'g'),
    ];
    for (const re of patterns) {
      const before = src;
      src = src.replace(re, `$1"@nzila/union-eyes-ui/${p}"`);
      if (src !== before) {
        hadChange = true;
        const matches = before.match(re);
        changed += matches ? matches.length : 0;
      }
    }
  }
  if (hadChange) {
    fs.writeFileSync(f, src);
    touchedFiles += 1;
    console.log(`  edited ${path.relative(ROOT, f)}`);
  }
}
console.log(`\ntotal imports rewritten: ${changed}`);
console.log(`total files edited: ${touchedFiles}`);
