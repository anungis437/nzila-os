/**
 * @nzila/ai-core — Shared types for the AI Control Plane
 */

// ── Provider types ──────────────────────────────────────────────────────────

export type AiProvider = 'azure_openai' | 'openai'

export type AiModality = 'text' | 'embeddings' | 'vision' | 'speech' | 'tools'

export type AiFeature =
  | 'chat'
  | 'generate'
  | 'embed'
  | 'rag_query'
  | 'extract'
  | 'actions_propose'
  | 'summarize'
  | 'classify'

export type DataClass = 'public' | 'internal' | 'sensitive' | 'regulated'

export type RedactionMode = 'strict' | 'balanced' | 'off'

// ── Request/Response ────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiGenerateRequest {
  entityId: string
  appKey: string
  profileKey: string
  promptKey?: string
  input: string | ChatMessage[]
  variables?: Record<string, string>
  dataClass: DataClass
  trace?: AiTrace
  params?: AiModelParams
}

export interface AiModelParams {
  temperature?: number
  maxTokens?: number
  topP?: number
}

export interface AiTrace {
  correlationId?: string
  domainType?: string
  domainId?: string
}

export interface AiGenerateResponse {
  requestId: string
  content: string
  tokensIn: number
  tokensOut: number
  costUsd: number | null
  latencyMs: number
  model: string
  provider: AiProvider
}

export interface AiStreamChunk {
  delta: string
  done: boolean
}

export interface AiEmbedRequest {
  entityId: string
  appKey: string
  profileKey: string
  input: string | string[]
  dataClass: DataClass
}

export interface AiEmbedResponse {
  requestId: string
  embeddings: number[][]
  model: string
  tokensUsed: number
}

export interface AiExtractRequest extends AiGenerateRequest {
  schemaKey?: string
}

export interface AiExtractResponse {
  requestId: string
  data: Record<string, unknown>
  tokensIn: number
  tokensOut: number
  costUsd: number | null
  latencyMs: number
}

export interface AiRagQueryRequest {
  entityId: string
  appKey: string
  profileKey: string
  query: string
  topK?: number
  filters?: Record<string, unknown>
  dataClass: DataClass
}

export interface AiRagChunk {
  chunkId: string
  chunkText: string
  score: number
  sourceId: string
  metadata: Record<string, unknown>
}

export interface AiRagQueryResponse {
  requestId: string
  chunks: AiRagChunk[]
  answer?: string
  tokensIn?: number
  tokensOut?: number
}

export interface AiActionProposeRequest {
  entityId: string
  appKey: string
  profileKey: string
  actionType: string
  input: string
  trace?: AiTrace
}

export interface AiActionProposeResponse {
  requestId: string
  actionId: string
  proposalJson: Record<string, unknown>
}

// ── Capability Profile (resolved) ───────────────────────────────────────────

export interface ResolvedCapabilityProfile {
  id: string
  entityId: string
  appKey: string
  environment: string
  profileKey: string
  enabled: boolean
  allowedProviders: AiProvider[]
  allowedModels: string[]
  modalities: AiModality[]
  features: AiFeature[]
  dataClassesAllowed: DataClass[]
  streamingAllowed: boolean
  determinismRequired: boolean
  retentionDays: number | null
  toolPermissions: string[]
  budgets: { monthlyUsd?: number; perUserUsd?: number; perRequestUsd?: number }
  redactionMode: RedactionMode
}

// ── Errors ──────────────────────────────────────────────────────────────────

export type AiErrorCode =
  | 'profile_not_found'
  | 'profile_disabled'
  | 'feature_not_allowed'
  | 'modality_not_allowed'
  | 'data_class_not_allowed'
  | 'streaming_not_allowed'
  | 'budget_exceeded'
  | 'policy_denied'
  | 'redaction_applied'
  | 'schema_invalid'
  | 'provider_error'
  | 'rate_limited'
  | 'unknown'

export class AiControlPlaneError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message)
    this.name = 'AiControlPlaneError'
  }
}

// ── Provider interface ──────────────────────────────────────────────────────

export interface AiProviderClient {
  generate(params: ProviderGenerateParams): Promise<ProviderGenerateResult>
  generateStream(
    params: ProviderGenerateParams,
  ): AsyncIterable<AiStreamChunk>
  embed(params: ProviderEmbedParams): Promise<ProviderEmbedResult>
}

export interface ProviderGenerateParams {
  messages: ChatMessage[]
  model: string
  temperature: number
  maxTokens: number
  topP?: number
  responseFormat?: 'json' | 'text'
}

export interface ProviderGenerateResult {
  content: string
  tokensIn: number
  tokensOut: number
  model: string
}

export interface ProviderEmbedParams {
  input: string[]
  model: string
}

export interface ProviderEmbedResult {
  embeddings: number[][]
  tokensUsed: number
  model: string
}
