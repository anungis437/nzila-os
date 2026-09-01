# OCI Continuity Event Runtime™

**Status:** Doctrine for the discrete continuity event layer of OCI Runtime Infrastructure™ (Product 4).

**Audience:** Stewards of the runtime, certified facilitators, engineering stewards of `apps/union-eyes/lib/runtime/events/`.

---

## 1. Purpose

The Continuity Event Runtime composes continuity-safe event sequences that describe how an institution's continuity posture has moved over time. The runtime does not observe operational systems on its own; events are supplied by a reviewer (or by a deterministic upstream engine acting under reviewer-led configuration).

Events are deterministic statements about institutional movement. They are never predictions and never recommendations.

---

## 2. The ten canonical event kinds

| Kind                                  | Default severity | Meaning                                                                                             |
| ------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------- |
| `GovernanceInterpretationChanged`     | observation      | A governance body has restated an interpretation that informs continuity.                           |
| `StewardshipConcentrationElevated`    | warning          | A stewardship concentration band has moved toward `regressing`.                                     |
| `OperationalDependencyReduced`        | note             | An operational dependency on a single steward or system has been reduced.                           |
| `OnboardingSurvivabilityImproved`     | note             | An onboarding workflow's contribution to survivability has improved.                                |
| `ContinuityBreakpointIntroduced`      | critical         | A change has introduced a continuity breakpoint that did not previously exist.                      |
| `ReconstructionBurdenReduced`         | note             | A successor steward's reconstruction burden has been reduced.                                       |
| `GovernanceRecoveryRatified`          | observation      | A governance recovery move has been ratified by the governance body.                                |
| `RuntimeTransitionActivated`          | observation      | A P3 → P4 runtime transition has been activated by the institution.                                 |
| `InstitutionalMemoryRiskElevated`     | warning          | Institutional memory risk has moved toward `regressing`.                                            |
| `ModernizationContinuityGapDetected`  | warning          | A modernization decision has surfaced a continuity gap requiring reviewer-led attention.            |

The catalogue is closed. New kinds require a doctrinal change to `continuityEventTypes.ts`, `runtimeContracts.ts`, and this document.

---

## 3. Posture

- **Deterministic.** The same input always produces the same output.
- **Refusal-first.** Invalid envelopes are reported in `rejections`, not silently dropped.
- **Anti-surveillance.** Envelopes never carry personal identifiers.
- **Stable ordering.** Accepted events are sorted by `observedAt` then `eventId`.
- **Severity floor.** Severity may be elevated relative to the default but never downgraded.

---

## 4. Validation contract

`validateContinuityEventEnvelope` checks structural completeness only. Institutional meaning remains the reviewer's responsibility. Validation reports machine-readable violation codes (e.g. `event.eventId_missing`, `event.observedAt_not_iso8601`).

`ingestContinuityEvents(envelopes)` returns:

- `accepted`: events that passed validation, stably sorted,
- `rejections`: events that failed validation, with violation codes,
- `signals`: a refusable summary and per-rejection observation.

---

## 5. Boundaries

The Continuity Event Runtime is not:

- a stream processor,
- a publish/subscribe broker,
- a notification engine,
- a metrics surface.

It is a deterministic composer of refusable continuity-event sequences.

---

## 6. Cross-references

- `docs/oci/OCI_AI_BOUNDARY.md`
- `docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md`
- `docs/oci/runtime/OCI_RUNTIME_CONTRACTS.md`
- `docs/oci/runtime/OCI_GOVERNANCE_MEMORY_RUNTIME.md`
- `docs/oci/runtime/OCI_CONTINUITY_LEDGER.md`
- `docs/oci/runtime/OCI_OPERATING_PRIMITIVES.md`
