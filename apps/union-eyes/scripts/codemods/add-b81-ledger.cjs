const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B81-SOCIAL-SCHEDULE-GRAPH-HS'
const test = A + 'lib/services/__tests__/s25-social-schedule-graph-hs.test.ts'
const ST = 'IMPLEMENTED_PENDING_QUALIFICATION'
const find = (prefix) => ledger.batches.flatMap((x) => x.items).find((i) => i.prefix.startsWith(prefix))
const item = (prefix, files, explanation, remaining) => ({ prefix, status: remaining ? 'PARTIAL' : ST, files: [...files, test], explanation, ...(remaining ? { remaining } : {}) })

if (!ledger.batches.some((x) => x.id === id)) {
  ledger.batches.push({
    id,
    family: 'Social scheduling and campaign link, graph query inputs, health-safety statistics',
    evidenceCommit: null,
    items: [
      item(
        'DEF-0B11-SOC-SCHEDULED-POST-IS-PUBLISHED-AT-ONCE-ON-INSTAGRAM-X-AND-LINKEDIN-WHILE-THE-ROW-SAYS-SCHEDULED-AND-HASHTAGS-AND-MENTIONS-ARE-NOT-SENT',
        [A + 'lib/social-media/social-media-service.ts', A + 'app/api/social-media/posts/route.ts', A + 'lib/social-media/__tests__/social-media-service.test.ts'],
        'A schedule is passed on only to Facebook, whose API schedules; for Instagram, X and LinkedIn the platform entry is refused ("not published") instead of publishing at once under a row that says scheduled. Hashtags are written into the post text that is sent (and an X post over 280 characters with them is refused); mentions, which no platform integration sends, are refused with 400. The scheduled-carousel service test, which pinned an immediate LinkedIn publish of a scheduled post, was changed to Facebook and its assertion to the scheduled publish time (disclosed); four cases were added.',
      ),
      item(
        'DEF-0B11-SOC-POSTS-ARE-NEVER-LINKED-TO-A-CAMPAIGN-SO-CAMPAIGN-METRICS-AND-THE-DELETE-GUARD-NEVER-SEE-A-POST',
        [A + 'lib/social-media/social-media-service.ts', A + 'app/api/social-media/posts/route.ts'],
        'The post route verifies campaign_id belongs to the organization (404 otherwise), passes it on, and the service stores it as the post campaignId, so campaign metrics and the campaign delete guard see the post.',
      ),
      item(
        'DEF-0B7-EXC-GRAPH-QUERY-ACCEPTS-FILTERS-AND-EXPLANATION-LEVEL-IT-NEVER-READS',
        [A + 'app/api/exit-interviews/graph-query/route.ts'],
        'The request schema is strict: category, roleFilter and depthLimit, which the reasoner never read, are refused (400); minimumRiskLevel is accepted only for isolated_knowledge, the one query that applies it; explanationLevel is optional and the response states one level and the filters actually applied.',
      ),
    ],
  })
}

const hs = find('DEF-0B8-HS-RESOLUTION-TIME-NEEDS-DATES-NO-ROUTE-SETS')
if (hs) {
  hs.files = [...new Set([...(hs.files || []), A + 'app/api/health-safety/incidents/stats/route.ts', A + 'app/api/health-safety/hazards/stats/route.ts', test])]
  hs.status = 'PARTIAL'
  if (!hs.explanation.includes('B81')) hs.explanation = (hs.explanation ? hs.explanation + ' ' : '') + 'B81: both statistics routes return avgResolutionTime as null, not 0, when no closed or resolved date exists to measure from.'
  hs.remaining = 'No route sets closed_date or resolution_date when a status changes (status is blocked from the generic PATCH and no workflow route closes a record), so the figure stays null until a closing workflow records those dates.'
}

for (const batch of ledger.batches.filter((x) => x.id === id)) for (const it of batch.items) for (const f of it.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B81 added')
