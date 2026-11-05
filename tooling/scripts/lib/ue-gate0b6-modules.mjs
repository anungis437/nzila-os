/**
 * The Gate 0B.6 domain modules. Each module exports GROUPS (ownership groups: exact route files, the owning capability,
 * the domain and the business evidence), ROUTES (the route files the module classifies), DEFECTS, CAPABILITIES (only
 * capabilities the module creates), optional DECISIONS (outstanding institutional decisions) and facts(a, readText).
 */
import * as education from './ue-gate0b6-education-facts.mjs'
import * as employers from './ue-gate0b6-employer-facts.mjs'
import * as compliance from './ue-gate0b6-compliance-facts.mjs'
import * as system from './ue-gate0b6-system-facts.mjs'
import { opAuthoring } from './ue-gate0b4-fact-helpers.mjs'

export const MODULES = [education, employers, compliance, system].filter((module) => module?.GROUPS)

export const GROUP_DEFS = MODULES.flatMap((module) => Object.entries(module.GROUPS))
export const DEFECTS_0B6 = MODULES.flatMap((module) => module.DEFECTS ?? [])
export const CAPABILITY_RECORDS = MODULES.flatMap((module) => module.CAPABILITIES ?? [])
export const DECISIONS_0B6 = MODULES.flatMap((module) => module.DECISIONS ?? [])
export const UNRESOLVED_0B6 = new Set(MODULES.flatMap((module) => [...(module.UNRESOLVED ?? [])]))

export function factsFor(id, readText, exists) {
  const authoring = opAuthoring(id, readText, exists)
  const found = MODULES.find((module) => module.ROUTES.has(authoring.route))
  if (!found) throw new Error(`no Gate 0B.6 facts for ${id}`)
  return found.facts(authoring, readText)
}
