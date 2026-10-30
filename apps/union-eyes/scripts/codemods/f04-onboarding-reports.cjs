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
  "  'onboarding': 'the generic CRUD factory over the pre-signup pending-profiles table, which the governance policy denies, while the onboarding form posts to it (so every submission was refused)',\n  'events/[id]/occurrences':",
]])
edit('lib/api/__tests__/roster-facades.contract.test.ts', [[
  "'wcb/claims', 'wcb/claims/[id]',",
  "'onboarding', 'wcb/claims', 'wcb/claims/[id]',",
]])
// A report definition is written by an author through these fields only: the creator, run counters and last-run time are the server's.
for (const f of ['app/api/reports/route.ts', 'app/api/reports/[id]/route.ts']) {
  edit(f, [[
    "  readRole: 'steward',\n",
    "  readRole: 'steward',\n  writableFields: ['name', 'description', 'reportType', 'category', 'config', 'templateId'],\n",
  ]])
}
console.log('ok')
