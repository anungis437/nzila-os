// Classifies every not-yet-corrected Gate 0 defect into a fix family and measures its impact surface (routes, files, shared
// mechanisms named in its own text). Deterministic and rerunnable; writes families.json beside this script. It reads the frozen
// Gate 0C.1 register and the canonical overlay and changes neither.
const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../../../..')
const register = JSON.parse(fs.readFileSync(path.join(root, 'docs/union-eyes/convergence/register/ue-route-classification-0c1.json'), 'utf8')).defectRegister
const overlay = JSON.parse(fs.readFileSync(path.join(__dirname, 'ue-all-777-remediation-register.json'), 'utf8')).records
const done = new Set(overlay.filter((r) => r.engineeringCorrection && r.engineeringCorrection.state === 'IMPLEMENTED_SOURCE_PENDING_VS_VALIDATION').map((r) => r.defectId))
const partial = new Set(overlay.filter((r) => r.engineeringCorrection && r.engineeringCorrection.state === 'PARTIAL_SOURCE_REMAINING_WORK').map((r) => r.defectId))

// Ordered: the first family whose pattern matches owns the defect, so each defect is counted exactly once.
const FAMILIES = [
  ['F01-CRON-SCHEDULER-WEBHOOK', /\bcron\b|scheduler|webhook|svix|redeliver|nightly|hourly|vercel\.json|CRON_SECRET|sweep\b|watchdog|reaper/i, 'Scheduled and provider-driven jobs: method, secret, scheduling, replay and failure reporting'],
  ['F02-PLACEHOLDER-FABRICATED-OR-NOT-IMPLEMENTED', /fixed (literal|rate|value)|constant (content|list|value)|fabricat|placeholder|hard-?coded|literal values?|invented|stub\b|presented as a result|answers? (HTTP )?200 (with|for|even)|nothing (sends|syncs|is stored)|no (route|worker|service|sender|subscriber|consumer) (reads|sends|calls|imports)|never (sends|reads|runs)|advertis/i, 'Stubs, fabricated figures and false-success answers: return 501 or implement for real'],
  ['F03-CROSS-TENANT-SYSTEM-ROLE-AND-SCOPE', /system role|cross-tenant|bypass(es)? row-level|no organization (column|predicate|scope)|every organization|another organization|all organizations|tenant (predicate|scope|isolation)|organization-only/i, 'Tenant and system-role scope: add real predicates or kernel decisions'],
  ['F04-MASS-ASSIGNMENT-AND-GENERIC-CRUD', /generic CRUD|crudRoutes|CRUD factory|whole (request )?body|every body field|copies? (the )?(request )?body|body fields? (is|are) (copied|stored)|facade/i, 'Generic-CRUD exposure and mass assignment: allow-lists, governance classification, response projection'],
  ['F05-INPUT-VALIDATION-AND-BOUNDS', /unvalidated|no (zod )?schema|without a schema|unbounded|no (row )?limit|no page|NaN|answers? 500|raw database|constraint (failure|clash)|length|malformed|not validated|no size cap|uncapped/i, 'Input validation, size and pagination bounds, and structured errors instead of 500s'],
  ['F06-AUDIT-ATOMICITY-AND-ACCESS-RECORDS', /audit/i, 'Audit atomicity, completeness and access records'],
  ['F07-AUTHORIZATION-ROLE-FLOOR-AND-OBJECT-LEVEL', /role floor|member floor|steward floor|minimum role|any member|every member|any steward|object-level|ownership|sensitivity|confidential|privileg|kernel decision|not a kernel|eligib|authority/i, 'Authorization beyond a role floor: object-level ownership, sensitivity and kernel decisions'],
  ['F08-PII-DISCLOSURE-AND-PROJECTION', /\bPII\b|e-?mail|phone|address|identity|token|credential|disclos|returns? (the )?(whole|every|all)|projection|redact|personal|birth|salary|medical/i, 'Personal-data disclosure: project, redact or restrict returned fields'],
  ['F09-RATE-LIMIT-IDEMPOTENCY-REPLAY', /rate.?limit|idempoten|replay|throttl|abuse|duplicate|double.?count|repeat(s|ed)? on every/i, 'Abuse controls: rate limits, idempotency keys and replay protection'],
  ['F10-FINANCIAL-AND-PAYMENT', /dues|payment|stripe|invoice|ledger|remit|per.?capita|billing|refund|money|currency|cost/i, 'Financial and payment integrity'],
  ['F11-AI-GOVERNANCE', /\bAI\b|\bML\b|model|LLM|prediction|embedding|prompt|chatbot|copilot/i, 'AI governance: consent, sensitivity, explainability and human accountability'],
  ['F12-OTHER-ROUTE-SPECIFIC', /./, 'Route-specific defects with no shared mechanism yet'],
]
const classify = (title) => FAMILIES.find(([, re]) => re.test(title))[0]
const routesIn = (t) => [...new Set([...t.matchAll(/\/api\/[A-Za-z0-9_\-/[\]{}.]+/g)].map((m) => m[0].replace(/[.,;)]+$/, '')))]
const filesIn = (t) => [...new Set([...t.matchAll(/\b((?:lib|app|services|db)\/[A-Za-z0-9_\-/.[\]]+\.(?:ts|tsx|mjs))\b/g)].map((m) => m[1]))]

const out = {}
for (const [id, , purpose] of FAMILIES) out[id] = { purpose, defects: 0, severity: { HIGH: 0, MEDIUM: 0, LOW: 0 }, routes: new Set(), files: new Set(), tranches: {}, ids: [] }
let outstanding = 0
for (const d of register) {
  if (done.has(d.id)) continue
  outstanding += 1
  const fam = classify(d.title)
  const f = out[fam]
  f.defects += 1
  f.severity[d.severity] += 1
  f.tranches[d.tranche] = (f.tranches[d.tranche] || 0) + 1
  routesIn(d.title).forEach((r) => f.routes.add(r))
  filesIn(d.title).forEach((x) => f.files.add(x))
  f.ids.push({ id: d.id, severity: d.severity, partial: partial.has(d.id) || undefined })
}
const summary = Object.entries(out).map(([family, f]) => ({ family, purpose: f.purpose, defects: f.defects, severity: f.severity, namedRoutes: f.routes.size, namedFiles: f.files.size, tranches: f.tranches }))
const doc = { generated: 'deterministic from the frozen register and the overlay', population: register.length, corrected: done.size, partial: partial.size, outstanding, accountedFor: summary.reduce((a, s) => a + s.defects, 0), families: summary, members: Object.fromEntries(Object.entries(out).map(([k, f]) => [k, f.ids])) }
if (doc.accountedFor !== outstanding || doc.corrected + doc.outstanding !== register.length) throw new Error('family accounting does not reconcile')
fs.writeFileSync(path.join(__dirname, 'families.json'), JSON.stringify(doc, null, 1) + '\n')
console.log(`population ${doc.population} corrected ${doc.corrected} outstanding ${doc.outstanding} (of which partial ${doc.partial})`)
for (const s of summary) console.log(String(s.defects).padStart(4), s.family.padEnd(46), `H${s.severity.HIGH} M${s.severity.MEDIUM} L${s.severity.LOW}`.padEnd(14), `routes:${s.namedRoutes} files:${s.namedFiles}`)
