const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B29-F12-COMMUNICATIONS-LIFECYCLE-AND-VERIFIED-CREDITS'
if (ledger.batches.some((b) => b.id === ID)) { console.log('B29 present'); process.exit(0) }
const A = 'apps/union-eyes/'
const CONTRACT = A + 'lib/api/__tests__/f12-communications.contract.test.ts'
const LIFE = A + 'lib/communications/__tests__/lifecycle.test.ts'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
ledger.batches.push({
  id: ID,
  family: 'F12: a record moves through its lifecycle by rule, the server owns its status and counters, and a route reads the id from the path segment it is mounted on',
  evidenceCommit: null,
  items: [
    item('DEF-0B5-COMMS-CAMPAIGN-STATUS-AND-STATS-WRITABLE', [A + 'app/api/communications/campaigns/route.ts', A + 'app/api/communications/campaigns/[id]/route.ts', CONTRACT],
      'A campaign create accepts author fields only, and a PATCH blocks status, send times, delivery statistics and the audience count; campaigns are read at the steward floor because they carry segment queries and bodies.'),
    item('DEF-0B5-SURVEY-LIFECYCLE-WRITABLE-DIRECTLY', [A + 'lib/communications/lifecycle.ts', LIFE, A + 'app/api/communications/surveys/route.ts', A + 'app/api/communications/surveys/[surveyId]/route.ts', CONTRACT],
      'A survey moves draft, then active or published, then closed, never backwards; the server stamps the publication time once; response counts, views and completion are never client-written and a new survey cannot be created already published.'),
    item('DEF-0B5-POLLS-ITEM-ROUTE-IS-COLLECTION', [A + 'app/api/communications/polls/[pollId]/route.ts', A + 'app/api/communications/polls/route.ts', LIFE, CONTRACT],
      'The poll item route was mounting the collection handlers (GET and POST), so no poll could be read, changed or removed by id; it is now an item route on [pollId] with the same lifecycle guard, and the vote totals are blocked from PATCH.'),
    item('DEF-0B5-COMMS-CAMPAIGN-DETACHED-FROM-CONSENT-AND-DELIVERY', [A + 'app/api/communications/campaigns/[id]/schedule/route.ts', A + 'app/api/communications/campaigns/[id]/send-test/route.ts', CONTRACT],
      'The schedule and send-test paths answer 501: they were the campaign row under another name and no sender reads them, so nothing was scheduled or tested.',
      { status: 'PARTIAL', remaining: 'There is still no delivery path that checks consent before sending a campaign.' }),
    item('DEF-0B1-VERSION-UNAUTH-TOPOLOGY', [A + 'app/api/version/route.ts', A + 'app/api/version/route.test.ts'],
      'Anonymous callers receive only the build identity; the environment, host, deployment type, feature profile and image digests need the deployment-probe credential, always with no-store (upstream\'s change, existing test).'),
    item('DEF-0B1-DOCS-UNAUTH-API-SURFACE', [A + 'app/api/docs/route.ts', A + 'lib/__tests__/docs-openapi-exposure.test.ts', A + 'app/api/__tests__/public-system-exposure.route.test.ts'],
      'The full operation inventory is served only to an authenticated administrator and never cached by a shared cache; the public documentation is the reduced openapi.json (upstream\'s change, existing tests).'),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B29 added')
