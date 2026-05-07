/**
 * Mobility Demo Sequence
 *
 * Demonstrates NzilaOS platform capabilities in a mobility/fleet context:
 * 1. Register ontology entities (Vehicle, Driver, Trip)
 * 2. Build entity graph relationships
 * 3. Emit platform events
 * 4. Register knowledge (fleet policy)
 * 5. Make governed decisions (trip approval)
 * 6. Run governed AI (risk scoring)
 * 7. Execute reasoning chain (cross-entity analysis)
 */

import { OntologyEntityTypes, EntityStatuses, RelationshipTypes } from '@nzila/platform-ontology'
import { createInMemoryGraphStore, getEntityNeighbors as _getEntityNeighbors, buildEntitySubgraph } from '@nzila/platform-entity-graph'
import { createEventBus, PlatformEventTypes, buildPlatformEvent } from '@nzila/platform-event-fabric'
import { createInMemoryKnowledgeStore, registerKnowledgeAsset, KnowledgeTypes } from '@nzila/platform-knowledge-registry'
import { createInMemoryDecisionStore, createDecisionNode, executeDecision, getDecisionTrail, DecisionTypes, ActorTypes } from '@nzila/platform-decision-graph'
import { createInMemoryAIRunStore, createNullPolicyEvaluator, executeGovernedAIRun, AIOperationTypes } from '@nzila/platform-governed-ai'
import { createInMemoryReasoningStore, executeReasoningChain, ReasoningTypes } from '@nzila/platform-reasoning-engine'

const ORG = 'org-mobility-demo'

