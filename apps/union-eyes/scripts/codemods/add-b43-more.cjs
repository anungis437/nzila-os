const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const b = ledger.batches.find((x) => x.id.startsWith('B43'))
const A = 'apps/union-eyes/'
const add = (prefix, files, explanation, extra = {}) => {
  if (b.items.some((i) => i.prefix === prefix)) return
  b.items.push({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
}
add('DEF-0B10-PIL-PILOT-FEEDBACK-COMMENT-IS-UNVALIDATED-AND-UNBOUNDED-AND-IS-RETURNED-RAW-WITH-THE-USER-ID', [A + 'app/api/pilot/feedback/route.ts', A + 'app/api/__tests__/pilot-feedback.route.test.ts'],
  'The comment must be text of at most 2000 characters (trimmed; an empty one is stored as none), a body that is not a JSON object is refused, and the administrator summary no longer returns the author user id of recent feedback. New route test covers each.')
add('DEF-0B10-PIL-PILOT-WRITE-ROUTES-CAST-THE-JSON-BODY-WITHOUT-A-SCHEMA-AND-STORE-CALLER-TEXT-IN-AN-UNBOUNDED-JSO', [A + 'app/api/pilot/events/route.ts', A + 'app/api/pilot/feedback/route.ts', A + 'app/api/pilot/__tests__/pilot-events-authority.route.test.ts', A + 'app/api/__tests__/pilot-feedback.route.test.ts'],
  'The pilot events and feedback writes bound their free-form fields (session id 200 characters, metadata a plain object of at most 4 KB, comment 2000 characters) and refuse a body that is not a JSON object; tests added for each bound.',
  { status: 'PARTIAL', remaining: 'The other pilot write routes (apply, onboarding, demo data) still cast their JSON body without a schema, and the event type stays caller-asserted.' })
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B43 items', b.items.length)
