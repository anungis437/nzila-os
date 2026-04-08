/**
 * @nzila/intelligence — Context
 *
 * Builds and enriches the IntelligenceContext that accompanies every
 * NIL request, merging caller-supplied overrides with platform defaults.
 */
import { randomUUID } from 'node:crypto'
import type { IntelligenceContext, IntelligenceRequest, DataClass } from './types.js'

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_ENVIRONMENT = 'production' as const
const DEFAULT_LOCALE = 'en' as const
const DEFAULT_DATA_CLASS: DataClass = 'internal'

// ── Builder ─────────────────────────────────────────────────────────────────

/**
 * Build a fully-resolved IntelligenceContext from a request.
 * Fills in sensible defaults for any fields the caller did not supply.
 */
export function buildContext(request: IntelligenceRequest): IntelligenceContext {
  const caller = request.context ?? {}

  return {
    actorId: caller.actorId,
    locale: caller.locale ?? DEFAULT_LOCALE,
    environment: caller.environment ?? DEFAULT_ENVIRONMENT,
    correlationId: caller.correlationId ?? randomUUID(),
    dataClass: caller.dataClass ?? DEFAULT_DATA_CLASS,
    metadata: {
      ...caller.metadata,
      orgId: request.orgId,
      app: request.app,
      useCase: request.useCase,
    },
  }
}

/**
 * Merge two contexts, with `overrides` taking precedence.
 */
export function mergeContexts(
  base: IntelligenceContext,
  overrides: Partial<IntelligenceContext>,
): IntelligenceContext {
  return {
    actorId: overrides.actorId ?? base.actorId,
    locale: overrides.locale ?? base.locale,
    environment: overrides.environment ?? base.environment,
    correlationId: overrides.correlationId ?? base.correlationId,
    dataClass: overrides.dataClass ?? base.dataClass,
    metadata: {
      ...base.metadata,
      ...overrides.metadata,
    },
  }
}