export async function runMobilityDemo() {
  console.log('=== NzilaOS Mobility Demo ===\n')

  // ── 1. Entity Graph ───────────────────────────────────────────────
  console.log('1. Building entity graph...')
  const graphStore = createInMemoryGraphStore()

  const _vehicleNode = await graphStore.addNode({
    id: 'vehicle-001',
    tenantId: ORG,
    entityType: OntologyEntityTypes.VEHICLE,
    resourceId: 'vehicle-001',
    status: EntityStatuses.ACTIVE,
    metadata: { registration: 'ABC-123', make: 'Toyota', model: 'HiAce' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const _driverNode = await graphStore.addNode({
    id: 'driver-001',
    tenantId: ORG,
    entityType: OntologyEntityTypes.EMPLOYEE,
    resourceId: 'driver-001',
    status: EntityStatuses.ACTIVE,
    metadata: { name: 'Jean-Baptiste Mukendi', license: 'DL-2024-001' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const _tripNode = await graphStore.addNode({
    id: 'trip-001',
    tenantId: ORG,
    entityType: OntologyEntityTypes.CASE,
    resourceId: 'trip-001',
    status: EntityStatuses.ACTIVE,
    metadata: { origin: 'Kinshasa', destination: 'Lubumbashi', distance_km: 2500 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  await graphStore.addEdge({
    id: 'edge-1',
    tenantId: ORG,
    fromNodeId: 'trip-001',
    toNodeId: 'vehicle-001',
    relationshipType: RelationshipTypes.ASSIGNED_TO,
    metadata: {},
    createdAt: new Date().toISOString(),
  })

  await graphStore.addEdge({
    id: 'edge-2',
    tenantId: ORG,
    fromNodeId: 'trip-001',
    toNodeId: 'driver-001',
    relationshipType: RelationshipTypes.ASSIGNED_TO,
    metadata: {},
    createdAt: new Date().toISOString(),
  })

  const subgraph = await buildEntitySubgraph(graphStore, 'trip-001', 1)
  console.log(`  Graph: ${subgraph.nodes.length} nodes, ${subgraph.edges.length} edges`)

  // ── 2. Event Fabric ───────────────────────────────────────────────
  console.log('\n2. Emitting platform events...')
  const bus = createEventBus()
  const events: string[] = []
  bus.subscribe(PlatformEventTypes.ENTITY_CREATED, (e) => events.push(e.type))

  bus.publish(
    buildPlatformEvent({
      type: PlatformEventTypes.ENTITY_CREATED,
      tenantId: ORG,
      entityType: OntologyEntityTypes.CASE,
      resourceId: 'trip-001',
      payload: { origin: 'Kinshasa', destination: 'Lubumbashi' },
      actorId: 'system',
    }),
  )
  console.log(`  Events received: ${events.length}`)

  // ── 3. Knowledge Registry ────────────────────────────────────────
  console.log('\n3. Registering fleet policy...')
  const knowledgeStore = createInMemoryKnowledgeStore()
  await registerKnowledgeAsset(knowledgeStore, {
    tenantId: ORG,
    name: 'Fleet Trip Approval Policy',
    knowledgeType: KnowledgeTypes.POLICY,
    content: 'Trips over 500km require manager approval. Vehicles must have valid inspection.',
    tags: ['fleet', 'trip', 'approval'],
    applicableEntityTypes: [OntologyEntityTypes.CASE],
  })
  console.log('  Registered: Fleet Trip Approval Policy')

  // ── 4. Decision Graph ────────────────────────────────────────────
  console.log('\n4. Making trip approval decision...')
  const decisionStore = createInMemoryDecisionStore()
  const riskDecision = await createDecisionNode(decisionStore, {
    tenantId: ORG,
    entityType: OntologyEntityTypes.CASE,
    resourceId: 'trip-001',
    decisionType: DecisionTypes.RISK_ASSESSMENT,
    actorType: ActorTypes.SYSTEM,
    actorId: 'risk-engine',
    summary: 'Trip risk: LOW — experienced driver, maintained vehicle',
    outcome: { riskLevel: 'low', score: 0.15 },
  })
  await executeDecision(decisionStore, riskDecision.id)

  const approvalDecision = await createDecisionNode(decisionStore, {
    tenantId: ORG,
    entityType: OntologyEntityTypes.CASE,
    resourceId: 'trip-001',
    decisionType: DecisionTypes.APPROVAL,
    actorType: ActorTypes.USER,
    actorId: 'manager-001',
    summary: 'Trip approved — low risk, business-critical route',
    outcome: { approved: true },
  })
  await executeDecision(decisionStore, approvalDecision.id)

  const trail = await getDecisionTrail(decisionStore, approvalDecision.id)
  console.log(`  Trail: ${trail.nodes.length} decisions`)

  // ── 5. Governed AI ───────────────────────────────────────────────
  console.log('\n5. Running governed AI risk scoring...')
  const aiStore = createInMemoryAIRunStore()
  const policyEval = createNullPolicyEvaluator()
  const aiRun = await executeGovernedAIRun(aiStore, policyEval, {
    tenantId: ORG,
    entityType: OntologyEntityTypes.CASE,
    resourceId: 'trip-001',
    operationType: AIOperationTypes.RISK_SCORING,
    modelId: 'nzila-risk-v2',
    prompt: 'Assess risk for trip Kinshasa→Lubumbashi, driver Mukendi, vehicle HiAce ABC-123',
    provider: {
      invoke: async () => ({
        result: { riskScore: 0.15, factors: ['experienced_driver', 'maintained_vehicle'] },
        confidence: 0.92,
        reasoning: 'Low risk based on driver history and vehicle inspection records',
        tokenUsage: { input: 120, output: 45, total: 165 },
      }),
    },
    evidence: [
      { sourceType: 'entity', sourceId: 'driver-001', excerpt: 'Driver rating: 4.8/5, 3 years experience' },
      { sourceType: 'entity', sourceId: 'vehicle-001', excerpt: 'Last inspection: 2024-01-15, no issues' },
    ],
  })
  console.log(`  AI Run: ${aiRun.status}, confidence: ${aiRun.confidence}`)

  // ── 6. Reasoning ─────────────────────────────────────────────────
  console.log('\n6. Executing reasoning chain...')
  const reasoningStore = createInMemoryReasoningStore()
  const chain = await executeReasoningChain(reasoningStore, {
    orgId: ORG,
    entityType: OntologyEntityTypes.CASE,
    resourceId: 'trip-001',
    reasoningType: ReasoningTypes.RISK_BASED,
    question: 'Should this trip proceed given current conditions?',
    strategy: {
      execute: async () => ({
        steps: [
          {
            stepNumber: 1,
            description: 'Evaluate driver qualifications',
            input: { driverId: 'driver-001' },
            output: { qualified: true, rating: 4.8 },
            citations: [{ sourceType: 'entity' as const, sourceId: 'driver-001', excerpt: 'Experienced driver' }],
            confidence: 0.95,
            durationMs: 12,
          },
          {
            stepNumber: 2,
            description: 'Evaluate vehicle condition',
            input: { vehicleId: 'vehicle-001' },
            output: { roadworthy: true, lastInspection: '2024-01-15' },
            citations: [{ sourceType: 'entity' as const, sourceId: 'vehicle-001', excerpt: 'Passed inspection' }],
            confidence: 0.90,
            durationMs: 8,
          },
        ],
        conclusion: {
          summary: 'Trip should proceed — driver and vehicle meet all requirements',
          recommendation: 'APPROVE',
          riskLevel: 'low',
          confidence: 0.92,
          alternativeConclusions: [],
        },
      }),
    },
  })
  console.log(`  Reasoning: ${chain.status}, ${chain.steps.length} steps`)
  console.log(`  Conclusion: ${chain.conclusion?.summary}`)

  console.log('\n=== Mobility Demo Complete ===')

  return {
    entities: subgraph.nodes.length,
    events: events.length,
    decisions: trail.nodes.length,
    aiRuns: 1,
    reasoningSteps: chain.steps.length,
  }
}
