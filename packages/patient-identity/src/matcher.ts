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

export function detectDuplicates(candidates: MatchCandidate[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = []
  const grouped = new Set<string>()

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i]
      const b = candidates[j]
      const result = scoreMatch(a, b)

      if (result.score >= 0.6) {
        const key = `${a.patientId}:${b.patientId}`
        if (!grouped.has(key)) {
          grouped.add(key)
          groups.push({
            primaryPatientId: a.patientId,
            duplicatePatientIds: [b.patientId],
            detectedAt: new Date().toISOString(),
            reviewStatus: 'pending',
          })
        }
      }
    }
  }

  return groups
}
