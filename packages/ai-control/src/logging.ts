import { createHash, randomUUID } from 'node:crypto'
import type { AILogEntry, AIRequest, AIResponse } from './schemas.js'

// ─── AI Log Store ───────────────────────────────────────────────────────────

export interface AILogStore {
  append(entry: AILogEntry): Promise<void>
  getEntries(orgId: string, options?: { limit?: number }): Promise<AILogEntry[]>
}

export class InMemoryAILogStore implements AILogStore {
  private readonly entries: AILogEntry[] = []

  async append(entry: AILogEntry): Promise<void> {
    this.entries.push(Object.freeze({ ...entry }))
  }

  async getEntries(orgId: string, options?: { limit?: number }): Promise<AILogEntry[]> {
    const filtered = this.entries.filter((e) => e.orgId === orgId)
    const limit = options?.limit ?? 1000
    return filtered.slice(-limit)
  }
}

// ─── Logging ────────────────────────────────────────────────────────────────

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

export function createAILogEntry(
  request: AIRequest,
  response: AIResponse,
  policyDecision: { allowed: boolean; reason: string },
): AILogEntry {
  return {
    id: randomUUID(),
    timestamp: response.timestamp,
    orgId: request.orgId,
    actorId: request.actorId,
    model: response.model,
    promptHash: hashContent(request.prompt),
    responseHash: hashContent(response.content),
    tokensUsed: response.tokensUsed.total,
    costUsd: response.costUsd,
    classification: response.classification,
    durationMs: response.durationMs,
    policyDecision,
  }
}
