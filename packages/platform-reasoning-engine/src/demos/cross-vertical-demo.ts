/**
 * Cross-Vertical Demo Sequence
 *
 * Demonstrates NzilaOS reasoning across multiple industry verticals:
 * 1. Agriculture: Crop yield analysis → risk scoring
 * 2. Commerce: Transaction pattern → fraud detection
 * 3. Cross-vertical: Unified reasoning connecting agriculture + commerce signals
 *
 * This showcases the platform's unique ability to reason across domain boundaries.
 */

import { OntologyEntityTypes } from '@nzila/platform-ontology'
import { createEventBus, PlatformEventTypes, buildPlatformEvent } from '@nzila/platform-event-fabric'
import { createInMemoryKnowledgeStore, registerKnowledgeAsset, KnowledgeTypes } from '@nzila/platform-knowledge-registry'
import { createInMemoryDecisionStore, createDecisionNode, executeDecision, DecisionTypes, ActorTypes } from '@nzila/platform-decision-graph'
import { createInMemoryAIRunStore, createNullPolicyEvaluator, executeGovernedAIRun, AIOperationTypes } from '@nzila/platform-governed-ai'
import { createInMemoryReasoningStore, executeReasoningChain, ReasoningTypes } from '@nzila/platform-reasoning-engine'

const ORG = 'org-cross-vertical-demo'

