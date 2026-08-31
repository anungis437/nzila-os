# Playbook 4 — Stewardship Redistribution

**Status:** Canonical Product 3 playbook. The framework-level companion document is [STEWARDSHIP_REDISTRIBUTION.md](../STEWARDSHIP_REDISTRIBUTION.md).

**Audience:** Certified facilitators, governance bodies, internal stewards of the method.

---

## 1. Purpose

Broaden the carriers of continuity-bearing practice without diminishing the originating steward's standing. Redistribution moves load from concentration to distribution while preserving recognition.

## 2. Preconditions

- Product 2 cartography names the concentration to be redistributed.
- The originating steward consents to participation.
- A candidate carrier (or carrier set) is named and consents to receiving the practice.
- Reciprocity terms for the originating steward are drafted before sequence start.

## 3. Readiness band

All five [Readiness Thresholds](../OCI_STABILIZATION_READINESS.md) at sufficient. Particular attention to **stewardship visibility** and **operational trust conditions**.

## 4. Severity band

Engaged at **Elevated** or above on the steward-concentration dimension. Institutional Fragility readings require governance-body co-sponsorship and a longer sprint cadence.

## 5. Intervention sequence

1. **Reciprocity terms ratified.** Reversibility: fully reversible. The originating steward's recognition, standing, and future role are confirmed in writing before sequence start.
2. **Joint practice walk-through.** Reversibility: fully reversible. The originating steward and the carrier candidate walk the practice together.
3. **Carrier broadening period.** Reversibility: reversible with cost. A bounded period during which the candidate carries the practice in parallel with the originating steward.
4. **Carrier confirmation.** Reversibility: reversible with cost. The institution confirms the broadened carrier set is operational.
5. **Redistribution ratified by governance body.** Reversibility: irreversible. The redistribution becomes the institutional arrangement.

## 6. Persona resonance

Primarily the **Continuity Guardian** (originating steward) and the **Institutional Rebuilder** (carrier candidate). The framework explicitly resists positioning the originating steward as a bottleneck or the carrier candidate as a replacement.

## 7. Engine inputs

- `stewardshipCartography`
- `continuityDependencyGraph`
- `continuityRedistributionPlanner`
- `onboardingFragilityAnalysis`
- `governanceInterpretationMatrix`

## 8. Facilitator guidance

- Sequence reciprocity ratification first, always. A redistribution without ratified reciprocity is an extraction.
- Hold the joint walk-through as a peer act, not as handover. Both stewards leave the walk-through with recognised standing.
- If the originating steward signals discomfort with the carrier candidate, pause the sequence and re-read readiness.
- Refuse to position the playbook as freeing the originating steward to "do more". Redistribution is reduction, not capacity-creation for additional load.

## 9. Executive briefing format

A two-page brief returned to the governance body:
- Page 1: redistribution scope, ratified reciprocity terms, carrier set confirmation.
- Page 2: residual concentration readings, reciprocity terms honoured, named contributors.

## 10. Deferral conditions

- Reciprocity terms cannot be ratified. Playbook is deferred; the engagement returns to readiness conversation with the governance body.
- The carrier candidate does not consent. Playbook is deferred; alternative candidates are surfaced through Product 2 deepening.
- The originating steward signals withdrawal at any point. Playbook is paused; consent revocability is honoured per [OCI_INTERVENTION_ETHICS.md](../OCI_INTERVENTION_ETHICS.md) §2.5.

## 11. Success criteria + reciprocity terms

**Success criteria:**
- The institution holds a ratified redistribution arrangement.
- Carrier broadening is confirmed operational.
- The originating steward exits with recognised standing.

**Reciprocity terms:**
- The originating steward is named as the source of the redistributed practice.
- The originating steward's compensation, role, and standing are preserved or enhanced.
- The institution records the broadened carrier set as institutional arrangement, not as the originating steward's replacement.

## 12. Executable composition

The playbook is operationalized by four composition engines under
`apps/union-eyes/lib/workbook/engines/redistribution/`:

- `reciprocityRatificationGate.ts` — deterministic gate enforcing
  Section 11 reciprocity terms. Refuses to advance the playbook
  unless every required term is ratified.
- `carrierConsentLedger.ts` — pure event-sourced ledger of carrier
  candidate consents (`proposed`, `consented`, `declined`,
  `withdrawn`). Honours consent revocability per
  [OCI_INTERVENTION_ETHICS.md](../OCI_INTERVENTION_ETHICS.md) §2.5.
- `residualConcentrationReader.ts` — reads pre-/post-redistribution
  carrier load and emits a categorical residual reading
  (`relieved`, `partially_relieved`, `unchanged`, `worsened`).
  Reads, not scores.
- `redistributionExecutionEngine.ts` — composes the three engines
  above with `stewardshipRedistributionEngine`,
  `interventionTrackingEngine`, and the stabilization state engine
  to produce a deterministic executable redistribution plan with
  canonical signal envelopes.

All four engines are pure, append-only where applicable, and write
no database. They are read by the facilitator and the governance
body; they do not act on behalf of the institution.

---

## Doctrine references

- [Playbook index](README.md)
- [STEWARDSHIP_REDISTRIBUTION.md](../STEWARDSHIP_REDISTRIBUTION.md) — framework-level companion document
- [OCI_STABILIZATION_FRAMEWORK.md](../OCI_STABILIZATION_FRAMEWORK.md)
- [OCI_INTERVENTION_ETHICS.md](../OCI_INTERVENTION_ETHICS.md)
- [OCI_ANTI_SURVEILLANCE_POSITION.md](../../../OCI_ANTI_SURVEILLANCE_POSITION.md)
- [OCI_AI_BOUNDARY.md](../../../OCI_AI_BOUNDARY.md)
- [OCI_DATA_HANDLING.md](../../../OCI_DATA_HANDLING.md)
