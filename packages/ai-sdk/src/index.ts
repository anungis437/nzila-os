/**
 * @nzila/ai-sdk — barrel export
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  SINGLE ENTRY POINT FOR ALL NZILA AI CAPABILITIES           ║
 * ║                                                              ║
 * ║  All Nzila apps MUST import AI functions from this package.  ║
 * ║  Direct imports from @nzila/ai-core/providers/* or raw       ║
 * ║  OpenAI/Azure SDK calls are PROHIBITED — they bypass the     ║
 * ║  governance control plane (profiles, budgets, redaction,     ║
 * ║  auditing, policy enforcement, and attestation).             ║
 * ║                                                              ║
 * ║  Usage:                                                      ║
 * ║    import { createAiClient } from '@nzila/ai-sdk'            ║
 * ╚══════════════════════════════════════════════════════════════╝
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
