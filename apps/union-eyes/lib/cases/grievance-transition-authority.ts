/** Advisory UI projection only. The mutation boundary re-evaluates the kernel in its transaction. */
export interface GrievanceTransitionAuthorityInput {
  canTransition?: boolean
}

/** Never derive an action from a title, relationship label, or an unassigned legacy primary column. */
export function canTransitionGrievance(input: GrievanceTransitionAuthorityInput): boolean {
  return input.canTransition === true
}
