const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B65-F05-GENERIC-PATHS-THAT-ADVERTISED-OTHER-OPERATIONS'
if (!ledger.batches.some((x) => x.id === id)) {
  const test = A + 'lib/services/__tests__/s6-verified-and-small-fixes.test.ts'
  const gov = [A + 'lib/api/crud-governance.ts', A + 'lib/api/__tests__/crud-governance.test.ts']
  ledger.batches.push({
    id,
    family: 'Campaign analytics and poll-vote paths that were generic CRUD over another table',
    evidenceCommit: null,
    items: [
      { prefix: 'DEF-0B5-COMMS-ACTION-ROUTE-IS-GENERIC-CAMPAIGN-CRUD', status: 'IMPLEMENTED_PENDING_QUALIFICATION', files: [A + 'app/api/communications/campaigns/[id]/analytics/route.ts', A + 'app/api/communications/campaigns/[id]/schedule/route.ts', A + 'app/api/communications/campaigns/[id]/send-test/route.ts', test],
        explanation: 'The analytics path, the last of the three (schedule and send-test were already 501), no longer returns the campaign row as analytics, updates it without validation, or archives the campaign on DELETE: it answers 501 and reads and writes nothing; pinned by a test.' },
      { prefix: 'DEF-0B5-POLLS-NO-CREATE-OR-VOTE-PATH', status: 'PARTIAL', files: [A + 'app/api/communications/polls/[pollId]/vote/route.ts', ...gov, test],
        explanation: 'The vote path answered a misleading 403 for every caller because poll_votes is denied in the CRUD governance table; it now answers 501 honestly and the governance entries for poll_votes and security_events were removed because no generic route uses them any more (a table not listed is still DENIED; the ratchet test pin was adjusted, disclosed).',
        remaining: 'No route creates a poll or records a vote: the polls collection route is generic CRUD over a read-only table, and a real create-and-vote path with one-vote-per-member enforcement is not built.' },
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B65 added')
