import { describe, it, expect } from 'vitest'
import {
  flowCompletedEvent,
  onboardingEventsFromCompletion,
  stepCompletedEvent,
} from './events'
import type { OnboardingProgress, StepResult } from './types'

let idCounter = 0
const createEvent = <T>(
  type: string,
  payload: T,
  metadata: Record<string, unknown>,
  schemaVersion = '1.0.0',
) => ({
  id: `evt-${++idCounter}`,
  type,
  payload,
  metadata,
  schemaVersion,
  occurredAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
})

const progress: OnboardingProgress = {
  orgId: 'org-1',
  flowId: 'default',
  status: 'in_progress',
  startedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  completions: {
    org_info: {
      stepName: 'org_info',
      completedAt: new Date('2026-01-01T00:01:00.000Z').toISOString(),
      completedBy: 'actor-1',
      data: {},
    },
  },
}

const stepResult: StepResult = {
  stepName: 'org_info',
  outcome: 'completed',
}

describe('onboarding events', () => {
  it('creates step completed events with source fallback', () => {
    const evt = stepCompletedEvent(
      createEvent,
      stepResult,
      progress,
      { orgId: 'org-1', actorId: 'actor-1', correlationId: 'corr-1' },
      25,
    )

    expect(evt.type).toBe('onboarding.step.completed')
    expect(evt.payload.percentComplete).toBe(25)
    expect(evt.metadata.source).toBe('onboarding-core')
  })

  it('creates flow completed events and sets optional source explicitly', () => {
    const evt = flowCompletedEvent(createEvent, progress, {
      orgId: 'org-1',
      actorId: 'actor-1',
      source: 'test-suite',
    })

    expect(evt.type).toBe('onboarding.flow.completed')
    expect(evt.payload.totalSteps).toBe(1)
    expect(evt.metadata.source).toBe('test-suite')
  })

  it('emits step only or step + flow based on completion flag', () => {
    const stepOnly = onboardingEventsFromCompletion(
      createEvent,
      stepResult,
      progress,
      { orgId: 'org-1', actorId: 'actor-1' },
      25,
      false,
    )
    expect(stepOnly).toHaveLength(1)

    const withFlow = onboardingEventsFromCompletion(
      createEvent,
      stepResult,
      progress,
      { orgId: 'org-1', actorId: 'actor-1' },
      100,
      true,
    )
    expect(withFlow).toHaveLength(2)
    expect(withFlow[1]?.metadata.causationId).toBe(withFlow[0]?.id)
  })
})
