/**
 * Barrel export coverage — import each index.ts barrel to ensure re-export
 * statements are covered by v8.
 */
import { describe, it, expect, vi } from 'vitest'

// Mock heavy external deps pulled transitively through evidence barrel
vi.mock('@nzila/blob', () => ({
  uploadBuffer: vi.fn(),
  computeSha256: vi.fn(),
}))
vi.mock('@nzila/db', () => ({
  db: { insert: vi.fn().mockReturnThis(), values: vi.fn().mockReturnThis() },
}))
vi.mock('@nzila/db/schema', () => ({
  documents: {},
  evidencePacks: {},
  evidencePackArtifacts: {},
  auditEvents: {},
  idempotencyCache: { id: 'id', expiresAt: 'expiresAt' },
}))
vi.mock('@nzila/db/client', () => ({
  db: { delete: vi.fn().mockReturnThis() },
}))

describe('barrel exports', () => {
  it('src/audit/index.ts re-exports ABR taxonomy', async () => {
    const mod = await import('../audit/index')
    expect(mod).toBeDefined()
    expect(Object.keys(mod).length).toBeGreaterThan(0)
  })

  it('src/policy/index.ts re-exports policy modules', async () => {
    const mod = await import('../policy/index')
    expect(mod.ConsoleRole).toBeDefined()
    expect(mod.Scope).toBeDefined()
    expect(mod.authorize).toBeDefined()
    expect(mod.withAuth).toBeDefined()
    expect(mod.AuthorizationError).toBeDefined()
  })

  it('src/resilience/index.ts re-exports resilience patterns', async () => {
    const mod = await import('../resilience/index')
    expect(mod.CircuitBreaker).toBeDefined()
    expect(mod.Bulkhead).toBeDefined()
    expect(mod.OrgBulkheadPool).toBeDefined()
    expect(mod.retry).toBeDefined()
    expect(mod.withTimeout).toBeDefined()
  })

  it('src/retention/index.ts re-exports retention module', async () => {
    const mod = await import('../retention/index')
    expect(mod).toBeDefined()
    expect(Object.keys(mod).length).toBeGreaterThan(0)
  })

  it('src/telemetry/index.ts re-exports telemetry modules', async () => {
    const mod = await import('../telemetry/index')
    expect(mod.createRequestContext).toBeDefined()
    expect(mod.createLogger).toBeDefined()
    expect(mod.createAppBoot).toBeDefined()
    expect(mod.metrics).toBeDefined()
    expect(mod.initOtel).toBeDefined()
  })

  it('src/evidence/index.ts re-exports evidence modules', async () => {
    const mod = await import('../evidence/index')
    expect(mod.buildEvidencePackFromAction).toBeDefined()
    expect(mod.generateSeal).toBeDefined()
    expect(mod.verifySeal).toBeDefined()
    expect(mod.processEvidencePack).toBeDefined()
    expect(mod.createEvidencePackDraft).toBeDefined()
    expect(mod.redactArtifact).toBeDefined()
    expect(mod.verifyPackIndex).toBeDefined()
  })

  it('src/index.ts top-level barrel exports core API', async () => {
    const mod = await import('../index')
    expect(mod.apiSuccess).toBeDefined()
    expect(mod.apiError).toBeDefined()
    expect(mod.ApiError).toBeDefined()
    expect(mod.ApiErrorCode).toBeDefined()
    expect(mod.apiHandler).toBeDefined()
    expect(mod.checkRateLimit).toBeDefined()
    expect(mod.auditedAction).toBeDefined()
    expect(mod.evaluateGovernanceRequirements).toBeDefined()
    expect(mod.computeEntryHash).toBeDefined()
    expect(mod.assertBootInvariants).toBeDefined()
    expect(mod.checkIdempotency).toBeDefined()
    expect(mod.InMemoryIdempotencyCache).toBeDefined()
    expect(mod.RetentionClass).toBeDefined()
  })
})
