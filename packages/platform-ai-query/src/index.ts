/**
 * @nzila/platform-ai-query — barrel exports
 */

export type {
  NaturalLanguageQuery,
  QueryResult,
  EvidenceReference,
  QueryIntent,
  IntentPrototype,
  IntentClassificationResult,
  QueryPlanStep,
  QueryExecutionPlan,
} from './types'

export {
  naturalLanguageQuerySchema,
  queryResultSchema,
  evidenceReferenceSchema,
} from './types'

export {
  classifyIntent,
  classifyIntentDetailed,
  buildExecutionPlan,
  parseQuery,
  buildQueryResult,
  executeQuery,
  getQueryLog,
  clearQueryLog,
} from './queryEngine'
export { createEvidenceRef, validateEvidenceBacking } from './evidenceBacked'
