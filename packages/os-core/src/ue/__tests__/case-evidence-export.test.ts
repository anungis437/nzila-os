import { describe, it, expect } from 'vitest'
import {
  computeDocumentVersionHash,
  verifyDocumentVersionChain,
  isBlockedByLitigationHold,
  validateRoleGraphAcyclic,
  type DocumentVersion,
  type LitigationHold,
  type RoleEdge,
} from '../case-evidence-export'

describe('ue/case-evidence-export', () => {
  // ── Document Version Hashing ────────────────────────────────────────

  describe('computeDocumentVersionHash', () => {
    it('returns a hex string', () => {
      const hash = computeDocumentVersionHash('hello world', null)
      expect(hash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('is deterministic', () => {
      const h1 = computeDocumentVersionHash('same', null)
      const h2 = computeDocumentVersionHash('same', null)
      expect(h1).toBe(h2)
    })

    it('differs when content differs', () => {
      const h1 = computeDocumentVersionHash('content-A', null)
      const h2 = computeDocumentVersionHash('content-B', null)
      expect(h1).not.toBe(h2)
    })

    it('chains to previous hash', () => {
      const h1 = computeDocumentVersionHash('v1', null)
      const h2 = computeDocumentVersionHash('v2', h1)
      const h2alt = computeDocumentVersionHash('v2', 'different-prev')
      expect(h2).not.toBe(h2alt) // different prev → different hash
    })

    it('works with Buffer input', () => {
      const hash = computeDocumentVersionHash(Buffer.from('binary'), null)
      expect(hash).toMatch(/^[0-9a-f]{64}$/)
    })
  })

  describe('verifyDocumentVersionChain', () => {
    it('returns valid for correct chain', () => {
      const v1hash = computeDocumentVersionHash('v1', null)
      const versions: DocumentVersion[] = [
        {
          documentId: 'd1', version: 1, contentHash: v1hash,
          previousVersionHash: null, authorId: 'a1', createdAt: '2026-01-01',
        },
        {
          documentId: 'd1', version: 2, contentHash: 'v2hash',
          previousVersionHash: v1hash, authorId: 'a1', createdAt: '2026-01-02',
        },
      ]
      expect(verifyDocumentVersionChain(versions).valid).toBe(true)
    })

    it('detects broken chain', () => {
      const versions: DocumentVersion[] = [
        {
          documentId: 'd1', version: 1, contentHash: 'hash1',
          previousVersionHash: null, authorId: 'a1', createdAt: '2026-01-01',
        },
        {
          documentId: 'd1', version: 2, contentHash: 'hash2',
          previousVersionHash: 'WRONG', authorId: 'a1', createdAt: '2026-01-02',
        },
      ]
      const result = verifyDocumentVersionChain(versions)
      expect(result.valid).toBe(false)
      expect(result.brokenAtVersion).toBe(2)
    })

    it('handles empty array', () => {
      expect(verifyDocumentVersionChain([]).valid).toBe(true)
    })

    it('validates single-version chain', () => {
      const versions: DocumentVersion[] = [
        {
          documentId: 'd1', version: 1, contentHash: 'hash',
          previousVersionHash: null, authorId: 'a1', createdAt: '2026-01-01',
        },
      ]
      expect(verifyDocumentVersionChain(versions).valid).toBe(true)
    })

    it('detects break if first version has non-null prev hash', () => {
      const versions: DocumentVersion[] = [
        {
          documentId: 'd1', version: 1, contentHash: 'hash',
          previousVersionHash: 'should-be-null', authorId: 'a1', createdAt: '2026-01-01',
        },
      ]
      expect(verifyDocumentVersionChain(versions).valid).toBe(false)
    })
  })

  // ── Litigation Hold ─────────────────────────────────────────────────

  describe('isBlockedByLitigationHold', () => {
    const hold: LitigationHold = {
      holdId: 'H-001',
      caseId: 'C-001',
      orgId: 'org-1',
      scope: {
        documentCategories: ['contracts', 'emails'],
        dateFrom: '2025-01-01',
        dateTo: '2025-12-31',
        specificDocumentIds: ['doc-99'],
      },
      issuedBy: 'counsel',
      issuedAt: '2025-06-01',
      reason: 'Pending litigation',
    }

    it('blocks delete of specific document', () => {
      const result = isBlockedByLitigationHold('doc-99', 'contracts', '2025-06-15', 'delete', [hold])
      expect(result.blocked).toBe(true)
      expect(result.holdId).toBe('H-001')
    })

    it('blocks modify of document in held category+date range', () => {
      const result = isBlockedByLitigationHold('doc-other', 'contracts', '2025-06-15', 'modify', [hold])
      expect(result.blocked).toBe(true)
    })

    it('allows export even under hold', () => {
      const result = isBlockedByLitigationHold('doc-99', 'contracts', '2025-06-15', 'export', [hold])
      expect(result.blocked).toBe(false)
    })

    it('allows actions outside date range', () => {
      const result = isBlockedByLitigationHold('doc-1', 'contracts', '2026-06-15', 'delete', [hold])
      expect(result.blocked).toBe(false)
    })

    it('allows actions for non-held categories', () => {
      const result = isBlockedByLitigationHold('doc-1', 'invoices', '2025-06-15', 'delete', [hold])
      expect(result.blocked).toBe(false)
    })

    it('skips released holds', () => {
      const releasedHold: LitigationHold = {
        ...hold,
        releasedAt: '2026-01-01',
      }
      const result = isBlockedByLitigationHold('doc-99', 'contracts', '2025-06-15', 'delete', [releasedHold])
      expect(result.blocked).toBe(false)
    })

    it('not blocked when no active holds', () => {
      const result = isBlockedByLitigationHold('doc-99', 'contracts', '2025-06-15', 'delete', [])
      expect(result.blocked).toBe(false)
    })
  })

  // ── Role Graph DAG Validation ───────────────────────────────────────

  describe('validateRoleGraphAcyclic', () => {
    it('valid for a simple DAG', () => {
      const edges: RoleEdge[] = [
        { parent: 'admin', child: 'editor' },
        { parent: 'editor', child: 'viewer' },
      ]
      expect(validateRoleGraphAcyclic(edges).valid).toBe(true)
    })

    it('detects simple cycle', () => {
      const edges: RoleEdge[] = [
        { parent: 'a', child: 'b' },
        { parent: 'b', child: 'a' },
      ]
      const result = validateRoleGraphAcyclic(edges)
      expect(result.valid).toBe(false)
      expect(result.cycle).toBeDefined()
      expect(result.cycle!.length).toBeGreaterThan(1)
    })

    it('detects longer cycle', () => {
      const edges: RoleEdge[] = [
        { parent: 'a', child: 'b' },
        { parent: 'b', child: 'c' },
        { parent: 'c', child: 'a' },
      ]
      expect(validateRoleGraphAcyclic(edges).valid).toBe(false)
    })

    it('valid for disconnected DAG', () => {
      const edges: RoleEdge[] = [
        { parent: 'a', child: 'b' },
        { parent: 'c', child: 'd' },
      ]
      expect(validateRoleGraphAcyclic(edges).valid).toBe(true)
    })

    it('valid for empty graph', () => {
      expect(validateRoleGraphAcyclic([]).valid).toBe(true)
    })

    it('valid for single edge', () => {
      expect(validateRoleGraphAcyclic([{ parent: 'a', child: 'b' }]).valid).toBe(true)
    })

    it('detects self-loop', () => {
      const edges: RoleEdge[] = [{ parent: 'a', child: 'a' }]
      expect(validateRoleGraphAcyclic(edges).valid).toBe(false)
    })
  })
})