export async function runCrossVerticalDemo() {
  console.log('=== NzilaOS Cross-Vertical Reasoning Demo ===\n')

  const bus = createEventBus()
  const knowledgeStore = createInMemoryKnowledgeStore()
  const decisionStore = createInMemoryDecisionStore()
  const aiStore = createInMemoryAIRunStore()
  const policyEval = createNullPolicyEvaluator()
  const reasoningStore = createInMemoryReasoningStore()

  // ── 1. Agriculture Vertical ───────────────────────────────────────
  console.log('--- Agriculture Vertical ---')

  // Register agri knowledge
  await registerKnowledgeAsset(knowledgeStore, {
    tenantId: ORG,
    name: 'Crop Yield Threshold Policy',
    knowledgeType: KnowledgeTypes.POLICY,
    content: 'If predicted yield drops below 60% of historical average, trigger supply chain alert.',
    tags: ['agriculture', 'yield', 'supply-chain'],
    applicableEntityTypes: [OntologyEntityTypes.PRODUCT],
  })

  // AI: Yield prediction
  const yieldRun = await executeGovernedAIRun(aiStore, policyEval, {
    tenantId: ORG,
    entityType: OntologyEntityTypes.PRODUCT,
    resourceId: 'crop-maize-2024',
    operationType: AIOperationTypes.RISK_SCORING,
    modelId: 'agri-yield-predictor-v1',
    prompt: 'Predict maize yield for Katanga region given current weather patterns',
    provider: {
      invoke: async () => ({
        result: { predictedYieldTons: 2.1, historicalAvgTons: 4.0, yieldRatio: 0.525 },
        confidence: 0.87,
        reasoning: 'Drought conditions reduce expected yield to 52.5% of historical average',
        tokenUsage: { input: 200, output: 80, total: 280 },
      }),
    },
    evidence: [
      { sourceType: 'data', sourceId: 'weather-station-ktg', excerpt: 'Rainfall 40% below average' },
      { sourceType: 'data', sourceId: 'soil-sensor-plot-7', excerpt: 'Soil moisture critical' },
    ],
  })
  console.log(`  Yield prediction: ${yieldRun.confidence} confidence`)

  // Decision: Supply chain alert
  const agriDecision = await createDecisionNode(decisionStore, {
    tenantId: ORG,
    entityType: OntologyEntityTypes.PRODUCT,
    resourceId: 'crop-maize-2024',
    decisionType: DecisionTypes.RISK_ASSESSMENT,
    actorType: ActorTypes.AI_MODEL,
    actorId: 'agri-yield-predictor-v1',
    summary: 'Supply chain alert: maize yield 52.5% of average — below 60% threshold',
    outcome: { alert: true, yieldRatio: 0.525, action: 'source_alternative_suppliers' },
  })
  await executeDecision(decisionStore, agriDecision.id)

  bus.publish(
    buildPlatformEvent({
      type: PlatformEventTypes.ENTITY_UPDATED,
      tenantId: ORG,
      entityType: OntologyEntityTypes.PRODUCT,
      resourceId: 'crop-maize-2024',
      payload: { alert: 'yield_below_threshold', yieldRatio: 0.525 },
      actorId: 'agri-yield-predictor-v1',
    }),
  )
  console.log('  Supply chain alert emitted')

  // ── 2. Commerce Vertical ──────────────────────────────────────────
  console.log('\n--- Commerce Vertical ---')

  // Register commerce knowledge
  await registerKnowledgeAsset(knowledgeStore, {
    tenantId: ORG,
    name: 'Commodity Price Surge Policy',
    knowledgeType: KnowledgeTypes.RULE,
    content: 'If commodity prices surge >25% in 30 days, flag transactions for review.',
    tags: ['commerce', 'pricing', 'fraud'],
    applicableEntityTypes: [OntologyEntityTypes.TRANSACTION],
  })

  // AI: Transaction anomaly detection
  const commerceRun = await executeGovernedAIRun(aiStore, policyEval, {
    tenantId: ORG,
    entityType: OntologyEntityTypes.TRANSACTION,
    resourceId: 'txn-batch-2024-03',
    operationType: AIOperationTypes.ANOMALY_DETECTION,
    modelId: 'commerce-anomaly-v2',
    prompt: 'Analyze maize transaction batch for pricing anomalies',
    provider: {
      invoke: async () => ({
        result: {
          anomalyDetected: true,
          priceSurge: 0.35,
          affectedTransactions: 12,
          pattern: 'supply_driven_price_surge',
        },
        confidence: 0.91,
        reasoning: '35% price surge in maize transactions correlates with supply shortage signals',
        tokenUsage: { input: 350, output: 120, total: 470 },
      }),
    },
    evidence: [
      { sourceType: 'data', sourceId: 'market-data-kinshasa', excerpt: 'Maize price +35% in 22 days' },
      { sourceType: 'entity', sourceId: 'crop-maize-2024', excerpt: 'Yield prediction: 52.5%' },
    ],
  })
  console.log(`  Anomaly detection: ${commerceRun.confidence} confidence`)

  // ── 3. Cross-Vertical Reasoning ───────────────────────────────────
  console.log('\n--- Cross-Vertical Reasoning ---')

  const chain = await executeReasoningChain(reasoningStore, {
    orgId: ORG,
    entityType: OntologyEntityTypes.ORGANIZATION,
    resourceId: 'org-nzila-demo',
    reasoningType: ReasoningTypes.CROSS_VERTICAL,
    question: 'How do agricultural yield forecasts impact commodity trading risk?',
    strategy: {
      execute: async () => ({
        steps: [
          {
            stepNumber: 1,
            description: 'Analyze agricultural yield signals',
            input: { vertical: 'agriculture', resourceId: 'crop-maize-2024' },
            output: { yieldRatio: 0.525, belowThreshold: true },
            citations: [
              { sourceType: 'decision' as const, sourceId: agriDecision.id, excerpt: 'Yield 52.5% of average' },
              { sourceType: 'knowledge' as const, sourceId: 'policy-yield-threshold', excerpt: '60% threshold' },
            ],
            confidence: 0.87,
            durationMs: 15,
          },
          {
            stepNumber: 2,
            description: 'Correlate with commodity price movements',
            input: { vertical: 'commerce', resourceId: 'txn-batch-2024-03' },
            output: { priceSurge: 0.35, anomalyDetected: true },
            citations: [
              { sourceType: 'data' as const, sourceId: 'market-data-kinshasa', excerpt: 'Price +35%' },
            ],
            confidence: 0.91,
            durationMs: 12,
          },
          {
            stepNumber: 3,
            description: 'Cross-vertical causal inference',
            input: { agriSignal: 'yield_shortage', commerceSignal: 'price_surge' },
            output: {
              causalLink: 'confirmed',
              mechanism: 'Supply shortage → price surge → transaction anomalies',
              recommendation: 'Not fraud — supply-driven price movement',
            },
            citations: [
              { sourceType: 'decision' as const, sourceId: agriDecision.id, excerpt: 'Supply alert' },
              { sourceType: 'knowledge' as const, sourceId: 'policy-price-surge', excerpt: 'Price surge rule' },
            ],
            confidence: 0.89,
            durationMs: 20,
          },
        ],
        conclusion: {
          summary:
            'Price surge in maize transactions is supply-driven, not fraudulent. ' +
            'Agricultural yield forecast (52.5%) causally explains the 35% price increase. ' +
            'Recommend: clear fraud flag, activate alternative supplier sourcing.',
          recommendation: 'CLEAR_FRAUD_FLAG_AND_SOURCE_ALTERNATIVES',
          riskLevel: 'medium',
          confidence: 0.89,
          alternativeConclusions: [
            'If weather improves, yield may recover — monitor closely before sourcing alternatives',
          ],
        },
        crossVerticalInsights: [
          {
            sourceVertical: 'agriculture',
            targetVertical: 'commerce',
            insight: 'Crop yield shortages in Katanga directly drive maize price surges in Kinshasa markets',
            confidence: 0.89,
            supportingEntityIds: ['crop-maize-2024', 'txn-batch-2024-03'],
          },
        ],
      }),
    },
  })

  console.log(`  Reasoning: ${chain.status}, ${chain.steps.length} steps`)
  console.log(`  Conclusion: ${chain.conclusion?.summary}`)
  console.log(`  Risk level: ${chain.conclusion?.riskLevel}`)

  console.log('\n=== Cross-Vertical Demo Complete ===')

  return {
    agriConfidence: yieldRun.confidence,
    commerceConfidence: commerceRun.confidence,
    reasoningSteps: chain.steps.length,
    conclusion: chain.conclusion?.recommendation,
  }
}
