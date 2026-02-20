/**
 * @nzila/ai-core — Direct OpenAI provider
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
 * Calls the OpenAI REST API directly (no external SDK dep).
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

const CHAT_URL = 'https://api.openai.com/v1/chat/completions'
const EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings'

// ── Direct OpenAI provider ──────────────────────────────────────────────────

export function createOpenAIProvider(): AiProviderClient {
  const env = getAiEnv()
  const apiKey = env.OPENAI_API_KEY!
  const project = env.OPENAI_PROJECT

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    ...(project ? { 'OpenAI-Project': project } : {}),
  }

  return {
    async generate(params: ProviderGenerateParams): Promise<ProviderGenerateResult> {
      const model = params.model || env.OPENAI_MODEL_TEXT || 'gpt-4o'
      const body = {
        model,
        messages: params.messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        top_p: params.topP,
        ...(params.responseFormat === 'json'
          ? { response_format: { type: 'json_object' } }
          : {}),
      }

      const res = await fetch(CHAT_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`OpenAI error ${res.status}: ${errorText}`)
      }

      const json = (await res.json()) as OpenAIChatResponse
      const choice = json.choices?.[0]

      return {
        content: choice?.message?.content ?? '',
        tokensIn: json.usage?.prompt_tokens ?? 0,
        tokensOut: json.usage?.completion_tokens ?? 0,
        model: json.model ?? model,
      }
    },

    async *generateStream(
      params: ProviderGenerateParams,
    ): AsyncIterable<AiStreamChunk> {
      const model = params.model || env.OPENAI_MODEL_TEXT || 'gpt-4o'
      const body = {
        model,
        messages: params.messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        top_p: params.topP,
        stream: true,
      }

      const res = await fetch(CHAT_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`OpenAI stream error ${res.status}: ${errorText}`)
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
          if (data === '[DONE]') {
            yield { delta: '', done: true }
            return
          }

          try {
            const parsed = JSON.parse(data) as OpenAIStreamChunk
            const delta = parsed.choices?.[0]?.delta?.content ?? ''
            if (delta) yield { delta, done: false }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }

      yield { delta: '', done: true }
    },

    async embed(params: ProviderEmbedParams): Promise<ProviderEmbedResult> {
      const model = params.model || env.OPENAI_MODEL_EMBEDDINGS || 'text-embedding-3-small'
      const body = { model, input: params.input }

      const res = await fetch(EMBEDDINGS_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`OpenAI embeddings error ${res.status}: ${errorText}`)
      }

      const json = (await res.json()) as OpenAIEmbeddingResponse

      return {
        embeddings: json.data.map((d) => d.embedding),
        tokensUsed: json.usage?.total_tokens ?? 0,
        model: json.model ?? model,
      }
    },
  }
}

// ── OpenAI response types ───────────────────────────────────────────────────

interface OpenAIChatResponse {
  id: string
  model: string
  choices: {
    message: { role: string; content: string }
    finish_reason: string
  }[]
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

interface OpenAIStreamChunk {
  choices: {
    delta: { content?: string; role?: string }
    finish_reason: string | null
  }[]
}

interface OpenAIEmbeddingResponse {
  data: { embedding: number[]; index: number }[]
  model: string
  usage: { prompt_tokens: number; total_tokens: number }
}
