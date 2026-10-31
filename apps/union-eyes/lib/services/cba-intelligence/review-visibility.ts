/**
 * Which extraction rows a reader may see. Extracted agreements, wage adjustments and clauses are machine output until a reviewer
 * approves them, so a member reads only approved rows; a reviewer (steward or above) may read the review queue by naming a status.
 */
export const APPROVED = 'approved' as const

export function reviewStatusFilter(isReviewer: boolean, requested: string | undefined): string | undefined {
  return isReviewer ? requested : APPROVED
}
