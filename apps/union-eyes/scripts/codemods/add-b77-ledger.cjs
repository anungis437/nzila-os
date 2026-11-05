const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B77-COGNITION-HONESTY'
const test = A + 'lib/services/__tests__/s21-cognition-honesty.test.ts'
const ST = 'IMPLEMENTED_PENDING_QUALIFICATION'
const item = (prefix, files, explanation, remaining) => ({ prefix, status: remaining ? 'PARTIAL' : ST, files: [...files, test], explanation, ...(remaining ? { remaining } : {}) })

if (!ledger.batches.some((x) => x.id === id)) {
  ledger.batches.push({
    id,
    family: 'Cognition and exit-interview analytics: officer-asserted inputs, whole-word topics, windowed attribution, uncapped counts',
    evidenceCommit: null,
    items: [
      item(
        'DEF-0B7-COGB-TOPIC-CATEGORY-BY-SUBSTRING-DRIVES-CRITICAL-SENSITIVITY',
        [A + 'lib/knowledge-transfer/topic-graph/topic-graph-builder.ts'],
        'A topic keyword now matches a tag only as a whole word or phrase (with an optional plural), so esa no longer matches inside message and tool no longer matches inside stool. The propagation engine reads the category from this graph, so unrelated tags can no longer raise critical bottleneck findings.',
      ),
      item(
        'DEF-0B7-COGB-MITIGATION-EFFECTIVENESS-ATTRIBUTES-NEXT-SCORE-TO-INTERVENTION',
        [
          A + 'lib/knowledge-transfer/mitigation-effectiveness/effectiveness-tracker.ts',
          A + 'lib/knowledge-transfer/mitigation-effectiveness/effectiveness-models.ts',
          A + 'components/knowledge-transfer/governance-evolution/governance-evolution-tracker.tsx',
        ],
        'The follow-up is the next resilience baseline only (not any later entry), within a 90-day window, and only when no other intervention was recorded between the two; otherwise the intervention is listed as unverified with the reason. The report states attribution association_not_causation and the window, and the screen says days to next baseline instead of days to effect.',
      ),
      item(
        'DEF-0B7-COGA-TIMELINE-COUNTS-CAPPED-AND-INTERVIEW-WINDOW-UNBOUNDED',
        [A + 'app/api/exit-interviews/governance-timeline/route.ts', A + 'app/api/__tests__/exit-interviews-governance-timeline.route.test.ts'],
        'The per-type event counts and the governance_updated count of the last 30 days are computed in SQL over every event in the window (the feed keeps its 500 newest); the interview window is bounded at 5000 and refused beyond it instead of cut silently. The route test was rewritten for the new query order and extended with the count and limit cases (disclosed).',
      ),
      item(
        'DEF-0B7-EXC-COGNITION-MEMORY-STORES-CALLER-ASSERTED-SNAPSHOTS-WITH-NO-AUTHOR',
        [
          A + 'lib/knowledge-transfer/cognition-memory/memory-store.ts',
          A + 'lib/knowledge-transfer/cognition-memory/memory-models.ts',
          A + 'app/api/exit-interviews/cognition-memory/route.ts',
        ],
        'Each saved entry carries its author (kept under a payload key the server reserves and a caller cannot supply) and is labelled officer_asserted on the entry and on every resilience timeline point; the payload (16 KB), tags (20 of 64 characters), insights (20 of 500) and session id are bounded.',
        'Nothing checks a snapshot or score against a real simulation or index (the entry is still the officer\'s statement, now labelled as such), and entries saved before this change have no recorded author.',
      ),
      item(
        'DEF-0B7-EXC-ANALYTICS-REPORTS-FULL-CONSENT-FOR-MONTHS-WITH-NO-INTERVIEWS',
        [A + 'app/api/exit-interviews/analytics/route.ts', A + 'app/api/__tests__/exit-interviews-analytics.route.test.ts'],
        'Verified in source: an empty month reports no coverage rate (null), the exposure score is null when nothing was assessed, and the read is bounded and refused beyond 10000 rows.',
      ),
    ],
  })
}

for (const batch of ledger.batches.filter((x) => x.id === id)) for (const it of batch.items) for (const f of it.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B77 added')
