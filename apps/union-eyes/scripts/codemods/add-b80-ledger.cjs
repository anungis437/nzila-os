const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B80-CBA-VISIBILITY-AND-ANALYTICS'
const test = A + 'lib/services/__tests__/s24-cba-visibility-and-analytics.test.ts'
const ST = 'IMPLEMENTED_PENDING_QUALIFICATION'
const all = () => ledger.batches.flatMap((x) => x.items)
const find = (prefix) => all().find((i) => i.prefix.startsWith(prefix))
const item = (prefix, files, explanation) => ({ prefix, status: ST, files: [...files, test], explanation })
const upgrade = (prefix, files, explanation) => {
  const found = find(prefix)
  if (!found) throw new Error('not found ' + prefix)
  found.status = ST
  delete found.remaining
  found.files = [...new Set([...(found.files || []), ...files, test])]
  if (!found.explanation.includes(explanation)) found.explanation += ' ' + explanation
}

if (!ledger.batches.some((x) => x.id === id)) {
  ledger.batches.push({
    id,
    family: 'CBA review visibility, benchmark and comparison honesty, cognition health scope, derived case metrics, metrics organization binding',
    evidenceCommit: null,
    items: [
      item(
        'DEF-0B4-CBA-INTEL-UNREVIEWED-ROWS-SERVED',
        [
          A + 'lib/services/cba-intelligence/review-visibility.ts',
          A + 'lib/services/cba-intelligence/extraction-service.ts',
          A + 'app/api/cba-intelligence/agreements/route.ts',
          A + 'app/api/cba-intelligence/agreements/export/route.ts',
          A + 'app/api/cba-intelligence/agreements/[id]/route.ts',
        ],
        'A member reads approved extractions only (list, export, and the agreement with its wage adjustments and clauses; an unapproved agreement answers 404 so its existence is not disclosed); a steward or above, the reviewers, may name any review status to read the queue.',
      ),
      item(
        'DEF-0B4-CBA-BENCHMARK-HISTORY-NOT-SCOPED',
        [A + 'lib/services/cba-intelligence/benchmark-service.ts'],
        'The snapshot history no longer returns the computedBy user id: the snapshots belong to the platform-wide dataset, so who saved one is platform information and is not shown to a tenant reader.',
      ),
      item(
        'DEF-0B4-CLAUSES-COMPARE-PLACEHOLDER-RECOMMENDATIONS',
        [A + 'lib/services/clause-service.ts'],
        'The comparison no longer returns three fixed recommendation sentences: differences, best practices and recommendations stay empty and the result states analysis grouped_by_type_only, since no wording is compared.',
      ),
      item(
        'DEF-0B5-COGNITION-HEALTH-PLATFORM-POSTURE-TO-ORG-OFFICER',
        [A + 'app/api/cognition/health/route.ts', A + 'app/api/__tests__/cognition-health.route.test.ts'],
        'An organization officer receives the status and check time only; the registry, ontology and contract versions and the engine counts per domain are returned to a platform administrator. The route test was extended (disclosed): it mocks the platform-administrator check and asserts the reduced payload.',
      ),
      item(
        'DEF-0B3-DERIVED-CASE-METRICS-FROM-TELEMETRY',
        [A + 'app/api/analytics/operational/derived-case-metrics/route.ts', A + 'app/api/analytics/insights/weekly-summary/route.ts'],
        'The case counts (opened and closed in the window, open now) are read from the claims table of the organization under its tenant context at the steward floor; overdue cases and SLA compliance are returned as null because a claim records no deadline or status-change time. The weekly summary labels its telemetry count caseCreatedEvents.',
      ),
      item(
        'DEF-0B3-METRICS-ORG-RESOLVED-TWICE',
        [A + 'actions/analytics-actions.ts', A + 'app/api/analytics/metrics/route.ts'],
        'The metrics routes pass the organization they authorized to the actions, which refuse the call when their own verified resolution differs, so a user with several memberships cannot write to an organization other than the one the role check was made in.',
      ),
      item(
        'DEF-0B5-COMMITTEE-INTELLIGENCE-GATHERS-ALL-COMMITTEES',
        [A + 'app/api/committees/[id]/intelligence/route.ts'],
        'Verified in source: the synthesis POST validates every named committee and then answers 501 without gathering minutes or storing a snapshot.',
      ),
    ],
  })
}

upgrade(
  'DEF-0B5-SURVEY-RESPONSES-ROUTE-IGNORES-SURVEY-ID',
  [A + 'app/api/communications/surveys/[surveyId]/responses/route.ts'],
  'Verified in source: POST binds the survey to the path (a body value may not change it), checks the survey belongs to the organization and is open, and GET returns counts for the path survey only.',
)
const contact = find('DEF-0B6-SYS-CONTACT-RATE-LIMIT-KEYED-ON-FORGEABLE-ADDRESS-NO-BOT-CHALLENGE')
if (contact && contact.status !== 'PARTIAL') {
  contact.status = 'PARTIAL'
  contact.files = [...new Set([...(contact.files || []), A + 'lib/public-intake/guard.ts', A + 'app/api/contact/route.ts', test])]
  contact.explanation = 'The contact route goes through guardPublicIntake: the limit is keyed on the edge-set address or the forwarded-for entry at the trusted proxy hop count (not the first, client-typed entry), the limiter refusing in production when unavailable, and the body capped at 16 KB.'
  contact.remaining = 'No bot challenge (CAPTCHA or proof-of-work) exists: the control is still a per-address rate limit, and the choice of challenge provider is a product decision.'
}
const campaign = find('DEF-0B5-COMMS-CAMPAIGN-DETACHED-FROM-CONSENT-AND-DELIVERY')
if (campaign) campaign.remaining = 'No sender exists: schedule and send-test answer 501 and nothing reads a campaign to deliver it, so the audience, communication preferences and consent are not evaluated by any send path; the consent check belongs to the sender when one is built. A campaign row remains a draft record whose scheduledAt and sendImmediately fields are intentions only.'

for (const batch of ledger.batches.filter((x) => x.id === id)) for (const it of batch.items) for (const f of it.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B80 added')
