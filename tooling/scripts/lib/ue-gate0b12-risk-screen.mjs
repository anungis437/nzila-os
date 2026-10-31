/**
 * Gate 0B.12 risk-category screen. The eight categories, the source-computed triggers and the satisfaction rules are the
 * Gate 0B.9 engine, unchanged: a triggered category is satisfied only by a defect that carries it or, where source can
 * legitimately show the harm is absent, by a recorded screen backed by a verbatim quote. A structural trigger (a GET that
 * writes, an audit outside the data transaction) can be satisfied only by a defect. This module holds only the Gate 0B.12
 * defect-to-category map and the Gate 0B.12 screens.
 */
export { RISK_CATEGORIES, STRUCTURAL_CATEGORIES, riskTriggers, riskCategoryProblems, riskDefectProblems, riskCoverage } from './ue-gate0b9-risk-screen.mjs'
import { riskDefectIdsOf, riskScreensOf } from './ue-gate0b12-modules.mjs'

export const DEFECT_RISK_CATEGORIES = riskDefectIdsOf()
export const RISK_SCREENS = riskScreensOf()
