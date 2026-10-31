const fs = require('fs')
const path = require('path')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.split(a).join(b)
  }
  fs.writeFileSync(f, s)
}
fs.writeFileSync('lib/api/window-days.ts', `/** A report window in days: 1..365, with a non-numeric, fractional or out-of-range value refused rather than turned into NaN. */
export function parseWindowDays(raw: string | null, fallback = 30): number | null {
  if (raw === null) return fallback
  if (!/^[1-9][0-9]{0,2}$/.test(raw)) return null
  const days = Number(raw)
  return days <= 365 ? days : null
}
`)
fs.writeFileSync('lib/api/__tests__/window-days.test.ts', `import { describe, expect, it } from 'vitest'
import { parseWindowDays } from '../window-days'

// DEF-0B5-COGNITION-KPI window parameter: Number('abc') was NaN and reached the date arithmetic and the SQL.
describe('parseWindowDays', () => {
  it('uses the default when no window is given', () => expect(parseWindowDays(null)).toBe(30))
  it.each([['1', 1], ['30', 30], ['365', 365]])('accepts %s', (raw, days) => expect(parseWindowDays(raw)).toBe(days))
  it.each(['abc', '0', '-5', '366', '1.5', '', '1e2', '30days', ' 30'])('refuses %j', (raw) => expect(parseWindowDays(raw)).toBeNull())
})
`)
edit('app/api/cognition/kpis/route.ts', [
  [`import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';`, `import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';\nimport { parseWindowDays } from '@/lib/api/window-days';`],
  [`  const windowDays = Math.max(1, Math.min(365, Number(url.searchParams.get('windowDays') ?? '30')));`, `  const windowDays = parseWindowDays(url.searchParams.get('windowDays'));
  if (windowDays === null) {
    return NextResponse.json({ error: 'windowDays must be a whole number from 1 to 365' }, { status: 400 });
  }`],
])
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B43-F05-PARSED-WINDOWS-AND-VERIFIED-TELEMETRY'
if (ledger.batches.some((b) => b.id === ID)) { console.log('B43 present'); process.exit(0) }
const A = 'apps/union-eyes/'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
ledger.batches.push({
  id: ID,
  family: 'F05: a numeric query parameter is parsed into a bounded integer, and a telemetry body is bounded',
  evidenceCommit: null,
  items: [
    item('DEF-0B12-PLT-WORKSPACE-TELEMETRY-LOGS-UNBOUNDED-CLIENT-STRINGS-AND-HAS-NO-LIMIT', [A + 'app/api/workspace/telemetry/route.ts', A + 'app/api/__tests__/workspace-telemetry.route.test.ts'],
      'The telemetry body is bounded to 2 KB while it is streamed (not only by Content-Length), the payload is reduced to an allow-list of canonical event, tab and static route, and the client attests to no timestamp or workspace name (existing implementation and tests).',
      { status: 'PARTIAL', remaining: 'The route has no rate limit of its own beyond the member floor.' }),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B43 added')
