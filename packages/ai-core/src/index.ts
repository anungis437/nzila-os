/**
 * @nzila/ai-core — barrel export
 */

// Types
export type {
  AiProvider,
  AiModality,
  AiFeature,
  DataClass,
  RedactionMode,
  ChatMessage,
  AiGenerateRequest,
  AiGenerateResponse,
  AiStreamChunk,
  AiEmbedRequest,
  AiEmbedResponse,
  AiExtractRequest,
  AiExtractResponse,
  AiRagQueryRequest,
  AiRagQueryResponse,
  AiRagChunk,
  AiActionProposeRequest,
  AiActionProposeResponse,
  AiModelParams,
  AiTrace,
  ResolvedCapabilityProfile,
  AiErrorCode,
  AiProviderClient,
  ProviderGenerateParams,
  ProviderGenerateResult,
  ProviderEmbedParams,
  ProviderEmbedResult,
} from './types'

export { AiControlPlaneError } from './types'

// Gateway (main entry point for requests)
export {
  generate,
  chat,
  chatStream,
  embed,
  resolveProfile,
  resolvePrompt,
  checkBudget,
  recordSpend,
  ensureBudgetRow,
  logAiRequest,
  appendAiAuditEvent,
  redactText,
} from './gateway'

// Prompts
export { listPromptVersions, activatePromptVersion } from './prompts'

// Schemas
export {
  AiGenerateRequestSchema,
  AiChatStreamRequestSchema,
  AiEmbedRequestSchema,
  AiRagQueryRequestSchema,
  AiExtractRequestSchema,
  AiActionProposeRequestSchema,
  AiActionApproveRequestSchema,
  validateActionProposal,
  validateOutputSchema,
} from './schemas'

// Artifacts
export { storeAiArtifactAsDocument, type StoreAiArtifactInput, type StoredArtifact } from './artifacts'

// Budgets
export { ensureBudgetRow as createBudgetRow } from './budgets'
