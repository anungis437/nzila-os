/**
 * Cognition Envelope Cache
 *
 * Lightweight TTL cache for explainability envelopes. Process-local by
 * default; hosting apps may swap in a distributed implementation by
 * implementing the `EnvelopeCacheStore` interface.
 *
 * Cache keys are deterministic: `${engineId}:${engineVersion}:${organizationId}`.
 * Cache entries are NEVER shared across organizations.
 */

import type { InstitutionalExplainabilityEnvelope } from '../explainability/index.js';
import { emitCognitionTelemetry } from '../observability/index.js';

export interface EnvelopeCacheStore {
  get(key: string): Promise<InstitutionalExplainabilityEnvelope<unknown> | undefined>;
  set(
    key: string,
    value: InstitutionalExplainabilityEnvelope<unknown>,
    ttlMs: number,
  ): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

/* -------------------------------------------------------------------------- */
/* Default in-memory store                                                     */
/* -------------------------------------------------------------------------- */

interface InMemoryEntry {
  value: InstitutionalExplainabilityEnvelope<unknown>;
  expiresAt: number;
}

class InMemoryEnvelopeCache implements EnvelopeCacheStore {
  private readonly entries = new Map<string, InMemoryEntry>();

  async get(key: string): Promise<InstitutionalExplainabilityEnvelope<unknown> | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async set(
    key: string,
    value: InstitutionalExplainabilityEnvelope<unknown>,
    ttlMs: number,
  ): Promise<void> {
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async clear(): Promise<void> {
    this.entries.clear();
  }
}

let activeStore: EnvelopeCacheStore = new InMemoryEnvelopeCache();

export function setEnvelopeCacheStore(store: EnvelopeCacheStore): void {
  activeStore = store;
}

export function getEnvelopeCacheStore(): EnvelopeCacheStore {
  return activeStore;
}

/* -------------------------------------------------------------------------- */
/* Public helpers                                                              */
/* -------------------------------------------------------------------------- */

export interface CacheKeyInput {
  engineId: string;
  engineVersion: string;
  organizationId: string;
  /** Optional discriminator (e.g. scenario hash) for parameterized engines. */
  discriminator?: string;
}

export function envelopeCacheKey(input: CacheKeyInput): string {
  const base = `${input.engineId}@${input.engineVersion}:${input.organizationId}`;
  return input.discriminator ? `${base}:${input.discriminator}` : base;
}

/** Default TTL: 60 seconds. Most cognition outputs are stable for short windows. */
export const DEFAULT_ENVELOPE_TTL_MS = 60_000;

/**
 * Memoize a cognition engine using the active envelope cache.
 * - Cache miss → invokes the engine, stores the envelope, returns it.
 * - Cache hit  → returns the stored envelope (does not re-invoke).
 *
 * This NEVER caches failures and NEVER caches across organizations.
 */
export function memoizeCognitionEngine<TPayload>(
  engineId: string,
  engineVersion: string,
  invoke: (organizationId: string) => Promise<InstitutionalExplainabilityEnvelope<TPayload>>,
  ttlMs: number = DEFAULT_ENVELOPE_TTL_MS,
): (organizationId: string) => Promise<InstitutionalExplainabilityEnvelope<TPayload>> {
  return async (organizationId: string) => {
    const key = envelopeCacheKey({ engineId, engineVersion, organizationId });
    const store = getEnvelopeCacheStore();
    const cached = await store.get(key);
    if (cached) {
      emitCognitionTelemetry({ kind: 'cache_hit', engineId, organizationId });
      return cached as InstitutionalExplainabilityEnvelope<TPayload>;
    }
    emitCognitionTelemetry({ kind: 'cache_miss', engineId, organizationId });
    const envelope = await invoke(organizationId);
    await store.set(key, envelope, ttlMs);
    return envelope;
  };
}
