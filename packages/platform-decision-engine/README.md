# @nzila/platform-decision-engine

Governed decision-support engine for the Nzila OS platform. Generates evidence-backed recommendations from anomalies, intelligence signals, and operational metrics — then routes them through a human review workflow with full audit trails.

## Quick Start

```ts
import {
  generateDecisions,
  summariseDecisions,
  loadAllDecisions,
} from '@nzila/platform-decision-engine'

// Generate decisions from platform data
const decisions = generateDecisions({
  org_id: 'org-001',
  anomalies,       // from @nzila/platform-anomaly-engine
  insights,        // from @nzila/platform-intelligence
  signals,         // from @nzila/platform-intelligence
  environment: 'STAGING',
})

// Summarise all decisions
const summary = summariseDecisions(loadAllDecisions())
// → { total, by_severity, by_category, by_status, pending_review, critical_open }
```

## Decision Record Example

```json
{
  "decision_id": "DEC-2026-0001",
  "org_id": "org-nzila-demo",
  "category": "STAFFING",
  "type": "RECOMMENDATION",
  "severity": "HIGH",
  "title": "Staffing anomaly — grievance_resolution_rate",
  "summary": "Anomaly detected in staffing metric: grievance_resolution_rate deviated 3.2x from expected range.",
  "explanation": "The metric grievance_resolution_rate showed a 3.2x deviation...",
  "confidence_score": 0.78,
  "generated_by": {
    "source": "rules",
    "engine_version": "0.1.0"
  },
  "evidence_refs": [
    {
      "type": "anomaly",
      "ref_id": "ANO-001",
      "summary": "staffing_anomaly: 3.2x deviation on grievance_resolution_rate"
    }
  ],
  "recommended_actions": [
    "Review staffing levels for the affected department",
    "Check recent personnel changes",
    "Assess workload distribution"
  ],
  "required_approvals": ["hr-manager", "operations-lead"],
  "review_required": true,
  "policy_context": {
    "execution_allowed": true,
    "reasons": []
  },
  "environment_context": {
    "environment": "STAGING",
    "protected_environment": true
  },
  "status": "PENDING_REVIEW",
  "generated_at": "2026-01-15T10:00:00.000Z"
}
```

## API Overview

### Engine

| Function | Description |
|----------|------------|
| `generateDecisions(input)` | Run the full pipeline: rules → evidence → policy → ranking |
| `summariseDecisions(records)` | Aggregate counts by severity, category, status |

### Store

| Function | Description |
|----------|------------|
| `saveDecisionRecord(record)` | Persist a decision record |
| `loadDecisionRecord(id)` | Load a single decision by ID |
| `loadAllDecisions()` | Load all persisted decisions |
| `listOpenDecisions()` | Decisions not CLOSED, EXPIRED, or EXECUTED |
| `updateDecisionStatus(id, status)` | Transition to a new lifecycle status |
| `appendDecisionReview(id, reviewer, notes)` | Record a review action |

### Evidence

| Function | Description |
|----------|------------|
| `evidenceFromAnomalies(anomalies)` | Build evidence refs from anomaly records |
| `evidenceFromInsights(insights)` | Build evidence refs from cross-app insights |
| `evidenceFromSignals(signals)` | Build evidence refs from operational signals |
| `buildEvidenceRefs(input)` | Build all evidence refs from engine input |

### Policy

| Function | Description |
|----------|------------|
| `evaluateDecisionPolicyContext(decision, governance)` | Evaluate policy constraints |
| `filterExecutableDecisions(decisions)` | Filter to execution-allowed decisions |
| `classifyDecisions(decisions)` | Group by category |

### Ranking

| Function | Description |
|----------|------------|
| `computePriorityScore(record)` | Calculate priority from severity × confidence |
| `rankDecisions(records)` | Sort by priority score descending |
| `topDecisions(records, n)` | Top N by priority |

### Audit

| Function | Description |
|----------|------------|
| `createAuditEntry(params)` | Create an audit trail entry |
| `saveAuditEntry(entry)` | Persist an audit entry |
| `loadAuditTrail(decisionId)` | Load all audit entries for a decision |
| `emitAuditEvent(params)` | Create + save in one call |

### Feedback

| Function | Description |
|----------|------------|
| `recordDecisionFeedback(params)` | Record approve/reject/defer/execute/comment |

### Export

| Function | Description |
|----------|------------|
| `createDecisionExportPack(decisionId)` | Export full decision pack with SHA-256 hash |

### NL Query

| Function | Description |
|----------|------------|
| `classifyDecisionIntent(query)` | Parse natural language query into intent |
| `executeDecisionQuery(query)` | Run NL query against decision store |

## Exports Map

```
@nzila/platform-decision-engine          → barrel (all exports)
@nzila/platform-decision-engine/types    → type definitions
@nzila/platform-decision-engine/schemas  → Zod schemas
@nzila/platform-decision-engine/engine   → generateDecisions, summariseDecisions
@nzila/platform-decision-engine/rules    → DEFAULT_RULES
@nzila/platform-decision-engine/ranking  → ranking functions
@nzila/platform-decision-engine/evidence → evidence builders
@nzila/platform-decision-engine/policy   → policy evaluation
@nzila/platform-decision-engine/audit    → audit trail
@nzila/platform-decision-engine/feedback → feedback recording
@nzila/platform-decision-engine/store    → persistence
@nzila/platform-decision-engine/status   → lifecycle transitions
@nzila/platform-decision-engine/utils    → IDs, hashing, timestamps
```

## Governance

- No autonomous execution — decisions are recommendations only
- Every decision is evidence-backed and policy-filtered
- Full audit trail for every lifecycle transition
- Export packs include SHA-256 integrity hashes
- See [Decision Layer docs](../../docs/categories/platform-and-operations/decision-layer/) for commercial documentation

## Scripts

```bash
pnpm test                    # Run unit tests (58 tests)
pnpm typecheck               # TypeScript strict check
pnpm decision:seed-demo      # Seed 5 demo decision records
```
