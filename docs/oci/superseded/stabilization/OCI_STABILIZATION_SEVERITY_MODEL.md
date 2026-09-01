# OCI Stabilization Severity Model™

**Status:** Canonical doctrine for severity band assignment across the Stabilization Framework™.

**Audience:** Certified facilitators, engine implementers, governance bodies receiving severity-band readings, internal stewards of the method.

---

## 1. Purpose

The Severity Model defines five ordinal severity bands across six structural dimensions of institutional continuity. It governs:

- The severity band that every Product 3 finding carries,
- The escalation gravity associated with each band,
- The facilitator response prescribed for each band,
- The deferral conditions that may attach to each band,
- The signal severity envelope (`note`, `observation`, `warning`, `critical`) emitted by the workbook engines.

The model is structural. Bands are read at the institutional level. The model does not assign severity to named individuals.

---

## 2. The five bands

The bands are ordinal. A higher band always implies a higher gravity than a lower band along the same dimension.

| Band | Label | Engine signal severity | Facilitator response |
|------|-------|------------------------|----------------------|
| 1 | Low | `note` | Record; surface in cadence; no immediate action. |
| 2 | Moderate | `observation` | Surface in the engagement reading; consider as candidate stabilization move. |
| 3 | Elevated | `warning` | Recommend stabilization move within the engagement. |
| 4 | Critical | `critical` | Prioritise stabilization move; offer expedited Lifecycle phase. |
| 5 | Institutional Fragility | `critical` | Pause non-essential engagement scope; offer focused stabilization; refer governance body. |

Band 5 is reserved for conditions under which a single steward departure would interrupt institutional function. Band 5 always carries a parallel briefing to the institution's governance body.

---

## 3. The six structural dimensions

Severity bands are assigned per dimension. An engagement carries a band per dimension, not a single composite. The six dimensions are:

### 3.1 Stewardship concentration

The degree to which institutional knowledge is carried by a small number of stewards. Measured via the Stewardship Density Index (see `stewardshipCartography`) and the carrier-exposure profile in `continuityDependencyGraph`.

### 3.2 Onboarding survivability

The degree to which a successor steward could absorb a current steward's load given current written practice, lineage capture, and shadowing. Measured via `onboardingFragilityAnalysis`.

### 3.3 Governance lineage integrity

The degree to which the institution's governance decisions remain interpretable from their documented lineage. Measured via `continuityLineageEngine` and `governanceInterpretationMatrix`.

### 3.4 Reconstruction burden

The cost the institution would bear to reconstruct lapsed institutional practice or interpretation. Measured via `reconstructionBurdenAnalyzer`.

### 3.5 Modernization discontinuity

The degree to which planned or in-flight modernization would interrupt institutional continuity. Measured via `continuitySafeModernization` and `modernizationAlignmentEngine`.

### 3.6 Continuity dependency density

The number and concentration of single-point dependencies in operational practice. Measured via `continuityDependencyGraph` and `operationalSurfaceAnalysis`.

---

## 4. Band assignment rules

### 4.1 Per-dimension assignment

Bands are assigned per dimension by deterministic thresholds documented in each engine. The engine emits a severity in the `note` / `observation` / `warning` / `critical` envelope; the engagement reading lifts the envelope severity into a Severity Model band per the mapping in §2.

### 4.2 No composite band

The model does not produce a composite institutional band. A six-dimension band profile is the canonical reading. Stakeholders who request a single composite are returned to the per-dimension profile with an explicit note that composite bands are not produced under the framework.

### 4.3 No per-person bands

Bands are institutional. A band is never assigned to a steward, a role, or a named individual.

### 4.4 Band trajectory

The model tracks band trajectory over engagement sessions and across longitudinal cadences. A worsening band is itself a finding and is surfaced to the institution at the next phase boundary.

---

## 5. Escalation gravity

Each band carries an explicit escalation gravity. Escalation does not mean alarm; it means the institutional surface to which the finding is briefed:

- **Low** — engagement log only.
- **Moderate** — engagement reading returned to the institution.
- **Elevated** — engagement reading returned with a stabilization-move recommendation.
- **Critical** — engagement reading returned with a stabilization-move recommendation and a parallel briefing to the engagement sponsor.
- **Institutional Fragility** — engagement reading returned with a stabilization-move recommendation, sponsor briefing, and governance-body briefing.

A facilitator who escalates above or below the prescribed surface records the departure in the engagement log with a stated reason.

---

## 6. Deferral conditions

A band may attach a deferral condition when:

- The Readiness Threshold for the band's dimension is not met,
- The steward(s) affected by a candidate move have not consented,
- A reversibility profile cannot be established,
- The institution has declined the move.

Deferred bands remain in the engagement reading with their deferral reason. They are not removed and are not downgraded by the deferral.

---

## 7. Mapping to engine signal envelope

The workbook engines emit signals shaped as:

```ts
interface EngineSignal {
  readonly signalId: string;
  readonly severity: 'note' | 'observation' | 'warning' | 'critical';
  readonly category: string;
  readonly statement: string;
  readonly evidence: Readonly<Record<string, unknown>>;
}
```

The Severity Model bands map to the `severity` field uniformly:

| Band | `severity` value |
|------|------------------|
| Low | `'note'` |
| Moderate | `'observation'` |
| Elevated | `'warning'` |
| Critical | `'critical'` |
| Institutional Fragility | `'critical'` |

Bands 4 and 5 both emit `'critical'`. The distinction between the two is carried in the `category` and `evidence` fields, not in the severity vocabulary. The Severity Model does not extend the engine signal severity vocabulary; the mapping is unidirectional from band to envelope severity.

The two new composition engines introduced under Phase D (`stewardshipRedistributionEngine`, `governanceRecoveryEngine`) honour this mapping. Their tests assert it.

---

## 8. Doctrine references

- [OCI_METHOD.md](../../OCI_METHOD.md)
- [OCI_STABILIZATION_FRAMEWORK.md](OCI_STABILIZATION_FRAMEWORK.md)
- [OCI_STABILIZATION_LIFECYCLE.md](OCI_STABILIZATION_LIFECYCLE.md)
- [OCI_STABILIZATION_READINESS.md](OCI_STABILIZATION_READINESS.md)
- [OCI_CONTINUITY_DEBT.md](OCI_CONTINUITY_DEBT.md)
- [OCI_ANTI_SURVEILLANCE_POSITION.md](../../OCI_ANTI_SURVEILLANCE_POSITION.md)
- [OCI_AI_BOUNDARY.md](../../OCI_AI_BOUNDARY.md)
- [OCI_DATA_HANDLING.md](../../OCI_DATA_HANDLING.md)
