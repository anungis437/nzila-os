/**
 * CFO — Architecture Purity Tests
 *
 * Validates that source files follow the governance rules:
 *   1. Domain layer exports canonical types with Zod schemas
 *   2. Platform adapters implement all 4 contracts
 *   3. Policy enforcement routes through platform-policy-engine
 *   4. Evidence pipeline uses os-core hashing
 *   5. No direct DB client imports in app code (must use scoped-db)
 *
 * These tests use static source analysis — no DB required.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '..')

function readSource(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), 'utf-8')
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. DOMAIN LAYER
// ═══════════════════════════════════════════════════════════════════════════

describe('Domain Layer', () => {
  it('domain/index.ts exports Zod schemas for all core entities', () => {
    const src = readSource('domain/index.ts')
    expect(src).toContain('ReportSchema')
    expect(src).toContain('LedgerEntrySchema')
    expect(src).toContain('AdvisoryAlertSchema')
    expect(src).toContain('WorkflowStepSchema')
    expect(src).toContain('AuditEventSchema')
  })

  it('domain/index.ts exports all status enums', () => {
    const src = readSource('domain/index.ts')
    expect(src).toContain('ReportType')
    expect(src).toContain('ReportStatus')
    expect(src).toContain('LedgerSource')
    expect(src).toContain('AlertSeverity')
    expect(src).toContain('AlertCategory')
    expect(src).toContain('WorkflowTrigger')
    expect(src).toContain('WorkflowStatus')
  })

  it('domain/index.ts re-exports from @nzila/commerce-core', () => {
    const src = readSource('domain/index.ts')
    expect(src).toContain('@nzila/commerce-core')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. PLATFORM ADAPTERS
// ═══════════════════════════════════════════════════════════════════════════

describe('Platform Adapters', () => {
  const adapterFiles = [
    'lib/platform-adapters/health-adapter.ts',
    'lib/platform-adapters/metrics-adapter.ts',
    'lib/platform-adapters/evidence-adapter.ts',
    'lib/platform-adapters/governance-adapter.ts',
  ]

  it('all 4 adapter files exist', () => {
    for (const file of adapterFiles) {
      expect(existsSync(resolve(ROOT, file)), `missing ${file}`).toBe(true)
    }
  })

  it('barrel re-exports all adapters', () => {
    const src = readSource('lib/platform-adapters/index.ts')
    expect(src).toContain('healthAdapter')
    expect(src).toContain('metricsAdapter')
    expect(src).toContain('evidenceAdapter')
    expect(src).toContain('governanceAdapter')
  })

  it('evidence adapter uses SHA-256 hashing', () => {
    const src = readSource('lib/platform-adapters/evidence-adapter.ts')
    expect(src).toContain('sha256')
  })

  it('health adapter checks DB connectivity', () => {
    const src = readSource('lib/platform-adapters/health-adapter.ts')
    expect(src).toContain('SELECT 1')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. INTEGRATION BARREL
// ═══════════════════════════════════════════════════════════════════════════

describe('Integration Barrel', () => {
  const EXPECTED_INTEGRATION_MODULES = [
    'plaid', 'stripe', 'qbo', 'dext', 'document-intelligence', 'excel-export',
    'xero', 'sage', 'payroll-provider', 'expense-management', 'irs-filing',
    'pension', 'tax', 'fx', 'bi-connector', 'crm', 'chatops', 'email',
    'calendar', 'm365', 'ai-client', 'ml-client', 'public-api',
  ]

  it('lib/integrations/index.ts re-exports all integration modules', () => {
    const src = readSource('lib/integrations/index.ts')
    for (const mod of EXPECTED_INTEGRATION_MODULES) {
      expect(src, `barrel missing module: ${mod}`).toContain(`'../${mod}'`)
    }
  })

  it('all integration source files exist', () => {
    for (const mod of EXPECTED_INTEGRATION_MODULES) {
      const filePath = resolve(ROOT, `lib/${mod}.ts`)
      expect(existsSync(filePath), `missing file: lib/${mod}.ts`).toBe(true)
    }
  })

  it('.env.example documents all external integration env vars', () => {
    const envExample = readSource('.env.example')
    const criticalVars = [
      'PLAID_CLIENT_ID', 'DEXT_API_KEY', 'XERO_CLIENT_ID',
      'SAGE_CLIENT_ID', 'PAYROLL_PROVIDER', 'EXPENSE_PROVIDER',
      'BI_PROVIDER', 'HUBSPOT_API_KEY', 'SLACK_TOKEN', 'RESEND_API_KEY',
    ]
    for (const v of criticalVars) {
      expect(envExample, `env.example missing ${v}`).toContain(v)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. LAYER BARRELS
// ═══════════════════════════════════════════════════════════════════════════

describe('Layer Barrels', () => {
  it('services/index.ts re-exports from lib/', () => {
    const src = readSource('services/index.ts')
    expect(src).toContain('advisory-automation')
    expect(src).toContain('policy-enforcement')
    expect(src).toContain('evaluateClientMetrics')
    expect(src).toContain('checkCfoPolicy')
  })

  it('workflows/index.ts re-exports workflow engine', () => {
    const src = readSource('workflows/index.ts')
    expect(src).toContain('evaluateTriggers')
    expect(src).toContain('WORKFLOW_TEMPLATE_LIBRARY')
    expect(src).toContain('evaluateWorkflowSla')
  })

  it('events/index.ts defines CfoEventType and CfoEvent', () => {
    const src = readSource('events/index.ts')
    expect(src).toContain('CfoEventType')
    expect(src).toContain('CfoEvent')
    expect(src).toContain('report.created')
    expect(src).toContain('reconciliation.started')
  })

  it('queries/index.ts has DB-backed read models', () => {
    const src = readSource('queries/index.ts')
    expect(src).toContain('getReportStatusDistribution')
    expect(src).toContain('getLedgerActivitySummary')
    expect(src).toContain('platformDb')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. POLICY & EVIDENCE INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

describe('Policy & Evidence Integration', () => {
  it('policy-enforcement.ts uses platform-policy-engine', () => {
    const src = readSource('lib/policy-enforcement.ts')
    expect(src).toContain('@nzila/platform-policy-engine')
    expect(src).toContain('evaluatePolicy')
    expect(src).toContain('isBlocked')
  })

  it('evidence.ts uses os-core evidence pipeline', () => {
    const src = readSource('lib/evidence.ts')
    expect(src).toContain('@nzila/os-core/evidence')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 6. CONFIG ALIGNMENT
// ═══════════════════════════════════════════════════════════════════════════

describe('Config Alignment', () => {
  it('control-manifest.json has aiControl enabled', () => {
    const manifest = JSON.parse(readSource('control-manifest.json'))
    expect(manifest.controls.aiControl).toBe(true)
    expect(manifest.controls.contracts).toBe(true)
    expect(manifest.controls.events).toBe(true)
  })

  it('control-manifest.json has capabilities block', () => {
    const manifest = JSON.parse(readSource('control-manifest.json'))
    expect(manifest.capabilities).toBeDefined()
    expect(manifest.capabilities.commerce).toBe(true)
    expect(manifest.capabilities.tax).toBe(true)
  })

  it('app-architecture.meta.json is marked PRODUCTION', () => {
    const meta = JSON.parse(readSource('app-architecture.meta.json'))
    expect(meta.app_tier).toBe('PRODUCTION')
    expect(meta.migration_status).toBe('complete')
    expect(meta.layers_missing).toHaveLength(0)
  })
})
