/**
 * Gate 0B.5 facts for the four carbon accounting operations carried forward from Gate 0B.4. The source evidence is the
 * Gate 0B.4 evidence, regenerated from the exact handler. Gate 0B.5 found no new source that names an owner, so the
 * four operations stay UNRESOLVED under UNDECIDED_OWNER. What this tranche adds is the scope disposition: the options
 * the institution must choose between, the fact that none is adopted, and the engineering obligation that holds
 * regardless of the choice.
 */
import { CARBON_DECISIONS, carbonUnresolved } from './ue-gate0b4-misc-facts.mjs'
import { CARRIED_OPERATIONS, DECISION_IDS_0B5, REUSED_CAPABILITY_IDS_0B5 } from './ue-gate0b5-ids.mjs'

export const CARBON_ROUTES = new Set(CARRIED_OPERATIONS.map((id) => id.split('|')[0]))
export const CARBON_DECISIONS_0B5 = CARBON_DECISIONS

export const CARBON_SCOPE_DISPOSITION = {
  disposition: 'RETAIN_AS_UNAPPROVED_CAPABILITY_CANDIDATE',
  adopted: false,
  decisionId: DECISION_IDS_0B5.CARBON,
  summary: 'The four carbon operations are retained as an unapproved capability candidate. Gate 0B.5 re-read the routes, the schema, the services, the capability registry and the product callers and found no source that names a data owner, a measured data source or an office for carbon accounting. No option below is chosen, no capability is created for carbon accounting, and no ownership entry is changed.',
  options: [
    {
      id: 'PLATFORM_OPERATOR_OWNS',
      description: 'The platform operator owns carbon accounting for the hosting footprint of the platform and publishes it to organizations.',
      consequence: 'A platform operator capability would hold the routes behind the platform staff mandate (UE-INST-PLATFORM-STAFF-MANDATE), with a measured data source from the hosting provider. The organization role floor on the current routes would no longer be the right guard.',
    },
    {
      id: 'ORGANIZATION_OWNS',
      description: 'Each organization owns carbon accounting for its own activities and supplies the data.',
      consequence: 'A new organization-scoped capability would need a table for the figures, an organization predicate and a named office that may attest a claim. The current routes read no table and take the organization from the query string.',
    },
    {
      id: 'RETIRE_THE_ROUTES',
      description: 'Carbon accounting is not an obligation of Union Eyes and the routes are retired.',
      consequence: 'The four operations leave the route universe. Nothing in the product calls them, so no caller changes, and the three defects recorded against them close by deletion.',
    },
  ],
  neitherOptionJustifiesAccess: 'Choosing an option would create an obligation. It would not authorize the current routes, which return literals to any authenticated caller.',
}

export const CARBON_IMPLEMENTATION_OBLIGATION = {
  gate: 8,
  capabilityId: REUSED_CAPABILITY_IDS_0B5.SCAFFOLD,
  obligation: 'Whichever option the institution chooses, the routes must not return emissions totals, renewable percentages, optimization advice or a certification-shaped result as success while no measured data source exists. Until then they return 501 not implemented. This obligation is held by the retired scaffold capability and is independent of who owns carbon accounting.',
  closesInstitutionalDecision: false,
}

export function carbonFacts(a) {
  return {
    ...carbonUnresolved(a),
    scopeDisposition: CARBON_SCOPE_DISPOSITION,
    implementationObligation: CARBON_IMPLEMENTATION_OBLIGATION,
  }
}
