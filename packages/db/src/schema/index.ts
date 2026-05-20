/**
 * Nzila OS — DB Schema barrel export
 */
export * from './orgs'
export * from './governance'
export * from './equity'
export * from './finance'
export * from './operations'
export * from './payments'
export * from './commerce'
export * from './ai'
export * from './ai-governance'
export * from './ml'
export * from './ue'
export * from './partners'
export * from './automation'
export * from './tax'
export * from './nacp'
export * from './zonga'
export * from './platform'
export * from './integrations'
export * from './trade'
export * from './agri'
export * from './auth'
export * from './mobility'
export * from './flow'
export * from './pilot-metrics'
export * from './executive'
export * from './itsm'
export * from './exec-data'
export * from './grants'
export * from './audit'
export * from './decision-aggregates'
export * from './decision-pipeline-checkpoints'
export * from './decision-pipeline-runs'
export * from './decision-events'
export * from './org-entitlements'
export * from './pipeline-alerts'
export * from './healthcare-surveys'

// Platform OS schemas (re-exported from dedicated packages)
export {
  ontologyEntities,
  ontologyRelationships,
} from '@nzila/platform-ontology/schema'
export {
  platformEvents,
  eventSubscriptions,
} from '@nzila/platform-event-fabric/schema'
export {
  knowledgeAssets,
  knowledgeVersions,
} from '@nzila/platform-knowledge-registry/schema'
export {
  canonicalRecords,
  recordLineage,
  syncJobs,
  syncConflicts,
} from '@nzila/platform-data-fabric/schema'
export {
  decisionNodes,
  decisionEdges,
} from '@nzila/platform-decision-graph/schema'
export {
  searchDocuments,
} from '@nzila/platform-semantic-search/schema'
export {
  aiRunRecords,
} from '@nzila/platform-governed-ai/schema'
export {
  reasoningChains,
} from '@nzila/platform-reasoning-engine/schema'
export * from './trustcore'
