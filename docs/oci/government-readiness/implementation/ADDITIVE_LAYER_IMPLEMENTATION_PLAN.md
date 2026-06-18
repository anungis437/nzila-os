# Additive-Layer Implementation Plan

> **Status:** Implementation plan — additive layer only. **No production code in
> this document.** It defines the implementation units, their shapes, placement,
> dependencies, and build order so that engineering can proceed safely.
> **Hard constraint:** every unit is **read-only over the frozen scoring core.**
> Nothing here writes, weights, or alters a dimension, composite, or maturity band.

---

## 0. Scope discipline

**In scope (the additive layer):**

1. Finding artifact
2. TraceabilityRecord
3. Obligation taxonomy reference data
4. Consequence reference data
5. Per-finding confidence envelope

**Explicitly out of scope (frozen):**

- `lib/icra/scoring.ts` math, `lib/icra/maturity.ts` bands, dimension weights,
  risk inversion, `contextualScoreNormalizer` label logic.
- Any change to question normalization or routing that would alter a score.

**Golden rule for every unit:** *it consumes `ScoringTrace` / answers / existing
evidence + confidence primitives and produces new, additional outputs. It never
mutates an input.*

---

## 1. Build order (dependency-ordered)

```
 (A) Obligation reference data ─┐
 (B) Consequence reference data ─┤→ (D) Finding ─→ (E) TraceabilityRecord
 (C) Per-finding confidence ─────┘
```

Reference data (A, B) and the per-finding confidence adapter (C) are leaf units
with no dependency on each other. The **Finding** (D) composes A + B + C + the
existing scoring trace + evidence taxonomy. The **TraceabilityRecord** (E)
aggregates findings and computes chain-integrity. Tests (see
[NON_REGRESSION_TEST_SPECIFICATION.md](./NON_REGRESSION_TEST_SPECIFICATION.md))
are written **before** each unit.

---

## 2. Unit A — Obligation taxonomy reference data

- **Nature:** pure reference data + a deterministic mapping function. No I/O.
- **Proposed location:** `apps/union-eyes/lib/icra/obligations/`
  (`obligationTaxonomy.ts`, `obligationMapping.ts`).
- **Doctrine:** [OCI_OCRA_OBLIGATION_TAXONOMY.md](../OCI_OCRA_OBLIGATION_TAXONOMY.md).

### Shape (spec, not wired)

```ts
export type ObligationClassId =
  | 'statutory' | 'regulatory' | 'policy'
  | 'governance' | 'fiduciary' | 'continuity' | 'operational';

export interface ObligationClass {
  readonly id: ObligationClassId;
  readonly tier: 1 | 2 | 3 | 4 | 5 | 6 | 7;     // reporting precedence ONLY
  readonly evidenceFloor: EvidenceLevel;          // min level to assert this class
  readonly reportingPriorityWeight: number;       // report ordering ONLY — never a score weight
}

export interface ObligationMappingRule {
  readonly findingTheme: string;                  // e.g. 'undocumented_succession_authority'
  readonly defaultClasses: readonly ObligationClassId[];
  readonly topClassEvidenceFloor: EvidenceLevel;
}

// Deterministic, table-driven. Returns classes admissible at the finding's evidence level.
export function mapFindingToObligations(
  theme: string,
  evidenceLevel: EvidenceLevel,
): readonly ObligationClassId[];
```

### Invariants

- `mapFindingToObligations` is **pure and deterministic**.
- A class is omitted if `evidenceLevel < class.evidenceFloor` (e.g. no statutory on
  VERBAL).
- **No function in this unit imports or returns a score.** (Enforced by test
  `obligation-mapping-never-changes-scores`.)
- Taxonomy is **versioned** (`OBLIGATION_TAXONOMY_VERSION`).

---

## 3. Unit B — Consequence reference data

- **Nature:** pure reference data + confidence-gated mapping. No I/O.
- **Proposed location:** `apps/union-eyes/lib/icra/consequences/`
  (`consequenceModel.ts`).
