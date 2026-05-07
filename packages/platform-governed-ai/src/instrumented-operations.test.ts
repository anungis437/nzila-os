import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeInstrumentedAIRun } from '../src/instrumented-operations'
import { createInMemoryAIRunStore, createNullPolicyEvaluator } from '../src/memory-store'
import type { AIModelProvider, AIRunRequest } from '../src/types'

// ── Helpers ─────────────────────────────────────────────────────────────────

function createMockProvider(overrides: Partial<AIModelProvider> = {}): AIModelProvider {
  return {
    modelId: 'gpt-4',
    modelVersion: '1.0',
    async invoke(_input) {
      return {
        output: { result: 'mock-output' },
        confidence: 0.92,
        reasoning: 'mock reasoning chain',
        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      }
    },
    ...overrides,
  }
}

function createTestRequest(overrides: Partial<AIRunRequest> = {}): AIRunRequest {
  return {
    tenantId: 'tenant-1',
    operationType: 'classify',
    modelId: 'gpt-4',
    entityType: 'policy',
    resourceId: 'policy-123',
    input: { text: 'test input' },
    requestedBy: 'test-user',
    ...overrides,
  }
}

describe('executeInstrumentedAIRun', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('completes a successful AI run with telemetry', async () => {
    const store = createInMemoryAIRunStore()
    const provider = createMockProvider()
    const policyEvaluator = createNullPolicyEvaluator()
    const request = createTestRequest()

    const result = await executeInstrumentedAIRun({
      store,
      provider,
      policyEvaluator,
      request,
    })

    expect(result.status).toBe('completed')
    expect(result.confidence).toBe(0.92)
    expect(result.output).toEqual({ result: 'mock-output' })
    expect(result.tenantId).toBe('tenant-1')
    expect(result.operationType).toBe('classify')
  })

  it('records policy-blocked runs', async () => {
    const store = createInMemoryAIRunStore()
    const provider = createMockProvider()
    const policyEvaluator = {
      async evaluate() {
        return [
          { policyId: 'pol-1', policyName: 'data-residency', satisfied: false, reason: 'Region not allowed' },
        ]
      },
    }
    const request = createTestRequest()

    const result = await executeInstrumentedAIRun({
      store,
      provider,
      policyEvaluator,
      request,
    })

    expect(result.status).toBe('rejected_by_policy')
    expect(result.reasoning).toContain('data-residency')
  })

  it('records failed AI runs', async () => {
    const store = createInMemoryAIRunStore()
    const provider = createMockProvider({
      async invoke() {
        throw new Error('model-error')
      },
    })
    const policyEvaluator = createNullPolicyEvaluator()
    const request = createTestRequest()

    const result = await executeInstrumentedAIRun({
      store,
      provider,
      policyEvaluator,
      request,
    })

    expect(result.status).toBe('failed')
    expect(result.reasoning).toBe('model-error')
  })

  it('includes evidence in telemetry', async () => {
    const store = createInMemoryAIRunStore()
    const provider = createMockProvider()
    const policyEvaluator = createNullPolicyEvaluator()
    const request = createTestRequest()

    const result = await executeInstrumentedAIRun({
      store,
      provider,
      policyEvaluator,
      request,
      evidence: [
        { id: 'ev-1', sourceType: 'document', sourceId: 'doc-1', excerpt: 'evidence text', relevanceScore: 0.95 },
      ],
    })

    expect(result.status).toBe('completed')
    expect(result.evidence).toHaveLength(1)
  })

  it('persists the run to the store', async () => {
    const store = createInMemoryAIRunStore()
    const provider = createMockProvider()
    const policyEvaluator = createNullPolicyEvaluator()
    const request = createTestRequest()

    const result = await executeInstrumentedAIRun({
      store,
      provider,
      policyEvaluator,
      request,
    })

    const fetched = await store.getRun(result.id)
    expect(fetched).toBeDefined()
    expect(fetched!.id).toBe(result.id)
  })
})
