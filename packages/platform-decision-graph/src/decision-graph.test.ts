import { describe, it, expect, beforeEach } from 'vitest'
import {
  DecisionTypes,
  DecisionStatuses,
  ActorTypes,
  DecisionEdgeTypes,
  createDecisionNode,
  linkDecisions,
  executeDecision,
  overrideDecision,
  getDecisionTrail,
  getDecisionsForEntity,
  createInMemoryDecisionStore,
} from './index'
import type { DecisionGraphStore, CreateDecisionNodeInput } from './index'
import { OntologyEntityTypes } from '@nzila/platform-ontology'

const TENANT = '00000000-0000-0000-0000-000000000001'
const ENTITY_ID = '00000000-0000-0000-0000-000000000099'

function makeInput(overrides: Partial<CreateDecisionNodeInput> = {}): CreateDecisionNodeInput {
  return {
    tenantId: TENANT,
    decisionType: DecisionTypes.APPROVAL,
    actorType: ActorTypes.USER,
    actorId: 'user-1',
    entityType: OntologyEntityTypes.CASE,
    resourceId: ENTITY_ID,
    summary: 'Approved case for processing',
    outcome: { approved: true },
    policyRefs: ['policy-kyc-001'],
    evidenceRefs: ['doc-id-scan'],
    knowledgeRefs: [],
    ...overrides,
  }
}

describe('platform-decision-graph', () => {
  let store: DecisionGraphStore

  beforeEach(() => {
    store = createInMemoryDecisionStore()
  })

  // ── Node Creation ───────────────────────────────────────────────────

  describe('createDecisionNode', () => {
    it('creates a decision node with PENDING status', async () => {
      const node = await createDecisionNode(store, makeInput())
      expect(node.id).toBeDefined()
      expect(node.status).toBe(DecisionStatuses.PENDING)
      expect(node.decisionType).toBe(DecisionTypes.APPROVAL)
      expect(node.policyRefs).toContain('policy-kyc-001')
    })
  })

  // ── Execution ─────────────────────────────────────────────────────

  describe('executeDecision', () => {
    it('transitions a decision to EXECUTED', async () => {
      const node = await createDecisionNode(store, makeInput())
      await executeDecision(store, node.id)
      const updated = await store.getNode(node.id)
      expect(updated?.status).toBe(DecisionStatuses.EXECUTED)
      expect(updated?.executedAt).toBeDefined()
    })
  })

  // ── Override ──────────────────────────────────────────────────────

  describe('overrideDecision', () => {
    it('creates an override and links it to original', async () => {
      const original = await createDecisionNode(store, makeInput())
      const { override, edge } = await overrideDecision(
        store,
        original.id,
        makeInput({
          summary: 'Override: additional docs required',
          outcome: { approved: false, reason: 'missing_documents' },
          actorId: 'supervisor-1',
        }),
      )
      expect(override.summary).toContain('Override')
      expect(edge.edgeType).toBe(DecisionEdgeTypes.OVERRIDES)
      expect(edge.toDecisionId).toBe(original.id)

      const orig = await store.getNode(original.id)
      expect(orig?.status).toBe(DecisionStatuses.OVERRIDDEN)
    })
  })

  // ── Linking ───────────────────────────────────────────────────────

  describe('linkDecisions', () => {
    it('creates an edge between two decisions', async () => {
      const a = await createDecisionNode(store, makeInput({ summary: 'Risk assessment' }))
      const b = await createDecisionNode(store, makeInput({ summary: 'Final approval' }))
      const edge = await linkDecisions(store, {
        fromDecisionId: b.id,
        toDecisionId: a.id,
        edgeType: DecisionEdgeTypes.DEPENDS_ON,
      })
      expect(edge.fromDecisionId).toBe(b.id)
      expect(edge.toDecisionId).toBe(a.id)
    })
  })

  // ── Decision Trail ────────────────────────────────────────────────

  describe('getDecisionTrail', () => {
    it('traverses a chain of decisions', async () => {
      const risk = await createDecisionNode(
        store,
        makeInput({
          decisionType: DecisionTypes.RISK_ASSESSMENT,
          summary: 'Risk: low',
        }),
      )
      const compliance = await createDecisionNode(
        store,
        makeInput({
          decisionType: DecisionTypes.COMPLIANCE_CHECK,
          summary: 'Compliance: pass',
        }),
      )
      const approval = await createDecisionNode(
        store,
        makeInput({
          decisionType: DecisionTypes.APPROVAL,
          summary: 'Final approval',
        }),
      )

      await linkDecisions(store, {
        fromDecisionId: approval.id,
        toDecisionId: risk.id,
        edgeType: DecisionEdgeTypes.DEPENDS_ON,
      })
      await linkDecisions(store, {
        fromDecisionId: approval.id,
        toDecisionId: compliance.id,
        edgeType: DecisionEdgeTypes.DEPENDS_ON,
      })

      const trail = await getDecisionTrail(store, approval.id)
      expect(trail.nodes).toHaveLength(3)
      expect(trail.edges).toHaveLength(2)
      expect(trail.totalDepth).toBe(1)
    })
  })

  // ── Entity Lookup ─────────────────────────────────────────────────

  describe('getDecisionsForEntity', () => {
    it('finds all decisions for an entity', async () => {
      await createDecisionNode(store, makeInput())
      await createDecisionNode(store, makeInput({ summary: 'Second decision' }))
      await createDecisionNode(
        store,
        makeInput({
          resourceId: '00000000-0000-0000-0000-000000000088',
          summary: 'Different entity',
        }),
      )

      const decisions = await getDecisionsForEntity(
        store,
        OntologyEntityTypes.CASE,
        ENTITY_ID,
      )
      expect(decisions).toHaveLength(2)
    })
  })
})
