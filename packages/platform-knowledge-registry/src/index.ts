/**
 * @nzila/platform-knowledge-registry — Barrel Export
 */

// Types
export type {
  KnowledgeType,
  KnowledgeStatus,
  KnowledgeAsset,
  KnowledgeVersion,
  CreateKnowledgeAssetInput,
  UpdateKnowledgeAssetInput,
  KnowledgeSearchQuery,
  KnowledgeStore,
} from './types'

export {
  KnowledgeTypes,
  KnowledgeStatuses,
  KnowledgeAssetSchema,
  CreateKnowledgeAssetSchema,
} from './types'

// Operations
export {
  registerKnowledgeAsset,
  searchKnowledgeAssets,
  getKnowledgeAssetVersion,
  resolveApplicableKnowledge,
} from './operations'

// Store
export { createInMemoryKnowledgeStore } from './store'

// Schema (Drizzle)
export { knowledgeAssets, knowledgeVersions } from './schema'

// Doctrine seeds — canonized research whitepapers
export type { DoctrineWhitepaperSeed } from './doctrine-whitepapers'
export {
  DOCTRINE_WHITEPAPERS,
  seedDoctrineWhitepapers,
  getDoctrineWhitepaper,
} from './doctrine-whitepapers'
