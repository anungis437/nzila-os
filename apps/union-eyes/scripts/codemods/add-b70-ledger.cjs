const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B70-CLAUSE-TAGS-REMINDER-OPT-OUT-AND-CHATBOT-ROLE'
const test = A + 'lib/services/__tests__/s14-clause-reminders-chatbot.test.ts'
const all = () => ledger.batches.flatMap((b) => b.items)
const earlier = (start) => all().find((i) => i.prefix.startsWith(start))
if (!ledger.batches.some((x) => x.id === id)) {
  const item = (prefix, files, explanation, remaining) => ({ prefix, status: remaining ? 'PARTIAL' : 'IMPLEMENTED_PENDING_QUALIFICATION', files: [...files, test], explanation, ...(remaining ? { remaining } : {}) })
  ledger.batches.push({
    id,
    family: 'Clause tag projection, education reminder opt-out and chatbot role and review markers',
    evidenceCommit: null,
    items: [
      item('DEF-0B4-CLAUSE-LIBRARY-CREATOR-USER-IDS-DISCLOSED', [A + 'app/api/clause-library/[id]/tags/route.ts', A + 'app/api/clause-library/[id]/route.ts'], 'The tags read selects only the tag id, clause id and name (no author user id), and the item read already returns the author only to the owner organization.'),
      item('DEF-0B6-EDU-CRON-REMINDERS-IGNORE-OPT-OUT-AND-HAVE-NO-SENT-MARKER', [A + 'lib/education/reminder-queries.ts', A + 'lib/education/__tests__/reminder-queries.pglite.test.ts'], 'Both reminder statements join the member\'s communication preferences and leave out a member who turned e-mail or training reminders off (an absent row is the default, on; another organization\'s opt-out does not apply). The PGlite test gained the preferences table and a case (disclosed).', 'There is still no sent marker: a second run on the same day would send the same reminders again.'),
      item('DEF-0B4-CHATBOT-REVIEW-NOT-REQUIRED-AND-FIXED-ROLE', [A + 'app/api/chatbot/messages/route.ts', A + 'app/api/chatbot/sessions/route.ts', A + 'app/api/chatbot/sessions/[sessionId]/messages/route.ts'], 'The safety policy receives the caller\'s own role instead of the literal member on all three routes, and the reply is marked reviewRequired true because it is model-generated and advisory and no person has reviewed it.'),
    ],
  })
  const upgrade = (start, add, files) => {
    const it = earlier(start)
    if (!it) throw new Error('no earlier item ' + start)
    it.status = 'IMPLEMENTED_PENDING_QUALIFICATION'
    delete it.remaining
    it.explanation += ' ' + add
    it.files = [...new Set([...it.files, ...files, test])]
  }
  upgrade('DEF-0B4-CLAUSE-LIBRARY-PUBLISHING-ON-STEWARD-ROLE-TITLE', 'Verified later: create, update and share all call assertMayPublish, so public sharing needs an officer role on every path.', [A + 'app/api/clause-library/route.ts', A + 'app/api/clause-library/[id]/share/route.ts', A + 'lib/clause-library/clause-body.ts'])
  upgrade('DEF-0B4-CLAUSE-LIBRARY-BODY-FIELDS-UNVALIDATED', 'Verified later: create, update and share parse their body with parseClauseBody and the tag routes with parseClauseTagBody, so no malformed field reaches the database.', [A + 'app/api/clause-library/route.ts', A + 'app/api/clause-library/[id]/share/route.ts', A + 'app/api/clause-library/[id]/tags/route.ts', A + 'lib/clause-library/tag-body.ts'])
}
for (const batch of ledger.batches.filter((x) => x.id === id)) for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B70 added')
