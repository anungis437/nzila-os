/**
 * @nzila/commerce-events — Saga Orchestrator Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InMemoryEventBus, createDomainEvent } from './event-bus'
import { createSagaOrchestrator } from './saga'
import type {
  SagaDefinition,
  SagaStep,
  SagaContext,
  SagaStepResult,
} from './types'

// ── Fixtures ────────────────────────────────────────────────────────────────

const TEST_ORG = 'org-test-001'
const TEST_ACTOR = 'actor-test-001'

function makeCtx<T extends Record<string, unknown>>(
  data: T,
  overrides?: Partial<SagaContext<T>>,
): SagaContext<T> {
  return {
    sagaId: crypto.randomUUID(),
    correlationId: 'corr-001',
    orgId: TEST_ORG,
    actorId: TEST_ACTOR,
    data,
    ...overrides,
  }
}

function successStep(name: string, sideEffect?: () => void): SagaStep {
  return {
    name,
    execute: vi.fn(async () => {
      sideEffect?.()
      return { ok: true as const, data: { step: name } }
    }),
    compensate: vi.fn(async () => ({ ok: true as const, data: {} })),
  }
}

function failStep(name: string, error = 'Step failed'): SagaStep {
  return {
    name,
    execute: vi.fn(async (): Promise<SagaStepResult> => ({
      ok: false,
      error,
    })),
    compensate: vi.fn(async () => ({ ok: true as const, data: {} })),
  }
}

function throwStep(name: string): SagaStep {
  return {
    name,
    execute: vi.fn(async () => { throw new Error('Unexpected crash') }),
    compensate: vi.fn(async () => ({ ok: true as const, data: {} })),
  }
}

function throwNonErrorStep(name: string): SagaStep {
  return {
    name,
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    execute: vi.fn(async () => { throw 'string crash' }),
    compensate: vi.fn(async () => ({ ok: true as const, data: {} })),
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('SagaOrchestrator', () => {
  let bus: InMemoryEventBus
  let orchestrator: ReturnType<typeof createSagaOrchestrator>

  beforeEach(() => {
    bus = new InMemoryEventBus()
    orchestrator = createSagaOrchestrator(bus)
  })

  describe('API surface', () => {
    it('exposes register, execute, registeredSagas, executions, clearHistory', () => {
      expect(orchestrator).toHaveProperty('register')
      expect(orchestrator).toHaveProperty('execute')
      expect(orchestrator).toHaveProperty('registeredSagas')
      expect(orchestrator).toHaveProperty('executions')
      expect(orchestrator).toHaveProperty('clearHistory')
    })
  })

  describe('execute — happy path', () => {
    it('runs all steps and returns completed', async () => {
      const step1 = successStep('create-order')
      const step2 = successStep('create-invoice')
      const saga: SagaDefinition = {
        name: 'quote-to-order',
        triggerEvent: 'quote.accepted',
        steps: [step1, step2],
      }

      const result = await orchestrator.execute(saga, makeCtx({}))

      expect(result.status).toBe('completed')
      expect(result.stepsCompleted).toEqual(['create-order', 'create-invoice'])
      expect(result.stepsCompensated).toEqual([])
      expect(result.error).toBeNull()
      expect(result.completedAt).not.toBeNull()
      expect(step1.execute).toHaveBeenCalledTimes(1)
      expect(step2.execute).toHaveBeenCalledTimes(1)
    })

    it('shares context across steps', async () => {
      const step1: SagaStep<{ orderId?: string }> = {
        name: 'create-order',
        execute: vi.fn(async (ctx) => {
          ctx.data.orderId = 'order-123'
          return { ok: true as const, data: {} }
        }),
        compensate: vi.fn(async () => ({ ok: true as const, data: {} })),
      }
      const step2: SagaStep<{ orderId?: string }> = {
        name: 'create-invoice',
        execute: vi.fn(async (ctx) => {
          expect(ctx.data.orderId).toBe('order-123')
          return { ok: true as const, data: {} }
        }),
        compensate: vi.fn(async () => ({ ok: true as const, data: {} })),
      }

      const saga: SagaDefinition<{ orderId?: string }> = {
        name: 'quote-to-order',
        triggerEvent: 'quote.accepted',
        steps: [step1, step2],
      }

      const result = await orchestrator.execute(
        saga,
        makeCtx<{ orderId?: string }>({}),
      )
      expect(result.status).toBe('completed')
    })
  })

  describe('execute — failure + compensation', () => {
    it('compensates completed steps in reverse order on failure', async () => {
      const compensationOrder: string[] = []
      const step1: SagaStep = {
        name: 'step-1',
        execute: vi.fn(async () => ({ ok: true as const, data: {} })),
        compensate: vi.fn(async () => {
          compensationOrder.push('step-1')
          return { ok: true as const, data: {} }
        }),
      }
      const step2: SagaStep = {
        name: 'step-2',
        execute: vi.fn(async () => ({ ok: true as const, data: {} })),
        compensate: vi.fn(async () => {
          compensationOrder.push('step-2')
          return { ok: true as const, data: {} }
        }),
      }
      const step3 = failStep('step-3', 'Database down')

      const saga: SagaDefinition = {
        name: 'test-saga',
        triggerEvent: 'test',
        steps: [step1, step2, step3],
      }

      const result = await orchestrator.execute(saga, makeCtx({}))

      expect(result.status).toBe('compensated')
      expect(result.stepsCompleted).toEqual(['step-1', 'step-2'])
      expect(result.stepsCompensated).toEqual(['step-2', 'step-1'])
      expect(result.error).toContain('step-3')
      expect(result.error).toContain('Database down')
      expect(compensationOrder).toEqual(['step-2', 'step-1'])
    })

    it('reports failed status when compensation itself fails', async () => {
      const step1: SagaStep = {
        name: 'step-1',
        execute: vi.fn(async () => ({ ok: true as const, data: {} })),
        compensate: vi.fn(async (): Promise<SagaStepResult> => ({
          ok: false,
          error: 'Cannot compensate',
        })),
      }
      const step2 = failStep('step-2')

      const saga: SagaDefinition = {
        name: 'test-saga',
        triggerEvent: 'test',
        steps: [step1, step2],
      }

      const result = await orchestrator.execute(saga, makeCtx({}))

      // step-1 compensation returned ok: false, so it's not in stepsCompensated
      expect(result.status).toBe('failed')
      expect(result.stepsCompensated).toEqual([])
    })

    it('handles thrown errors in execute as failures', async () => {
      const step1 = successStep('step-1')
      const step2 = throwStep('step-2')

      const saga: SagaDefinition = {
        name: 'test-saga',
        triggerEvent: 'test',
        steps: [step1, step2],
      }

      const result = await orchestrator.execute(saga, makeCtx({}))

      expect(result.status).toBe('compensated')
      expect(result.error).toContain('step-2')
      expect(result.error).toContain('Unexpected crash')
      expect(step1.compensate).toHaveBeenCalledTimes(1)
    })

    it('does not compensate steps that never ran', async () => {
      const step1 = failStep('step-1')
      const step2 = successStep('step-2')

      const saga: SagaDefinition = {
        name: 'test-saga',
        triggerEvent: 'test',
        steps: [step1, step2],
      }

      const result = await orchestrator.execute(saga, makeCtx({}))

      expect(result.stepsCompleted).toEqual([])
      expect(result.stepsCompensated).toEqual([])
      expect(step2.execute).not.toHaveBeenCalled()
      expect(step2.compensate).not.toHaveBeenCalled()
    })
  })

  describe('register — event-driven trigger', () => {
    it('auto-executes saga when trigger event fires', async () => {
      const step1 = successStep('auto-step')
      const saga: SagaDefinition = {
        name: 'auto-saga',
        triggerEvent: 'quote.accepted',
        steps: [step1],
      }

      orchestrator.register(saga)

      // Emit the trigger event
      await bus.emitAndWait(
        createDomainEvent('quote.accepted', { quoteId: 'q-1' }, {
          orgId: TEST_ORG,
          actorId: TEST_ACTOR,
          correlationId: 'corr-auto',
        }),
      )

      // Give the async handler a moment to complete
      await new Promise((r) => setTimeout(r, 50))

      expect(step1.execute).toHaveBeenCalledTimes(1)
      expect(orchestrator.executions().length).toBeGreaterThanOrEqual(1)
    })

    it('unregister prevents future trigger execution', async () => {
      const step1 = successStep('step')
      const saga: SagaDefinition = {
        name: 'removable',
        triggerEvent: 'test.event',
        steps: [step1],
      }

      const unsub = orchestrator.register(saga)
      unsub()

      await bus.emitAndWait(
        createDomainEvent('test.event', {}, {
          orgId: TEST_ORG,
          actorId: TEST_ACTOR,
          correlationId: 'c',
        }),
      )

      expect(step1.execute).not.toHaveBeenCalled()
    })
  })

  describe('registeredSagas', () => {
    it('returns names of registered sagas', () => {
      const saga1: SagaDefinition = { name: 'saga-a', triggerEvent: 'a', steps: [] }
      const saga2: SagaDefinition = { name: 'saga-b', triggerEvent: 'b', steps: [] }

      orchestrator.register(saga1)
      orchestrator.register(saga2)

      expect(orchestrator.registeredSagas()).toContain('saga-a')
      expect(orchestrator.registeredSagas()).toContain('saga-b')
    })
  })

  describe('executions + clearHistory', () => {
    it('records executions', async () => {
      const saga: SagaDefinition = {
        name: 'tracked',
        triggerEvent: 'x',
        steps: [successStep('s')],
      }

      await orchestrator.execute(saga, makeCtx({}))
      await orchestrator.execute(saga, makeCtx({}))

      expect(orchestrator.executions()).toHaveLength(2)
      expect(orchestrator.executions()[0]!.sagaName).toBe('tracked')
    })

    it('clearHistory empties execution list', async () => {
      const saga: SagaDefinition = {
        name: 'clear-me',
        triggerEvent: 'x',
        steps: [successStep('s')],
      }

      await orchestrator.execute(saga, makeCtx({}))
      expect(orchestrator.executions()).toHaveLength(1)

      orchestrator.clearHistory()
      expect(orchestrator.executions()).toHaveLength(0)
    })
  })

  describe('execution record', () => {
    it('carries correct metadata', async () => {
      const saga: SagaDefinition = {
        name: 'metadata-test',
        triggerEvent: 'x',
        steps: [successStep('s')],
      }

      const ctx = makeCtx({}, {
        sagaId: 'saga-123',
        correlationId: 'corr-456',
        orgId: 'org-789',
        actorId: 'actor-abc',
      })

      const result = await orchestrator.execute(saga, ctx)

      expect(result.sagaId).toBe('saga-123')
      expect(result.sagaName).toBe('metadata-test')
      expect(result.correlationId).toBe('corr-456')
      expect(result.orgId).toBe('org-789')
      expect(result.actorId).toBe('actor-abc')
      expect(result.startedAt).toBeTruthy()
    })
  })

  describe('empty saga', () => {
    it('completes with no steps', async () => {
      const saga: SagaDefinition = {
        name: 'empty',
        triggerEvent: 'x',
        steps: [],
      }

      const result = await orchestrator.execute(saga, makeCtx({}))
      expect(result.status).toBe('completed')
      expect(result.stepsCompleted).toEqual([])
    })
  })

  describe('execute — compensation throws', () => {
    it('handles thrown error during compensation', async () => {
      const step1: SagaStep = {
        name: 'step-1',
        execute: vi.fn(async () => ({ ok: true as const, data: {} })),
        compensate: vi.fn(async () => { throw new Error('Compensate exploded') }),
      }
      const step2 = failStep('step-2')

      const saga: SagaDefinition = {
        name: 'throw-compensate',
        triggerEvent: 'test',
        steps: [step1, step2],
      }

      const result = await orchestrator.execute(saga, makeCtx({}))

      expect(result.status).toBe('failed')
      expect(result.stepsCompensated).toEqual([])
      expect(step1.compensate).toHaveBeenCalledTimes(1)
    })

    it('continues compensating remaining steps when one throws', async () => {
      const step1: SagaStep = {
        name: 'step-1',
        execute: vi.fn(async () => ({ ok: true as const, data: {} })),
        compensate: vi.fn(async () => ({ ok: true as const, data: {} })),
      }
      const step2: SagaStep = {
        name: 'step-2',
        execute: vi.fn(async () => ({ ok: true as const, data: {} })),
        compensate: vi.fn(async () => { throw new Error('Compensate exploded') }),
      }
      const step3 = failStep('step-3')

      const saga: SagaDefinition = {
        name: 'partial-compensate',
        triggerEvent: 'test',
        steps: [step1, step2, step3],
      }

      const result = await orchestrator.execute(saga, makeCtx({}))

      // step-2 compensation threw (so not in stepsCompensated), but step-1 compensation succeeded
      expect(result.status).toBe('failed')
      expect(result.stepsCompensated).toEqual(['step-1'])
      expect(step1.compensate).toHaveBeenCalledTimes(1)
      expect(step2.compensate).toHaveBeenCalledTimes(1)
    })

    it('captures non-Error thrown values via String(err)', async () => {
      const step1 = successStep('ok-step')
      const step2 = throwNonErrorStep('string-throw')

      const saga: SagaDefinition = {
        name: 'non-error-throw',
        triggerEvent: 'test',
        steps: [step1, step2],
      }

      const result = await orchestrator.execute(saga, makeCtx({}))

      expect(result.status).toBe('compensated')
      expect(result.error).toBe('Step "string-throw" failed: string crash')
      expect(step1.compensate).toHaveBeenCalledTimes(1)
    })
  })
})
