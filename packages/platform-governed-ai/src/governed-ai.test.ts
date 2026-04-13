import { describe, it, expect, beforeEach } from 'vitest'
import {
  AIOperationTypes,
  AIRunStatuses,
  executeGovernedAIRun,
  getAIRunHistory,
  getAIRun,
  createInMemoryAIRunStore,
  createNullPolicyEvaluator,
  aiRunRecords,
  executeInstrumentedAIRun,
} from './index'
import type { AIRunStore, AIModelProvider, PolicyEvaluator } from './index'
import { OntologyEntityTypes } from '@nzila/platform-ontology'

const TENANT = '00000000-0000-0000-0000-000000000001'
const ENTITY_ID = '00000000-0000-0000-0000-000000000099'

function makeProvider(overrides: Partial<AIModelProvider> = {}): AIModelProvider {
  return {
    modelId: 'gpt-4o',
    modelVersion: '2024-08-06',
    async invoke(_input) {
      return {
        output: { recommendation: 'approve', reason: 'Low risk profile' },
        confidence: 0.92,
        reasoning: 'Based on credit history and income verification',
        tokenUsage: { promptTokens: 500, completionTokens: 100, totalTokens: 600 },
      }
    },
    ...overrides,
  }
}

describe('platform-governed-ai', () => {
  let store: AIRunStore

  beforeEach(() => {
    store = createInMemoryAIRunStore()
  })

  // ── Successful Execution ──────────────────────────────────────────

  describe('executeGovernedAIRun — success', () => {
    it('executes an AI run with no policy blocks', async () => {
      const run = await executeGovernedAIRun({
        store,
        provider: makeProvider(),
        policyEvaluator: createNullPolicyEvaluator(),
        request: {
          tenantId: TENANT,
          operationType: AIOperationTypes.RECOMMENDATION,
          modelId: 'gpt-4o',
          entityType: OntologyEntityTypes.CASE,
          entityId: ENTITY_ID,
          input: { caseData: { income: 50000 } },
          requestedBy: 'user-1',
        },
      })

      expect(run.status).toBe(AIRunStatuses.COMPLETED)
      expect(run.confidence).toBe(0.92)
      expect(run.output).toEqual({
        recommendation: 'approve',
        reason: 'Low risk profile',
      })
      expect(run.tokenUsage?.totalTokens).toBe(600)
      expect(run.latencyMs).toBeGreaterThanOrEqual(0)
    })

    it('persists the run in the store', async () => {
      const run = await executeGovernedAIRun({
        store,
        provider: makeProvider(),
        policyEvaluator: createNullPolicyEvaluator(),
        request: {
          tenantId: TENANT,
          operationType: AIOperationTypes.RISK_SCORING,
          modelId: 'risk-model-v2',
          entityType: OntologyEntityTypes.CASE,
          entityId: ENTITY_ID,
          input: {},
          requestedBy: 'user-1',
        },
      })

      const retrieved = await getAIRun(store, run.id)
      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(run.id)
    })
  })

  // ── Policy Rejection ──────────────────────────────────────────────

  describe('executeGovernedAIRun — policy rejection', () => {
    it('rejects when a policy is not satisfied', async () => {
      const strictEvaluator: PolicyEvaluator = {
        async evaluate() {
          return [
            {
              policyId: 'policy-pii-001',
              policyName: 'PII Data Policy',
              satisfied: false,
              reason: 'Input contains PII data that cannot be sent to external model',
            },
          ]
        },
      }

      const run = await executeGovernedAIRun({
        store,
        provider: makeProvider(),
        policyEvaluator: strictEvaluator,
        request: {
          tenantId: TENANT,
          operationType: AIOperationTypes.SUMMARIZATION,
          modelId: 'gpt-4o',
          entityType: OntologyEntityTypes.DOCUMENT,
          entityId: ENTITY_ID,
          input: { text: 'sensitive data' },
          requestedBy: 'user-1',
        },
      })

      expect(run.status).toBe(AIRunStatuses.REJECTED_BY_POLICY)
      expect(run.output).toBeNull()
      expect(run.reasoning).toContain('PII Data Policy')
    })
  })

  // ── Model Failure ─────────────────────────────────────────────────

  describe('executeGovernedAIRun — model failure', () => {
    it('records a FAILED status when model throws', async () => {
      const failingProvider = makeProvider({
        async invoke() {
          throw new Error('Model timeout')
        },
      })

      const run = await executeGovernedAIRun({
        store,
        provider: failingProvider,
        policyEvaluator: createNullPolicyEvaluator(),
        request: {
          tenantId: TENANT,
          operationType: AIOperationTypes.CLASSIFICATION,
          modelId: 'classifier-v1',
          entityType: OntologyEntityTypes.CASE,
          entityId: ENTITY_ID,
          input: {},
          requestedBy: 'user-1',
        },
      })

      expect(run.status).toBe(AIRunStatuses.FAILED)
      expect(run.reasoning).toContain('Model timeout')
    })
  })

  // ── History ───────────────────────────────────────────────────────

  describe('getAIRunHistory', () => {
    it('returns runs for a specific entity', async () => {
      await executeGovernedAIRun({
        store,
        provider: makeProvider(),
        policyEvaluator: createNullPolicyEvaluator(),
        request: {
          tenantId: TENANT,
          operationType: AIOperationTypes.RECOMMENDATION,
          modelId: 'gpt-4o',
          entityType: OntologyEntityTypes.CASE,
          entityId: ENTITY_ID,
          input: {},
          requestedBy: 'user-1',
        },
      })

      const history = await getAIRunHistory(
        store,
        OntologyEntityTypes.CASE,
        ENTITY_ID,
      )
      expect(history).toHaveLength(1)
    })
  })

  describe('in-memory store branches', () => {
    it('returns undefined for missing run and ignores updates for unknown ids', async () => {
      const missingBefore = await store.getRun('missing-run')
      expect(missingBefore).toBeUndefined()

      await store.updateRun('missing-run', { status: AIRunStatuses.FAILED })

      const missingAfter = await store.getRun('missing-run')
      expect(missingAfter).toBeUndefined()
    })

    it('filters by tenant and enforces limit', async () => {
      const provider = makeProvider()
      const policyEvaluator = createNullPolicyEvaluator()

      await executeGovernedAIRun({
        store,
        provider,
        policyEvaluator,
        request: {
          tenantId: TENANT,
          operationType: AIOperationTypes.CLASSIFICATION,
          modelId: 'classifier-v1',
          entityType: OntologyEntityTypes.CASE,
          entityId: ENTITY_ID,
          input: {},
          requestedBy: 'user-1',
        },
      })

      await executeGovernedAIRun({
        store,
        provider,
        policyEvaluator,
        request: {
          tenantId: TENANT,
          operationType: AIOperationTypes.RECOMMENDATION,
          modelId: 'gpt-4o',
          entityType: OntologyEntityTypes.CASE,
          entityId: ENTITY_ID,
          input: {},
          requestedBy: 'user-2',
        },
      })

      await executeGovernedAIRun({
        store,
        provider,
        policyEvaluator,
        request: {
          tenantId: '00000000-0000-0000-0000-000000000777',
          operationType: AIOperationTypes.SUMMARIZATION,
          modelId: 'gpt-4o',
          entityType: OntologyEntityTypes.CASE,
          entityId: ENTITY_ID,
          input: {},
          requestedBy: 'user-3',
        },
      })

      const tenantRuns = await store.getRunsByTenant(TENANT, 1)
      expect(tenantRuns).toHaveLength(1)
      expect(tenantRuns[0]?.tenantId).toBe(TENANT)
    })
  })

  describe('index exports', () => {
    it('exports schema and instrumented operation entrypoints', () => {
      expect(aiRunRecords).toBeDefined()
      expect(typeof executeInstrumentedAIRun).toBe('function')
    })

    it('null policy evaluator returns no violations', async () => {
      const evaluator = createNullPolicyEvaluator()
      const result = await evaluator.evaluate()
      expect(result).toEqual([])
    })
  })
})