- **Doctrine:** [OCI_OCRA_CONSEQUENCE_MODEL.md](../OCI_OCRA_CONSEQUENCE_MODEL.md).

### Shape

```ts
export type ConsequenceClassId =
  | 'institutional' | 'governance' | 'operational'
  | 'service_delivery' | 'public_trust' | 'financial_risk';

export type ConsequenceSeverity = 'negligible' | 'moderate' | 'serious' | 'severe';
export type ConsequenceAssertion = 'asserted' | 'potential' | 'not_asserted';

export interface ConsequenceMappingRule {
  readonly findingTheme: string;
  readonly classes: readonly ConsequenceClassId[];
  readonly realizationTrigger: string;            // e.g. 'unplanned_departure'
  readonly baseSeverity: ConsequenceSeverity;
}

export interface MappedConsequence {
  readonly classes: readonly ConsequenceClassId[];
  readonly severity: ConsequenceSeverity;
  readonly assertion: ConsequenceAssertion;       // gated by confidence band
  readonly realizationTrigger: string;
}

export function mapFindingToConsequence(
  theme: string,
  confidence: ConfidenceState,                     // from @nzila/oci-confidence
): MappedConsequence;
```

### Invariants

- **Confidence-gating:** `HIGH|MODERATE → asserted`, `LOW → potential`,
  `INSUFFICIENT → not_asserted` (consequence suppressed/labelled, never claimed).
- Pure, deterministic, **score-free**.

---

## 4. Unit C — Per-finding confidence envelope

- **Nature:** thin adapter that reuses `@nzila/oci-confidence`'s
  `buildConfidenceEnvelope` at **finding granularity**, fed by the evidence ladder.
- **Proposed location:** `apps/union-eyes/lib/icra/confidence/`
  (`findingConfidence.ts`).
- **Doctrine:** [OCI_OCRA_CONFIDENCE_ARCHITECTURE.md](../OCI_OCRA_CONFIDENCE_ARCHITECTURE.md).

### Shape

```ts
import { buildConfidenceEnvelope } from '@nzila/oci-confidence';
import type { EvidenceLevel } from '../evidence-strength/evidenceTaxonomy';

// Maps the existing 6-level ladder to a confidence band that can only LOWER the envelope.
export function evidenceBandFor(level: EvidenceLevel): ConfidenceState; // NONE→INSUFFICIENT … VERIFIED/CROSS_VALIDATED→HIGH

export function buildFindingConfidence(input: {
  readonly evidenceLevel: EvidenceLevel;
  readonly corroborated: boolean;
  readonly reviewerVariance?: number;
  readonly assessmentAgeDays?: number;
}): ConfidenceEnvelope<null>;   // score payload is null — confidence is ABOUT a finding, not a score
```

### Invariants

- Reuses the existing **`min`-band composition** — the evidence band joins the
  `lower(...)` fold, so it can **only tighten** confidence.
- **No path can raise confidence above the evidence floor.** (Enforced by test
  `confidence-cannot-inflate-above-evidence-floor`.)
- Emits the existing caution set + rationale array. No probability output.

---

## 5. Unit D — Finding artifact

- **Nature:** deterministic derivation from `ScoringTrace` + evidence + units A/B/C.
- **Proposed location:** `apps/union-eyes/lib/icra/findings/`
  (`finding.ts`, `findingDerivation.ts`).
- **Doctrine:** [OCI_OCRA_POLICY_TRACEABILITY_ARCHITECTURE.md](../OCI_OCRA_POLICY_TRACEABILITY_ARCHITECTURE.md),
  [OCI_OCRA_EXPLAINABILITY_MODEL.md](../OCI_OCRA_EXPLAINABILITY_MODEL.md).

### Shape

