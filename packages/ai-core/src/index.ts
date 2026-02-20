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

// Errors (standard taxonomy)
export {
  profileNotFound,
  profileDisabled,
  featureNotAllowed,
  modalityNotAllowed,
  dataClassNotAllowed,
  streamingNotAllowed,
  budgetExceeded,
  policyDenied,
  schemaInvalid,
  providerError,
  rateLimited,
  isRetryable,
  isPolicyError,
  toErrorResponse,
} from './errors'

// Gateway (main entry point for requests)
export {
  generate,
  chat,
  chatStream,
  embed,
  resolveProfile,
  resolveDeployment,
  resolvePrompt,
  checkBudget,
  recordSpend,
  ensureBudgetRow,
  logAiRequest,
  appendAiAuditEvent,
  redactText,
} from './gateway'
export type { ResolvedDeployment } from './gateway'

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
  ACTION_TYPES,
  FinanceStripeMonthlyReportsProposalSchema,
  AiIngestKnowledgeSourceProposalSchema,
} from './schemas'
export type {
  ActionType,
  FinanceStripeMonthlyReportsProposal,
  AiIngestKnowledgeSourceProposal,
} from './schemas'

// Artifacts
export { storeAiArtifactAsDocument, type StoreAiArtifactInput, type StoredArtifact } from './artifacts'

// Budgets
export { ensureBudgetRow as createBudgetRow } from './budgets'

// Policy
export { checkActionPolicy, type PolicyCheckInput, type PolicyDecision } from './policy/actionsPolicy'

// Actions (Phase C)
export { executeAction, type ExecuteActionResult } from './actions/executeAction'
export {
  createActionAttestation,
  storeAttestation,
  type AttestationInput,
  type AttestationJson,
  type StoredAttestation,
} from './actions/attestation'
export {
  collectAiActionEvidence,
  type AiActionEvidence,
  type AiActionsEvidenceAppendix,
} from './actions/evidencePack'
