import { describe, it, expect, beforeEach } from 'vitest'
import {
  ReasoningTypes,
  ReasoningStatuses,
  executeReasoningChain,
  getReasoningChain,
  getReasoningHistory,
  createInMemoryReasoningStore,
} from './index'
import type { ReasoningStore, ReasoningStrategy, Citation } from './index'
import { OntologyEntityTypes, EntityStatuses } from '@nzila/platform-ontology'
import type { ContextEnvelope } from '@nzila/platform-context-orchestrator'

const ORG = '00000000-0000-0000-0000-000000000001'
const ENTITY_ID = '00000000-0000-0000-0000-000000000099'

function makeContext(): ContextEnvelope {
  return {
    id: '00000000-0000-0000-0000-000000000050',
    tenantId: ORG,
    purpose: 'decision',
    primaryEntityType: OntologyEntityTypes.CASE,
    primaryEntityId: ENTITY_ID,
    assembledAt: '2025-06-01T00:00:00.000Z',
    entity: {
      id: ENTITY_ID,
      tenantId: ORG,
      entityType: OntologyEntityTypes.CASE,
      canonicalName: 'Case #42',
      aliases: [],
      status: EntityStatuses.ACTIVE,
      tags: [],
      sourceSystems: [],
      metadata: {},
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
    relatedEntities: [],
    relationships: [],
    recentEvents: [],
    applicableKnowledge: [],
    decisionHistory: [],
    tenantPolicies: {},
    caller: { userId: 'user-1', role: 'case_officer' },
  }
}

function makeStrategy(): ReasoningStrategy {
  return {
    type: ReasoningTypes.RISK_BASED,
    async reason(_context, _question) {
      const citation: Citation = {
        id: 'cit-1',
        sourceType: 'policy',
        sourceId: 'policy-risk-001',
        label: 'Risk Assessment Policy',
        excerpt: 'Cases with income > 30k are low risk',
        relevance: 0.95,
      }

      return {
        steps: [
          {
            stepNumber: 1,
            description: 'Evaluate income level',
            input: { income: 50000 },
            output: { riskCategory: 'low' },
            citations: [citation],
            confidence: 0.95,
            durationMs: 120,
          },
          {
            stepNumber: 2,
            description: 'Check credit history',
            input: { creditScore: 720 },
            output: { creditRisk: 'low' },
            citations: [],
            confidence: 0.88,
            durationMs: 80,
          },
        ],
        conclusion: {
          summary: 'Risk level is LOW based on income and credit analysis',
          recommendation: 'Proceed with standard processing',
          riskLevel: 'low',
          confidence: 0.91,
          alternativeConclusions: ['Medium risk if employment unverified'],
        },
        citations: [citation],
      }
    },
  }
}

describe('platform-reasoning-engine', () => {
  let store: ReasoningStore

  beforeEach(() => {
    store = createInMemoryReasoningStore()
  })

  // ── Successful Reasoning ──────────────────────────────────────────

  describe('executeReasoningChain — success', () => {
    it('executes a reasoning chain with steps and conclusion', async () => {
      const chain = await executeReasoningChain({
        store,
        strategy: makeStrategy(),
        context: makeContext(),
        request: {
          orgId: ORG,
          reasoningType: ReasoningTypes.RISK_BASED,
          entityType: OntologyEntityTypes.CASE,
          entityId: ENTITY_ID,
          question: 'What is the risk level for this case?',
          requestedBy: 'user-1',
        },
      })

      expect(chain.status).toBe(ReasoningStatuses.COMPLETED)
      expect(chain.steps).toHaveLength(2)
      expect(chain.conclusion).toBeDefined()
      expect(chain.conclusion?.riskLevel).toBe('low')
      expect(chain.allCitations).toHaveLength(1)
      expect(chain.totalConfidence).toBeGreaterThan(0)
    })

    it('persists the chain in the store', async () => {
      const chain = await executeReasoningChain({
        store,
        strategy: makeStrategy(),
        context: makeContext(),
        request: {
          orgId: ORG,
          reasoningType: ReasoningTypes.RISK_BASED,
          entityType: OntologyEntityTypes.CASE,
          entityId: ENTITY_ID,
          question: 'Risk assessment',
          requestedBy: 'user-1',
        },
      })

      const retrieved = await getReasoningChain(store, chain.id)
      expect(retrieved?.id).toBe(chain.id)
    })
  })

  // ── Failed Reasoning ──────────────────────────────────────────────

  describe('executeReasoningChain — failure', () => {
    it('records FAILED status when strategy throws', async () => {
      const failingStrategy: ReasoningStrategy = {
        type: ReasoningTypes.DEDUCTIVE,
        async reason() {
          throw new Error('Strategy error')
        },
      }

      const chain = await executeReasoningChain({
        store,
        strategy: failingStrategy,
        context: makeContext(),
        request: {
          orgId: ORG,
          reasoningType: ReasoningTypes.DEDUCTIVE,
          entityType: OntologyEntityTypes.CASE,
          entityId: ENTITY_ID,
          question: 'Deduction test',
          requestedBy: 'user-1',
        },
      })

      expect(chain.status).toBe(ReasoningStatuses.FAILED)
      expect(chain.conclusion).toBeNull()
      expect(chain.steps).toHaveLength(0)
    })
  })

  // ── History ───────────────────────────────────────────────────────

  describe('getReasoningHistory', () => {
    it('returns chains for a specific entity', async () => {
      await executeReasoningChain({
        store,
        strategy: makeStrategy(),
        context: makeContext(),
        request: {
          orgId: ORG,
          reasoningType: ReasoningTypes.RISK_BASED,
          entityType: OntologyEntityTypes.CASE,
          entityId: ENTITY_ID,
          question: 'Q1',
          requestedBy: 'user-1',
        },
      })

      const history = await getReasoningHistory(
        store,
        OntologyEntityTypes.CASE,
        ENTITY_ID,
      )
      expect(history).toHaveLength(1)
    })
  })
})
