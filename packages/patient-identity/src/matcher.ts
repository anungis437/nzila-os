import type { MatchCandidate, MatchResult, DuplicateGroup } from './types.js'

export function scoreMatch(a: MatchCandidate, b: MatchCandidate): MatchResult {
  let score = 0
  const matchedFields: string[] = []

  if (a.mrn && b.mrn && a.mrn === b.mrn) {
    score += 0.4
    matchedFields.push('mrn')
  }

  if (
    a.firstName.toLowerCase() === b.firstName.toLowerCase() &&
    a.lastName.toLowerCase() === b.lastName.toLowerCase()
  ) {
    score += 0.3
    matchedFields.push('firstName', 'lastName')
  }

  if (a.dateOfBirth === b.dateOfBirth) {
    score += 0.3
    matchedFields.push('dateOfBirth')
  }

  const confidence =
    score >= 0.9 ? 'high' :
    score >= 0.6 ? 'medium' :
    score >= 0.3 ? 'low' : 'no-match'

  return {
    patientId: a.patientId,
    score,
    confidence,
    matchedFields,
  }
}

/**
 * Detects duplicate patients using a union-find structure so transitive matches
 * (A≈B and B≈C) collapse into a single group (primary A, duplicates [B, C]).
 *
 * NOTE: The comparison step is O(n²) by design for demo/low-volume use.
 * For production at scale, bucket candidates on normalised name+DOB first.
 */
export function detectDuplicates(candidates: MatchCandidate[]): DuplicateGroup[] {
  const n = candidates.length
  if (n === 0) return []

  // Union-find helpers
  const parent = Array.from({ length: n }, (_, i) => i)

  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]] // path compression
      x = parent[x]
    }
    return x
  }

  function union(x: number, y: number): void {
    const rx = find(x)
    const ry = find(y)
    if (rx !== ry) parent[ry] = rx
  }

  // O(n²) pairwise comparison – acceptable for demo/low-volume datasets
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (scoreMatch(candidates[i], candidates[j]).score >= 0.6) {
        union(i, j)
      }
    }
  }

  // Group indices by root; only emit groups with at least one duplicate
  const rootToIndices = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const root = find(i)
    const bucket = rootToIndices.get(root) ?? []
    bucket.push(i)
    rootToIndices.set(root, bucket)
  }

  const detectedAt = new Date().toISOString()
  const groups: DuplicateGroup[] = []

  for (const indices of rootToIndices.values()) {
    if (indices.length < 2) continue
    groups.push({
      primaryPatientId: candidates[indices[0]].patientId,
      duplicatePatientIds: indices.slice(1).map((i) => candidates[i].patientId),
      detectedAt,
      reviewStatus: 'pending',
    })
  }

  return groups
}
