import { describe, it, expect } from 'vitest'
import {
  ControlFamily,
  EvidenceEventType,
  RetentionClass,
  Classification,
  BlobContainer,
  ArtifactDescriptor,
  EvidencePackRequest,
  GOVERNANCE_EVIDENCE_MAPPINGS,
} from '../types'

describe('evidence/types', () => {
  describe('ControlFamily', () => {
    it('accepts valid values', () => {
      expect(ControlFamily.parse('access')).toBe('access')
      expect(ControlFamily.parse('change-mgmt')).toBe('change-mgmt')
      expect(ControlFamily.parse('incident-response')).toBe('incident-response')
      expect(ControlFamily.parse('dr-bcp')).toBe('dr-bcp')
      expect(ControlFamily.parse('integrity')).toBe('integrity')
      expect(ControlFamily.parse('sdlc')).toBe('sdlc')
      expect(ControlFamily.parse('retention')).toBe('retention')
    })

    it('rejects invalid values', () => {
      expect(() => ControlFamily.parse('invalid')).toThrow()
    })
  })

  describe('EvidenceEventType', () => {
    it('accepts all valid event types', () => {
      const valid = [
        'incident', 'dr-test', 'access-review', 'period-close',
        'release', 'restore-test', 'control-test', 'audit-request',
      ]
      for (const v of valid) {
        expect(EvidenceEventType.parse(v)).toBe(v)
      }
    })
  })

  describe('RetentionClass', () => {
    it('accepts PERMANENT, 7_YEARS, 3_YEARS, 1_YEAR', () => {
      expect(RetentionClass.parse('PERMANENT')).toBe('PERMANENT')
      expect(RetentionClass.parse('7_YEARS')).toBe('7_YEARS')
      expect(RetentionClass.parse('3_YEARS')).toBe('3_YEARS')
      expect(RetentionClass.parse('1_YEAR')).toBe('1_YEAR')
    })
  })

  describe('Classification', () => {
    it('accepts INTERNAL, CONFIDENTIAL, RESTRICTED', () => {
      for (const c of ['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']) {
        expect(Classification.parse(c)).toBe(c)
      }
    })
  })

  describe('BlobContainer', () => {
    it('accepts evidence, minutebook, exports', () => {
      expect(BlobContainer.parse('evidence')).toBe('evidence')
      expect(BlobContainer.parse('minutebook')).toBe('minutebook')
      expect(BlobContainer.parse('exports')).toBe('exports')
    })
  })

  describe('ArtifactDescriptor', () => {
    const valid = {
      artifactId: 'a1',
      artifactType: 'resolution',
      filename: 'test.pdf',
      buffer: Buffer.from('hello'),
      contentType: 'application/pdf',
      retentionClass: 'PERMANENT' as const,
      classification: 'INTERNAL' as const,
    }

    it('parses a valid descriptor', () => {
      const result = ArtifactDescriptor.parse(valid)
      expect(result.artifactId).toBe('a1')
    })

    it('defaults classification to INTERNAL', () => {
      const { classification: _, ...withoutClassification } = valid
      const result = ArtifactDescriptor.parse(withoutClassification)
      expect(result.classification).toBe('INTERNAL')
    })

    it('rejects missing required fields', () => {
      expect(() => ArtifactDescriptor.parse({})).toThrow()
    })
  })

  describe('EvidencePackRequest', () => {
    const validRequest = {
      packId: 'IR-2026-001',
      orgId: '00000000-0000-0000-0000-000000000001',
      controlFamily: 'integrity' as const,
      eventType: 'period-close' as const,
      eventId: 'evt-1',
      blobContainer: 'evidence' as const,
      createdBy: 'admin',
      artifacts: [
        {
          artifactId: 'a1',
          artifactType: 'resolution',
          filename: 'test.pdf',
          buffer: Buffer.from('data'),
          contentType: 'application/pdf',
          retentionClass: 'PERMANENT' as const,
        },
      ],
    }

    it('parses valid request', () => {
      const result = EvidencePackRequest.parse(validRequest)
      expect(result.packId).toBe('IR-2026-001')
      expect(result.controlsCovered).toEqual([]) // default
      expect(result.summary).toBe('') // default
    })

    it('rejects empty packId', () => {
      expect(() => EvidencePackRequest.parse({ ...validRequest, packId: '' })).toThrow()
    })

    it('rejects non-UUID orgId', () => {
      expect(() => EvidencePackRequest.parse({ ...validRequest, orgId: 'not-a-uuid' })).toThrow()
    })

    it('rejects empty artifacts array', () => {
      expect(() => EvidencePackRequest.parse({ ...validRequest, artifacts: [] })).toThrow()
    })
  })

  describe('GOVERNANCE_EVIDENCE_MAPPINGS', () => {
    it('maps issue_shares to integrity control family', () => {
      expect(GOVERNANCE_EVIDENCE_MAPPINGS['issue_shares']!.controlFamily).toBe('integrity')
    })

    it('all mappings have required fields', () => {
      for (const [key, mapping] of Object.entries(GOVERNANCE_EVIDENCE_MAPPINGS)) {
        expect(mapping.actionType).toBe(key)
        expect(mapping.controlFamily).toBeTruthy()
        expect(mapping.eventType).toBeTruthy()
        expect(Array.isArray(mapping.controlsCovered)).toBe(true)
        expect(mapping.retentionClass).toBeTruthy()
        expect(mapping.blobContainer).toBeTruthy()
      }
    })
  })
})
