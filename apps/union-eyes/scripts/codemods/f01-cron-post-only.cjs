// F01a codemod: scheduled routes become POST-only, and every caller moves with them.
//   - GET-only routes: `export const GET = withApi(` becomes POST (the route doc comment follows).
//   - GET+POST aliases of one handler: the GET export and its comment are removed.
//   - rewards/cron: its own Authorization-only / CRON_SECRET-only check is replaced by the shared rule (lib/api/cron-secret.ts)
//     and its GET "reachability probe" is removed.
// Idempotent: a route already converted is reported as unchanged. Usage: node scripts/codemods/f01-cron-post-only.cjs
const fs = require('fs')
const path = require('path')
const app = path.resolve(__dirname, '../..')
const read = (f) => fs.readFileSync(f, 'utf8')
const write = (f, s) => fs.writeFileSync(f, s)
const report = []

function transform(file, steps) {
  const abs = path.join(app, file)
  const raw = read(abs)
  const crlf = raw.includes('\r\n')
  let s = raw.replace(/\r\n/g, '\n')
  const before = s
  for (const [name, fn] of steps) {
    const next = fn(s)
    if (next === null) { report.push(`${file}: step "${name}" did not match`); continue }
    s = next
  }
  if (s !== before) write(abs, crlf ? s.replace(/\n/g, '\r\n') : s)
  report.push(`${file}: ${s === before ? 'unchanged' : 'converted'}`)
}

const getOnly = ['cron/analytics/daily-metrics', 'cron/deadline-overdue', 'cron/deadline-reminders', 'cron/education-reminders', 'cron/monthly-dues', 'cron/overdue-notifications', 'cron/process-messages', 'cron/process-notifications', 'cron/scheduled-reports']
for (const r of getOnly) {
  transform(`app/api/${r}/route.ts`, [
    ['export', (s) => (/export const POST\b/.test(s) ? s : s.includes('export const GET = withApi(') ? s.replace('export const GET = withApi(', 'export const POST = withApi(') : null)],
    ['doc', (s) => s.replace(/\bGET (\/api\/(?:cron|rewards))/g, 'POST $1').replace(/\/\/ GET - /g, '// POST - ')],
  ])
}
for (const r of ['cron/document-intake-reaper', 'cron/external-data-sync', 'cron/location-retention', 'cron/monthly-per-capita']) {
  transform(`app/api/${r}/route.ts`, [
    ['alias', (s) => (/export const GET = handler;/.test(s) ? s.replace(/(?:\/\/ GET[^\n]*\n)?export const GET = handler;\n/, '').replace(/\/\/ POST for manual triggering\n/, '// POST only: a scheduler (lib/operations/scheduled-jobs.json) or an operator posts here; a GET can never run the job.\n') : s)],
  ])
}
transform('app/api/rewards/cron/route.ts', [
  ['auth', (s) => {
    if (!s.includes("const authHeader = request.headers.get('authorization');")) return s
    const start = s.indexOf('    // 1. Verify cron secret (timing-safe comparison)')
    const end = s.indexOf('    // 2. Get task parameter')
    if (start < 0 || end < 0) return null
    return s.slice(0, start) + "    // 1. Verify the cron secret with the rule shared with the edge check and withApi (lib/api/cron-secret.ts):\n    // x-cron-secret or a bearer token, CRON_SECRET_KEY then CRON_SECRET, constant time, unset never matches.\n    if (!(await cronSecretMatches(request.headers))) {\n      return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized');\n    }\n\n" + s.slice(end)
  }],
  ['import', (s) => s.replace("import { timingSafeEqual } from 'crypto';\n", "import { cronSecretMatches } from '@/lib/api/cron-secret';\n")],
  ['probe', (s) => { const i = s.indexOf('/**\n * GET handler'); return i < 0 ? s : s.slice(0, i).replace(/\n+$/, '\n') }],
  ['doc', (s) => s.replace(' * - Vercel Cron Jobs (vercel.json)\n * - External cron service (cron-job.org, etc.)\n * - Self-hosted cron daemon\n', ' * - the scheduled job declared in lib/operations/scheduled-jobs.json (POST, x-cron-secret)\n').replace(' * - secret: Verification token to prevent unauthorized execution\n', '').replace(' * Security: Requires CRON_SECRET environment variable', ' * Security: the cron secret (CRON_SECRET_KEY or CRON_SECRET), presented as x-cron-secret or a bearer token')],
])

// callers
transform('scripts/bootstrap-v2/next-http-smoke.ts', [
  ['smoke', (s) => s.replace("await request('cron-without-credential-denied', '/api/cron/deadline-reminders', [401])", "await request('cron-without-credential-denied', '/api/cron/deadline-reminders', [401], { method: 'POST' })").replace("await request('cron-with-credential', '/api/cron/deadline-reminders', [200], {\n    headers:", "await request('cron-with-credential', '/api/cron/deadline-reminders', [200], {\n    method: 'POST',\n    headers:")],
])
// vercel.json is not the scheduler of record; its one entry named a path with no method or secret
const vj = path.join(app, 'vercel.json')
const v = JSON.parse(read(vj))
if (v.crons) { delete v.crons; write(vj, JSON.stringify(v, null, 2) + '\n'); report.push('vercel.json: crons removed (scheduler of record is infrastructure/bicep/ue-v2, from lib/operations/scheduled-jobs.json)') } else report.push('vercel.json: unchanged')
console.log(report.join('\n'))
