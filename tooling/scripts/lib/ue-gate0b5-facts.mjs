/**
 * Gate 0B.5 source facts: the engineering gates of every capability the tranche cites, the institutional decisions
 * (every earlier decision, unaltered in meaning, plus the software owners this tranche names), the defect register
 * entries this tranche found, and the per-operation fact lookup. Each defect names one responsible capability whose
 * primary gate is the gate that repairs it. No institutional decision recorded here is adopted, and none justifies
 * access.
 */
import { CAPABILITY_IDS_0B5 as NEW, REUSED_CAPABILITY_IDS_0B5 as REUSED } from './ue-gate0b5-ids.mjs'
import { opAuthoring } from './ue-gate0b4-fact-helpers.mjs'
import { CARBON_ROUTES, carbonFacts } from './ue-gate0b5-carbon-facts.mjs'
import { COGNITION_DEFECTS, COGNITION_ROUTES, cognitionFacts } from './ue-gate0b5-cognition-facts.mjs'
import { COMMITTEE_DEFECTS, COMMITTEE_ROUTES, committeeFacts } from './ue-gate0b5-committee-facts.mjs'
import { COMMS_DEFECTS, COMMS_ROUTES, commsFacts } from './ue-gate0b5-comms-facts.mjs'
import { CNESST_ROUTES, OHS_DEFECTS_0B5, PAY_EQUITY_DEFECTS, cnesstFacts } from './ue-gate0b5-ohs-facts.mjs'

export const CAPABILITY_GATES_0B5 = {
  'UE-CAP-H-001': 8,
  [REUSED.OHS]: 6,
  [REUSED.ANALYTICS]: 14,
  [REUSED.OPERATOR]: 9,
  [NEW.PAY_EQUITY]: 6,
  [NEW.COMMITTEES]: 14,
  [NEW.CAMPAIGN_AUTHORING]: 11,
  [NEW.SMS]: 11,
  [NEW.CONSENT]: 11,
  [NEW.POLLS_SURVEYS]: 14,
}

/** Software owners added to earlier decisions. The question and the status of an earlier decision are never changed. */
const SOFTWARE_OWNERS_ADDED = {
  'UE-INST-COMMUNICATIONS-CAMPAIGN-OWNER': [NEW.CAMPAIGN_AUTHORING, NEW.CONSENT],
}

export function institutionalDecisions0b5(priorDecisions) {
  return priorDecisions.map((decision) => {
    const added = SOFTWARE_OWNERS_ADDED[decision.id]
    return added ? { ...decision, softwareOwners: [...new Set([...(decision.softwareOwners ?? []), ...added])] } : decision
  })
}

const owned = (defects, ownerCapabilityId) => defects.map((defect) => ({ ...defect, ownerCapabilityId: defect.ownerCapabilityId ?? ownerCapabilityId }))

export const DEFECTS_0B5 = [
  ...owned(OHS_DEFECTS_0B5, REUSED.OHS),
  ...owned(PAY_EQUITY_DEFECTS, NEW.PAY_EQUITY),
  ...COGNITION_DEFECTS.map((defect) => ({ ...defect, ownerCapabilityId: defect.ownerCapabilityId ?? (defect.gate === 9 ? REUSED.OPERATOR : REUSED.ANALYTICS) })),
  ...owned(COMMITTEE_DEFECTS, NEW.COMMITTEES),
  ...COMMS_DEFECTS,
]

export const UNRESOLVED_0B5 = CARBON_ROUTES

const FACT_MODULES = [
  [CARBON_ROUTES, carbonFacts],
  [CNESST_ROUTES, cnesstFacts],
  [COGNITION_ROUTES, cognitionFacts],
  [COMMITTEE_ROUTES, committeeFacts],
  [COMMS_ROUTES, commsFacts],
]

export function isUnresolved(id) {
  return UNRESOLVED_0B5.has(id.split('|')[0])
}

export function factsFor(id, readText, exists) {
  const authoring = opAuthoring(id, readText, exists)
  const found = FACT_MODULES.find(([routes]) => routes.has(authoring.route))
  if (!found) throw new Error(`no Gate 0B.5 facts for ${id}`)
  return found[1](authoring, readText)
}
