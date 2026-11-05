/** Stable identifiers and counts for Gate 0C.1 (canonical route-universe reconciliation). */
export { DECISION_BOUND_OPERATIONS } from './ue-gate0b6-ids.mjs'

export const TRANCHE_ID = 'GATE-0C.1'
export const TRANCHE_DEFECT = '0C.1'
export const ANCHOR_COMMIT = '447c98c44b04fdca23d9b959bddfa62ccec351b2'
export const PRIOR_TRANCHES = ['GATE-0B.1', 'GATE-0B.2', 'GATE-0B.3', 'GATE-0B.4', 'GATE-0B.5', 'GATE-0B.6', 'GATE-0B.7', 'GATE-0B.8', 'GATE-0B.9', 'GATE-0B.10', 'GATE-0B.11', 'GATE-0B.12']

/** The operations the canonical universe gained. Nothing is removed. */
export const ADDED_OPERATIONS = ['reviews/route.ts|GET', 'reviews/route.ts|POST']
export const REMOVED_OPERATIONS = []
export const ADDED_ROUTE_FILES = ['reviews/route.ts']

export const OLD_UNIVERSE_VERSION = 1
export const NEW_UNIVERSE_VERSION = 2
export const OLD_UNIVERSE_OPERATIONS = 1644
export const NEW_UNIVERSE_OPERATIONS = 1646
export const OLD_UNIVERSE_ROUTES = 993
export const NEW_UNIVERSE_ROUTES = 994
