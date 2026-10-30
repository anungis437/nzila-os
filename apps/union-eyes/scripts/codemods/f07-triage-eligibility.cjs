const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 60)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}
edit('lib/triage/designations.ts', [[
  "/** The caller's live designation, as a predicate for use inside another query (no round trip, no rank). */",
  `/**
 * Whether a user may hold a messages designation: a live conversation-assignee membership. The case-assignee test is a
 * different capacity (it asks whether the person may add case notes), so a messages designation must not be judged by it.
 */
export async function conversationAssigneeEligible(tx: RLSTx, organizationId: string, userId: string): Promise<boolean> {
  const [row] = await tx.execute(sql\`SELECT \${membershipStillEligible(organizationId, userId)} AS allowed\`)
  return (row as { allowed?: unknown } | undefined)?.allowed === true
}

/** The caller's live designation, as a predicate for use inside another query (no round trip, no rank). */`,
]])
edit('app/api/triage-designations/route.ts', [
  ["import { caseAssigneeEligible, getCaseActor } from '@/lib/cases/case-authorization';", "import { caseAssigneeEligible, getCaseActor } from '@/lib/cases/case-authorization';\nimport { conversationAssigneeEligible } from '@/lib/triage/designations';"],
  [
    "        { assigneeEligible: (userId) => caseAssigneeEligible(tx, actor, userId) },",
    "        // Eligibility is the capacity the scope is for: a messages designation is judged as a conversation assignee, a cases designation as a case assignee.\n        { assigneeEligible: (userId) => (body.scope === 'messages' ? conversationAssigneeEligible(tx, actor.organizationId, userId) : caseAssigneeEligible(tx, actor, userId)) },",
  ],
])
console.log('ok')
