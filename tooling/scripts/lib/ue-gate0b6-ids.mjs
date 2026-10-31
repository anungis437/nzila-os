/** Stable identifiers and counts for Gate 0B.6. */
export const TRANCHE_ID = 'GATE-0B.6'
export const TRANCHE_SIZE = 100
export const ANCHOR_COMMIT = '00de050b86e1014854e38fc34f51b4c7c85ed747'
export const PRIOR_TRANCHES = ['GATE-0B.1', 'GATE-0B.2', 'GATE-0B.3', 'GATE-0B.4', 'GATE-0B.5']

/**
 * Operations Gate 0B.4 and Gate 0B.5 examined twice and could not place. They are decision-bound scope exceptions:
 * they are excluded from selection, never carried into this tranche, and their frozen Gate 0B.4 and Gate 0B.5 records
 * are not touched.
 */
export const DECISION_BOUND_OPERATIONS = [
  'carbon/dashboard/route.ts|GET',
  'carbon/infrastructure/route.ts|GET',
  'carbon/validate/route.ts|GET',
  'carbon/validate/route.ts|POST',
]

export const DECISION_IDS_0B6 = {
  CARBON: 'UE-INST-CARBON-ACCOUNTING-SCOPE',
}
