/**
 * Builds the route and method ownership file. Each rule cites evidence that names its domain:
 * a register entry, a frozen persona source, a capability-registry record, or the authority
 * kernel. A domain with no such evidence is owned by UE-OMIT-ROUTE-DOMAIN-SCOPE and marked
 * SCOPE_UNDECIDED. Ownership is never guessed from a route name.
 */
import { deriveEntry, selectRule, UNDECIDED_OWNER } from './ue-gate0-route-ownership.mjs'
import { ownershipRulesForTranche } from './ue-gate0b1-groups.mjs'

const REP = 'docs/union-eyes/convergence/UE_REPRESENTATIVE_2_2_CONVERGENCE_DISPOSITION.md'
const MEMBER = 'docs/union-eyes/reality-remediation/UE_MEMBER_CANONICAL_2_1.md'
const FIN = 'docs/union-eyes/financial-officer/UE_FINANCIAL_OFFICER_2_1_CONVERGENCE_DISPOSITION.md'
const ONTOLOGY = 'apps/union-eyes/lib/authority/ontology.ts'
const REGISTRY = 'apps/union-eyes/lib/reality/capability-registry.ts'

const reg = (ref) => ({ kind: 'register', ref })
const file = (ref, quote) => (quote ? { kind: 'file', ref, quote } : { kind: 'file', ref })
const registry = (ref) => ({ kind: 'registry', ref })

const PRIVACY_NA_SYSTEM = 'Probe or documentation route. The route-coverage manifest records no write and no tenant data access (data NONE or AMBIENT_DB, read only).'

