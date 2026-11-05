const fs = require('fs')
const file = 'lib/api/crud-factory.ts'
let t = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')

const from = `        if (ownerCol && userId) {
          conditions.push(eq(ownerCol, userId));
        }
        const lowRole = await readScope(userId, organizationId);`
const to = `        if (ownerCol && userId && !(await staffMayReadAll(userId, organizationId))) {
          conditions.push(eq(ownerCol, userId));
        }
        const lowRole = await readScope(userId, organizationId);`
const parts = t.split(from)
if (parts.length !== 3) throw new Error(`expected 2 read sites, found ${parts.length - 1}`)
t = parts.join(to)
t = t.split(`        const lowRole = await readScope(userId, organizationId);`).join(`        if (opts.belowStaffReadCondition && (await isBelowStaff(userId, organizationId))) conditions.push(opts.belowStaffReadCondition);
        const lowRole = await readScope(userId, organizationId);`)

t = t.replace(
  `  /** With an ownerColumn: the owner may delete their own row`,
  `  /**
   * With an ownerColumn: a caller at or above the steward floor reads every row of the organization on GET, while a member
   * still reads only their own. Writes keep the owner scope, so staff reading a member's record never edits it as the member.
   */
  staffReadsAll?: boolean;
  /** A condition added to GET only for a caller below the steward floor (for example, hiding unpublished rows from members). */
  belowStaffReadCondition?: SQL;
  /** With an ownerColumn: the owner may delete their own row`,
)
t = t.replace(
  `  const omitted = new Set(opts.omitFromResponse ?? []);`,
  `  async function staffMayReadAll(userId: string, organizationId: string | null | undefined): Promise<boolean> {
    if (!opts.staffReadsAll) return false;
    return !(await isBelowStaff(userId, organizationId));
  }

  const omitted = new Set(opts.omitFromResponse ?? []);`,
)
t = t.replace(
  `import { lowRoleModeFor, ownRowsScope, resolveLowRoleScope } from './crud-low-role-guard';`,
  `import { isBelowStaff, lowRoleModeFor, ownRowsScope, resolveLowRoleScope } from './crud-low-role-guard';`,
)
fs.writeFileSync(file, t)

const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 50)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}
// Staff (steward and above) administer registrations and certifications, so they read every member's; a member keeps their own.
for (const f of ['app/api/education/registrations/route.ts', 'app/api/education/certifications/route.ts']) {
  edit(f, [["  ownerColumn: 'memberId',\n", "  ownerColumn: 'memberId',\n  staffReadsAll: true,\n"]])
}
// A session row carries the virtual-meeting link, its access code and the budget and actual cost: those are staff-only.
edit('app/api/education/sessions/route.ts', [[
  "  readRole: 'member',\n",
  "  readRole: 'member',\n  // The access code and the budget and actual cost are for staff; the factory has no per-role column view, so no one reads them here.\n  omitFromResponse: ['virtualMeetingAccessCode', 'sessionBudget', 'actualCost'],\n",
]])
edit('app/api/education/courses/route.ts', [[
  "  readRole: 'member',\n",
  "  readRole: 'member',\n  // The table holds drafts and archived courses (isActive false) beside the live catalogue; a member reads only the live ones.\n  belowStaffReadCondition: eq(trainingCourses.isActive, true),\n",
], ["import { trainingCourses } from '@/db/schema';", "import { eq } from 'drizzle-orm';\nimport { trainingCourses } from '@/db/schema';"]])
edit('app/api/health-safety/ppe/route.ts', [[
  "  readRole: 'member',\n",
  "  // The issuance columns name the member who holds each item.\n  readRole: 'health_safety_rep',\n",
]])
console.log('ok')
