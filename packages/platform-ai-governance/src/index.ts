/**
 * @nzila/platform-ai-governance — barrel exports
 */

export type {
  ModelRegistryEntry,
  PromptVersion,
  AIDecisionLogEntry,
  HumanReviewFlag,
} from './types'

export {
  modelRegistryEntrySchema,
  promptVersionSchema,
  aiDecisionLogEntrySchema,
  humanReviewFlagSchema,
} from './types'

export {
  registerModel,
  approveModel,
  getModel,
  listModels,
  clearRegistry,
} from './modelRegistry'

export {
  createPromptVersion,
  getActivePrompt,
  getPromptHistory,
  clearPromptVersions,
} from './promptVersioning'

export {
  logAIDecision,
  getDecisionsPendingReview,
  reviewDecision,
  getDecisionLog,
  clearDecisionLog,
} from './decisionLog'

export {
  flagForReview,
  resolveReviewFlag,
  getPendingReviewFlags,
  clearReviewFlags,
} from './humanReview'

export type { GovernanceStore, GovernanceCollection } from './store'
export {
  getGovernanceStore,
  setGovernanceStore,
  resetGovernanceStore,
  persistGovernanceCollection,
} from './store'

