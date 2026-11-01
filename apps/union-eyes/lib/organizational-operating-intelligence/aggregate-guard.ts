/**
 * Guards for the aggregator routes that run every cognition engine for one organization.
 *
 * - Engine failures are reported by engine and a fixed code; the raw exception text (a database or provider error) never reaches the client.
 * - A response in which engines are missing says so (`complete: false`) and one in which every engine failed is a 503, not a success.
 * - Each call runs about 28 engines, so a request is limited per organization and a recent result for the same organization is reused for
 *   a short time. The memo is keyed by organization, bounded in size, and never holds a result that contains a failure.
 */
import { ApiError, ErrorCode } from '@/lib/api/errors';
import { checkRateLimit } from '@/lib/rate-limiter';
import type { OrchestrationResult } from '@nzila/organizational-cognition-core';

export interface SanitizedEngineFailure {
  engineId: string;
  domain: string;
  code: 'NOT_IMPLEMENTED' | 'ENGINE_FAILED';
}

export function sanitizeEngineFailures(failures: OrchestrationResult['failures']): SanitizedEngineFailure[] {
  return failures.map((failure) => ({
    engineId: failure.engineId,
    domain: failure.domain,
    code: /is not implemented/i.test(failure.error) ? 'NOT_IMPLEMENTED' : 'ENGINE_FAILED',
  }));
}

/** The failure list a response may carry, and whether the run was complete. Throws 503 when nothing ran. */
export function describeAggregateOutcome(result: OrchestrationResult): { failures: SanitizedEngineFailure[]; complete: boolean } {
  if (result.envelopes.length === 0 && result.failures.length > 0) {
    throw new ApiError(ErrorCode.SERVICE_UNAVAILABLE, 'No cognition engine produced a result.');
  }
  return { failures: sanitizeEngineFailures(result.failures), complete: result.failures.length === 0 };
}

const AGGREGATE_LIMIT = { limit: 12, window: 60, identifier: 'cognition-aggregate' } as const;

export async function limitAggregateRun(organizationId: string): Promise<void> {
  const decision = await checkRateLimit(`org:${organizationId}`, { ...AGGREGATE_LIMIT });
  if (!decision.allowed) throw ApiError.rateLimited(decision.resetIn);
}

/** A model-backed analysis sends every published interview to the provider, so a page load must not repeat it without bound. */
const MODEL_RUN_LIMIT = { limit: 10, window: 3600, identifier: 'succession-model-run' } as const;

export async function limitModelRun(organizationId: string): Promise<void> {
  const decision = await checkRateLimit(`org:${organizationId}`, { ...MODEL_RUN_LIMIT });
  if (!decision.allowed) throw ApiError.rateLimited(decision.resetIn);
}

const MEMO_TTL_MS = 30_000;
const MEMO_MAX_ENTRIES = 200;
// ga-check:exempt per-instance memo of a recomputable result: keyed by organization, 30 seconds, 200 entries at most, complete runs only, never a source of truth.
const memo = new Map<string, { at: number; result: OrchestrationResult }>();

export async function memoizeAggregateRun(
  organizationId: string,
  run: () => Promise<OrchestrationResult>,
  now: () => number = Date.now,
): Promise<OrchestrationResult> {
  const key = `full:${organizationId}`;
  const hit = memo.get(key);
  if (hit && now() - hit.at < MEMO_TTL_MS) return hit.result;
  const result = await run();
  if (result.failures.length === 0) {
    if (memo.size >= MEMO_MAX_ENTRIES) memo.delete(memo.keys().next().value as string);
    memo.set(key, { at: now(), result });
  }
  return result;
}

export function clearAggregateMemo(): void {
  memo.clear();
}
