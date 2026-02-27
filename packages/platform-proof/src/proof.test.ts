import { describe, it, expect, vi } from 'vitest'
import { computeSignatureHash } from './proof'

// ── Mock DB layer ──────────────────────────────────────────────────────────

vi.mock('@nzila/db/platform', () => ({
  platformDb: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'test-proof-id' }]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockResolvedValue([{ totalEvents: 42, latestAt: '2026-01-01T00:00:00Z' }]),
    }),
  },
}))

vi.mock('@nzila/db/schema', () => ({
  platformProofPacks: {
    id: 'id',
    contractTestHash: 'contract_test_hash',
    ciPipelineStatus: 'ci_pipeline_status',
    lastMigrationId: 'last_migration_id',
    auditIntegrityHash: 'audit_integrity_hash',
    secretScanStatus: 'secret_scan_status',
    redTeamSummary: 'red_team_summary',
    signatureHash: 'signature_hash',
    immutable: 'immutable',
    payload: 'payload',
    generatedAt: 'generated_at',
  },
  auditEvents: {
    createdAt: 'created_at',
    entityId: 'entity_id',
  },
}))

// ── Type contract tests ────────────────────────────────────────────────────

describe('Platform Proof — type contracts', () => {
  it('exports generateGovernanceProofPack', async () => {
    const mod = await import('./proof')
    expect(typeof mod.generateGovernanceProofPack).toBe('function')
  })

  it('exports computeSignatureHash', async () => {
    const mod = await import('./proof')
    expect(typeof mod.computeSignatureHash).toBe('function')
  })
})

// ── Signature hash tests ────────────────────────────────────────────────────

describe('computeSignatureHash — deterministic', () => {
  it('produces consistent hash for same payload', () => {
    const payload = { a: '1', b: '2', c: '3' }
    const hash1 = computeSignatureHash(payload)
    const hash2 = computeSignatureHash(payload)
    expect(hash1).toBe(hash2)
  })

  it('produces different hash for different payloads', () => {
    const hash1 = computeSignatureHash({ a: '1' })
    const hash2 = computeSignatureHash({ a: '2' })
    expect(hash1).not.toBe(hash2)
  })

  it('is order-independent (sorted keys)', () => {
    const hash1 = computeSignatureHash({ b: '2', a: '1' })
    const hash2 = computeSignatureHash({ a: '1', b: '2' })
    expect(hash1).toBe(hash2)
  })

  it('produces a 64-char hex string (SHA-256)', () => {
    const hash = computeSignatureHash({ test: 'value' })
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

// ── Proof generation test ───────────────────────────────────────────────────

describe('generateGovernanceProofPack — integration', () => {
  it('returns well-formed proof pack', async () => {
    const { generateGovernanceProofPack } = await import('./proof')
    const result = await generateGovernanceProofPack()

    expect(result).toHaveProperty('id')
    expect(result).toHaveProperty('contractTestHash')
    expect(result).toHaveProperty('ciPipelineStatus')
    expect(result).toHaveProperty('lastMigrationId')
    expect(result).toHaveProperty('auditIntegrityHash')
    expect(result).toHaveProperty('secretScanStatus')
    expect(result).toHaveProperty('redTeamSummary')
    expect(result).toHaveProperty('signatureHash')
    expect(result).toHaveProperty('generatedAt')
    expect(result.signatureHash).toMatch(/^[0-9a-f]{64}$/)
  })
})
