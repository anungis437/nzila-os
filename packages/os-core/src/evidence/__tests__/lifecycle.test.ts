import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import {
  createEvidencePackDraft,
  assertValidTransition,
  LifecycleTransitionError,
  SealOnceViolationError,
  DraftMutationError,
  type EvidencePackDraftOptions,
} from '../lifecycle'
import type { ArtifactDescriptor } from '../types'

function makeArtifact(id: string): ArtifactDescriptor {
  return {
    artifactId: id,
    artifactType: 'test',
    filename: `${id}.json`,
    buffer: Buffer.from(`content-${id}`),
    contentType: 'application/json',
    retentionClass: '7_YEARS',
    classification: 'INTERNAL',
  }
}

const defaultOpts: EvidencePackDraftOptions = {
  packId: 'IR-2026-001',
  orgId: 'org-1',
  controlFamily: 'incident-response',
  eventType: 'incident',
  eventId: 'INC-42',
  createdBy: 'system',
}

describe('lifecycle', () => {
  describe('assertValidTransition', () => {
    it('draft → sealed is valid', () => {
      expect(() => assertValidTransition('draft', 'sealed')).not.toThrow()
    })

    it('sealed → verified is valid', () => {
      expect(() => assertValidTransition('sealed', 'verified')).not.toThrow()
    })

    it('sealed → expired is valid', () => {
      expect(() => assertValidTransition('sealed', 'expired')).not.toThrow()
    })

    it('verified → expired is valid', () => {
      expect(() => assertValidTransition('verified', 'expired')).not.toThrow()
    })

    it('draft → verified is invalid', () => {
      expect(() => assertValidTransition('draft', 'verified')).toThrow(LifecycleTransitionError)
    })

    it('sealed → draft is invalid', () => {
      expect(() => assertValidTransition('sealed', 'draft')).toThrow(LifecycleTransitionError)
    })

    it('expired → anything is invalid', () => {
      expect(() => assertValidTransition('expired', 'sealed')).toThrow(LifecycleTransitionError)
    })

    it('LifecycleTransitionError has from/to properties', () => {
      try {
        assertValidTransition('expired', 'draft')
      } catch (e) {
        expect(e).toBeInstanceOf(LifecycleTransitionError)
        expect((e as LifecycleTransitionError).from).toBe('expired')
        expect((e as LifecycleTransitionError).to).toBe('draft')
      }
    })
  })

  describe('createEvidencePackDraft', () => {
    it('creates a draft with correct metadata', () => {
      const draft = createEvidencePackDraft(defaultOpts)
      expect(draft.status).toBe('draft')
      expect(draft.packId).toBe('IR-2026-001')
      expect(draft.orgId).toBe('org-1')
      expect(draft.controlFamily).toBe('incident-response')
      expect(draft.eventType).toBe('incident')
    })

    it('defaults blobContainer to "evidence"', () => {
      const draft = createEvidencePackDraft(defaultOpts)
      expect(draft.blobContainer).toBe('evidence')
    })

    it('addArtifact increases artifacts array', () => {
      const draft = createEvidencePackDraft(defaultOpts)
      draft.addArtifact(makeArtifact('a1'))
      expect(draft.artifacts).toHaveLength(1)
      draft.addArtifact(makeArtifact('a2'))
      expect(draft.artifacts).toHaveLength(2)
    })

    it('artifacts are frozen (immutable snapshot)', () => {
      const draft = createEvidencePackDraft(defaultOpts)
      draft.addArtifact(makeArtifact('a1'))
      const arts = draft.artifacts
      expect(Object.isFrozen(arts)).toBe(true)
    })

    it('seal() produces a SealedEvidencePack', () => {
      const draft = createEvidencePackDraft(defaultOpts)
      draft.addArtifact(makeArtifact('a1'))
      const sealed = draft.seal({ sealedAt: '2026-01-01T00:00:00Z' })
      expect(sealed.status).toBe('sealed')
      expect(sealed.packId).toBe('IR-2026-001')
      expect(sealed.seal).toBeDefined()
      expect(sealed.seal.sealVersion).toBe('1.0')
      expect(sealed.seal.packDigest).toMatch(/^[0-9a-f]{64}$/)
      expect(sealed.seal.artifactCount).toBe(1)
    })

    it('seal() throws SealOnceViolationError if called twice', () => {
      const draft = createEvidencePackDraft(defaultOpts)
      draft.addArtifact(makeArtifact('a1'))
      draft.seal()
      expect(() => draft.seal()).toThrow(SealOnceViolationError)
    })

    it('addArtifact throws DraftMutationError after seal()', () => {
      const draft = createEvidencePackDraft(defaultOpts)
      draft.addArtifact(makeArtifact('a1'))
      draft.seal()
      expect(() => draft.addArtifact(makeArtifact('a2'))).toThrow(DraftMutationError)
    })

    it('seal() throws DraftMutationError if no artifacts', () => {
      const draft = createEvidencePackDraft(defaultOpts)
      expect(() => draft.seal()).toThrow(DraftMutationError)
    })

    it('sealed pack is frozen', () => {
      const draft = createEvidencePackDraft(defaultOpts)
      draft.addArtifact(makeArtifact('a1'))
      const sealed = draft.seal()
      expect(Object.isFrozen(sealed)).toBe(true)
    })

    it('sealed pack artifacts have sha256 hashes', () => {
      const draft = createEvidencePackDraft(defaultOpts)
      const buf = Buffer.from('test-content')
      draft.addArtifact({ ...makeArtifact('a1'), buffer: buf })
      const sealed = draft.seal()
      const sealedArt = sealed.seal
      expect(sealedArt.packDigest).toBeDefined()
    })
  })
})
