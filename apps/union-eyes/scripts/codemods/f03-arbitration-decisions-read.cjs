const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.split(a).join(b)
  }
  fs.writeFileSync(f, s)
}
edit('lib/api/crud-factory.ts', [
  [`  /** A condition added to GET only for a caller below the steward floor`, `  /** A condition added to every GET, whatever the caller's role (for example, a restricted row of shared reference data is never listed). */
  readCondition?: SQL;
  /** A condition added to GET only for a caller below the steward floor`],
  [`        if (opts.belowStaffReadCondition && (await isBelowStaff(userId, organizationId))) conditions.push(opts.belowStaffReadCondition);`,
   `        if (opts.readCondition) conditions.push(opts.readCondition);
        if (opts.belowStaffReadCondition && (await isBelowStaff(userId, organizationId))) conditions.push(opts.belowStaffReadCondition);`],
])
for (const [f, extra] of [['app/api/arbitration/precedents/route.ts', 'GET, POST'], ['app/api/arbitration/precedents/[id]/route.ts', 'GET, PATCH, DELETE']]) {
  edit(f, [
    [`import { arbitrationDecisions } from '@/db/schema';`, `import { arbitrationDecisions } from '@/db/schema';\nimport { eq, isNull, or, and } from 'drizzle-orm';`],
    [`  readRole: 'member',`, `  readRole: 'member',
  // The row says whether it may be shared: a decision marked not public, or carrying an access restriction, is not listed
  // or returned to an organization at all (the table has no organization column to scope it by).
  readCondition: and(eq(arbitrationDecisions.isPublic, true), or(isNull(arbitrationDecisions.accessRestrictions), eq(arbitrationDecisions.accessRestrictions, ''))),`],
  ])
}
console.log('ok')
