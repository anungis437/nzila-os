// ---------------------------------------------------------------------------
// @nzila/fsm-core  —  Platform event bridge
// ---------------------------------------------------------------------------
//
// Converts FSM transition results into PlatformEvent objects.
// Follows the same bridge pattern as @nzila/commerce-events.
// No bus dependency — returns event objects for the caller to emit.
// ---------------------------------------------------------------------------

import type { createPlatformEvent as CreateFn } from '@nzila/platform-events'
import type { TransitionSuccess, TransitionRecord } from './types'

/** Metadata required to bridge a transition into platform events. */
export interface TransitionEventMeta {
  readonly orgId: string
  readonly actorId: string
  readonly correlationId: string
  readonly causationId?: string | null
  readonly source?: string
}

/** Transition-completed event payload. */
export interface FsmTransitionPayload {
  readonly machineName: string
  readonly machineVersion: string
  readonly from: string
  readonly to: string
  readonly label: string
  readonly entityId: string
}

/**
 * Build platform events from a successful transition.
 *
 * Returns an array of events:
 *  1. One `fsm.transition.completed` envelope event (always)
 *  2. One event per `eventsToEmit` declared on the transition definition
 *
 * @param transition - The successful transition result
 * @param machineName - Name of the machine
 * @param machineVersion - Version of the machine
 * @param entityId - The entity that transitioned
 * @param meta - Org, actor, correlation metadata
 * @param createEvent - The createPlatformEvent factory (injected to avoid hard dep)
 */
export function platformEventsFromTransition(
  transition: TransitionSuccess,
  machineName: string,
  machineVersion: string,
  entityId: string,
  meta: TransitionEventMeta,
  createEvent: typeof CreateFn,
): ReturnType<typeof CreateFn>[] {
  const events: ReturnType<typeof CreateFn>[] = []

  // 1. Envelope event for every transition
  events.push(
    createEvent(
      'fsm.transition.completed',
      {
        machineName,
        machineVersion,
        from: transition.from,
        to: transition.to,
        label: transition.label,
        entityId,
      } satisfies FsmTransitionPayload,
      {
        orgId: meta.orgId,
        actorId: meta.actorId,
        correlationId: meta.correlationId,
        causationId: meta.causationId ?? null,
        source: meta.source ?? 'fsm-core',
      },
    ),
  )

  // 2. Domain-specific events declared on the transition
  for (const emitted of transition.eventsToEmit) {
    events.push(
      createEvent(
        emitted.type,
        emitted.payload,
        {
          orgId: meta.orgId,
          actorId: meta.actorId,
          correlationId: meta.correlationId,
          causationId: events[0]!.id, // caused by the envelope event
          source: meta.source ?? 'fsm-core',
        },
      ),
    )
  }

  return events
}

/**
 * Build a platform event from a TransitionRecord (audit record).
 * Useful for replaying or forwarding audit trail events.
 */
export function platformEventFromRecord(
  record: TransitionRecord,
  meta: TransitionEventMeta,
  createEvent: typeof CreateFn,
): ReturnType<typeof CreateFn> {
  return createEvent(
    'fsm.transition.recorded',
    {
      transitionId: record.transitionId,
      machineName: record.machineName,
      machineVersion: record.machineVersion,
      entityId: record.entityId,
      from: record.from,
      to: record.to,
      label: record.label,
      durationMs: record.durationMs,
    },
    {
      orgId: meta.orgId,
      actorId: meta.actorId,
      correlationId: meta.correlationId,
      causationId: meta.causationId ?? null,
      source: meta.source ?? 'fsm-core',
    },
  )
}
