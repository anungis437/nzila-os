/**
 * Per-Org Bulkhead Isolation
 *
 * Provides org-scoped concurrency limits to prevent any single org
 * from monopolizing shared resources. Each orgId gets its own Bulkhead
 * with configurable concurrency and queue limits.
 *
 * This prevents the noisy-neighbour problem in multi-org environments
 * and ensures fair resource distribution across organizations.
 *
 * @example
 * ```ts
 * const pool = new OrgBulkheadPool({
 *   name: 'ai-inference',
 *   maxConcurrentPerOrg: 5,
 *   maxQueuePerOrg: 20,
 *   globalMaxConcurrent: 50,
 * });
 *
 * // Scoped to orgId — other orgs are not affected
 * const result = await pool.execute(orgId, () => callAIModel(prompt));
 * ```
 */

import { Bulkhead, type BulkheadOptions } from './bulkhead';

export interface OrgBulkheadPoolOptions {
  /** Pool name for telemetry */
  name: string;
  /** Max concurrent operations per org (default: 10) */
  maxConcurrentPerOrg?: number;
  /** Max queue per org (default: 50) */
  maxQueuePerOrg?: number;
  /** Global concurrent limit across all orgs (default: unlimited) */
  globalMaxConcurrent?: number;
  /** Evict idle org bulkheads after ms (default: 300_000 = 5min) */
  idleEvictionMs?: number;
  /** Callback when an org is throttled */
  onThrottle?: (orgId: string, activeCount: number, queueLength: number) => void;
}

interface OrgEntry {
  bulkhead: Bulkhead;
  lastUsed: number;
}

export class OrgBulkheadPool {
  private readonly orgs = new Map<string, OrgEntry>();
  private globalActive = 0;
  private readonly options: Required<Omit<OrgBulkheadPoolOptions, 'onThrottle'>> & Pick<OrgBulkheadPoolOptions, 'onThrottle'>;
  private evictionTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: OrgBulkheadPoolOptions) {
    this.options = {
      name: options.name,
      maxConcurrentPerOrg: options.maxConcurrentPerOrg ?? 10,
      maxQueuePerOrg: options.maxQueuePerOrg ?? 50,
      globalMaxConcurrent: options.globalMaxConcurrent ?? Number.MAX_SAFE_INTEGER,
      idleEvictionMs: options.idleEvictionMs ?? 300_000,
      onThrottle: options.onThrottle,
    };

    // Periodically evict idle org bulkheads
    this.evictionTimer = setInterval(() => this.evictIdle(), this.options.idleEvictionMs);
    if (typeof this.evictionTimer === 'object' && 'unref' in this.evictionTimer) {
      this.evictionTimer.unref(); // Don't block Node.js exit
    }
  }

  /**
   * Execute a function within the org's isolated bulkhead.
   *
   * Each orgId gets its own concurrency limit. If the per-org bulkhead
   * is full, the request is queued or rejected — but other orgs are
   * unaffected.
   */
  async execute<T>(orgId: string, fn: () => Promise<T>): Promise<T> {
    if (this.globalActive >= this.options.globalMaxConcurrent) {
      throw new OrgBulkheadOverloadError(
        this.options.name,
        orgId,
        this.globalActive,
        'Global concurrency limit reached',
      );
    }

    const entry = this.getOrCreateOrg(orgId);
    entry.lastUsed = Date.now();

    this.globalActive++;
    try {
      return await entry.bulkhead.execute(fn);
    } catch (error) {
      // Emit throttle event if this was a capacity error
      if (error instanceof Error && error.name === 'BulkheadFullError') {
        this.options.onThrottle?.(
          orgId,
          entry.bulkhead.getActiveCount(),
          entry.bulkhead.getQueueLength(),
        );
      }
      throw error;
    } finally {
      this.globalActive--;
    }
  }

  private getOrCreateOrg(orgId: string): OrgEntry {
    let entry = this.orgs.get(orgId);
    if (!entry) {
      const bulkhead = new Bulkhead({
        name: `${this.options.name}:${orgId}`,
        maxConcurrent: this.options.maxConcurrentPerOrg,
        maxQueue: this.options.maxQueuePerOrg,
      });
      entry = { bulkhead, lastUsed: Date.now() };
      this.orgs.set(orgId, entry);
    }
    return entry;
  }

  private evictIdle(): void {
    const now = Date.now();
    for (const [orgId, entry] of this.orgs) {
      if (
        entry.bulkhead.getActiveCount() === 0 &&
        entry.bulkhead.getQueueLength() === 0 &&
        now - entry.lastUsed > this.options.idleEvictionMs
      ) {
        this.orgs.delete(orgId);
      }
    }
  }

  /** Get stats for a specific org */
  getOrgStats(orgId: string): { active: number; queued: number } | null {
    const entry = this.orgs.get(orgId);
    if (!entry) return null;
    return {
      active: entry.bulkhead.getActiveCount(),
      queued: entry.bulkhead.getQueueLength(),
    };
  }

  /** Get aggregate pool stats */
  getPoolStats(): {
    globalActive: number;
    orgCount: number;
    orgs: Record<string, { active: number; queued: number }>;
  } {
    const orgs: Record<string, { active: number; queued: number }> = {};
    for (const [id, entry] of this.orgs) {
      orgs[id] = {
        active: entry.bulkhead.getActiveCount(),
        queued: entry.bulkhead.getQueueLength(),
      };
    }
    return {
      globalActive: this.globalActive,
      orgCount: this.orgs.size,
      orgs,
    };
  }

  /** Dispose the pool and clear the eviction timer */
  dispose(): void {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = null;
    }
    this.orgs.clear();
  }
}

export class OrgBulkheadOverloadError extends Error {
  constructor(
    public readonly poolName: string,
    public readonly orgId: string,
    public readonly globalActive: number,
    message: string,
  ) {
    super(`OrgBulkheadPool "${poolName}" [${orgId}]: ${message}`);
    this.name = 'OrgBulkheadOverloadError';
  }
}
