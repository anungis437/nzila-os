import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../dispatch.js', () => ({
  dispatchWorkflow: vi.fn(async () => true),
}))

vi.mock('../platform.js', () => ({
  emitCommandEvent: vi.fn(async () => undefined),
}))

import {
  executeWorkflow,
  getWorkflowRun,
  listWorkflowRuns,
} from '../execution-engine.js'

function makeInput(overrides: Partial<Parameters<typeof executeWorkflow>[0]> = {}) {
  const requestId = crypto.randomUUID()
  const correlationId = crypto.randomUUID()
  const orgId = '11111111-1111-4111-8111-111111111111'

  return {
    workflowId: 'lint_check',
    orgId,
    requestId,
    initiatedBy: {
      actorId: 'test-actor',
      actorType: 'service' as const,
      orgId,
    },
    payload: { feature: 'engine-test' },
    executionContext: {
      dryRun: true,
      idempotencyKey: `idem-${requestId}`,
      priority: 'normal' as const,
    },
    correlationEnvelope: {
      requestId,
      correlationId,
      orgId,
      actorId: 'test-actor',
      initiatedAt: new Date().toISOString(),
    },
    ...overrides,
  }
}

describe('execution-engine', () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL
  })

  it('executes dry-run and deduplicates duplicate request IDs', async () => {
    const input = makeInput()

    const first = await executeWorkflow(input)
    const second = await executeWorkflow(input)

    expect(first.status).toBe('succeeded')
    expect(first.idempotent).toBe(false)
    expect(second.idempotent).toBe(true)
    expect(second.runId).toBe(first.runId)

    const persisted = await getWorkflowRun(first.runId)
    expect(persisted).not.toBeNull()
    expect(persisted?.orgId).toBe(input.orgId)
    expect(persisted?.requestId).toBe(input.requestId)
  })

  it('deduplicates concurrent duplicate requests', async () => {
    const input = makeInput()

    const results = await Promise.all(
      Array.from({ length: 25 }, () => executeWorkflow(input)),
    )

    const runIds = new Set(results.map((r) => r.runId))
    const primaryCount = results.filter((r) => !r.idempotent).length

    expect(runIds.size).toBe(1)
    expect(primaryCount).toBe(1)
    expect(results.every((r) => r.status === 'succeeded')).toBe(true)
  })

  it('rejects non-dry-run requests without authorization decision', async () => {
    const input = makeInput({
      executionContext: {
        dryRun: false,
        idempotencyKey: `idem-${crypto.randomUUID()}`,
        priority: 'normal',
      },
      authorizationDecisionId: undefined,
    })

    const result = await executeWorkflow(input)

    expect(result.status).toBe('failed')
    expect(result.failureClass).toBe('auth_failure')
    expect(result.failureMessage).toContain('Control Plane authorization')
  })

  it('lists runs with org filter', async () => {
    const orgA = '22222222-2222-4222-8222-222222222222'
    const orgB = '33333333-3333-4333-8333-333333333333'

    await executeWorkflow(makeInput({ orgId: orgA }))
    await executeWorkflow(makeInput({ orgId: orgB }))

    const orgARuns = await listWorkflowRuns({ orgId: orgA, limit: 20 })

    expect(orgARuns.length).toBeGreaterThan(0)
    for (const run of orgARuns) {
      expect(run.orgId).toBe(orgA)
    }
  })
})
