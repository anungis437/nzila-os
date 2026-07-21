// Demo import audit - Node script (avoids PowerShell wildcard gotchas)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'apps/union-eyes-demo';

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.isFile() && /\.(ts|tsx|mjs|cjs|js)$/.test(entry.name)) out.push(p);
  }
  return out;
}

const files = walk(ROOT);
console.log(`files: ${files.length}`);

const importsByFile = new Map();
const allImports = new Set();

const patterns = [
  /from\s+['"]([^'"]+)['"]/g,
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /^\s*import\s+['"]([^'"]+)['"]/gm,
];

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const fileImports = new Set();
  for (const re of patterns) {
    for (const m of content.matchAll(re)) {
      fileImports.add(m[1]);
      allImports.add(m[1]);
    }
  }
  importsByFile.set(f, [...fileImports]);
}

console.log(`unique imports: ${allImports.size}`);

const buckets = {
  'ui-primitives': [],
  'demo-local-components': [],
  'demo-local-lib': [],
  'BREACH-op-components': [],
  'BREACH-op-lib': [],
  'BREACH-op-db': [],
  'BREACH-op-other': [],
  'nzila-pkg': [],
  'next-or-react': [],
  'external': [],
  'relative': [],
};

const opBreachPaths = [];

// Alias resolution: `@/*` in apps/union-eyes-demo/tsconfig.json maps to the
// demo app root. An `@/foo/bar` import is DEMO-LOCAL iff a file exists at
// apps/union-eyes-demo/foo/bar(.ts|.tsx|.mjs|.cjs|.js|.d.ts) OR a directory
// exists at apps/union-eyes-demo/foo/bar containing an index.*.
// Otherwise it silently resolves nowhere in the demo (or would fall through
// to whatever a shared package/alias exposes), which is an operational
// boundary breach against the operational app that owns the same path.
const EXT_CANDIDATES = ['.ts', '.tsx', '.mjs', '.cjs', '.js', '.d.ts'];
function aliasResolvesInDemo(imp) {
  if (!imp.startsWith('@/')) return false;
  const rel = imp.slice(2); // strip "@/"
  const base = path.join(ROOT, rel);
  for (const ext of EXT_CANDIDATES) {
    if (fs.existsSync(base + ext)) return true;
  }
  // directory with index.*
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    for (const ext of EXT_CANDIDATES) {
      if (fs.existsSync(path.join(base, 'index' + ext))) return true;
    }
  }
  return false;
}

for (const imp of [...allImports].sort()) {
  if (/^@\/components\/ui\//.test(imp)) buckets['ui-primitives'].push(imp);
  else if (/^@\/components\/demo/.test(imp)) buckets['demo-local-components'].push(imp);
  else if (/^@\/lib\/demo/.test(imp)) buckets['demo-local-lib'].push(imp);
  else if (/^@\//.test(imp) && aliasResolvesInDemo(imp)) {
    // Alias resolves inside the demo app → demo-local shim. Classify by prefix.
    if (/^@\/components\//.test(imp)) buckets['demo-local-components'].push(imp);
    else if (/^@\/lib\//.test(imp)) buckets['demo-local-lib'].push(imp);
    else if (/^@\/db\//.test(imp)) buckets['demo-local-lib'].push(imp);
    else buckets['demo-local-lib'].push(imp);
  }
  else if (/^@\/components\//.test(imp)) { buckets['BREACH-op-components'].push(imp); opBreachPaths.push(imp); }
  else if (/^@\/db\//.test(imp)) { buckets['BREACH-op-db'].push(imp); opBreachPaths.push(imp); }
  else if (/^@\/lib\//.test(imp)) { buckets['BREACH-op-lib'].push(imp); opBreachPaths.push(imp); }
  else if (/^@\//.test(imp)) { buckets['BREACH-op-other'].push(imp); opBreachPaths.push(imp); }
  else if (/^@nzila\//.test(imp)) buckets['nzila-pkg'].push(imp);
  else if (/^(next|react|next-intl)/.test(imp)) buckets['next-or-react'].push(imp);
  else if (/^\./.test(imp)) buckets['relative'].push(imp);
  else buckets['external'].push(imp);
}

console.log('\n=== BUCKETS ===');
for (const [k, v] of Object.entries(buckets)) {
  console.log(`${k.padEnd(28)} ${v.length}`);
}

console.log('\n=== BREACH-op-components ===');
buckets['BREACH-op-components'].forEach(x => console.log(x));
console.log('\n=== BREACH-op-lib ===');
buckets['BREACH-op-lib'].forEach(x => console.log(x));
console.log('\n=== BREACH-op-db ===');
buckets['BREACH-op-db'].forEach(x => console.log(x));
console.log('\n=== BREACH-op-other ===');
buckets['BREACH-op-other'].forEach(x => console.log(x));

console.log('\n=== ui-primitives ===');
buckets['ui-primitives'].forEach(x => console.log(x));

console.log('\n=== nzila-pkg ===');
buckets['nzila-pkg'].forEach(x => console.log(x));

console.log('\n=== external ===');
buckets['external'].forEach(x => console.log(x));

console.log('\n=== relative (demo-internal) ===');
buckets['relative'].forEach(x => console.log(x));

// Write machine-readable output
fs.mkdirSync('reports/wave0', { recursive: true });
fs.writeFileSync('reports/wave0/demo-import-audit.json', JSON.stringify({
  scannedFiles: files.length,
  uniqueImports: allImports.size,
  buckets,
  breachCount: opBreachPaths.length,
  breachPaths: opBreachPaths.sort(),
  filesWithBreaches: [...importsByFile.entries()]
    .filter(([, imps]) => imps.some(i => opBreachPaths.includes(i)))
    .map(([f, imps]) => ({ file: f.replace(/\\/g, '/'), breachedImports: imps.filter(i => opBreachPaths.includes(i)).sort() }))
    .sort((a, b) => a.file.localeCompare(b.file)),
}, null, 2));

console.log(`\nWrote reports/wave0/demo-import-audit.json`);
console.log(`Total operational-boundary breaches: ${opBreachPaths.length}`);
console.log(`Files with breaches: ${[...importsByFile.entries()].filter(([, imps]) => imps.some(i => opBreachPaths.includes(i))).length}`);
