export interface MatchingProfile {
  id: string; userId: string; specialization: string | null; maxCaseload: number; openCases: number
}

/** Recorded expertise first, then actual utilization; stable ids resolve exact ties without invented success rates. */
export function matchingExpertise(specialization: string | null, caseType: string): boolean {
  const recorded = specialization?.trim().toLowerCase()
  const type = caseType.trim().toLowerCase()
  const family = type.startsWith('discrimination_') ? 'discrimination' : type.startsWith('harassment_') ? 'harassment' : ({
    workplace_safety: 'safety', grievance_discipline: 'discipline', grievance_schedule: 'scheduling',
    grievance_pay: 'pay', wage_dispute: 'pay', grievance_benefits: 'benefits', grievance_leave: 'leave',
    contract_dispute: 'contract', wrongful_termination: 'termination',
  } as Record<string, string>)[type]
  return recorded === type || (family !== undefined && recorded === family)
}

export function rankMatchingProfiles(profiles: MatchingProfile[], caseType: string | null): MatchingProfile[] {
  if (!caseType?.trim()) return []
  const occurrences = new Map<string, number>()
  for (const profile of profiles) occurrences.set(profile.userId, (occurrences.get(profile.userId) ?? 0) + 1)
  const exact = (profile: MatchingProfile) => matchingExpertise(profile.specialization, caseType)
  return profiles.filter(profile => occurrences.get(profile.userId) === 1 &&
    Number.isSafeInteger(profile.maxCaseload) && profile.maxCaseload > 0 &&
    Number.isSafeInteger(profile.openCases) && profile.openCases >= 0 && profile.openCases < profile.maxCaseload &&
    (exact(profile) || profile.specialization?.trim().toLowerCase() === 'general'))
    .sort((a, b) => Number(exact(b)) - Number(exact(a)) ||
      a.openCases / a.maxCaseload - b.openCases / b.maxCaseload ||
      a.openCases - b.openCases || a.userId.localeCompare(b.userId) || a.id.localeCompare(b.id))
}
