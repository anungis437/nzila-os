const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}
edit('scripts/codemods/f02-domain-facades-501.cjs', [[
  "  'events/[id]/occurrences':",
  "  'communications/templates/[id]/duplicate': 'the generic CRUD factory over message templates (a template item; nothing is duplicated and its DELETE removed the template)',\n  'events/[id]/occurrences':",
]])
edit('lib/api/__tests__/roster-facades.contract.test.ts', [[
  "'communications/campaigns/[id]/schedule',",
  "'communications/templates/[id]/duplicate', 'communications/campaigns/[id]/schedule',",
]])
const limit = "    rateLimit: RATE_LIMITS.FINANCIAL_WRITE,\n"
for (const [f, anchors] of [
  ['app/api/pension/plans/route.ts', ["    auth: { required: true, roles: PENSION_ADMIN_ROLES },\n    openapi: { tags: ['Pension'], summary: 'Create pension plan'"]],
  ['app/api/pension/members/route.ts', ["    auth: { required: true, roles: PENSION_ADMIN_ROLES },\n    openapi: { tags: ['Pension'], summary: 'Enroll pension member'"]],
  ['app/api/pension/plans/[id]/route.ts', ["    auth: { required: true, roles: PENSION_ADMIN_ROLES },\n    openapi: { tags: ['Pension'], summary: 'Update pension plan'", "    auth: { required: true, roles: PENSION_ADMIN_ROLES },\n    openapi: { tags: ['Pension'], summary: 'Terminate pension plan'"]],
]) {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const a of anchors) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 60)}`)
    s = s.replace(a, a.replace("    openapi:", limit + "    openapi:"))
  }
  s = s.replace(/import \{ withApi, ApiError \} from '@\/lib\/api\/framework';/, "import { withApi, ApiError, RATE_LIMITS } from '@/lib/api/framework';")
  if (!s.includes('RATE_LIMITS }')) throw new Error(`${f}: import`)
  fs.writeFileSync(f, s)
}
console.log('ok')
