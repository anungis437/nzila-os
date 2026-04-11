/**
 * @nzila/pilot-mode — Event Bridge
 *
 * Converts pilot flag operations into platform events.
 * Pure functions — accepts createPlatformEvent as a dependency.
 *
 * @module @nzila/pilot-mode/events
 */
import type { PlatformEvent } from '@nzila/platform-events'
import type { PilotEvaluation, PilotFlagDef, PilotCohort } from './types'

// ── Event Metadata ──────────────────────────────────────────────────────────

export interface PilotEventMeta {
  readonly orgId: string
  readonly actorId: string
  readonly correlationId?: string
  readonly causationId?: string
  readonly source?: string
}

// ── Payloads ────────────────────────────────────────────────────────────────

export interface FlagEvaluatedPayload {
  readonly flagName: string
  readonly enabled: boolean
  readonly reason: string
  readonly orgId: string
  readonly userId: string
}

export interface CohortEnrolledPayload {
  readonly cohortId: string
  readonly cohortName: string
  readonly orgIds: readonly string[]
  readonly enrolledBy: string
}

export interface FlagChangedPayload {
  readonly flagName: string
  readonly change: 'registered' | 'updated' | 'removed'
  readonly strategy: string
  readonly orgId: string
}

// ── Event Factories ─────────────────────────────────────────────────────────

type CreatePlatformEvent = <T>(
  type: string,
  payload: T,
  metadata: Record<string, unknown>,
  schemaVersion?: string,
) => PlatformEvent<T>

/**
 * Create an event when a pilot flag is evaluated for a material action.
 */
export function flagEvaluatedEvent(
  createEvent: CreatePlatformEvent,
  evaluation: PilotEvaluation,
  context: { orgId: string; userId: string },
  meta: PilotEventMeta,
): PlatformEvent<FlagEvaluatedPayload> {
  return createEvent<FlagEvaluatedPayload>(
    'pilot.flag.evaluated',
    {
      flagName: evaluation.flag,
      enabled: evaluation.enabled,
      reason: evaluation.reason,
      orgId: context.orgId,
      userId: context.userId,
    },
    {
      orgId: meta.orgId,
      actorId: meta.actorId,
      correlationId: meta.correlationId,
      causationId: meta.causationId,
      source: meta.source ?? 'pilot-mode',
    },
  )
}

/**
 * Create an event when a cohort is enrolled.
 */
export function cohortEnrolledEvent(
  createEvent: CreatePlatformEvent,
  cohort: PilotCohort,
  meta: PilotEventMeta,
): PlatformEvent<CohortEnrolledPayload> {
  return createEvent<CohortEnrolledPayload>(
    'pilot.cohort.enrolled',
    {
      cohortId: cohort.id,
      cohortName: cohort.name,
      orgIds: cohort.orgIds,
      enrolledBy: meta.actorId,
    },
    {
      orgId: meta.orgId,
      actorId: meta.actorId,
      correlationId: meta.correlationId,
      source: meta.source ?? 'pilot-mode',
    },
  )
}

/**
 * Create an event when a pilot flag is registered/changed.
 */
export function flagChangedEvent(
  createEvent: CreatePlatformEvent,
  flag: PilotFlagDef,
  change: 'registered' | 'updated' | 'removed',
  meta: PilotEventMeta,
): PlatformEvent<FlagChangedPayload> {
  return createEvent<FlagChangedPayload>(
    'pilot.flag.changed',
    {
      flagName: flag.name,
      change,
      strategy: flag.strategy,
      orgId: meta.orgId,
    },
    {
      orgId: meta.orgId,
      actorId: meta.actorId,
      correlationId: meta.correlationId,
      source: meta.source ?? 'pilot-mode',
    },
  )
}
