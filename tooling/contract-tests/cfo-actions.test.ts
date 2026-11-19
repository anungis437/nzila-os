/**
 * Contract Test — CFO Server Actions
 *
 * Structural invariants for the CFO app's server actions:
 *   1. Every action file must use 'use server' directive
 *   2. Every exported action must authenticate and authorize through the single
 *      verified resolver `resolveOrgContext` (lib/resolve-org.ts), which calls
 *      `auth()` from @nzila/platform-auth and `requirePermission()`
 *   3. Every real mutation must leave a tamper-evident, tenant-scoped audit record
 *      in the same transaction; no evidence may be attested for work not done
 *   4. Every action file must use the structured logger
 *   5. Every action must reach the database only through the governed platformDb
 *      transaction opened by the resolver — never by importing a client itself
 *
 * @invariant CFO-ACT-01: Server action auth guard
 * @invariant CFO-ACT-02: Evidence pipeline integration
 * @invariant CFO-ACT-03: Structured logging
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '../..')
const CFO_APP = join(ROOT, 'apps', 'cfo')
const CFO_ACTIONS = join(CFO_APP, 'lib', 'actions')
const RESOLVE_ORG = join(CFO_APP, 'lib', 'resolve-org.ts')
const ACTION_CONTEXT = join(CFO_APP, 'queries', 'action-context.ts')
const CFO_SERVICES = join(CFO_APP, 'lib', 'services')

const read = (path: string) => readFileSync(path, 'utf-8')
const readAction = (file: string) => read(join(CFO_ACTIONS, file))
const readService = (file: string) => read(join(CFO_SERVICES, file))

/**
 * Split a source file into its exported async functions: name -> source text
 * from the `export async function` keyword up to the next top-level export.
 */
function exportedActions(content: string): Map<string, string> {
  const starts = [...content.matchAll(/^export async function (\w+)/gm)]
  const result = new Map<string, string>()
  starts.forEach((match, i) => {
    const from = match.index ?? 0
    const rest = content.slice(from + match[0].length)
    const nextExport = rest.search(/^export /m)
    const to = i + 1 < starts.length ? (starts[i + 1].index ?? content.length) : content.length
    const end = nextExport === -1 ? to : Math.min(to, from + match[0].length + nextExport)
    result.set(match[1], content.slice(from, end))
  })
  return result
}

/** Body of a top-level (exported or not) function declaration in a file. */
function functionBody(content: string, name: string): string {
  const match = new RegExp(`^(?:export )?(?:async )?function ${name}\\b`, 'm').exec(content)
  if (!match) return ''
  const rest = content.slice(match.index + match[0].length)
  const next = rest.search(/^(?:export |async function |function |const |interface |type )/m)
  return content.slice(
    match.index,
    next === -1 ? content.length : match.index + match[0].length + next,
  )
}

