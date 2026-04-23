# @nzila/platform-cognition-core

The **Nzila Cognition Engine** — a reusable, consent-native intelligence layer
that composes with the existing decision, reasoning, anomaly, and ML packages
without duplicating them.

This package provides four engines:

| Engine | Purpose |
|---|---|
| **Memory** | Persistent, scoped, decaying user/org/entity memory with episodic, semantic, preference, decision, and trust kinds. Supports tag-weighted recall ranking, scoped redaction (consent withdrawal), and hard purge for retention jobs. |
| **Trajectory** | Sequence-feature risk scoring over time — churn, escalation, aging, disengagement, progression. Interpretable logistic models with version-pinned coefficients and per-feature contribution explainability. |
| **State** | Explainable human-state inference across six dimensions (confusion, fatigue, frustration, urgency, confidence, disengagement) from operational signals — repeat actions, session frequency, errors, deadlines. |
| **Consent** | A fail-closed gate that wraps memory recall and inference output. Intersects subject-stated policies with jurisdiction profiles (CA / EU / US / AF / OTHER), enforces retention, and strips events whose tags overlap mandatory exclusions. |

Plus a **decision-engine adapter** that turns trajectory risk scores into
`OperationalSignal` records the existing `@nzila/platform-decision-engine`
already consumes — that composition is the design moat.

## Quick start

```ts
import {
  memory,
  trajectory,
  state,
  consent,
  riskScoresToSignals,
} from '@nzila/platform-cognition-core'

const subject = {
  tenantId: 'tenant-1',
  orgId: 'org-1',
  userId: 'user-1',
  entityType: 'case',
  entityId: 'case-1',
}

// 1. Record what happened
memory.recordMemoryEvent({
  subject,
  kind: 'episodic',
  source: 'user_action',
  type: 'grievance_filed',
  payload: { severity: 'high' },
  salience: 0.9,
  tags: ['negative', 'grievance'],
  occurredAt: new Date().toISOString(),
})

// 2. Score the trajectory
const scores = trajectory.scoreSubject(subject, { windowDays: 90 })

// 3. Feed the existing decision engine
const signals = riskScoresToSignals(scores, { minProbability: 0.6 })
//   → pass `signals` to generateDecisions({ signals, ... })

// 4. Independently, infer human state from operational telemetry
const stateInf = state.inferState(subject, {
  repeatActionCount: 4,
  errorEventCount: 2,
  hoursToDeadline: 6,
})

// 5. Anything that returns memory or inference about a person should be gated:
const policy = consent.buildConsentPolicy({
  subject,
  allowedZones: ['operational', 'analytics'],
  allowedKinds: ['episodic', 'preference'],
  retentionDays: 180,
  jurisdiction: 'CA',
})
const recall = consent.gatedRecall({
  policy,
  requiredZones: ['analytics'],
  requiredKinds: ['episodic'],
  recall: () => memory.recallMemories({ subject, halfLifeDays: 30 }),
})
if (!recall.allowed) {
  // recall.reasons is safe to log
}
```

## Subpath imports

```ts
import { memory } from '@nzila/platform-cognition-core'                  // namespace
import { recallMemories } from '@nzila/platform-cognition-core/memory'   // direct
import { scoreSubject } from '@nzila/platform-cognition-core/trajectory'
import { inferState } from '@nzila/platform-cognition-core/state'
import { gatedRecall } from '@nzila/platform-cognition-core/consent'
```

## Storage

Phase-1 persistence is file-backed JSON under `ops/cognition-memory/`,
mirroring the precedent set by `@nzila/platform-decision-engine`. The Drizzle
schema for the Phase-2 Postgres backing is exported from
[`./src/schema.ts`](src/schema.ts) — DBA review required before any migration
SQL is written.

## Models — what's actually trained today

See [STATUS.md](STATUS.md). Short version: every Phase-1 score is an
**interpretable model with version-pinned, hand-calibrated coefficients**, not
a trained ML model. Trained models live in `@nzila/ml-core`'s registry; we
swap them in here once labeled data exists.

## Tests

```sh
pnpm --filter @nzila/platform-cognition-core test
# or from root:
pnpm cognition:test
```

## Operational report

```sh
pnpm cognition:report
```