export function buildOwnershipRules(routes, registryActions) {
  const stubRoutes = registryActions
    .filter((record) => record.id.startsWith('UE-ACTION-') && record.id !== 'UE-ACTION-ORG-HIERARCHY-SEED')
    .flatMap((record) => record.routes)
    .map((route) => route.replace(/^app\/api\//, ''))
  const cronRoutes = registryActions.filter((record) => record.id.startsWith('UE-CRON-')).flatMap((record) => record.routes).map((route) => route.replace(/^app\/api\//, ''))

  const rules = [
    ...ownershipRulesForTranche(),
    {
      id: 'RULE-STUB-H002',
      precedence: 30,
      prefixes: stubRoutes,
      capabilityId: 'UE-CAP-H-002',
      disposition: 'STUB_501',
      actor: 'Administrative operator',
      privacy: 'CAPABILITY',
      evidence: [reg('UE-CONV-H-002'), ...registryActions.filter((record) => record.id.startsWith('UE-ACTION-') && record.id !== 'UE-ACTION-ORG-HIERARCHY-SEED').map((record) => registry(record.id))],
    },
    {
      id: 'RULE-STUB-CRON',
      precedence: 30,
      prefixes: cronRoutes,
      capabilityId: 'UE-OMIT-MAIN-APP-CRONS',
      disposition: 'STUB_501',
      actor: 'Scheduled job runner',
      privacy: 'CAPABILITY',
      evidence: registryActions.filter((record) => record.id.startsWith('UE-CRON-')).map((record) => registry(record.id)),
    },
    {
      id: 'RULE-SEED-RETIRED',
      precedence: 30,
      prefixes: ['admin/seed-test-data/route.ts', 'admin/seed-cupe-pilot/route.ts'],
      capabilityId: 'UE-CAP-H-005',
      disposition: 'RETIRED_501',
      actor: 'Development seed control',
      privacy: 'CAPABILITY',
      evidence: [reg('UE-CONV-H-005'), registry('UE-ACTION-ORG-HIERARCHY-SEED')],
    },
    {
      id: 'RULE-CASE-ASSIGN',
      precedence: 20,
      prefixes: ['cases/[caseId]/assign/', 'grievances/[id]/assign/', 'workbench/assign/'],
      capabilityId: 'UE-CAP-B-001',
      disposition: 'OWNED',
      actor: 'Supervisory representative',
      privacy: 'CAPABILITY',
      evidence: [reg('UE-CONV-B-001'), file(ONTOLOGY, "'case:assign'"), file(REP, 'Assign case (workbench, cases)')],
    },
    {
      id: 'RULE-DOCUMENT-OCR',
      precedence: 20,
      prefixes: ['documents/[id]/ocr/'],
      capabilityId: 'UE-CAP-K-010',
      disposition: 'OWNED',
      actor: 'Case-handling staff',
      privacy: 'CAPABILITY',
      evidence: [reg('UE-CONV-K-010'), file(ONTOLOGY, "'case:process_ocr'")],
    },
    {
      id: 'RULE-GOVERNANCE-ELECTIONS',
      precedence: 20,
      prefixes: ['governance/elections/', 'governance/council-elections/'],
      capabilityId: 'UE-CAP-K-009',
      disposition: 'OWNED',
      actor: 'Governance officer and voting member',
      privacy: 'CAPABILITY',
      evidence: [reg('UE-CONV-K-009'), file('apps/union-eyes/app/api/elections/[id]/vote/route.ts')],
    },
    {
      id: 'RULE-NOTIFICATION-PREFERENCES',
      precedence: 20,
      prefixes: ['notifications/preferences/'],
      capabilityId: 'UE-CAP-I-001',
      disposition: 'OWNED',
      actor: 'Member',
      privacy: 'CAPABILITY',
      evidence: [reg('UE-CONV-I-001'), file(MEMBER, '/api/notifications/preferences')],
    },
    {
      id: 'RULE-ADMIN-DUES',
      precedence: 20,
      prefixes: ['admin/dues/'],
      capabilityId: 'UE-CAP-D-003',
      disposition: 'OWNED',
      actor: 'Financial officer',
      privacy: 'CAPABILITY',
      evidence: [reg('UE-CONV-D-003')],
    },
    {
      id: 'RULE-ADMIN-PAYMENTS',
      precedence: 20,
      prefixes: ['admin/payments/'],
      capabilityId: 'UE-CAP-D-001',
      disposition: 'OWNED',
      actor: 'Financial officer',
      privacy: 'CAPABILITY',
      evidence: [reg('UE-CONV-D-001')],
    },
    {
      id: 'RULE-DEADLINE-JOBS',
      precedence: 20,
      prefixes: ['cron/deadline-overdue/', 'cron/deadline-reminders/', 'deadlines/', 'grievance-deadlines/', 'staging-proof/deadline-engine/'],
      capabilityId: 'UE-OMIT-DEADLINE-OVERDUE',
      disposition: 'OWNED',
      actor: 'Responsible representative',
      privacy: 'CAPABILITY',
      evidence: [file('apps/union-eyes/lib/deadline-engine/reminder-worker.ts'), file(REP, '/dashboard/priorities')],
    },
    {
      id: 'RULE-SYSTEM-PROBE',
      precedence: 20,
      prefixes: ['health/', 'ready/', 'status/', 'version/', 'docs/', 'auth_core/health/'],
      capabilityId: 'UE-CAP-K-008',
      disposition: 'SYSTEM',
      actor: 'Platform operations and API consumers',
      privacy: 'NOT_APPLICABLE',
      privacyJustification: PRIVACY_NA_SYSTEM,
      evidence: [reg('UE-CONV-K-008'), file('docs/union-eyes/convergence/register/ue-route-coverage-manifest.json')],
    },
    {
      id: 'RULE-PENSION-TRUSTEES',
      precedence: 20,
      prefixes: ['pension/trustees/'],
      capabilityId: 'UE-CAP-D-003',
      disposition: 'OWNED',
      actor: 'Financial officer',
      privacy: 'CAPABILITY',
      evidence: [file(REGISTRY, 'UE-FIN-PENSION-TRUSTEE-ADMIN'), file(FIN, 'F19 (trustees)')],
    },
    {
      id: 'RULE-AFFILIATE-REMITTANCES',
      precedence: 20,
      prefixes: ['admin/clc/remittances/'],
      capabilityId: 'UE-OMIT-FINANCE-UNAVAILABLE',
      disposition: 'OWNED',
      actor: 'Financial officer',
      privacy: 'CAPABILITY',
      evidence: [file(REGISTRY, 'UE-FIN-AFFILIATE-REMITTANCES'), file(FIN, 'F10 (affiliate remittances)')],
    },
    {
      id: 'RULE-BUDGETS-EXPENSES-VENDORS',
      precedence: 20,
      prefixes: ['financial/budgets/', 'financial/expenses/', 'financial/vendors/'],
      capabilityId: 'UE-OMIT-FINANCE-UNAVAILABLE',
      disposition: 'OWNED',
      actor: 'Financial officer',
      privacy: 'CAPABILITY',
      evidence: [file(REGISTRY, 'UE-FIN-UNION-BUDGETS-EXPENSES-VENDORS'), file(FIN, 'F11/F12/F13/F14 (budgets, expenses, vendors)')],
    },
    {
      id: 'RULE-BREACH-ASSESSMENT',
      precedence: 20,
      prefixes: ['emergency/pipeda/'],
      capabilityId: 'UE-OMIT-PRIVACY-RIGHTS',
      disposition: 'OWNED',
      actor: 'Governance officer',
      privacy: 'CAPABILITY',
      evidence: [file(REGISTRY, 'UE-PRIVACY-BREACH-ASSESSMENT')],
    },
    {
      id: 'RULE-IDENTITY-SESSION',
      precedence: 10,
      prefixes: ['auth/', 'auth_core/'],
      capabilityId: 'UE-CAP-A-004',
      disposition: 'OWNED',
      actor: 'Authenticated member and staff session',
      privacy: 'CAPABILITY',
      evidence: [reg('UE-CONV-A-004'), reg('UE-CONV-A-006'), file('apps/union-eyes/lib/authority/store/platform-identity.ts')],
    },
    {
      id: 'RULE-WHOP-IDENTITY',
      precedence: 10,
      prefixes: ['whop/'],
      capabilityId: 'UE-CAP-A-007',
      disposition: 'OWNED',
      actor: 'Billing integration owner',
      privacy: 'CAPABILITY',
      evidence: [reg('UE-CONV-A-007'), file('docs/union-eyes/convergence/register/ue-convergence-register.json', 'apps/union-eyes/app/api/whop/create-checkout/route.ts')],
    },
    {
      id: 'RULE-CASE-MODEL',
      precedence: 10,
      prefixes: ['cases/', 'claims/', 'grievances/', 'workflow/'],
      capabilityId: 'UE-CAP-K-010',
      disposition: 'OWNED',
      actor: 'Case-handling staff and the member on their own case',
      privacy: 'CAPABILITY',
      evidence: [reg('UE-CONV-K-010'), reg('UE-CONV-C-001'), reg('UE-CONV-E-001'), file(REP, 'workflow/transition')],
    },
    {
      id: 'RULE-DOCUMENTS',
      precedence: 10,
      prefixes: ['documents/', 'search/universal/'],
      capabilityId: 'UE-CAP-F-002',
      disposition: 'OWNED',
      actor: 'Member and representative document custodian',
      privacy: 'CAPABILITY',
      evidence: [reg('UE-CONV-F-002'), file(REP, 'search/universal/route.ts')],
    },
    {
      id: 'RULE-WORKAID',
      precedence: 10,
      prefixes: ['workaid/'],
      capabilityId: 'UE-CAP-G-002',
      disposition: 'OWNED',
      actor: 'Member and union staff referring to WorkAid',
      privacy: 'CAPABILITY',
      evidence: [reg('UE-CONV-G-002'), file('apps/union-eyes/lib/authority/store/workaid-disclosure.ts')],
    },
    {
      id: 'RULE-PERSONA-JOURNEYS',
      precedence: 10,
      prefixes: ['workbench/', 'members/', 'users/me/profile/', 'executive/', 'governance/'],
      capabilityId: 'UE-CAP-I-001',
      disposition: 'OWNED',
      actor: 'Frozen persona journeys',
      privacy: 'CAPABILITY',
      evidence: [
        reg('UE-CONV-I-001'),
        file(REP, '/api/workbench/assigned'),
        file(REP, '/api/members'),
        file(MEMBER, '/api/users/me/profile'),
        file('apps/union-eyes/lib/executive/capability-matrix.ts', 'app/api/executive/dashboard/route.ts'),
        file('docs/union-eyes/convergence/register/ue-convergence-register.json', 'apps/union-eyes/app/api/governance/'),
      ],
    },
    {
      id: 'RULE-CORRESPONDENCE',
      precedence: 10,
      prefixes: ['correspondence/'],
      capabilityId: 'UE-OMIT-REP-CORRESPONDENCE',
      disposition: 'OWNED',
      actor: 'Representative',
      privacy: 'CAPABILITY',
      evidence: [file(REP, '/dashboard/correspondence')],
    },
    {
      id: 'RULE-MESSAGING',
      precedence: 10,
      prefixes: ['messages/', 'messaging/'],
      capabilityId: 'UE-CAP-I-002',
      disposition: 'OWNED',
      actor: 'Member and assigned staff',
      privacy: 'CAPABILITY',
      evidence: [reg('UE-CONV-I-002'), file('apps/union-eyes/lib/messaging/conversation-participation.ts')],
    },
    {
      id: 'RULE-REVIEWS',
      precedence: 10,
      prefixes: ['reviews/'],
      capabilityId: 'UE-CAP-REVIEW-INTAKE',
      disposition: 'OWNED',
      actor: 'Active member and governance officer holding review:monitor',
      privacy: 'CAPABILITY',
      evidence: [file('apps/union-eyes/lib/authority/store/review-intake.ts')],
    },
    {
      id: 'RULE-ELECTIONS-VOTING',
      precedence: 10,
      prefixes: ['elections/', 'voting/'],
      capabilityId: 'UE-CAP-K-009',
      disposition: 'OWNED',
      actor: 'Governance officer and voting member',
      privacy: 'CAPABILITY',
      evidence: [reg('UE-CONV-K-009'), file('apps/union-eyes/lib/voting/election-succession.ts')],
    },
    {
      id: 'RULE-FINANCE-AUTHORITY',
      precedence: 10,
      prefixes: ['finance/', 'dues/', 'financial/'],
      capabilityId: 'UE-CAP-D-003',
      disposition: 'OWNED',
      actor: 'Financial officer',
      privacy: 'CAPABILITY',
      evidence: [reg('UE-CONV-D-003'), file('apps/union-eyes/lib/finance/retired-financial-route.ts')],
    },
    {
      id: 'RULE-FINANCE-TRANSACTIONS',
      precedence: 10,
      prefixes: ['arrears/', 'currency/', 'payment/', 'payments/'],
      capabilityId: 'UE-CAP-D-001',
      disposition: 'OWNED',
      actor: 'Financial officer',
      privacy: 'CAPABILITY',
      evidence: [reg('UE-CONV-D-001')],
    },
    {
      id: 'RULE-FINANCE-UNAVAILABLE',
      precedence: 10,
      prefixes: ['strike/', 'strike-fund/'],
      capabilityId: 'UE-OMIT-FINANCE-UNAVAILABLE',
      disposition: 'OWNED',
      actor: 'Financial officer',
      privacy: 'CAPABILITY',
      evidence: [file(FIN, '/api/strike/{funds')],
    },
    {
      id: 'RULE-PRIVACY-RIGHTS',
      precedence: 10,
      prefixes: ['privacy/', 'gdpr/', 'consent/'],
      capabilityId: 'UE-OMIT-PRIVACY-RIGHTS',
      disposition: 'OWNED',
      actor: 'Member and governance officer',
      privacy: 'CAPABILITY',
      evidence: [file(MEMBER, 'POST /api/gdpr/data-export'), file(REGISTRY, 'DSAR')],
    },
    {
      id: 'RULE-STEWARD-ABSENT',
      precedence: 10,
      prefixes: ['stewards/'],
      capabilityId: 'UE-OMIT-STEWARD-CANONICAL-ABSENT',
      disposition: 'SCOPE_UNDECIDED',
      actor: 'Steward (no frozen canonical in the repository)',
      privacy: 'CAPABILITY',
      evidence: [file('apps/union-eyes/lib/dashboard/role-experience.ts', "'steward'")],
    },
    {
      id: 'RULE-RETIRED-ANY',
      precedence: 5,
      prefixes: [''],
      guards: ['RETIRED'],
      capabilityId: 'UE-CAP-H-001',
      disposition: 'RETIRED_501',
      actor: 'Any caller of a retired scaffold route',
      privacy: 'CAPABILITY',
      evidence: [reg('UE-CONV-H-001')],
    },
  ]

  const segments = [...new Set(routes.map((route) => route.route.split('/')[0]))].sort()
  rules.push({
    id: 'RULE-DOMAIN-SCOPE-UNDECIDED',
    precedence: 1,
    prefixes: segments.map((segment) => `${segment}/`),
    capabilityId: UNDECIDED_OWNER,
    disposition: 'SCOPE_UNDECIDED',
    actor: 'Undetermined by any register entry, persona source, or capability-registry record',
    privacy: 'CAPABILITY',
    evidence: [{ kind: 'manifest', ref: 'No register entry, frozen persona source, or capability-registry record names this domain.' }],
  })
  return rules
}

export function buildOwnership({ routes, registryActions, uninventoried }) {
  const rules = buildOwnershipRules(routes, registryActions)
  const entries = []
  for (const route of routes) {
    const { rule } = selectRule(rules, route)
    if (!rule) throw new Error(`no rule for ${route.route}`)
    for (const method of [].concat(route.methods)) entries.push(deriveEntry(route, method, rule))
  }
  entries.sort((a, b) => (a[0] + a[1] < b[0] + b[1] ? -1 : 1))
  return {
    schemaVersion: 1,
    note: 'Machine-enforced route and method ownership. The guard class in the route-coverage manifest is the declared control category and is not implementation evidence. A rule owns a domain only where its evidence names that domain. A domain without such evidence is owned by UE-OMIT-ROUTE-DOMAIN-SCOPE with disposition SCOPE_UNDECIDED.',
    entryColumns: ['route', 'method', 'ruleId', 'capabilityId', 'disposition', 'control', 'audit', 'privacy', 'actor'],
    rules,
    uninventoriedRoutes: uninventoried,
    entries,
  }
}

export function ownershipJson(ownership) {
  const head = { ...ownership, entries: undefined }
  const lines = JSON.stringify(head, null, 2).split('\n')
  const body = ownership.entries.map((entry) => `    ${JSON.stringify(entry)}`).join(',\n')
  const text = lines.join('\n')
  const marker = text.lastIndexOf('\n}')
  return `${text.slice(0, marker)},\n  "entries": [\n${body}\n  ]\n}\n`
}
