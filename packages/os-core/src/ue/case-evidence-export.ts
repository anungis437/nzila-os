/**
 * Nzila OS — Union Eyes Case Evidence Export
 *
 * Implements:
 *   1. Case-level evidence pack export
 *   2. Litigation hold enforcement
 *   3. Document version hashing
 *   4. Role graph acyclic validation (DAG enforcement)
 */
import { createHash } from 'node:crypto'

// ── Document Version Hashing ────────────────────────────────────────────────

export interface DocumentVersion {
  documentId: string
  version: number
  contentHash: string
  previousVersionHash: string | null
  authorId: string
  createdAt: string
}

/**
 * Compute a content hash for a document version, chained to the previous version.
 */
export function computeDocumentVersionHash(
  content: Buffer | string,
  previousVersionHash: string | null,
): string {
  const contentDigest = createHash('sha256')
    .update(typeof content === 'string' ? content : content)
    .digest('hex')

  return createHash('sha256')
    .update(JSON.stringify({ contentDigest, previousVersionHash }))
    .digest('hex')
}

/**
 * Verify the integrity of a document version chain.
 */
export function verifyDocumentVersionChain(
  versions: DocumentVersion[],
): { valid: boolean; brokenAtVersion?: number } {
  for (let i = 0; i < versions.length; i++) {
    const version = versions[i]
    const expectedPrev = i === 0 ? null : versions[i - 1].contentHash
    if (version.previousVersionHash !== expectedPrev) {
      return { valid: false, brokenAtVersion: version.version }
    }
  }
  return { valid: true }
}

// ── Litigation Hold ─────────────────────────────────────────────────────────

export interface LitigationHold {
  holdId: string
  caseId: string
  entityId: string
  scope: LitigationHoldScope
  issuedBy: string
  issuedAt: string
  releasedAt?: string
  reason: string
}

export interface LitigationHoldScope {
  /** Document categories under hold */
  documentCategories: string[]
  /** Date range for documents under hold */
  dateFrom: string
  dateTo: string
  /** Specific document IDs if targeted */
  specificDocumentIds?: string[]
}

export type LitigationHoldAction = 'delete' | 'modify' | 'export' | 'archive'

/**
 * Check if a document action is blocked by a litigation hold.
 */
export function isBlockedByLitigationHold(
  documentId: string,
  documentCategory: string,
  documentDate: string,
  action: LitigationHoldAction,
  activeHolds: LitigationHold[],
): { blocked: boolean; holdId?: string; reason?: string } {
  for (const hold of activeHolds) {
    // Skip released holds
    if (hold.releasedAt) continue

    const scope = hold.scope

    // Check specific document IDs
    if (scope.specificDocumentIds?.includes(documentId)) {
      if (action === 'delete' || action === 'modify') {
        return {
          blocked: true,
          holdId: hold.holdId,
          reason: `Document ${documentId} is under litigation hold ${hold.holdId}: ${hold.reason}`,
        }
      }
    }

    // Check category and date range
    if (
      scope.documentCategories.includes(documentCategory) &&
      documentDate >= scope.dateFrom &&
      documentDate <= scope.dateTo
    ) {
      if (action === 'delete' || action === 'modify') {
        return {
          blocked: true,
          holdId: hold.holdId,
          reason: `Document category "${documentCategory}" is under litigation hold ${hold.holdId}: ${hold.reason}`,
        }
      }
    }
  }

  return { blocked: false }
}

// ── Role Graph DAG Validation ───────────────────────────────────────────────

export interface RoleEdge {
  parent: string
  child: string
}

/**
 * Validate that a role graph is a valid DAG (no cycles).
 * Uses DFS-based cycle detection.
 */
export function validateRoleGraphAcyclic(
  edges: RoleEdge[],
): { valid: boolean; cycle?: string[] } {
  // Build adjacency list
  const adj = new Map<string, string[]>()
  const allNodes = new Set<string>()

  for (const edge of edges) {
    allNodes.add(edge.parent)
    allNodes.add(edge.child)
    if (!adj.has(edge.parent)) adj.set(edge.parent, [])
    adj.get(edge.parent)!.push(edge.child)
  }

  // DFS cycle detection
  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Map<string, number>()
  const parent = new Map<string, string | null>()

  for (const node of allNodes) {
    color.set(node, WHITE)
    parent.set(node, null)
  }

  function dfs(u: string): string[] | null {
    color.set(u, GRAY)

    for (const v of adj.get(u) ?? []) {
      if (color.get(v) === GRAY) {
        // Back edge found → cycle
        const cycle: string[] = [v, u]
        let cur = u
        while (parent.get(cur) && parent.get(cur) !== v) {
          cur = parent.get(cur)!
          cycle.push(cur)
        }
        cycle.push(v)
        return cycle.reverse()
      }

      if (color.get(v) === WHITE) {
        parent.set(v, u)
        const cycleResult = dfs(v)
        if (cycleResult) return cycleResult
      }
    }

    color.set(u, BLACK)
    return null
  }

  for (const node of allNodes) {
    if (color.get(node) === WHITE) {
      const cycle = dfs(node)
      if (cycle) {
        return { valid: false, cycle }
      }
    }
  }

  return { valid: true }
}

// ── Case Evidence Pack Export ────────────────────────────────────────────────

export interface CaseEvidenceExportRequest {
  caseId: string
  entityId: string
  requestedBy: string
  includeDocuments: boolean
  includeAuditTrail: boolean
  includeRoleGraph: boolean
  includeVersionHistory: boolean
  format: 'json' | 'pdf-bundle'
}

export interface CaseEvidenceExportResult {
  exportId: string
  caseId: string
  entityId: string
  artifactCount: number
  totalSizeBytes: number
  sealed: boolean
  sealDigest?: string
  exportedAt: string
  litigationHoldsActive: number
}
