/**
 * The Gate 0B.12 domain modules. Each module exports GROUPS (ownership groups: exact route files, the owning capability,
 * the domain and the business evidence), ROUTES (the route files the module classifies), DEFECTS, CAPABILITIES (only
 * capabilities the module creates), optional DECISIONS (outstanding institutional decisions), optional RISK_SCREENS
 * (verified screens of risk categories no defect carries) and facts(a, readText).
 */
import * as crud from './ue-gate0b12-crud-facts.mjs'
import * as platform from './ue-gate0b12-platform-facts.mjs'
import * as workbook from './ue-gate0b12-workbook-facts.mjs'
import { opAuthoring } from './ue-gate0b4-fact-helpers.mjs'

export const MODULES = [crud, platform, workbook].filter((module) => module?.GROUPS)

export const GROUP_DEFS = MODULES.flatMap((module) => Object.entries(module.GROUPS))
export const DEFECTS_0B12 = MODULES.flatMap((module) => module.DEFECTS ?? [])
export const CAPABILITY_RECORDS = MODULES.flatMap((module) => module.CAPABILITIES ?? [])
export const DECISIONS_0B12 = MODULES.flatMap((module) => module.DECISIONS ?? [])
export const UNRESOLVED_0B12 = new Set(MODULES.flatMap((module) => [...(module.UNRESOLVED ?? [])]))

export const riskDefectIdsOf = () => Object.fromEntries(DEFECTS_0B12.filter((defect) => defect.riskCategories).map((defect) => [defect.id, defect.riskCategories]))
export const riskScreensOf = () => Object.assign({}, ...MODULES.map((module) => module.RISK_SCREENS ?? {}))

export function factsFor(id, readText, exists) {
  const authoring = opAuthoring(id, readText, exists)
  const found = MODULES.find((module) => module.ROUTES.has(authoring.route))
  if (!found) throw new Error(`no Gate 0B.12 facts for ${id}`)
  return found.facts(authoring, readText)
}
