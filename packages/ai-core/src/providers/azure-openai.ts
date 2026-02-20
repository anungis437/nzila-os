/**
 * @nzila/ai-core — Azure OpenAI provider
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
 * Calls Azure OpenAI REST API directly (no external SDK dep).
 * Supports chat completions and embeddings.
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

// ── Azure OpenAI provider ───────────────────────────────────────────────────

export function createAzureOpenAIProvider(): AiProviderClient {
  const env = getAiEnv()

  function chatUrl(deployment: string): string {
    return `${env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${deployment}/chat/completions?api-version=${env.AZURE_OPENAI_API_VERSION}`
  }

  function embeddingsUrl(deployment: string): string {
    return `${env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${deployment}/embeddings?api-version=${env.AZURE_OPENAI_API_VERSION}`
  }

  const headers = {
    'api-key': env.AZURE_OPENAI_API_KEY,
    'Content-Type': 'application/json',
  }

  return {
    async generate(params: ProviderGenerateParams): Promise<ProviderGenerateResult> {
      const deployment = params.model || env.AZURE_OPENAI_DEPLOYMENT_TEXT
      const body = {
        messages: params.messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        top_p: params.topP,
        ...(params.responseFormat === 'json'
          ? { response_format: { type: 'json_object' } }
          : {}),
      }

      const res = await fetch(chatUrl(deployment), {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Azure OpenAI error ${res.status}: ${errorText}`)
      }

      const json = (await res.json()) as AzureChatResponse
      const choice = json.choices?.[0]

      return {
        content: choice?.message?.content ?? '',
        tokensIn: json.usage?.prompt_tokens ?? 0,
        tokensOut: json.usage?.completion_tokens ?? 0,
        model: json.model ?? deployment,
      }
    },

    async *generateStream(
      params: ProviderGenerateParams,
    ): AsyncIterable<AiStreamChunk> {
      const deployment = params.model || env.AZURE_OPENAI_DEPLOYMENT_TEXT
      const body = {
        messages: params.messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        top_p: params.topP,
        stream: true,
      }

      const res = await fetch(chatUrl(deployment), {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Azure OpenAI stream error ${res.status}: ${errorText}`)
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
            const parsed = JSON.parse(data) as AzureStreamChunk
            const delta = parsed.choices?.[0]?.delta?.content ?? ''
            if (delta) {
              yield { delta, done: false }
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }

      yield { delta: '', done: true }
    },

    async embed(params: ProviderEmbedParams): Promise<ProviderEmbedResult> {
      const deployment = params.model || env.AZURE_OPENAI_DEPLOYMENT_EMBEDDINGS
      const body = { input: params.input }

      const res = await fetch(embeddingsUrl(deployment), {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Azure OpenAI embeddings error ${res.status}: ${errorText}`)
      }

      const json = (await res.json()) as AzureEmbeddingResponse

      return {
        embeddings: json.data.map((d) => d.embedding),
        tokensUsed: json.usage?.total_tokens ?? 0,
        model: json.model ?? deployment,
      }
    },
  }
}

// ── Azure response types ────────────────────────────────────────────────────

interface AzureChatResponse {
  id: string
  model: string
  choices: {
    message: { role: string; content: string }
    finish_reason: string
  }[]
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

interface AzureStreamChunk {
  choices: {
    delta: { content?: string; role?: string }
    finish_reason: string | null
  }[]
}

interface AzureEmbeddingResponse {
  data: { embedding: number[]; index: number }[]
  model: string
  usage: { prompt_tokens: number; total_tokens: number }
}
