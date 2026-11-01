/** Closed intake types a member may open. Shared by the store and the screen. */
export const REVIEW_INTAKE_TYPES = ['complaint', 'appeal', 'reconsideration'] as const
export type ReviewIntakeType = (typeof REVIEW_INTAKE_TYPES)[number]
