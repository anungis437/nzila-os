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
  })

  describe('listRegisteredWorkflows', () => {
    it('returns all registered workflows', () => {
      const list = listRegisteredWorkflows()
      expect(list.length).toBeGreaterThan(0)
    })
  })
})
