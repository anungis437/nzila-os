import type { CUPERole } from '@/lib/action-enforcer'
import { caseActionAllowed } from './case-permissions'

/**
 * Member-visibility of a note is an affirmative disclosure decision. A representative who does not
 * state one gets an internal (staff-only) note; only a member-authored note defaults to member-visible.
 */
export function resolveNoteInternal(requested: boolean | undefined, role: CUPERole): boolean {
  if (requested !== undefined) return requested
  return caseActionAllowed('note_add_internal', role)
}
