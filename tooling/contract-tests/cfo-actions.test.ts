/**
 * Contract Test — CFO Server Actions
 *
 * Structural invariants for the CFO app's server actions:
 *   1. Every action file must use 'use server' directive
 *   2. Every action must call `auth()` for authentication
 *   3. Every mutating action must call evidence pipeline
 *   4. Every action must use the structured logger
 *   5. Every action must import from platformDb
 *
 * @invariant CFO-ACT-01: Server action auth guard
 * @invariant CFO-ACT-02: Evidence pipeline integration
 * @invariant CFO-ACT-03: Structured logging
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '../..')
const CFO_ACTIONS = join(ROOT, 'apps', 'cfo', 'lib', 'actions')

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

describe('CFO-ACT-01 — Every action file calls auth()', () => {
  for (const file of ACTION_FILES) {
    it(`${file} authenticates via auth()`, () => {
      const path = join(CFO_ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      expect(content).toContain('auth()')
      expect(content).toContain('@nzila/platform-auth')
    })
  }
})

describe('CFO-ACT-02 — Mutating actions use evidence pipeline', () => {
  const MUTATING_FILES = [
    'ledger-actions.ts',
    'report-actions.ts',
    'integration-actions.ts',
    'advisory-actions.ts',
  ]

  for (const file of MUTATING_FILES) {
    it(`${file} integrates evidence pipeline`, () => {
      const path = join(CFO_ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      expect(content).toContain('buildEvidencePackFromAction')
      expect(content).toContain('processEvidencePack')
    })
  }
})

describe('CFO-ACT-03 — Every action file uses structured logger', () => {
  for (const file of ACTION_FILES) {
    it(`${file} imports logger`, () => {
      const path = join(CFO_ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      expect(content).toContain('logger')
    })
  }
})

describe('CFO-ACT — Action files use platformDb', () => {
  for (const file of ACTION_FILES) {
    it(`${file} imports platformDb`, () => {
      const path = join(CFO_ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      expect(content).toContain('platformDb')
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

  it('runReconciliation uses commerce reconciliation', () => {
    const path = join(CFO_ACTIONS, 'ledger-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('matchPayoutsToDeposits')
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
    const path = join(CFO_ACTIONS, 'report-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('runAICompletion')
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
    const path = join(CFO_ACTIONS, 'platform-admin-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('requirePermission')
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
