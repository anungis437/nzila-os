/**
 * @nzila/onboarding-core — Event Bridge
 *
 * Converts onboarding engine results into platform events.
 * Pure functions — accepts createPlatformEvent as a dependency
 * (no hard coupling to the event bus).
 *
 * @module @nzila/onboarding-core/events
 */
import type { PlatformEvent } from '@nzila/platform-events'
import type { OnboardingProgress, StepResult } from './types'

// ── Event Metadata ──────────────────────────────────────────────────────────

export interface OnboardingEventMeta {
  readonly orgId: string
  readonly actorId: string
  readonly correlationId?: string
  readonly causationId?: string
  readonly source?: string
}

// ── Payloads ────────────────────────────────────────────────────────────────

export interface StepCompletedPayload {
  readonly flowId: string
  readonly stepName: string
  readonly outcome: string
  readonly orgId: string
  readonly actorId: string
  readonly percentComplete: number
}

export interface FlowCompletedPayload {
  readonly flowId: string
  readonly orgId: string
  readonly actorId: string
  readonly totalSteps: number
  readonly completedAt: string
}

// ── Event Factories ─────────────────────────────────────────────────────────

type CreatePlatformEvent = <T>(
  type: string,
  payload: T,
  metadata: Record<string, unknown>,
  schemaVersion?: string,
) => PlatformEvent<T>

/**
 * Create a platform event for a completed onboarding step.
 */
export function stepCompletedEvent(
  createEvent: CreatePlatformEvent,
  result: StepResult,
  progress: OnboardingProgress,
  meta: OnboardingEventMeta,
  percentComplete: number,
): PlatformEvent<StepCompletedPayload> {
  return createEvent<StepCompletedPayload>(
    'onboarding.step.completed',
    {
      flowId: progress.flowId,
      stepName: result.stepName,
      outcome: result.outcome,
      orgId: meta.orgId,
      actorId: meta.actorId,
      percentComplete,
    },
    {
      orgId: meta.orgId,
      actorId: meta.actorId,
      correlationId: meta.correlationId,
      causationId: meta.causationId,
      source: meta.source ?? 'onboarding-core',
    },
  )
}

/**
 * Create a platform event for a fully completed onboarding flow.
 */
export function flowCompletedEvent(
  createEvent: CreatePlatformEvent,
  progress: OnboardingProgress,
  meta: OnboardingEventMeta,
): PlatformEvent<FlowCompletedPayload> {
  const completions = Object.values(progress.completions)
  return createEvent<FlowCompletedPayload>(
    'onboarding.flow.completed',
    {
      flowId: progress.flowId,
      orgId: meta.orgId,
      actorId: meta.actorId,
      totalSteps: completions.length,
      completedAt: new Date().toISOString(),
    },
    {
      orgId: meta.orgId,
      actorId: meta.actorId,
      correlationId: meta.correlationId,
      causationId: meta.causationId,
      source: meta.source ?? 'onboarding-core',
    },
  )
}

/**
 * Convenience: create step event + optional flow event (if flow is now complete).
 */
export function onboardingEventsFromCompletion(
  createEvent: CreatePlatformEvent,
  result: StepResult,
  progress: OnboardingProgress,
  meta: OnboardingEventMeta,
  percentComplete: number,
  flowComplete: boolean,
): PlatformEvent<unknown>[] {
  const events: PlatformEvent<unknown>[] = []

  const stepEvt = stepCompletedEvent(createEvent, result, progress, meta, percentComplete)
  events.push(stepEvt)

  if (flowComplete) {
    const flowEvt = flowCompletedEvent(createEvent, progress, {
      ...meta,
      causationId: stepEvt.id,
    })
    events.push(flowEvt)
  }

  return events
}