/** A verified resolver entry with a declared purpose and a concrete permission. */
const RESOLVER_CALL =
  /resolveOrgContext\(\s*'(?:organization|collection|platform|personal|resource)',\s*\{\s*permission:\s*'[a-z_]+:[a-z_]+'/

const ACTION_FILES = [
  'client-actions.ts',
  'ledger-actions.ts',
  'report-actions.ts',
  'integration-actions.ts',
  'advisory-actions.ts',
  'misc-actions.ts',
  'security-actions.ts',
  'audit-actions.ts',
  'platform-admin-actions.ts',
  'notification-actions.ts',
  'workflow-actions.ts',
]

describe('CFO-ACT — Server action files exist', () => {
  for (const file of ACTION_FILES) {
    it(`${file} exists`, () => {
      expect(existsSync(join(CFO_ACTIONS, file))).toBe(true)
    })
  }
})

describe('CFO-ACT-01 — Every action file uses "use server" directive', () => {
  for (const file of ACTION_FILES) {
    it(`${file} has 'use server'`, () => {
      const path = join(CFO_ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      expect(content).toContain("'use server'")
    })
  }
})

// Authentication moved out of each action file into the single verified
// resolver. The guarantee is asserted at its real location (resolve-org.ts)
// AND every exported action is required to enter through it.
describe('CFO-ACT-01 — auth() is enforced by the shared resolver', () => {
  const content = read(RESOLVE_ORG)

  it('resolve-org.ts authenticates via auth() from @nzila/platform-auth', () => {
    expect(content).toMatch(/import \{ auth \} from '@nzila\/platform-auth\/entra\/server'/)
    expect(content).toContain('await auth()')
  })

  it('resolveOrgContext rejects a missing identity before any work', () => {
    const body = functionBody(content, 'resolveOrgContext')
    expect(body).toContain('const actor = await auth()')
    expect(body).toMatch(/!userId[\s\S]*throw new CfoScopeError\('Unauthorized'\)/)
    // Authorization of the declared permission happens before the transaction.
    expect(body).toContain('requirePermission(options.permission, userId)')
    expect(body.indexOf('requirePermission(')).toBeLessThan(
      body.indexOf('withCfoActionTransaction('),
    )
  })
})

describe('CFO-ACT-01 — Every exported action authenticates through resolveOrgContext', () => {
  for (const file of ACTION_FILES) {
    it(`${file} routes every exported action through resolveOrgContext`, () => {
      const path = join(CFO_ACTIONS, file)
      if (!existsSync(path)) return
      const content = read(path)
      expect(content).toMatch(
        /import \{[^}]*\bresolveOrgContext\b[^}]*\} from '@\/lib\/resolve-org'/,
      )
      const actions = exportedActions(content)
      expect(actions.size).toBeGreaterThan(0)
      const unguarded = [...actions].filter(([, body]) => !RESOLVER_CALL.test(body)).map(([n]) => n)
      expect(unguarded, `actions not entering resolveOrgContext: ${unguarded.join(', ')}`).toEqual(
        [],
      )
    })
  }
})

describe('CFO-ACT-02 — Mutating actions leave tamper-evident, tenant-scoped evidence', () => {
  // The os-core evidence pack (buildEvidencePackFromAction/processEvidencePack)
  // ran on a separate connection after the work, under `orgId: 'platform'` or
  // the provider name. Real mutations now append a hash-chained `audit_events`
  // row for the VERIFIED organization in the SAME transaction (mandatory: the
  // transaction fails if it is not stored). No-op work attests nothing.
  it('the primary audit writer is hash-chained, org-scoped and mandatory', () => {
    const records = readService('cfo-records.ts')
    const writer = functionBody(records, 'appendPrimaryAudit')
    expect(writer).toContain('assertCfoActionContext(context)')
    expect(writer).toContain('computeCanonicalHash(')
    expect(writer).toContain('.insert(auditEvents)')
    expect(writer).toContain("throw new Error('CFO_MANDATORY_AUDIT_NOT_STORED')")
    expect(writer).toMatch(
      /context\.organizationId !== event\.organizationId\)\s*throw new CfoScopeError/,
    )
    expect(functionBody(records, 'createCfoRecord')).toContain('appendPrimaryAudit(context')
  })

  it('report-actions.ts: generateReport records the report with a primary audit event', () => {
    const action = exportedActions(readAction('report-actions.ts')).get('generateReport') ?? ''
    expect(action).toContain('generateScopedReport(context, input)')
    const service = functionBody(readService('reports.ts'), 'generateScopedReport')
    expect(service).toContain("context.purpose !== 'organization'")
    expect(service).toMatch(/createCfoRecord\(context, \{\s*action: 'report\.generated'/)
    expect(service).toContain('evidenceRefs: [`audit_log:${row.id}`]')
  })

  it('advisory-actions.ts: askAdvisor appends a primary audit event for the verified org', () => {
    const action = exportedActions(readAction('advisory-actions.ts')).get('askAdvisor') ?? ''
    expect(action).toMatch(
      /appendCfoPrimaryAudit\(context, \{\s*organizationId: context\.organizationId/,
    )
    expect(action).toContain(
      "cfoAuthoritySource(context, context.organizationId, 'advisory_ai:use')",
    )
    expect(action).toContain('evidenceRefs: [`audit_events:${receipt.id}`]')
  })

  it('ledger-actions.ts: runReconciliation performs no fake run and attests nothing', () => {
    // It used to "reconcile" matchPayoutsToDeposits([], []) and seal evidence for
    // org 'platform'. With no verified source data it must now refuse honestly.
    const action = exportedActions(readAction('ledger-actions.ts')).get('runReconciliation') ?? ''
    expect(action).toContain("permission: 'ledger:write'")
    expect(action).toContain(
      "throw new CfoCapabilityUnavailableError('RECONCILIATION_SOURCE_UNAVAILABLE')",
    )
    expect(action).not.toContain('matchPayoutsToDeposits')
    expect(action).not.toContain('processEvidencePack')
  })

  it('integration-actions.ts: triggerSync claims no sync and records an honest receipt', () => {
    // It used to report "sync completed" after a connectivity probe and seal
    // evidence under `orgId: provider`. Now it states that no synchronization
    // was performed and stores a receipt of the check in the same transaction.
    const action = exportedActions(readAction('integration-actions.ts')).get('triggerSync') ?? ''
    expect(action).toContain('checkIntegration(context, provider)')
    const service = functionBody(readService('integrations.ts'), 'checkIntegration')
    expect(service).toContain("action: 'integration.connectivity_checked'")
    expect(service).toContain("throw new Error('Integration receipt was not stored')")
    expect(service).toContain('no synchronization was performed')
    expect(service).not.toMatch(/sync completed/i)
  })

  it('capability-unavailable responses are HTTP 501, never a success', () => {
    const content = readService('capability-unavailable.ts')
    expect(content).toContain('readonly status = 501')
  })

  it('no action or service attests evidence for a fabricated organization', () => {
    const files = [
      ...ACTION_FILES.map((f) => join(CFO_ACTIONS, f)),
      ...['reports.ts', 'integrations.ts', 'cfo-records.ts'].map((f) => join(CFO_SERVICES, f)),
    ]
    for (const path of files) {
      const content = read(path)
      expect(content, path).not.toMatch(/orgId:\s*[^,\n]*'platform'/)
      expect(content, path).not.toMatch(/orgId:\s*provider\b/)
      expect(content, path).not.toContain('processEvidencePack')
    }
  })
})

describe('CFO-ACT-03 — Every action file uses structured logger', () => {
  for (const file of ACTION_FILES) {
    it(`${file} imports logger`, () => {
      const path = join(CFO_ACTIONS, file)
      if (!existsSync(path)) return
      const content = read(path)
      expect(content).toContain("import { logger } from '@/lib/logger'")
      expect(content).toMatch(/logger\.(?:error|warn|info)\(/)
      expect(content).not.toMatch(/console\.(?:log|error|warn|info)\(/)
    })
  }
})

// Direct platformDb access moved out of action files (NO_RAW_DB_IN_ACTIONS_001 /
// ORG_REQUIRED_SERVER_ACTIONS_001). The guarantee — all CFO action DB access goes
// through the governed @nzila/db/platform client — is asserted where it now lives.
describe('CFO-ACT — Action DB access goes through the governed platformDb transaction', () => {
  it('queries/action-context.ts opens the action transaction on platformDb', () => {
    const content = read(ACTION_CONTEXT)
    expect(content).toContain("import { platformDb } from '@nzila/db/platform'")
    expect(functionBody(content, 'withCfoActionTransaction')).toContain(
      'return platformDb.transaction(operation)',
    )
  })

  it('resolve-org.ts hands actions only that transaction', () => {
    expect(functionBody(read(RESOLVE_ORG), 'resolveOrgContext')).toContain(
      'return withCfoActionTransaction(async (db) =>',
    )
  })

  for (const file of ACTION_FILES) {
    it(`${file} does not open its own database client`, () => {
      const path = join(CFO_ACTIONS, file)
      if (!existsSync(path)) return
      const content = read(path)
      expect(content).not.toContain('platformDb')
      expect(content).not.toMatch(/from '@nzila\/db(?:\/platform|\/raw|\/client)?'/)
      expect(content).not.toMatch(/from 'drizzle-orm\/(?:postgres-js|node-postgres|neon-http)'/)
    })
  }
})

describe('CFO-ACT — Client actions contract', () => {
  it('exports listClients, createClient, getClientDetail', () => {
    const path = join(CFO_ACTIONS, 'client-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function listClients')
    expect(content).toContain('export async function createClient')
    expect(content).toContain('export async function getClientDetail')
  })
})

describe('CFO-ACT — Ledger actions contract', () => {
  it('exports getLedgerEntries, runReconciliation, getFinancialOverview', () => {
    const path = join(CFO_ACTIONS, 'ledger-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function getLedgerEntries')
    expect(content).toContain('export async function runReconciliation')
    expect(content).toContain('export async function getFinancialOverview')
  })

  it('runReconciliation refuses honestly until verified source data exists', () => {
    // The old assertion required matchPayoutsToDeposits, which was only ever
    // called on two empty arrays — a reconciliation that matched nothing yet
    // reported close readiness. Without a verified payout/deposit source the
    // action must surface RECONCILIATION_SOURCE_UNAVAILABLE (HTTP 501) instead.
    const action = exportedActions(readAction('ledger-actions.ts')).get('runReconciliation') ?? ''
    expect(action).toContain("CfoCapabilityUnavailableError('RECONCILIATION_SOURCE_UNAVAILABLE')")
    expect(action).not.toMatch(/matchPayoutsToDeposits\(\s*\[\]\s*,\s*\[\]\s*\)/)
  })
})

describe('CFO-ACT — Report actions contract', () => {
  it('exports listReports, generateReport, getReportNarrative', () => {
    const path = join(CFO_ACTIONS, 'report-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function listReports')
    expect(content).toContain('export async function generateReport')
    expect(content).toContain('export async function getReportNarrative')
  })

  it('generateReport uses AI for narratives', () => {
    // Narrative generation moved into the report service; the action delegates to it.
    const action = exportedActions(readAction('report-actions.ts')).get('generateReport') ?? ''
    expect(action).toContain('generateScopedReport(context, input)')
    const service = functionBody(readService('reports.ts'), 'generateScopedReport')
    expect(service).toMatch(/runAICompletion(?:Detailed)?\(/)
    // The AI call is attributed to the verified organization, never 'platform'.
    expect(service).toContain('orgId: context.organizationId')
  })
})

describe('CFO-ACT — Integration actions contract', () => {
  it('exports getIntegrationStatuses, triggerSync, getTaxDeadlines', () => {
    const path = join(CFO_ACTIONS, 'integration-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function getIntegrationStatuses')
    expect(content).toContain('export async function triggerSync')
    expect(content).toContain('export async function getTaxDeadlines')
  })
})

describe('CFO-ACT — Advisory actions contract', () => {
  it('exports askAdvisor, getAIInsights, getCashFlowForecast', () => {
    const path = join(CFO_ACTIONS, 'advisory-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function askAdvisor')
    expect(content).toContain('export async function getAIInsights')
    expect(content).toContain('export async function getCashFlowForecast')
  })

  it('getCashFlowForecast uses ML prediction', () => {
    const path = join(CFO_ACTIONS, 'advisory-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('runPrediction')
  })
})

describe('CFO-ACT — Misc actions contract', () => {
  it('exports document, task, alert, message, workflow, and settings actions', () => {
    const path = join(CFO_ACTIONS, 'misc-actions.ts')
    const content = readFileSync(path, 'utf-8')
    // Documents
    expect(content).toContain('export async function listDocuments')
    expect(content).toContain('export async function uploadDocument')
    // Tasks
    expect(content).toContain('export async function listTasks')
    expect(content).toContain('export async function createTask')
    // Alerts
    expect(content).toContain('export async function listAlerts')
    // Messages
    expect(content).toContain('export async function listMessages')
    // Workflows
    expect(content).toContain('export async function listWorkflows')
    // Settings
    expect(content).toContain('export async function getSettings')
    expect(content).toContain('export async function updateSettings')
  })
})

describe('CFO-ACT — revalidatePath on mutations', () => {
  const MUTATING_FILES = [
    'client-actions.ts',
    'misc-actions.ts',
    'security-actions.ts',
    'platform-admin-actions.ts',
    'notification-actions.ts',
    'workflow-actions.ts',
  ]

  for (const file of MUTATING_FILES) {
    it(`${file} calls revalidatePath after mutations`, () => {
      const path = join(CFO_ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      expect(content).toContain('revalidatePath')
    })
  }
})

// ─── Phase 2 action files ────────────────────────────────────────────

describe('CFO-ACT — Security actions contract', () => {
  it('exports all security functions', () => {
    const path = join(CFO_ACTIONS, 'security-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function getSecurityPosture')
    expect(content).toContain('export async function listSecurityEvents')
    expect(content).toContain('export async function resolveSecurityEvent')
    expect(content).toContain('export async function listIncidents')
    expect(content).toContain('export async function updateIncidentStatus')
    expect(content).toContain('export async function listBackups')
    expect(content).toContain('export async function listComplianceItems')
    expect(content).toContain('export async function runSecurityScan')
  })
})

describe('CFO-ACT — Audit actions contract', () => {
  it('exports listAuditEntries and getAuditStats', () => {
    const path = join(CFO_ACTIONS, 'audit-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function listAuditEntries')
    expect(content).toContain('export async function getAuditStats')
  })
})

describe('CFO-ACT — Platform admin actions contract', () => {
  it('exports all platform admin functions', () => {
    const path = join(CFO_ACTIONS, 'platform-admin-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function getPlatformMetrics')
    expect(content).toContain('export async function listFirms')
    expect(content).toContain('export async function suspendFirm')
    expect(content).toContain('export async function reactivateFirm')
    expect(content).toContain('export async function updateFirmSubscription')
  })

  it('enforces RBAC via requirePermission', () => {
    // RBAC moved into resolveOrgContext: every admin action must declare the
    // 'platform' purpose with platform_admin:manage, and the resolver must call
    // requirePermission and refuse a non-platform role for that purpose.
    const actions = exportedActions(readAction('platform-admin-actions.ts'))
    expect(actions.size).toBeGreaterThan(0)
    for (const [name, body] of actions) {
      expect(body, name).toMatch(
        /resolveOrgContext\(\s*'platform',\s*\{\s*permission:\s*'platform_admin:manage'\s*\}/,
      )
    }
    const resolver = functionBody(read(RESOLVE_ORG), 'resolveOrgContext')
    expect(resolver).toContain('requirePermission(options.permission, userId)')
    expect(resolver).toContain("if (purpose === 'platform' && !platform) throw new CfoScopeError()")
  })
})

describe('CFO-ACT — Notification actions contract', () => {
  it('exports all notification functions', () => {
    const path = join(CFO_ACTIONS, 'notification-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function listNotifications')
    expect(content).toContain('export async function getUnreadCount')
    expect(content).toContain('export async function markNotificationRead')
    expect(content).toContain('export async function markAllNotificationsRead')
    expect(content).toContain('export async function createNotification')
    expect(content).toContain('export async function deleteNotification')
  })
})

describe('CFO-ACT — Workflow actions contract', () => {
  it('exports all workflow functions', () => {
    const path = join(CFO_ACTIONS, 'workflow-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function createWorkflowTemplate')
    expect(content).toContain('export async function getWorkflowTemplate')
    expect(content).toContain('export async function startWorkflowInstance')
    expect(content).toContain('export async function getWorkflowInstance')
    expect(content).toContain('export async function listWorkflowInstances')
    expect(content).toContain('export async function approveWorkflowStep')
    expect(content).toContain('export async function rejectWorkflowStep')
  })
})

describe('CFO-ACT — Misc actions CRUD gap fills', () => {
  it('exports acknowledgeAlert, sendMessage, updateTaskStatus', () => {
    const path = join(CFO_ACTIONS, 'misc-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function acknowledgeAlert')
    expect(content).toContain('export async function sendMessage')
    expect(content).toContain('export async function updateTaskStatus')
  })
})
