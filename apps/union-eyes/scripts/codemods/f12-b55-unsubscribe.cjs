const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, s)
}
const p = 'app/api/communications/unsubscribe/[recipientId]/route.ts'
let s = fs.readFileSync(p, 'utf8')
const start = s.indexOf('  await withSystemContext(async () => {')
const end = s.indexOf('  return new NextResponse(confirmationHtml(locale)')
if (start < 0 || end < 0) throw new Error('anchors')
// One transaction: every write below uses tx, so a failure part-way leaves no recipient half-unsubscribed.
let body = s.slice(start, end).replace('withSystemContext(async () => {', 'withSystemContext(async (tx) => {')
body = body.split('await db\n').join('await tx\n').split('await db.').join('await tx.')
body = body.replace(
  "      await db.insert(consentRecords)",
  "      await db.insert(consentRecords)",
)
s = s.slice(0, start) + body + s.slice(end)
fs.writeFileSync(p, s)

edit(p, [
  ["import { campaigns, communicationPreferences, consentRecords, messageLog } from '@/db/schema';", "import { campaigns, communicationPreferences, consentRecords, messageLog, newsletterDistributionLists, newsletterListSubscribers } from '@/db/schema';"],
  [
    "      await tx.insert(consentRecords).values({",
    "      // An unsubscribe from a campaign link also ends the recipient's subscriptions to this organization's distribution lists.\n      await tx\n        .update(newsletterListSubscribers)\n        .set({ status: 'unsubscribed', unsubscribedAt: new Date() })\n        .where(\n          and(\n            eq(newsletterListSubscribers.profileId, recipientId),\n            ne(newsletterListSubscribers.status, 'unsubscribed'),\n            inArray(\n              newsletterListSubscribers.listId,\n              tx.select({ id: newsletterDistributionLists.id }).from(newsletterDistributionLists).where(eq(newsletterDistributionLists.organizationId, organizationId)),\n            ),\n          ),\n        );\n\n      await tx.insert(consentRecords).values({",
  ],
  ["import { and, eq, ne } from 'drizzle-orm';", "import { and, eq, inArray, ne } from 'drizzle-orm';"],
])
