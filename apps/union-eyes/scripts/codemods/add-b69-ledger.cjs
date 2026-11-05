const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B69-SATISFACTION-FIGURES-PLATFORM-STATS-AND-ORGANIZATION-REPARENT'
const test = A + 'lib/services/__tests__/s13-satisfaction-and-platform-figures.test.ts'
if (!ledger.batches.some((x) => x.id === id)) {
  const item = (prefix, files, explanation, remaining) => ({ prefix, status: remaining ? 'PARTIAL' : 'IMPLEMENTED_PENDING_QUALIFICATION', files: [...files, test], explanation, ...(remaining ? { remaining } : {}) })
  ledger.batches.push({
    id,
    family: 'Representative satisfaction figures, platform statistics definitions, the in-memory index answer and organization parent changes',
    evidenceCommit: null,
    items: [
      item('DEF-0B11-IDS-SATISFACTION-REPRESENTATIVE-FIGURES-HAVE-NO-MINIMUM-RESPONSES', [A + 'lib/satisfaction/figures-policy.ts', A + 'app/api/satisfaction/rankings/route.ts', A + 'app/api/satisfaction/lro/[lroId]/route.ts', A + 'app/api/__tests__/satisfaction-lro.route.test.ts', A + 'app/api/__tests__/satisfaction-rankings-policy.route.test.ts'],
        'The rankings are an officer read that leaves out a representative with fewer than five completed surveys (and says how many); the item route lets a steward read their own figures and any other representative\'s only at the officer floor, shows the count without averages below five, and both record the read in the same transaction. The lro route test was adapted (a mock for the guard, audit and context, a six-survey fixture and three new cases; disclosed).'),
      item('DEF-0B10-OPL-15', [A + 'lib/queries/platform-stats.ts'],
        'registeredUsers and activeUsers count distinct people with an undeleted membership (one person in several organizations is one; removed members are excluded), resolved grievances are settled or closed, and the settlement total sums only agreed or implemented settlements (the table records no currency, noted in the source).'),
      item('DEF-0B10-OPL-14', [A + 'lib/queries/platform-stats.ts', A + 'app/api/platform/stats/route.ts'],
        'The cross-organization statements now run in withSystemContext on purpose instead of whatever the connection role sees, and the role-title read is unchanged.',
        'The read is still authorized by a platform_lead role title and is not audited (the audit entry needs an organization, and no platform-scope audit exists); a platform-staff mandate is an authority decision.'),
      item('DEF-0B2-AI-RAG-INDEX-PROCESS-LOCAL', [A + 'app/api/ai/ingest/route.ts'],
        'The answer now says indexed_in_process_memory with durable false and no invented chunk count.',
        'The index itself is still process memory; a durable shared index (a table with embeddings or a vector store) is not built.'),
      item('DEF-0B9-ORG-ITEM-PATCH-PARENT-CHANGE-DOES-NOT-REPOINT-HIERARCHY', [A + 'lib/organizations/reparent.ts', A + 'app/api/organizations/[id]/route.ts', A + 'app/api/__tests__/organization-reparent.pglite.test.ts'],
        'A parent change (still a system administrator\'s act) now checks that the new parent exists and is neither the organization nor a descendant, refuses a branch deeper than the maximum, recomputes the path and level of the organization and every descendant in the same transaction, and records the previous parent and the number of descendants repointed in the audit. Proved on PGlite.'),
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B69 added')
