/**
 * Gate 0C.1 ownership group. The group names the one route file whose two operations the canonical universe gained, the
 * capability whose obligation covers them and the business evidence. A route prefix or an HTTP method alone never
 * decides ownership: the rule is bound to the exact file and the two exported methods.
 */
import { GROUPS } from './ue-gate0c1-facts.mjs'

export { ADDED_OPERATIONS, ANCHOR_COMMIT, PRIOR_TRANCHES, TRANCHE_ID } from './ue-gate0c1-ids.mjs'

export const OWNERSHIP_GROUPS = Object.entries(GROUPS).map(([key, group]) => ({
  id: `RULE-0C1-${key.replaceAll('_', '-')}`,
  domainKey: key,
  ...group,
}))

export const groupOfRoute = (route, method) => OWNERSHIP_GROUPS.find((group) => group.routes.includes(route) && (!group.methods || !method || group.methods.includes(method)))

export function ownershipRulesForTranche0c1() {
  return OWNERSHIP_GROUPS.map((group) => ({
    id: group.id,
    precedence: 40,
    prefixes: group.routes,
    methods: group.methods,
    capabilityId: group.capabilityId,
    disposition: 'OWNED',
    actor: group.actor,
    privacy: 'CAPABILITY',
    evidence: group.evidence,
  }))
}

export const CAPABILITY_DOMAINS = Object.fromEntries(OWNERSHIP_GROUPS.map((group) => [group.capabilityId, [group.domain]]))
