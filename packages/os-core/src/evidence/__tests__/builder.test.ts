import { describe, it, expect } from 'vitest'
import {
  buildEvidencePackFromAction,
  computeBasePath,
  listMappedActionTypes,
  type GovernanceActionContext,
} from '../builder'

describe('evidence/builder', () => {
  const baseCtx: GovernanceActionContext = {
    actionId: 'act-123',
    actionType: 'issue_shares',
    orgId: 'org-1',
    executedBy: 'admin',
  }

  describe('buildEvidencePackFromAction', () => {
    it('creates a pack request with metadata artifact when no documents provided', () => {
      const result = buildEvidencePackFromAction(baseCtx)
      expect(result.packId).toBeTruthy()
      expect(result.orgId).toBe('org-1')
      expect(result.artifacts).toHaveLength(1)
      expect(result.artifacts[0]!.artifactType).toBe('metadata')
    })

    it('includes resolution document when provided', () => {
      const ctx: GovernanceActionContext = {
        ...baseCtx,
        resolutionDocument: {
          filename: 'resolution.pdf',
          buffer: Buffer.from('pdf-data'),
          contentType: 'application/pdf',
        },
      }
      const result = buildEvidencePackFromAction(ctx)
      const resArt = result.artifacts.find((a) => a.artifactType === 'resolution')
      expect(resArt).toBeDefined()
      expect(resArt!.filename).toBe('resolution.pdf')
    })

    it('includes executed artifact', () => {
      const ctx: GovernanceActionContext = {
        ...baseCtx,
        executedArtifact: {
          filename: 'cert.pdf',
          buffer: Buffer.from('cert'),
          contentType: 'application/pdf',
        },
      }
      const result = buildEvidencePackFromAction(ctx)
      const art = result.artifacts.find((a) => a.artifactType === 'executed-artifact')
      expect(art).toBeDefined()
    })

    it('includes audit trail', () => {
      const ctx: GovernanceActionContext = {
        ...baseCtx,
        auditTrail: { buffer: Buffer.from('[]') },
      }
      const result = buildEvidencePackFromAction(ctx)
      const art = result.artifacts.find((a) => a.artifactType === 'audit-trail')
      expect(art).toBeDefined()
      expect(art!.contentType).toBe('application/json')
    })

    it('uses GOVERNANCE_EVIDENCE_MAPPINGS for known action types', () => {
      const result = buildEvidencePackFromAction(baseCtx)
      expect(result.controlFamily).toBe('integrity')
      expect(result.eventType).toBe('period-close')
    })

    it('falls back to defaults for unknown action types', () => {
      const result = buildEvidencePackFromAction({ ...baseCtx, actionType: 'unknown-type' })
      expect(result.controlFamily).toBe('change-mgmt')
      expect(result.eventType).toBe('period-close')
    })

    it('respects overrides', () => {
      const result = buildEvidencePackFromAction(baseCtx, {
        controlFamily: 'sdlc',
        eventType: 'release',
        blobContainer: 'exports',
      })
      expect(result.controlFamily).toBe('sdlc')
      expect(result.eventType).toBe('release')
      expect(result.blobContainer).toBe('exports')
    })

    it('includes additional artifacts', () => {
      const ctx: GovernanceActionContext = {
        ...baseCtx,
        additionalArtifacts: [
          {
            artifactId: 'extra-1',
            artifactType: 'attachment',
            filename: 'extra.pdf',
            buffer: Buffer.from('extra'),
            contentType: 'application/pdf',
            retentionClass: 'PERMANENT',
            classification: 'INTERNAL',
          },
        ],
      }
      const result = buildEvidencePackFromAction(ctx)
      const extra = result.artifacts.find((a) => a.artifactId === 'extra-1')
      expect(extra).toBeDefined()
    })
  })

  describe('computeBasePath', () => {
    it('returns orgId/controlFamily/year/month/packId format', () => {
      const path = computeBasePath('org-1', 'integrity', 'PACK-001')
      expect(path).toMatch(/^org-1\/integrity\/\d{4}\/\d{2}\/PACK-001$/)
    })
  })

  describe('listMappedActionTypes', () => {
    it('returns an array of known action types', () => {
      const types = listMappedActionTypes()
      expect(types).toContain('issue_shares')
      expect(types).toContain('transfer_shares')
      expect(types).toContain('dividend')
      expect(types.length).toBeGreaterThan(3)
    })
  })
})
