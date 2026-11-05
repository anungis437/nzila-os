const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B79-SOCIAL-FIGURES-AND-PUBLISH'
const test = A + 'lib/services/__tests__/s23-social-figures-and-publish.test.ts'
const ST = 'IMPLEMENTED_PENDING_QUALIFICATION'
const item = (prefix, files, explanation, remaining) => ({ prefix, status: remaining ? 'PARTIAL' : ST, files: [...files, test], explanation, ...(remaining ? { remaining } : {}) })

if (!ledger.batches.some((x) => x.id === id)) {
  ledger.batches.push({
    id,
    family: 'Social campaign figures, publish handling and token refresh',
    evidenceCommit: null,
    items: [
      item(
        'DEF-0B11-SOC-CAMPAIGN-ANALYTICS-PLATFORM-AND-GOAL-FIGURES-READ-FIELDS-THE-QUERY-DOES-NOT-SELECT-AND-A-HARD-CODED-UNDEFINED',
        [
          A + 'lib/social-media/campaign-figures.ts',
          A + 'app/api/social-media/analytics/route.ts',
          A + 'app/api/social-media/campaigns/route.ts',
        ],
        'One helper computes the campaign totals, the per-platform figures (from the count fields the query selects, not impressions/engagement/likes names it does not return), the average engagement rate (absent when no post has one) and the progress toward the goals the campaign set (impressions, engagement rate; conversions have no actual because none is collected). The clicks total is absent, not zero; both reads add the organization predicate on posts; the responses carry figures_recorded so default zeros are not presented as measured performance.',
      ),
      item(
        'DEF-0B11-SOC-PUBLISH-RECORDS-THE-ROW-AFTER-THE-EXTERNAL-POST-AUDITS-COMPLETED-WHEN-EVERY-PLATFORM-FAILED-AND-RETURNS-PLATFORM-ERROR-TEXT',
        [
          A + 'lib/social-media/social-media-service.ts',
          A + 'app/api/social-media/posts/route.ts',
          A + 'lib/social-media/__tests__/social-media-service.test.ts',
          A + 'app/api/__tests__/social-posts-and-redemptions-audit.route.test.ts',
        ],
        'A platform failure is returned as a fixed message (this application\'s own refusals keep their text; the platform\'s text is logged, not returned); a failure to save the row after the platform accepted the post is reported as published and unrecorded (recorded: false) and logged, not as a failed publish; when no platform accepted the post the audited operation throws, so its outcome record says failed. Two tests were adapted and three added (disclosed): the route test mock gained the error class, the service test gained the three cases.',
        'The intent and outcome records are still written around the external call and are not committed with a data row: an external effect cannot be made atomic with a database row, and a post scheduled or published before the row is saved can still exist without it if the process dies in between.',
      ),
      item(
        'DEF-0B11-SOC-ANY-REFRESH-FAILURE-MARKS-THE-ACCOUNT-EXPIRED-AND-A-SUCCESS-FORCES-IT-ACTIVE',
        [A + 'app/api/social-media/accounts/route.ts', A + 'app/api/__tests__/social-media-accounts.route.test.ts'],
        'Only the platform refusing the refresh marks a connected (active) account expired, with an audit record that says whether it did; a storage or audit failure after a successful refresh marks nothing. A suspended or disconnected account is refused with 409 rather than reactivated, and a successful refresh sets an expired account active and keeps any other state. Two tests were added (disclosed).',
      ),
    ],
  })
}

const annotate = (prefix, files, explanation) => {
  const found = ledger.batches.flatMap((x) => x.items).find((i) => i.prefix.startsWith(prefix))
  if (!found) throw new Error('not found ' + prefix)
  found.files = [...new Set([...(found.files || []), ...files, test])]
  if (!found.explanation.includes(explanation)) found.explanation += ' ' + explanation
}
annotate(
  'DEF-0B11-SOC-ANALYTICS-AND-ENGAGEMENT-FIGURES-HAVE-NO-WRITER',
  [A + 'lib/social-media/campaign-figures.ts', A + 'app/api/social-media/analytics/route.ts'],
  'B79: the campaign reads now say figures_recorded false when every counter is a default, so an unwritten counter is not presented as measured performance; no collector exists yet.',
)

for (const batch of ledger.batches.filter((x) => x.id === id)) for (const it of batch.items) for (const f of it.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B79 added')
