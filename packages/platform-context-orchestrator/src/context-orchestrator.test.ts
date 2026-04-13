import { describe, it, expect, vi } from 'vitest'
import {
  buildContextEnvelope,
  getWorkflowContext,
  getDecisionContext,
  getAIContext,
  createNullContextSources,
  ContextPurposes,
} from './index'
import type { ContextSources, ContextCaller } from './index'
import { OntologyEntityTypes, EntityStatuses } from '@nzila/platform-ontology'

const TENANT = '00000000-0000-0000-0000-000000000001'
const ENTITY_ID = '00000000-0000-0000-0000-000000000099'
const CALLER: ContextCaller = {
  userId: 'user-1',
  role: 'case_officer',
  permissions: ['case.read', 'case.approve'],
}

function makeSources(overrides: Partial<ContextSources> = {}): ContextSources {
  return {
    ...createNullContextSources(),
    ...overrides,
  }
}

describe('platform-context-orchestrator', () => {
  // ── Context Envelope Assembly ─────────────────────────────────────

  describe('buildContextEnvelope', () => {
    it('assembles a context envelope from null sources', async () => {
      const envelope = await buildContextEnvelope(
        makeSources(),
        {
          tenantId: TENANT,
          purpose: ContextPurposes.WORKFLOW,
          entityType: OntologyEntityTypes.CASE,
          entityId: ENTITY_ID,
          caller: CALLER,
        },
      )

      expect(envelope.id).toBeDefined()
      expect(envelope.tenantId).toBe(TENANT)
      expect(envelope.purpose).toBe('workflow')
      expect(envelope.primaryEntityType).toBe(OntologyEntityTypes.CASE)
      expect(envelope.entity).toBeNull()
      expect(envelope.relatedEntities).toEqual([])
      expect(envelope.recentEvents).toEqual([])
      expect(envelope.applicableKnowledge).toEqual([])
      expect(envelope.decisionHistory).toEqual([])
      expect(envelope.tenantPolicies).toEqual({})
      expect(envelope.caller).toBe(CALLER)
    })

    it('includes entity data from source', async () => {
      const entity = {
        id: ENTITY_ID,
        tenantId: TENANT,
        entityType: OntologyEntityTypes.CASE,
        canonicalName: 'Case #42',
        aliases: [] as readonly string[],
        status: EntityStatuses.ACTIVE,
        tags: [] as readonly string[],
        sourceSystems: [] as readonly string[],
        metadata: {},
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      }

      const sources = makeSources({
        entity: {
          async getEntity(_tenantId, _entityType, _entityId) {
            return entity
          },
        },
      })

      const envelope = await buildContextEnvelope(sources, {
        tenantId: TENANT,
        purpose: ContextPurposes.DECISION,
        entityType: OntologyEntityTypes.CASE,
        entityId: ENTITY_ID,
        caller: CALLER,
      })

      expect(envelope.entity).toEqual(entity)
    })

    it('includes tenant policies', async () => {
      const policies = { maxApprovalAmount: 100_000, requireDualSign: true }
      const sources = makeSources({
        tenant: {
          async getTenantPolicies() {
            return policies
          },
        },
      })

      const envelope = await buildContextEnvelope(sources, {
        tenantId: TENANT,
        purpose: ContextPurposes.AUDIT,
        entityType: OntologyEntityTypes.CASE,
        entityId: ENTITY_ID,
        caller: CALLER,
      })

      expect(envelope.tenantPolicies).toEqual(policies)
    })

    it('uses deterministic fallback id when randomUUID is unavailable', async () => {
      const originalCrypto = globalThis.crypto

      vi.stubGlobal('crypto', {
        ...(originalCrypto ?? {}),
        randomUUID: undefined,
      })

      try {
        const envelopeA = await buildContextEnvelope(makeSources(), {
          tenantId: TENANT,
          purpose: ContextPurposes.WORKFLOW,
          entityType: OntologyEntityTypes.CASE,
          entityId: ENTITY_ID,
          caller: CALLER,
        })

        const envelopeB = await buildContextEnvelope(makeSources(), {
          tenantId: TENANT,
          purpose: ContextPurposes.WORKFLOW,
          entityType: OntologyEntityTypes.CASE,
          entityId: ENTITY_ID,
          caller: CALLER,
        })

        expect(envelopeA.id).toBe('00000000-0000-0000-0000-000000000001')
        expect(envelopeB.id).toBe('00000000-0000-0000-0000-000000000002')
      } finally {
        vi.unstubAllGlobals()
      }
    })
  })

  // ── Convenience Builders ──────────────────────────────────────────

  describe('convenience builders', () => {
    it('getWorkflowContext uses workflow purpose', async () => {
      const envelope = await getWorkflowContext(
        makeSources(),
        TENANT,
        OntologyEntityTypes.CASE,
        ENTITY_ID,
        CALLER,
      )
      expect(envelope.purpose).toBe('workflow')
    })

    it('getDecisionContext uses decision purpose', async () => {
      const envelope = await getDecisionContext(
        makeSources(),
        TENANT,
        OntologyEntityTypes.CASE,
        ENTITY_ID,
        CALLER,
      )
      expect(envelope.purpose).toBe('decision')
    })

    it('getAIContext uses ai_inference purpose', async () => {
      const envelope = await getAIContext(
        makeSources(),
        TENANT,
        OntologyEntityTypes.CASE,
        ENTITY_ID,
        CALLER,
      )
      expect(envelope.purpose).toBe('ai_inference')
    })
  })
})