```ts
export interface Finding {
  readonly findingId: string;                      // stable, deterministic
  readonly theme: string;
  readonly statement: string;                      // plain language, PII-free
  readonly contributingQuestionIds: readonly string[];
  readonly evidenceLevel: EvidenceLevel;
  readonly affectedDimensions: ReadonlyArray<{
    readonly dimension: DimensionId;
    readonly contribution: number;                 // READ from ScoringTrace; never recomputed
  }>;
  readonly obligationClasses: readonly ObligationClassId[];   // from Unit A
  readonly severity: 'attention' | 'material' | 'serious' | 'critical';
  readonly confidence: ConfidenceEnvelope<null>;   // from Unit C
  readonly consequence: MappedConsequence;         // from Unit B
  readonly recommendationRefs: readonly string[];  // existing recommendation ids
}

export function deriveFindings(trace: ScoringTrace, evidence: EvidenceInputs): readonly Finding[];
```

### Invariants

- **Determinism:** identical `trace` + `evidence` → identical findings (ids,
  ordering, fields).
- **Reads dimension contributions** from `trace.questionTraces[].dimensionContributions`;
  never recomputes or mutates them.
- **Seven-answer completeness:** a `Finding` is only emitted if evidence,
  obligation, dimension contribution, confidence, consequence, and ≥1
  recommendation are all populated. (Enforced by test
  `every-surfaced-finding-has-seven-answers`.)
- PII-free statements only.

---

## 6. Unit E — TraceabilityRecord

- **Nature:** aggregation + integrity computation. Persistable as JSON (mirrors
  `RoutingExplainabilitySnapshot`).
- **Proposed location:** `apps/union-eyes/lib/icra/traceability/`
  (`traceabilityRecord.ts`).

### Shape

```ts
export interface TraceabilityRecord {
  readonly assessmentId: string;
  readonly scoringVersion: string;                 // ties to ScoringTrace
  readonly obligationTaxonomyVersion: string;
  readonly consequenceModelVersion: string;
  readonly findings: readonly Finding[];
  readonly chainIntegrity: {
    readonly everyFindingHasEvidence: boolean;
    readonly everyFindingHasConfidence: boolean;
    readonly everyFindingHasObligation: boolean;
    readonly everyRecommendationHasFinding: boolean;
    readonly intact: boolean;                      // AND of the above
  };
}

export function buildTraceabilityRecord(
  assessmentId: string,
  trace: ScoringTrace,
  findings: readonly Finding[],
): TraceabilityRecord;
```

### Invariants

- **No orphan recommendations:** every recommendation surfaced in the report maps
  to ≥1 finding. (Enforced by test `no-orphan-recommendations`.)
- `chainIntegrity.intact` must be `true` before a report renders findings.
- Version-pinned; append-only; no PII.

---

## 7. Wiring points (read-only)

| Existing module | Relationship to new layer |
| --- | --- |
| `lib/icra/scoring.ts` (`ScoringTrace`) | **input** to Unit D — read only |
| `lib/icra/evidence-strength/` | **input** to Units C, D |
| `lib/icra/recommendations.ts` | recommendation **ids** referenced by Unit D |
| `@nzila/oci-confidence` | reused by Unit C |
| `lib/icra/adaptation/routingExplainabilitySnapshot.ts` | **pattern template** for E |
| `contextualScoreNormalizer` | unchanged; interpretation labels still label-only |

**No existing module is modified to compute a score differently.** The only
permissible edits to existing files are *additive read paths* (e.g. exporting a
trace already produced) — never math changes.

---

## 8. Definition of done (layer)

1. Units A–E implemented as pure, deterministic, score-free modules.
2. All five non-regression suites green (see test spec).
3. Backward-compat suite proves existing labour/healthcare/association assessments
   reproduce **identical** composite/dimensions/band.
4. A `TraceabilityRecord` renders the seven-answer contract at three depths.
5. Obligation + consequence taxonomies versioned and documented.
6. No new AI surface introduced beyond optional **phrasing** of completed chains.

---

## 9. What this plan deliberately does NOT do

- Does not add or change any scoring dimension, weight, or maturity band.
- Does not introduce a government scoring path or sector fork.
- Does not add migrations in this phase (schema **shapes** only; persistence design
  follows once shapes are validated).
- Does not stand up the IRR program (separate, staged workstream).
