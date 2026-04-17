const BASE = 'http://localhost:3001'

const routes = [
  // Public / auth
  '/',
  '/sign-in',
  '/sign-up',
  // Dashboard pages
  '/analytics',
  '/assurance',
  '/audit-graph',
  '/audit-insights',
  '/automation',
  '/business',
  '/business/approvals',
  '/business/compliance',
  '/business/equity',
  '/business/equity/captable',
  '/business/equity/issue',
  '/business/finance',
  '/business/finance/close',
  '/business/finance/close/period-test-1',
  '/business/finance/expense',
  '/business/finance/indirect-tax',
  '/business/finance/indirect-tax/period-test-1',
  '/business/finance/tax',
  '/business/finance/tax/year-test-1',
  '/business/finance/year-end-pack',
  '/business/governance',
  '/business/governance/resolution',
  '/business/queues',
  '/business/signatures',
  '/business/yearend',
  '/compliance-snapshots',
  '/console',
  '/console/admin/retention',
  '/console/ai/actions',
  '/console/ai/knowledge',
  '/console/ai/models',
  '/console/ai/overview',
  '/console/ai/usage',
  '/console/finance/stripe',
  '/console/ml/models',
  '/console/ml/overview',
  '/console/ml/runs',
  '/console/ml/stripe/daily',
  '/console/ml/stripe/transactions',
  '/cost',
  '/deployment-profile',
  '/docs',
  '/docs/getting-started',
  '/evidence-packs',
  '/failure-simulation',
  '/governance',
  '/integrations',
  '/integrations-control-plane',
  '/integrations-control-plane/dlq',
  '/integrations/chaos',
  '/integrations/deliveries',
  '/integrations/dlq',
  '/integrations/health',
  '/integrations/health/stripe',
  '/integrations/sla',
  '/integrations/stripe',
  '/isolation-certification',
  '/marketplace',
  '/nacp-integrity',
  '/ops',
  '/ops-score',
  '/orgs',
  '/performance',
  '/performance/regressions',
  '/pilot/export',
  '/platform',
  '/platform-economics',
  '/proof-center',
  '/proof-pack',
  '/scale-simulation',
  '/settings',
  '/settings/billing',
  '/settings/billing/success',
  '/settings/integrations',
  '/standards',
  '/system-health',
  '/trend-detection',
  // API routes (GET-safe)
  '/api/health',
  '/api/auth/me',
  '/api/metrics',
  '/api/orgs',
  '/api/analytics',
  '/api/audit/events',
  '/api/audit/tamper-status',
  '/api/assurance',
  '/api/approvals',
  '/api/evidence-packs',
  '/api/proof-center',
  '/api/proof-center/public-key',
  '/api/ml/models',
  '/api/ml/models/active',
  '/api/ml/runs/inference',
  '/api/ml/runs/training',
  '/api/ml/scores/stripe/daily',
  '/api/ml/scores/stripe/transactions',
  '/api/ml/scores/ue/cases/priority',
  '/api/ml/scores/ue/cases/sla-risk',
  '/api/ai/prompts',
  '/api/ai/prompts/versions',
  '/api/finance/close',
  '/api/finance/governance-links',
  '/api/finance/indirect-tax/periods',
  '/api/finance/indirect-tax/summary',
  '/api/finance/tax/years',
  '/api/finance/tax/filings',
  '/api/finance/tax/installments',
  '/api/finance/tax/notices',
  '/api/finance/tax/profiles',
  '/api/finance/year-end-pack',
  '/api/governance/votes',
  '/api/isolation',
  '/api/marketplace/install',
  '/api/pilot/export',
  '/api/qbo/status',
  '/api/stripe/customers',
  '/api/stripe/subscriptions',
  '/api/stripe/refunds',
  '/api/stripe/reports/generate',
]

const PASS_STATUSES = new Set([200, 307, 308])
const REDIRECT_STATUSES = new Set([301, 302, 303])

async function main() {
  const results = []

  for (const route of routes) {
    try {
      const res = await fetch(BASE + route, { redirect: 'manual' })
      results.push({ route, status: res.status })
    } catch (e) {
      results.push({ route, status: 'ERR:' + (e.code ?? e.message) })
    }
  }

  const pass = results.filter(r => PASS_STATUSES.has(r.status))
  const redirects = results.filter(r => REDIRECT_STATUSES.has(r.status))
  const fail = results.filter(r => typeof r.status === 'string' || r.status >= 400)

  console.log('=== PASS (200 / 307 / 308) ===')
  pass.forEach(r => console.log(' ', r.status, r.route))

  if (redirects.length) {
    console.log('\n=== REDIRECT (301-303) ===')
    redirects.forEach(r => console.log(' ', r.status, r.route))
  }

  if (fail.length) {
    console.log('\n=== FAIL ===')
    fail.forEach(r => console.log(' ', r.status, r.route))
  }

  console.log(`\nTotal: ${results.length} | Pass: ${pass.length} | Redirect: ${redirects.length} | Fail: ${fail.length}`)
}

main()
