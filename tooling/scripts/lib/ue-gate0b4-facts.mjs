/**
 * Gate 0B.4 source facts: the engineering gates of every capability the tranche cites, the institutional decisions
 * (every earlier decision, unaltered in meaning, plus the one this tranche adds), the defect register entries this
 * tranche found, and the per-operation fact lookup. Each defect names one responsible capability whose primary gate is
 * the gate that repairs it. No institutional decision recorded here is adopted, and none justifies access.
 */
import { CAPABILITY_IDS_0B2 } from './ue-gate0b2-groups.mjs'
import { CAPABILITY_IDS_0B4 as IDS } from './ue-gate0b4-ids.mjs'
import { opAuthoring } from './ue-gate0b4-fact-helpers.mjs'
import { CALENDAR_DEFECTS, CALENDAR_ROUTES, calendarFacts } from './ue-gate0b4-calendar-facts.mjs'
import { CBA_DEFECTS, CBA_ROUTES, cbaFacts } from './ue-gate0b4-cba-facts.mjs'
import { CHATBOT_DEFECTS, CHATBOT_ROUTES, chatbotFacts } from './ue-gate0b4-chatbot-facts.mjs'
import { CLAUSE_LIBRARY_DEFECTS, CLAUSE_LIBRARY_ROUTES, clauseLibraryFacts } from './ue-gate0b4-clause-library-facts.mjs'
import { CARBON_DECISIONS, MISC_DEFECTS, MISC_ROUTES, UNRESOLVED_ROUTES, miscFacts } from './ue-gate0b4-misc-facts.mjs'
import { CLC_DEFECTS, CLC_ROUTES, OHS_DEFECTS, OHS_ROUTES, ohsFacts } from './ue-gate0b4-ohs-facts.mjs'
import { REGISTER_DEFECTS, REGISTER_ROUTES, registerFacts } from './ue-gate0b4-register-facts.mjs'

export const CAPABILITY_GATES_0B4 = {
  'UE-CAP-K-007': 13,
  'UE-CAP-H-001': 8,
  [CAPABILITY_IDS_0B2.AI]: 14,
  [CAPABILITY_IDS_0B2.OPERATOR]: 9,
  [IDS.COMMS_DELIVERY]: 11,
  [IDS.CALENDAR]: 14,
  [IDS.CBA_DATASET]: 14,
  [IDS.CBA_REGISTER]: 14,
  [IDS.CLAUSE_LIBRARY]: 14,
  [IDS.OHS]: 6,
}

/** Software owners added to earlier decisions. The question and the status of an earlier decision are never changed. */
const SOFTWARE_OWNERS_ADDED = {
  'UE-INST-COMMUNICATIONS-CAMPAIGN-OWNER': [IDS.COMMS_DELIVERY],
  'UE-INST-PLATFORM-STAFF-MANDATE': [IDS.CBA_DATASET],
  'UE-INST-KNOWLEDGE-PUBLICATION': [IDS.CLAUSE_LIBRARY],
}

export function institutionalDecisions0b4(priorDecisions) {
  return [
    ...priorDecisions.map((decision) => {
      const added = SOFTWARE_OWNERS_ADDED[decision.id]
      return added ? { ...decision, softwareOwners: [...new Set([...(decision.softwareOwners ?? []), ...added])] } : decision
    }),
    ...CARBON_DECISIONS,
  ]
}

const owned = (defects, ownerCapabilityId) => defects.map((defect) => ({ ...defect, ownerCapabilityId: defect.ownerCapabilityId ?? ownerCapabilityId }))

export const DEFECTS_0B4 = [
  ...owned(CALENDAR_DEFECTS, IDS.CALENDAR),
  ...owned(CBA_DEFECTS, IDS.CBA_DATASET),
  ...owned(CHATBOT_DEFECTS, CAPABILITY_IDS_0B2.AI),
  ...owned(CLAUSE_LIBRARY_DEFECTS, IDS.CLAUSE_LIBRARY),
  ...owned(CLC_DEFECTS, 'UE-CAP-K-007'),
  ...owned(OHS_DEFECTS, IDS.OHS),
  ...owned(REGISTER_DEFECTS, IDS.CBA_REGISTER),
  ...MISC_DEFECTS(IDS),
]

export const UNRESOLVED_0B4 = UNRESOLVED_ROUTES

const FACT_MODULES = [
  [CALENDAR_ROUTES, calendarFacts],
  [CBA_ROUTES, cbaFacts],
  [CHATBOT_ROUTES, chatbotFacts],
  [CLAUSE_LIBRARY_ROUTES, clauseLibraryFacts],
  [CLC_ROUTES, ohsFacts],
  [OHS_ROUTES, ohsFacts],
  [REGISTER_ROUTES, registerFacts],
  [MISC_ROUTES, miscFacts],
]

export function isUnresolved(id) {
  return UNRESOLVED_ROUTES.has(id.split('|')[0])
}

export function factsFor(id, readText, exists) {
  const authoring = opAuthoring(id, readText, exists)
  const found = FACT_MODULES.find(([routes]) => routes.has(authoring.route))
  if (!found) throw new Error(`no Gate 0B.4 facts for ${id}`)
  return found[1](authoring, readText)
}
