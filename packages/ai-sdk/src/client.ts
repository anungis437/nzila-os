/**
 * @nzila/ai-sdk — API Client
 *
 * Typed fetch wrapper for the Nzila OS AI Control Plane.
 * Apps import this and call methods — never calling model providers directly.
 */
import { AiSdkError } from './types'
import { consumeStream, collectStream, toReadableStream } from './streaming'
import type {
  GenerateOptions,
  GenerateResult,
  EmbedOptions,
  EmbedResult,
  ExtractOptions,
  ExtractResult,
  RagQueryOptions,
  RagQueryResult,
  ActionProposeOptions,
  ActionProposeResult,
  ActionApproveOptions,
  ActionApproveResult,
  StreamChunk,
} from './types'

// ── Config ──────────────────────────────────────────────────────────────────

export interface AiSdkConfig {
  /** Base URL of the Nzila OS console (e.g., https://console.nzila.io or http://localhost:3001) */
  baseUrl: string
  /** Clerk session token or API key getter */
  getToken: () => string | Promise<string>
}

// ── Client ──────────────────────────────────────────────────────────────────

export function createAiClient(config: AiSdkConfig) {
  async function headers(): Promise<Record<string, string>> {
    const token = await config.getToken()
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  }

  async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${config.baseUrl}${path}`, {
      method: 'POST',
      headers: await headers(),
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      let errorBody: { error?: string; code?: string } = {}
      try {
        errorBody = await res.json()
      } catch {
        // ignore
      }
      throw new AiSdkError(
        (errorBody.code as AiSdkError['code']) ?? 'unknown',
        errorBody.error ?? `Request failed with status ${res.status}`,
        res.status,
      )
    }

    return res.json() as Promise<T>
  }

  return {
    /**
     * Non-streaming text generation.
     */
    generate(opts: GenerateOptions): Promise<GenerateResult> {
      return post('/api/ai/generate', opts)
    },

    /**
     * Non-streaming chat completion.
     */
    chat(opts: GenerateOptions): Promise<GenerateResult> {
      return post('/api/ai/chat', opts)
    },

    /**
     * Streaming chat completion — returns an async iterable of chunks.
     */
    async chatStream(opts: GenerateOptions): Promise<{
      stream: AsyncIterable<StreamChunk>
      collect: () => Promise<string>
      toReadable: () => ReadableStream<string>
    }> {
      const res = await fetch(`${config.baseUrl}/api/ai/chat/stream`, {
        method: 'POST',
        headers: await headers(),
        body: JSON.stringify(opts),
      })

      if (!res.ok) {
        let errorBody: { error?: string; code?: string } = {}
        try {
          errorBody = await res.json()
        } catch {
          // ignore
        }
        throw new AiSdkError(
          (errorBody.code as AiSdkError['code']) ?? 'unknown',
          errorBody.error ?? `Stream request failed with status ${res.status}`,
          res.status,
        )
      }

      return {
        stream: consumeStream(res),
        collect: () => collectStream(res),
        toReadable: () => toReadableStream(res),
      }
    },

    /**
     * Generate embeddings.
     */
    embed(opts: EmbedOptions): Promise<EmbedResult> {
      return post('/api/ai/embed', opts)
    },

    /**
     * Extract structured JSON from text.
     */
    extract(opts: ExtractOptions): Promise<ExtractResult> {
      return post('/api/ai/extract', opts)
    },

    /**
     * RAG query — vector search + optional LLM answer.
     */
    ragQuery(opts: RagQueryOptions): Promise<RagQueryResult> {
      return post('/api/ai/rag/query', opts)
    },

    /**
     * Propose an AI action (Phase B).
     */
    actionPropose(opts: ActionProposeOptions): Promise<ActionProposeResult> {
      return post('/api/ai/actions/propose', opts)
    },

    /**
     * Approve or reject an AI action (Phase B).
     */
    actionApprove(opts: ActionApproveOptions): Promise<ActionApproveResult> {
      return post('/api/ai/actions/approve', opts)
    },
  }
}

export type AiClient = ReturnType<typeof createAiClient>
