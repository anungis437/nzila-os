// Impact evaluation for family F01 (cron / scheduler / webhook). Inventories every route that is driven by a scheduler or a
// provider callback and checks it against one contract. Read-only; prints a table and writes f01-impact.json.
//
// Contract for a scheduled (cron) route:
//   C1 exports POST only (a scheduler must not be able to change state with a GET, which a prefetcher or a link can send)
//   C2 authenticates with the shared secret check (verifyCronAuth) and nothing weaker
//   C3 answers a non-2xx status when the job fails (it must not log "completed" and answer 200)
//   C4 is registered in a scheduler entry (vercel.json) with a method the route accepts
const fs = require('fs')
const path = require('path')
const app = path.resolve(__dirname, '../../../../apps/union-eyes')
const walk = (d, out = []) => { for (const n of fs.readdirSync(d)) { const f = path.join(d, n); fs.statSync(f).isDirectory() ? walk(f, out) : n === 'route.ts' && out.push(f) } return out }
const routes = walk(path.join(app, 'app/api'))
const vercel = JSON.parse(fs.readFileSync(path.join(app, 'vercel.json'), 'utf8'))
const scheduled = new Set((vercel.crons || []).map((c) => c.path))
const rel = (f) => path.relative(path.join(app, 'app/api'), f).replace(/\\/g, '/').replace(/\/route\.ts$/, '')
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const methodsOf = (s) => {
  const found = new Set()
  for (const m of METHODS) if (new RegExp(`export\\s+(?:async\\s+function|const|let|function)\\s+${m}\\b`).test(s)) found.add(m)
  for (const b of s.matchAll(/export\s*\{([^}]*)\}/g)) for (const p of b[1].split(',')) { const n = p.trim().split(/\s+as\s+/).pop().trim(); if (METHODS.includes(n)) found.add(n) }
  return [...found].sort()
}
const rows = []
for (const f of routes) {
  const s = fs.readFileSync(f, 'utf8')
  const isCron = /verifyCronAuth|CRON_SECRET|cron:\s*true|cronAuth|auth:\s*\{[^}]*cron/i.test(s) || /^cron\//.test(rel(f))
  if (!isCron) continue
  const methods = methodsOf(s)
  const aliases = /export\s*\{[^}]*\bGET\b[^}]*\bPOST\b|GET\s*=\s*POST|POST\s*=\s*GET|export const GET = POST|export \{ handler as GET, handler as POST \}|as GET[\s\S]{0,80}as POST|as POST[\s\S]{0,80}as GET/.test(s)
  const failure = {
    returnsSuccessFalseAs200: /success:\s*false/.test(s) && !/status:\s*(5\d\d|4\d\d)/.test(s),
    swallows: /catch\s*(\([^)]*\))?\s*\{\s*\}/.test(s),
  }
  rows.push({
    route: '/api/' + rel(f),
    methods,
    C1_postOnly: methods.length === 1 && methods[0] === 'POST',
    getAliasesPost: aliases || (methods.includes('GET') && methods.includes('POST')),
    C2_sharedSecretCheck: /verifyCronAuth/.test(s),
    weakSecret: /CRON_SECRET/.test(s) && !/verifyCronAuth/.test(s),
    C3_failureSurfaced: !(failure.returnsSuccessFalseAs200 || failure.swallows),
    C4_scheduled: scheduled.has('/api/' + rel(f)),
  })
}
const proxy = fs.existsSync(path.join(app, 'proxy.ts')) ? fs.readFileSync(path.join(app, 'proxy.ts'), 'utf8') : ''
const cronApi = (proxy.match(/CRON_API_ROUTES\s*=\s*\[([\s\S]*?)\]/) || [, ''])[1].match(/['"][^'"]+['"]/g) || []
const doc = { cronRoutes: rows.length, scheduledEntries: [...scheduled], edgeCronRoutes: cronApi, violations: {
  C1_notPostOnly: rows.filter((r) => !r.C1_postOnly).map((r) => r.route),
  C2_noSharedSecretCheck: rows.filter((r) => !r.C2_sharedSecretCheck).map((r) => r.route),
  C3_failureNotSurfaced: rows.filter((r) => !r.C3_failureSurfaced).map((r) => r.route),
  C4_notScheduled: rows.filter((r) => !r.C4_scheduled).map((r) => r.route),
}, rows }
fs.writeFileSync(path.join(__dirname, 'f01-impact.json'), JSON.stringify(doc, null, 1) + '\n')
console.log(`cron routes ${rows.length}; scheduler entries ${scheduled.size}; edge-checked ${cronApi.length}`)
for (const [k, v] of Object.entries(doc.violations)) console.log(k.padEnd(26), String(v.length).padStart(3), v.slice(0, 40).join(' '))
