/**
 * @nzila/ai-sdk — barrel export
 *
 * Single import for all Nzila OS AI capabilities:
 *   import { createAiClient } from '@nzila/ai-sdk'
 */

// Client
export { createAiClient, type AiSdkConfig, type AiClient } from './client'

// Streaming helpers
export { consumeStream, collectStream, toReadableStream } from './streaming'

// Types
export type {
  GenerateOptions,
  GenerateResult,
  EmbedOptions,
  EmbedResult,
  ExtractOptions,
  ExtractResult,
  RagQueryOptions,
  RagQueryResult,
  RagChunk,
  ActionProposeOptions,
  ActionProposeResult,
  ActionApproveOptions,
  ActionApproveResult,
  ChatMessage,
  DataClass,
  AiTrace,
  AiModelParams,
  StreamChunk,
  AiSdkErrorCode,
} from './types'

export { AiSdkError } from './types'
