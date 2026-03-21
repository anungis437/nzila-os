# @nzila/platform-reasoning-engine

Cross-vertical reasoning engine for NzilaOS — structured reasoning chains with citations, confidence scoring, and explainable conclusions.

## Purpose

Provides a structured framework for the platform to **reason** about entities by assembling evidence, applying reasoning strategies, and producing explainable conclusions with full citation chains. Supports multiple reasoning types including risk-based, policy-based, causal, and cross-vertical reasoning.

## Key Concepts

| Concept | Description |
|---------|-------------|
| **Reasoning Chain** | A complete reasoning execution with steps, conclusion, and citations |
| **Reasoning Step** | One step in the reasoning process — input, output, citations, confidence |
| **Citation** | A grounded reference to a source (policy, event, decision, knowledge, entity) |
| **Conclusion** | The final result — summary, recommendation, risk level, alternatives |
| **Reasoning Strategy** | Pluggable algorithm that implements a reasoning pattern |
| **Cross-Vertical Insight** | An insight derived by connecting data across business verticals |

## Reasoning Types

`deductive`, `inductive`, `abductive`, `analogical`, `causal`, `risk_based`, `policy_based`, `cross_vertical`

## Usage

```typescript
import {
  executeReasoningChain,
  createInMemoryReasoningStore,
  ReasoningTypes,
} from '@nzila/platform-reasoning-engine'

const chain = await executeReasoningChain({
  store: createInMemoryReasoningStore(),
  strategy: myRiskStrategy,
  context: contextEnvelope, // from platform-context-orchestrator
  request: {
    orgId: 'org-uuid',
    reasoningType: ReasoningTypes.RISK_BASED,
    entityType: 'case',
    entityId: 'case-uuid',
    question: 'What is the risk level for this case?',
    requestedBy: 'user-1',
  },
})

// chain.steps — each step with citations and confidence
// chain.conclusion — summary, recommendation, riskLevel
// chain.allCitations — all unique citations
// chain.totalConfidence — weighted average confidence
```

## Drizzle Schema

Exports table: `reasoningChains`.
