/**
 * @nzila/zonga-control-plane — Orchestrator Tests
 *
 * Tests multi-step workflow execution, retry, compensation,
 * and error scenarios.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  registerWorkflow,
  executeWorkflow,
  getWorkflowDefinition,
  listRegisteredWorkflows,
  WorkflowNotFoundError,
  WorkflowBypassError,
} from './orchestrator'
import type {
  ControlPlaneContext,
  WorkflowDefinition,
  WorkflowStepResult,
  WorkflowId,
} from './types'
import { WorkflowExecutionStatus } from './types'
import { clearEventLog, getEventLog } from './system-events'

function makeContext(overrides?: Partial<ControlPlaneContext>): ControlPlaneContext {
  return {
    orgId: 'org-test',
    actorId: 'actor-test',
    actorRole: 'admin',
    correlationId: 'corr-test',
    requestId: 'req-test',
    timestamp: new Date(),
    ...overrides,
  }
}

function makeStepDef(
  id: string,
  opts?: {
    shouldFail?: boolean
    shouldRetryOnce?: boolean
    output?: Record<string, unknown>
    onCompensate?: () => void
  },
) {
  let callCount = 0
  return {
    id,
    name: `Step ${id}`,
    maxRetries: opts?.shouldRetryOnce ? 1 : 0,
    timeoutMs: 5000,
    execute: vi.fn(async (): Promise<WorkflowStepResult> => {
      callCount++
      if (opts?.shouldRetryOnce && callCount === 1) {
        return { success: false, error: 'Transient failure', shouldRetry: true }
      }
      if (opts?.shouldFail) {
        return { success: false, error: `Step ${id} failed` }
      }
      return { success: true, output: opts?.output ?? { stepId: id } }
    }),
    compensate: opts?.onCompensate
      ? vi.fn(async () => { opts.onCompensate!() })
      : undefined,
  }
}

// We need to reset the workflow registry between tests.
// The module uses a private Map, so we register unique IDs per test.
let testCounter = 0
function uniqueId(): string {
  testCounter++
  return `test_workflow_${testCounter}`
}

describe('@nzila/zonga-control-plane — orchestrator', () => {
  beforeEach(() => {
    clearEventLog()
  })

  describe('registerWorkflow', () => {
    it('registers a workflow definition', () => {
      const id = uniqueId()
      const def: WorkflowDefinition = {
        id: id as WorkflowId,
        name: 'Test Workflow',
        description: 'For testing',
        steps: [makeStepDef('step1')],
        maxRetries: 0,
        timeoutMs: 10000,
      }
      registerWorkflow(def)
      expect(getWorkflowDefinition(id)).toBe(def)
    })

    it('throws when registering duplicate workflow ID', () => {
      const id = uniqueId()
      const def: WorkflowDefinition = {
        id: id as WorkflowId,
        name: 'Dup',
        description: 'Dup',
        steps: [],
        maxRetries: 0,
        timeoutMs: 1000,
      }
      registerWorkflow(def)
      expect(() => registerWorkflow(def)).toThrow(/already registered/)
    })
  })

  describe('executeWorkflow', () => {
    it('completes a single-step workflow', async () => {
      const id = uniqueId()
      registerWorkflow({
        id: id as WorkflowId,
        name: 'Single Step',
        description: 'One step',
        steps: [makeStepDef('s1', { output: { done: true } })],
        maxRetries: 0,
        timeoutMs: 5000,
      })

      const execution = await executeWorkflow(id, makeContext(), { test: true })
      expect(execution.status).toBe(WorkflowExecutionStatus.COMPLETED)
      expect(execution.output).toEqual({ done: true })
      expect(execution.steps[0]!.status).toBe('completed')
    })

    it('completes a multi-step workflow in order', async () => {
      const id = uniqueId()
      const order: string[] = []
      registerWorkflow({
        id: id as WorkflowId,
        name: 'Multi Step',
        description: 'Three steps',
        steps: [
          {
            ...makeStepDef('s1'),
            execute: vi.fn(async () => { order.push('s1'); return { success: true, output: { step: 1 } } }),
          },
          {
            ...makeStepDef('s2'),
            execute: vi.fn(async () => { order.push('s2'); return { success: true, output: { step: 2 } } }),
          },
          {
            ...makeStepDef('s3'),
            execute: vi.fn(async () => { order.push('s3'); return { success: true, output: { step: 3 } } }),
          },
        ],
        maxRetries: 0,
        timeoutMs: 10000,
      })

      const execution = await executeWorkflow(id, makeContext(), {})
      expect(execution.status).toBe(WorkflowExecutionStatus.COMPLETED)
      expect(order).toEqual(['s1', 's2', 's3'])
    })

    it('compensates on step failure (rollback)', async () => {
      const id = uniqueId()
      const compensated: string[] = []

      registerWorkflow({
        id: id as WorkflowId,
        name: 'With Rollback',
        description: 'Fails at step 3, rolls back step 1 and 2',
        steps: [
          makeStepDef('s1', { output: { a: 1 }, onCompensate: () => compensated.push('s1') }),
          makeStepDef('s2', { output: { b: 2 }, onCompensate: () => compensated.push('s2') }),
          makeStepDef('s3-fail', { shouldFail: true }),
        ],
        maxRetries: 0,
        timeoutMs: 10000,
      })

      const execution = await executeWorkflow(id, makeContext(), {})
      expect(execution.status).toBe(WorkflowExecutionStatus.COMPENSATED)
      expect(execution.error).toContain('s3-fail failed')
      // Compensation happens in reverse order
      expect(compensated).toEqual(['s2', 's1'])
    })

    it('retries a step on transient failure', async () => {
      const id = uniqueId()
      registerWorkflow({
        id: id as WorkflowId,
        name: 'With Retry',
        description: 'Retries step once',
        steps: [
          makeStepDef('s1-retry', { shouldRetryOnce: true, output: { recovered: true } }),
        ],
        maxRetries: 0,
        timeoutMs: 5000,
      })

      const execution = await executeWorkflow(id, makeContext(), {})
      expect(execution.status).toBe(WorkflowExecutionStatus.COMPLETED)
      expect(execution.output).toEqual({ recovered: true })
    })

    it('throws WorkflowNotFoundError for unknown workflow', async () => {
      await expect(
        executeWorkflow('nonexistent_workflow', makeContext(), {}),
      ).rejects.toThrow(WorkflowNotFoundError)
    })

    it('emits system events for start, step completion, and workflow completion', async () => {
      const id = uniqueId()
      registerWorkflow({
        id: id as WorkflowId,
        name: 'Events Test',
        description: 'Check events',
        steps: [makeStepDef('s1')],
        maxRetries: 0,
        timeoutMs: 5000,
      })

      await executeWorkflow(id, makeContext(), {})
      const events = getEventLog()
      const types = events.map(e => e.type)
      expect(types).toContain('workflow.started')
      expect(types).toContain('workflow.step_completed')
      expect(types).toContain('workflow.completed')
    })

    it('handles step that throws an exception', async () => {
      const id = uniqueId()
      registerWorkflow({
        id: id as WorkflowId,
        name: 'Throwing Step',
        description: 'Step throws instead of returning failure',
        steps: [
          {
            id: 's-throw',
            name: 'Throwing step',
            maxRetries: 0,
            timeoutMs: 5000,
            execute: vi.fn(async () => { throw new Error('Unexpected crash') }),
          },
        ],
        maxRetries: 0,
        timeoutMs: 5000,
      })

      const execution = await executeWorkflow(id, makeContext(), {})
      expect(execution.status).toBe(WorkflowExecutionStatus.COMPENSATED)
      expect(execution.error).toContain('Unexpected crash')
    })

    it('handles step that throws a non-Error value', async () => {
      const id = uniqueId()
      registerWorkflow({
        id: id as WorkflowId,
        name: 'Throwing String',
        description: 'Step throws a string',
        steps: [
          {
            id: 's-throw-str',
            name: 'String throw step',
            maxRetries: 0,
            timeoutMs: 5000,
            execute: vi.fn(async () => { throw 'string error' }),
          },
        ],
        maxRetries: 0,
        timeoutMs: 5000,
      })

      const execution = await executeWorkflow(id, makeContext(), {})
      expect(execution.status).toBe(WorkflowExecutionStatus.COMPENSATED)
      expect(execution.error).toContain('string error')
    })

    it('skips compensation for steps without compensate function', async () => {
      const id = uniqueId()
      const compensated: string[] = []

      registerWorkflow({
        id: id as WorkflowId,
        name: 'Skip Compensate',
        description: 'First step has no compensate, second does, third fails',
        steps: [
          {
            id: 's1-no-comp',
            name: 'No compensate',
            maxRetries: 0,
            timeoutMs: 5000,
            execute: vi.fn(async () => ({ success: true, output: { a: 1 } })),
            // no compensate function
          },
          makeStepDef('s2-comp', { output: { b: 2 }, onCompensate: () => compensated.push('s2') }),
          makeStepDef('s3-fail', { shouldFail: true }),
        ],
        maxRetries: 0,
        timeoutMs: 10000,
      })

      const execution = await executeWorkflow(id, makeContext(), {})
      expect(execution.status).toBe(WorkflowExecutionStatus.COMPENSATED)
      // Only s2 should be compensated; s1 should be skipped
      expect(compensated).toEqual(['s2'])
      expect(execution.steps[0]!.status).toBe('skipped')
    })

    it('handles compensation failure gracefully', async () => {
      const id = uniqueId()

      registerWorkflow({
        id: id as WorkflowId,
        name: 'Compensation Failure',
        description: 'Compensation itself throws',
        steps: [
          {
            id: 's1-comp-fail',
            name: 'Bad compensate',
            maxRetries: 0,
            timeoutMs: 5000,
            execute: vi.fn(async () => ({ success: true, output: { a: 1 } })),
            compensate: vi.fn(async () => { throw new Error('Rollback failed') }),
          },
          makeStepDef('s2-fail', { shouldFail: true }),
        ],
        maxRetries: 0,
        timeoutMs: 10000,
      })

      const execution = await executeWorkflow(id, makeContext(), {})
      expect(execution.status).toBe(WorkflowExecutionStatus.COMPENSATED)
      expect(execution.steps[0]!.status).toBe('failed')
      expect(execution.steps[0]!.error).toContain('Compensation failed')
    })

    it('retries step that throws then succeeds', async () => {
      const id = uniqueId()
      let callCount = 0

      registerWorkflow({
        id: id as WorkflowId,
        name: 'Retry After Throw',
        description: 'Step throws on first attempt, succeeds on retry',
        steps: [
          {
            id: 's-retry-throw',
            name: 'Retry throw step',
            maxRetries: 1,
            timeoutMs: 5000,
            execute: vi.fn(async () => {
              callCount++
              if (callCount === 1) throw new Error('Transient')
              return { success: true, output: { recovered: true } }
            }),
          },
        ],
        maxRetries: 0,
        timeoutMs: 5000,
      })

      const execution = await executeWorkflow(id, makeContext(), {})
      expect(execution.status).toBe(WorkflowExecutionStatus.COMPLETED)
      expect(callCount).toBe(2)
    })

    it('step returns failure without shouldRetry stops immediately', async () => {
      const id = uniqueId()
      const executeFn = vi.fn(async () => ({
        success: false as const,
        error: 'Permanent failure',
        shouldRetry: false,
      }))

      registerWorkflow({
        id: id as WorkflowId,
        name: 'No Retry',
        description: 'Step fails without shouldRetry',
        steps: [
          { id: 's-no-retry', name: 'No retry', maxRetries: 3, timeoutMs: 5000, execute: executeFn },
        ],
        maxRetries: 0,
        timeoutMs: 5000,
      })

      const execution = await executeWorkflow(id, makeContext(), {})
      expect(execution.status).toBe(WorkflowExecutionStatus.COMPENSATED)
      expect(executeFn).toHaveBeenCalledTimes(1)
    })

    it('exhausts all retries and returns last error', async () => {
      const id = uniqueId()
      const executeFn = vi.fn(async () => ({
        success: false as const,
        error: 'Still failing',
        shouldRetry: true,
      }))

      registerWorkflow({
        id: id as WorkflowId,
        name: 'All Retries Fail',
        description: 'Step fails on every retry attempt',
        steps: [
          { id: 's-exhaust', name: 'Exhaust retries', maxRetries: 2, timeoutMs: 5000, execute: executeFn },
        ],
        maxRetries: 0,
        timeoutMs: 5000,
      })

      const execution = await executeWorkflow(id, makeContext(), {})
      expect(execution.status).toBe(WorkflowExecutionStatus.COMPENSATED)
      expect(execution.error).toContain('Still failing')
      // 1 initial + 2 retries = 3 calls
      expect(executeFn).toHaveBeenCalledTimes(3)
    })

    it('returns default error when all retries fail without error field', async () => {
      const id = uniqueId()
      const executeFn = vi.fn(async () => ({
        success: false as const,
        shouldRetry: true,
      }))

      registerWorkflow({
        id: id as WorkflowId,
        name: 'No Error Field',
        description: 'Step fails without providing error field',
        steps: [
          { id: 's-no-err', name: 'No error', maxRetries: 1, timeoutMs: 5000, execute: executeFn },
        ],
        maxRetries: 0,
        timeoutMs: 5000,
      })

      const execution = await executeWorkflow(id, makeContext(), {})
      expect(execution.status).toBe(WorkflowExecutionStatus.COMPENSATED)
      expect(execution.error).toBe('Step failed after all retries')
    })

    it('handles compensation that throws a non-Error value', async () => {
      const id = uniqueId()

      registerWorkflow({
        id: id as WorkflowId,
        name: 'Non-Error Compensation',
        description: 'Compensation throws a string',
        steps: [
          {
            id: 's1-str-comp',
            name: 'String compensate',
            maxRetries: 0,
            timeoutMs: 5000,
            execute: vi.fn(async () => ({ success: true, output: { a: 1 } })),
            compensate: vi.fn(async () => { throw 'non-error rollback' }),
          },
          makeStepDef('s2-fail', { shouldFail: true }),
        ],
        maxRetries: 0,
        timeoutMs: 10000,
      })

      const execution = await executeWorkflow(id, makeContext(), {})
      expect(execution.status).toBe(WorkflowExecutionStatus.COMPENSATED)
      expect(execution.steps[0]!.error).toContain('non-error rollback')
    })
  })

  describe('WorkflowBypassError', () => {
    it('includes operation and required workflow in message', () => {
      const err = new WorkflowBypassError('direct_payout', 'payout_settlement_flow')
      expect(err.name).toBe('WorkflowBypassError')
      expect(err.operation).toBe('direct_payout')
      expect(err.requiredWorkflow).toBe('payout_settlement_flow')
      expect(err.message).toContain('direct_payout')
      expect(err.message).toContain('payout_settlement_flow')
    })
  })

  describe('listRegisteredWorkflows', () => {
    it('returns all registered workflows', () => {
      const list = listRegisteredWorkflows()
      expect(list.length).toBeGreaterThan(0)
    })
  })
})
