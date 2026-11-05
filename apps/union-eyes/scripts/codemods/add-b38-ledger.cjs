const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B38-F01-F09-F10-DEPRECATION-REGISTRY-AND-VERIFIED-JOBS'
if (ledger.batches.some((b) => b.id === ID)) { console.log('B38 present'); process.exit(0) }
const A = 'apps/union-eyes/'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
ledger.batches.push({
  id: ID,
  family: 'F01/F09/F10: a registry names replacements that exist, a job pages its scan and awaits its writes, and a read honours the record\'s state and the feature gate',
  evidenceCommit: null,
  items: [
    item('DEF-0B6-SYS-DEPRECATION-REGISTRY-NAMES-MISSING-REPLACEMENTS-AND-STALE-SUNSET', [A + 'lib/api/deprecation.ts', A + 'lib/api/__tests__/deprecation-registry.test.ts'],
      'Seven registry rows named replacement routes that do not exist; they now name the real route (current-user, message thread, strike funds) or REMOVED with the reason. A test checks every named replacement against the route tree. A sunset date already past is no longer advertised in a Sunset header, and the body states that it has passed.'),
    item('DEF-0B6-SYS-SLA-WATCHDOG-UNBOUNDED-SCAN-AND-UNAWAITED-DUPLICATE-METRICS', [A + 'app/api/cron/sla-watchdog/route.ts', A + 'app/api/__tests__/cron-sla-watchdog.route.test.ts', A + 'lib/workflow/__tests__/sla-alerts.pglite.test.ts'],
      'The watchdog keyset-pages the claims scan under a page cap, assesses each claim once, awaits the metric writes keyed by organization and hour, and reports a failed metric or alert write as a failed job (existing implementation, existing route and pglite tests).'),
    item('DEF-0B4-CHATBOT-SESSION-READ-IGNORES-STATE-AND-FEATURE-GATE', [A + 'app/api/chatbot/sessions/route.ts', A + 'app/api/chatbot/sessions/[sessionId]/messages/route.ts', A + 'lib/ai/chatbot-service.ts', A + 'app/api/__tests__/chatbot-session-read-guards.route.test.ts'],
      'The session list reads active sessions only, and the message read needs the entitlement, the AI feature flag, the safety check and the rate limit, and refuses an archived or deleted session (existing implementation and test).'),
    item('DEF-0B8-ICRA-CHECKOUT-REDIRECT-DEFAULTS-TO-LOCALHOST-AND-PRICE-MAY-DIFFER-FROM-DISPLAYED', [A + 'app/api/icra/checkout/route.ts', A + 'app/api/__tests__/icra-checkout.route.test.ts'],
      'Production with no application URL refuses to open a session instead of redirecting a buyer to localhost (existing implementation and test).',
      { status: 'PARTIAL', remaining: 'A configured Stripe price id can still differ from the amount the application displays; nothing compares them.' }),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B38 added')
