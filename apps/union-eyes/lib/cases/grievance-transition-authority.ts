export interface GrievanceTransitionAuthorityInput {
  isPrimaryOwner: boolean
  /** Active collaborator role on this case, if any. */
  accessRole: string | null
  grievanceStatus: string
  primaryRepresentativeId: string | null
}

/**
 * Who may move a grievance through its lifecycle. Role level (enforced by the FSM) is necessary
 * but never sufficient: the actor also needs authority over this matter. Seniority is not authority:
 * a chief steward or officer with no relationship to the case may not advance it.
 *  - the primary representative;
 *  - an active secondary LRO (reviewers and read-only collaborators may not advance a case);
 *  - any representative disposing of an unassigned intake awaiting triage.
 */
export function canTransitionGrievance(input: GrievanceTransitionAuthorityInput): boolean {
  if (input.isPrimaryOwner) return true
  if (input.accessRole === 'secondary_lro') return true
  return input.grievanceStatus === 'draft' && !input.primaryRepresentativeId
}
