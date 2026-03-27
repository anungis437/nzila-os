/**
 * AI client — Union-Eyes (standard-path re-export).
 *
 * The canonical AI client lives at lib/ai/ai-client.ts with Clerk auth
 * integration. This file exists at the standard lib/ai-client.ts path
 * to satisfy the platform wiring contract (STUDIO-AI-01).
 */
export { getAiClient, UE_APP_KEY, UE_SYSTEM_ORG_ID } from '@/lib/ai/ai-client'

// Re-export the SDK types so consumers importing from the standard path get types too
import type { AiClient } from '@nzila/ai-sdk'
export type { AiClient }
