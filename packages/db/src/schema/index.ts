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
export * from './ml'
export * from './ue'
export * from './partners'
export * from './automation'
export * from './tax'
export * from './nacp'
export * from './zonga'
export * from './platform'
export * from './trade'
export * from './agri'
export * from './mobility'
export * from './flow'

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
