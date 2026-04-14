/**
 * @nzila/platform-integrations — Idempotency Utilities
 *
 * Ensures duplicate inbound deliveries are safely deduplicated.
 */

// ─── Idempotency Store Interface ─────────────────────────────────────────────

export interface IdempotencyStore {
  check(key: string): Promise<Record<string, unknown> | null>
  record(key: string, result: Record<string, unknown>, ttlMs?: number): Promise<void>
  remove(key: string): Promise<void>
}

// ─── In-Memory Implementation ────────────────────────────────────────────────

interface IdempotencyEntry {
  result: Record<string, unknown>
  expiresAt: number
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly entries = new Map<string, IdempotencyEntry>()
  private static readonly DEFAULT_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

  async check(key: string): Promise<Record<string, unknown> | null> {
    const entry = this.entries.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key)
      return null
    }

    return entry.result
  }

  async record(key: string, result: Record<string, unknown>, ttlMs?: number): Promise<void> {
    this.entries.set(key, {
      result,
      expiresAt: Date.now() + (ttlMs ?? InMemoryIdempotencyStore.DEFAULT_TTL_MS),
    })
  }

  async remove(key: string): Promise<void> {
    this.entries.delete(key)
  }

  /** Test helper: clear all entries */
  clear(): void {
    this.entries.clear()
  }
}
