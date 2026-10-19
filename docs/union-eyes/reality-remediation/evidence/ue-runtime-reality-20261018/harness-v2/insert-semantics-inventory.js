// Static, credential-free inventory of Drizzle insert semantics versus the Django-owned table set.
// Purpose: replace the blunt "523 uuid ids without a default" statistic with an upper bound derived from actual
// insert call sites. Run from apps/union-eyes:  node <path>/insert-semantics-inventory.js > inventory.json
// Result is an UPPER BOUND on tables that need an id/NOT-NULL default decision: a table only needs one if the
// Drizzle insert omits the column AND the live column has no default (confirm with the governed read-only catalog check).
const fs = require('fs'), path = require('path'), cp = require('child_process');
const SKIP = new Set(['node_modules', '.next', '__tests__', 'tests', 'migrations', 'migrations-cache', 'migrations-platform', 'migrations-audit']);
const walk = (d, ok, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (SKIP.has(e.name)) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p, ok, out); else if (ok(p)) out.push(p); } return out; };
const django = new Set();
for (const f of walk('backend', (p) => /models\.py$/.test(p))) for (const m of fs.readFileSync(f, 'utf8').matchAll(/db_table\s*=\s*["']([^"']+)["']/g)) django.add(m[1]);
const varToTable = {};
for (const f of walk('db/schema', (p) => p.endsWith('.ts'))) for (const m of fs.readFileSync(f, 'utf8').matchAll(/export const (\w+)\s*=\s*pgTable\(\s*["']([^"']+)["']/g)) varToTable[m[1]] = m[2];
const sites = {};
for (const root of ['app', 'lib', 'actions', 'services', 'db/queries']) {
  if (!fs.existsSync(root)) continue;
  for (const f of walk(root, (p) => /\.(ts|tsx)$/.test(p) && !/\.test\.|\.spec\./.test(p))) {
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(/\.insert\(\s*(\w+)\s*\)/g)) { const t = varToTable[m[1]]; if (t) (sites[t] ??= new Set()).add(f.replace(/\\/g, '/')); }
  }
}
const inserted = Object.keys(sites).sort();
const djangoOwnedInserted = inserted.filter((t) => django.has(t));
const commit = cp.execSync('git rev-parse HEAD').toString().trim();
console.log(JSON.stringify({
  note: 'Upper bound from static analysis; not a live-catalog result.',
  sourceCommit: commit,
  counts: { djangoTables: django.size, drizzleTables: Object.keys(varToTable).length, tablesWithDrizzleInsertSites: inserted.length, djangoOwnedAndInserted: djangoOwnedInserted.length },
  tranche1AcceptanceCritical: ['profiles', 'grievances', 'grievance_deadlines', 'claims', 'claim_updates', 'documents', 'in_app_notifications', 'steward_assignments'].filter((t) => djangoOwnedInserted.includes(t)),
  djangoOwnedAndInserted: djangoOwnedInserted.map((t) => ({ table: t, insertSiteFiles: sites[t].size })),
}, null, 1));