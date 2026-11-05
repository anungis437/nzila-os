import type { CaseActor } from './case-authorization'
import { caseActionAllowed } from './case-permissions'

export type WorkbenchAccess = 'case' | 'triage'

type Row = Record<string, unknown>

/** Minimum metadata a representative may see for a matter they are not assigned to. */
const TRIAGE_FIELDS = [
  'claimId', 'claimNumber', 'organizationId', 'claimType', 'status', 'priority',
  'assignedTo', 'assignedAt', 'createdAt', 'updatedAt', 'closedAt', 'isAnonymous',
] as const

/**
 * Case-resource authority exists only for the assigned representative or the member
 * who filed the matter. A role that may read the organization queue
 * receives triage metadata for everything else: no member identity, contact data,
 * narrative, witnesses, attachments, transcriptions or free-form metadata.
 */
export function workbenchAccess(actor: CaseActor, row: Row): WorkbenchAccess {
  if (row.assignedTo === actor.userId || row.memberId === actor.userId) return 'case'
  return 'triage'
}

export function projectWorkbenchRow(actor: CaseActor, row: Row): Row {
  const access = workbenchAccess(actor, row)
  if (access === 'case') return { ...row, access }
  const projected: Row = { access }
  for (const field of TRIAGE_FIELDS) projected[field] = row[field] ?? null
  return projected
}

export function workbenchCapabilities(actor: CaseActor) {
  return {
    // Mirrors the server-side case_assign policy; self-assignment is not a separate grant.
    canAssign: caseActionAllowed('case_assign', actor.role),
  }
}
