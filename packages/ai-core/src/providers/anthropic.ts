/**
 * @nzila/ai-core — Anthropic provider
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  DO NOT IMPORT IN APPS                                      ║
 * ║                                                              ║
 * ║  This module is an internal provider implementation.         ║
 * ║  All apps MUST use @nzila/ai-sdk for AI capabilities.       ║
 * ║  Direct provider usage bypasses governance, budgets,         ║
 * ║  redaction, auditing, and policy enforcement.                ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Calls the Anthropic Messages API directly (no external SDK dep).
 * Supports text generation, streaming, and embeddings (via Voyage AI passthrough).
 * Used for local dev; Azure OpenAI is used in staging/prod.
 */
import { getAiEnv } from '@nzila/os-core/ai-env'
import type {
  AiProviderClient,
  AiStreamChunk,
  ProviderGenerateParams,
  ProviderGenerateResult,
  ProviderEmbedParams,
  ProviderEmbedResult,
} from '../types'

const MESSAGES_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

// ── Anthropic provider ──────────────────────────────────────────────────────

export function createAnthropicProvider(): AiProviderClient {
  const env = getAiEnv()
  const apiKey = env.ANTHROPIC_API_KEY!

  const headers: Record<string, string> = {
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'content-type': 'application/json',
  }

  /** Convert OpenAI-style messages to Anthropic format, extracting system prompt */
  function toAnthropicMessages(
    messages: ProviderGenerateParams['messages'],
  ): { system?: string; messages: { role: 'user' | 'assistant'; content: string }[] } {
    let system: string | undefined
    const out: { role: 'user' | 'assistant'; content: string }[] = []

    for (const m of messages) {
      if (m.role === 'system') {
        system = system ? `${system}\n${m.content}` : m.content
      } else {
        out.push({ role: m.role as 'user' | 'assistant', content: m.content })
      }
    }

    return { system, messages: out }
  }

  return {
    async generate(params: ProviderGenerateParams): Promise<ProviderGenerateResult> {
      const model = params.model || env.ANTHROPIC_MODEL_TEXT || 'claude-sonnet-4-6'
      const { system, messages } = toAnthropicMessages(params.messages)

      const body: Record<string, unknown> = {
        model,
        max_tokens: params.maxTokens ?? 1024,
        messages,
        ...(system ? { system } : {}),
        ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
        ...(params.topP !== undefined ? { top_p: params.topP } : {}),
        ...(params.responseFormat === 'json'
          ? { system: [system, 'Respond with valid JSON only.'].filter(Boolean).join('\n') }
          : {}),
      }

      const res = await fetch(MESSAGES_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Anthropic error ${res.status}: ${errorText}`)
      }

      const json = (await res.json()) as AnthropicResponse
      const textBlock = json.content.find((b) => b.type === 'text')

      return {
        content: textBlock?.text ?? '',
        tokensIn: json.usage?.input_tokens ?? 0,
        tokensOut: json.usage?.output_tokens ?? 0,
        model: json.model ?? model,
      }
    },

    async *generateStream(
      params: ProviderGenerateParams,
    ): AsyncIterable<AiStreamChunk> {
      const model = params.model || env.ANTHROPIC_MODEL_TEXT || 'claude-sonnet-4-6'
      const { system, messages } = toAnthropicMessages(params.messages)

      const body: Record<string, unknown> = {
        model,
        max_tokens: params.maxTokens ?? 1024,
        messages,
        stream: true,
        ...(system ? { system } : {}),
        ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
        ...(params.topP !== undefined ? { top_p: params.topP } : {}),
      }

      const res = await fetch(MESSAGES_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Anthropic stream error ${res.status}: ${errorText}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body for streaming')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)

          try {
            const parsed = JSON.parse(data) as AnthropicStreamEvent
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              yield { delta: parsed.delta.text ?? '', done: false }
            } else if (parsed.type === 'message_stop') {
              yield { delta: '', done: true }
              return
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }

      yield { delta: '', done: true }
    },

    async embed(_params: ProviderEmbedParams): Promise<ProviderEmbedResult> {
      // Anthropic does not offer a native embeddings API.
      // Route embedding requests to OpenAI or Azure OpenAI instead.
      throw new Error(
        'Anthropic provider does not support embeddings. ' +
        'Set AI_EMBEDDINGS_PROVIDER=openai or azure_openai for embed() calls.',
      )
    },
  }
}

// ── Anthropic response types ────────────────────────────────────────────────

interface AnthropicResponse {
  id: string
  model: string
  content: { type: string; text: string }[]
  usage: { input_tokens: number; output_tokens: number }
}

interface AnthropicStreamEvent {
  type: string
  delta?: { type: string; text?: string }
}
