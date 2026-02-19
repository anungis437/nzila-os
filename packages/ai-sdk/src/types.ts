/**
 * @nzila/ai-sdk — Shared types for app-facing AI SDK
 *
 * These mirror the API request/response shapes but are independent
 * of the server-side ai-core package.
 */

export type DataClass = 'public' | 'internal' | 'sensitive' | 'regulated'

export interface AiTrace {
  correlationId?: string
  domainType?: string
  domainId?: string
}

export interface AiModelParams {
  temperature?: number
  maxTokens?: number
  topP?: number
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// ── Request types ───────────────────────────────────────────────────────────

export interface GenerateOptions {
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

export interface EmbedOptions {
  entityId: string
  appKey: string
  profileKey: string
  input: string | string[]
  dataClass: DataClass
}

export interface ExtractOptions {
  entityId: string
  appKey: string
  profileKey: string
  promptKey: string
  input: string
  schemaKey?: string
  variables?: Record<string, string>
  dataClass: DataClass
  trace?: AiTrace
}

export interface RagQueryOptions {
  entityId: string
  appKey: string
  profileKey: string
  query: string
  topK?: number
  filters?: Record<string, unknown>
  dataClass: DataClass
}

export interface ActionProposeOptions {
  entityId: string
  appKey: string
  profileKey: string
  actionType: string
  input: string
  trace?: AiTrace
}

export interface ActionApproveOptions {
  actionId: string
  approved: boolean
  notes?: string
}

// ── Response types ──────────────────────────────────────────────────────────

export interface GenerateResult {
  requestId: string
  content: string
  tokensIn: number
  tokensOut: number
  costUsd: number | null
  latencyMs: number
  model: string
  provider: string
}

export interface EmbedResult {
  requestId: string
  embeddings: number[][]
  model: string
  tokensUsed: number
}

export interface ExtractResult {
  requestId: string
  data: Record<string, unknown>
  tokensIn: number
  tokensOut: number
  costUsd: number | null
  latencyMs: number
}

export interface RagChunk {
  chunkId: string
  chunkText: string
  score: number
  sourceId: string
  metadata: Record<string, unknown>
}

export interface RagQueryResult {
  requestId: string
  chunks: RagChunk[]
  answer?: string
  tokensIn?: number
  tokensOut?: number
}

export interface ActionProposeResult {
  requestId: string
  actionId: string
  proposalJson: Record<string, unknown>
}

export interface ActionApproveResult {
  actionId: string
  status: string
  approvedBy: string
}

// ── Error types ─────────────────────────────────────────────────────────────

export type AiSdkErrorCode =
  | 'budget_exceeded'
  | 'policy_denied'
  | 'redaction_applied'
  | 'schema_invalid'
  | 'profile_not_found'
  | 'profile_disabled'
  | 'feature_not_allowed'
  | 'streaming_not_allowed'
  | 'provider_error'
  | 'unauthorized'
  | 'network_error'
  | 'unknown'

export class AiSdkError extends Error {
  constructor(
    public readonly code: AiSdkErrorCode,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message)
    this.name = 'AiSdkError'
  }
}

export interface StreamChunk {
  delta: string
  done: boolean
}
