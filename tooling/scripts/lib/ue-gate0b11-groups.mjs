/**
 * Gate 0B.11 ownership groups, assembled from the domain modules. A group names the exact route files whose operations
 * the tranche classified with source evidence, the one capability whose obligation covers them, and the business
 * domain. A route prefix or an HTTP method never decides ownership. The four decision-bound operations belong to no
 * group and are not part of this tranche.
 */
import { GROUP_DEFS } from './ue-gate0b11-modules.mjs'

export { ANCHOR_COMMIT, DECISION_BOUND_OPERATIONS, PRIOR_TRANCHES, TRANCHE_ID, TRANCHE_SIZE } from './ue-gate0b11-ids.mjs'

export const OWNERSHIP_GROUPS = GROUP_DEFS.map(([key, group]) => ({
  id: `RULE-0B11-${key.replaceAll('_', '-')}`,
  domainKey: key,
  ...group,
}))

export function groupOfRoute(route, method) {
  return OWNERSHIP_GROUPS.find((group) => group.routes.includes(route) && (!group.methods || !method || group.methods.includes(method)))
}

export function ownershipRulesForTranche11() {
  return OWNERSHIP_GROUPS.map((group) => {
    const rule = {
      id: group.id,
      precedence: 40,
      prefixes: group.routes,
      capabilityId: group.capabilityId,
      disposition: 'OWNED',
      actor: group.actor,
      privacy: 'CAPABILITY',
      evidence: group.evidence,
    }
    if (group.methods) rule.methods = group.methods
    return rule
  })
}

const domainsOf = (capabilityId) => [...new Set(OWNERSHIP_GROUPS.filter((group) => group.capabilityId === capabilityId).map((group) => group.domain))]

export const CAPABILITY_DOMAINS = Object.fromEntries([...new Set(OWNERSHIP_GROUPS.map((group) => group.capabilityId))].map((id) => [id, domainsOf(id)]))

export const domainsForGroups = (groups) => Object.fromEntries([...new Set(groups.map((group) => group.capabilityId))].map((id) => [id, [...new Set(groups.filter((group) => group.capabilityId === id).map((group) => group.domain))]]))
