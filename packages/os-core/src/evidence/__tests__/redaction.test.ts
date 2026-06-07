import { describe, it, expect } from 'vitest'
import {
  redactArtifact,
  redactArtifacts,
  redactAndReseal,
  PARTNER_RESTRICTED_ARTIFACT_TYPES,
  type RedactionMode,
} from '../redaction'
import { generateSeal, type SealablePackIndex } from '../seal'

describe('redaction', () => {
  const internalArtifact = {
    type: 'governance-resolution',
    email: 'alice@example.com',
    orgId: 'org-1',
    ipAddress: '1.2.3.4',
    value: 42,
  }

  const restrictedArtifact = {
    type: 'security-scan-findings',
    findings: ['vuln-1', 'vuln-2'],
  }

  describe('redactArtifact', () => {
    it('returns same artifact in internal mode', () => {
      const result = redactArtifact(internalArtifact, 'internal')
      expect(result).toBe(internalArtifact) // same reference
    })

    it('returns null for restricted artifact types in partner mode', () => {
      const result = redactArtifact(restrictedArtifact, 'partner')
      expect(result).toBeNull()
    })

    it('strips PII fields in partner mode', () => {
      const result = redactArtifact(internalArtifact, 'partner')!
      expect(result).not.toBeNull()
      expect(result.email).toBeUndefined()
      expect(result.ipAddress).toBeUndefined()
      expect(result.value).toBe(42) // non-PII preserved
    })

    it('strips more fields in public mode (orgId)', () => {
      const result = redactArtifact(internalArtifact, 'public')!
      expect(result).not.toBeNull()
      expect(result.email).toBeUndefined()
      expect(result.orgId).toBeUndefined()
      expect(result.value).toBe(42)
    })

    it('returns null for all restricted types in public mode', () => {
      for (const type of PARTNER_RESTRICTED_ARTIFACT_TYPES) {
        const result = redactArtifact({ type }, 'public')
        expect(result).toBeNull()
      }
    })

    it('strips nested PII fields', () => {
      const artifact = {
        type: 'audit',
        user: { email: 'x@y.com', role: 'admin' },
      }
      const result = redactArtifact(artifact, 'partner')!
      const user = result.user as { email?: string; role?: string }
      expect(user.email).toBeUndefined()
      expect(user.role).toBe('admin')
    })

    it('strips PII in arrays', () => {
      const artifact = {
        type: 'audit',
        actors: [{ email: 'a@b.com', id: '1' }],
      }
      const result = redactArtifact(artifact, 'partner')!
      const actors = result.actors as Array<{ email?: string; id?: string }>
      expect(actors[0]?.email).toBeUndefined()
      expect(actors[0]?.id).toBe('1')
    })
  })

  describe('redactArtifacts', () => {
    it('filters out restricted artifacts and redacts PII', () => {
      const artifacts = [internalArtifact, restrictedArtifact]
      const result = redactArtifacts(artifacts, 'partner')
      expect(result).toHaveLength(1)
      expect(result[0]!.email).toBeUndefined()
    })

    it('returns all artifacts for internal mode', () => {
      const result = redactArtifacts([internalArtifact, restrictedArtifact], 'internal')
      expect(result).toHaveLength(2)
    })
  })

  describe('redactAndReseal', () => {
    const baseIndex: SealablePackIndex = {
      packId: 'IR-1',
      orgId: 'org-1',
      artifacts: [
        { sha256: 'abc123', type: 'governance-resolution', artifactType: 'governance-resolution', email: 'a@b.com' },
        { sha256: 'def456', type: 'security-scan-findings', artifactType: 'security-scan-findings', findings: [] },
      ],
    }

    it('internal mode preserves all artifacts and re-seals', () => {
      const seal = generateSeal(baseIndex, { sealedAt: '2026-01-01T00:00:00Z' })
      const withSeal = { ...baseIndex, seal }

      const result = redactAndReseal(withSeal, 'internal')
      expect(result.index.redactedFor).toBe('internal')
      expect(result.index.originalPackDigest).toBe(seal.packDigest)
      expect(result.seal).toBeDefined()
      expect(result.seal.packDigest).toMatch(/^[0-9a-f]{64}$/)
    })

    it('partner mode strips restricted artifacts', () => {
      const seal = generateSeal(baseIndex)
      const withSeal = { ...baseIndex, seal }

      const result = redactAndReseal(withSeal, 'partner')
      // security-scan-findings should be removed
      expect(result.index.artifacts).toHaveLength(1)
      expect(result.index.redactedFor).toBe('partner')
    })

    it('partner mode strips PII fields from remaining artifacts', () => {
      const seal = generateSeal(baseIndex)
      const withSeal = { ...baseIndex, seal }

      const result = redactAndReseal(withSeal, 'partner')
      const remainingArt = result.index.artifacts[0] as { email?: string }
      expect(remainingArt.email).toBeUndefined()
    })

    it('public mode strips orgId from index', () => {
      const seal = generateSeal(baseIndex)
      const withSeal = { ...baseIndex, seal }

      const result = redactAndReseal(withSeal, 'public')
      expect(result.index.orgId).toBeUndefined()
    })

    it('generates a fresh seal on redacted content', () => {
      const seal = generateSeal(baseIndex)
      const withSeal = { ...baseIndex, seal }

      const result = redactAndReseal(withSeal, 'partner')
      // New seal should differ from original
      expect(result.seal.packDigest).not.toBe(seal.packDigest)
    })

    it('handles missing original seal gracefully', () => {
      const result = redactAndReseal(baseIndex, 'internal')
      expect(result.index.originalPackDigest).toBe('no-original-seal')
    })
  })
})
