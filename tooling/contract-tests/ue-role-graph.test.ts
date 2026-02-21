/**
 * Contract test · INV-16 — Union Eyes Role Graph Acyclic Invariant
 *
 * The role inheritance graph MUST be a directed acyclic graph (DAG).
 * Cycles would allow circular privilege escalation.
 *
 * INV-17 — Document version chain integrity
 * INV-18 — Litigation hold blocks destructive actions
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  validateRoleGraphAcyclic,
  computeDocumentVersionHash,
  verifyDocumentVersionChain,
  isBlockedByLitigationHold,
} from '../../packages/os-core/src/ue/case-evidence-export'
import type { DocumentVersion, LitigationHold } from '../../packages/os-core/src/ue/case-evidence-export'

describe('INV-16 — Role graph MUST be acyclic (DAG)', () => {
  it('accepts a valid hierarchical role graph', () => {
    const result = validateRoleGraphAcyclic([
      { parent: 'org-admin', child: 'case-manager' },
      { parent: 'case-manager', child: 'investigator' },
      { parent: 'case-manager', child: 'reviewer' },
      { parent: 'investigator', child: 'read-only' },
      { parent: 'reviewer', child: 'read-only' },
    ])
    expect(result.valid).toBe(true)
    expect(result.cycle).toBeUndefined()
  })

  it('rejects a role graph with a direct cycle', () => {
    const result = validateRoleGraphAcyclic([
      { parent: 'admin', child: 'manager' },
      { parent: 'manager', child: 'admin' }, // Direct cycle
    ])
    expect(result.valid).toBe(false)
    expect(result.cycle).toBeDefined()
    expect(result.cycle!.length).toBeGreaterThanOrEqual(2)
  })

  it('rejects a role graph with a transitive cycle', () => {
    const result = validateRoleGraphAcyclic([
      { parent: 'a', child: 'b' },
      { parent: 'b', child: 'c' },
      { parent: 'c', child: 'd' },
      { parent: 'd', child: 'a' }, // Transitive cycle: a→b→c→d→a
    ])
    expect(result.valid).toBe(false)
    expect(result.cycle).toBeDefined()
  })

  it('rejects self-referencing roles', () => {
    const result = validateRoleGraphAcyclic([
      { parent: 'admin', child: 'admin' }, // Self-loop
    ])
    expect(result.valid).toBe(false)
  })
})

describe('INV-17 — Document version chain integrity', () => {
  it('valid chain passes verification', () => {
    const hash0 = computeDocumentVersionHash('version-0-content', null)
    const hash1 = computeDocumentVersionHash('version-1-content', hash0)
    const hash2 = computeDocumentVersionHash('version-2-content', hash1)

    const versions: DocumentVersion[] = [
      { documentId: 'doc-1', version: 1, contentHash: hash0, previousVersionHash: null, authorId: 'user-1', createdAt: '2025-01-01' },
      { documentId: 'doc-1', version: 2, contentHash: hash1, previousVersionHash: hash0, authorId: 'user-2', createdAt: '2025-01-02' },
      { documentId: 'doc-1', version: 3, contentHash: hash2, previousVersionHash: hash1, authorId: 'user-1', createdAt: '2025-01-03' },
    ]

    expect(verifyDocumentVersionChain(versions)).toEqual({ valid: true })
  })

  it('broken chain is detected', () => {
    const hash0 = computeDocumentVersionHash('version-0-content', null)
    const fakePrev = 'deadbeef0000000000000000000000000000000000000000000000000000dead'

    const versions: DocumentVersion[] = [
      { documentId: 'doc-1', version: 1, contentHash: hash0, previousVersionHash: null, authorId: 'user-1', createdAt: '2025-01-01' },
      { documentId: 'doc-1', version: 2, contentHash: 'whatever', previousVersionHash: fakePrev, authorId: 'user-2', createdAt: '2025-01-02' },
    ]

    const result = verifyDocumentVersionChain(versions)
    expect(result.valid).toBe(false)
    expect(result.brokenAtVersion).toBe(2)
  })
})

describe('INV-18 — Litigation hold blocks destructive actions', () => {
  const hold: LitigationHold = {
    holdId: 'LH-001',
    caseId: 'CASE-500',
    entityId: 'entity-abc',
    scope: {
      documentCategories: ['financial', 'correspondence'],
      dateFrom: '2024-01-01',
      dateTo: '2025-12-31',
      specificDocumentIds: ['DOC-999'],
    },
    issuedBy: 'legal-counsel',
    issuedAt: '2025-01-15',
    reason: 'Pending regulatory investigation',
  }

  it('blocks deletion of a document under hold by ID', () => {
    const result = isBlockedByLitigationHold('DOC-999', 'other', '2024-06-15', 'delete', [hold])
    expect(result.blocked).toBe(true)
    expect(result.holdId).toBe('LH-001')
  })

  it('blocks modification of a document under hold by category', () => {
    const result = isBlockedByLitigationHold('DOC-123', 'financial', '2024-06-15', 'modify', [hold])
    expect(result.blocked).toBe(true)
  })

  it('allows export of a document under hold', () => {
    const result = isBlockedByLitigationHold('DOC-999', 'financial', '2024-06-15', 'export', [hold])
    expect(result.blocked).toBe(false)
  })

  it('allows action when hold is released', () => {
    const releasedHold: LitigationHold = { ...hold, releasedAt: '2025-06-01' }
    const result = isBlockedByLitigationHold('DOC-999', 'financial', '2024-06-15', 'delete', [releasedHold])
    expect(result.blocked).toBe(false)
  })

  it('allows action on document outside hold scope', () => {
    const result = isBlockedByLitigationHold('DOC-OTHER', 'marketing', '2024-06-15', 'delete', [hold])
    expect(result.blocked).toBe(false)
  })
})
