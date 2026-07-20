# Evidence Index — deeper materials (available on request, not attached)

> The Independent Review Brief is deliberately self-contained. The
> materials below are indexed here so that if you want to test any
> specific claim in the brief, you can request the exact document — but
> nothing below is attached by default, and the reviewer is not asked to
> read any of it.
>
> **Doctrine version:** 1.0.0 · **As of:** 2026-07-20

## Authoritative status of every claim

- [`../../IMPLEMENTATION_STATUS.md`](../../IMPLEMENTATION_STATUS.md) —
  the authoritative matrix of `PROPOSED` / `IMPLEMENTED` /
  `INTERNALLY_TESTED` / `PROOF_RUN_VERIFIED` / `EXTERNALLY_VALIDATED` /
  `EMPIRICALLY_MEASURED` per artifact. Where any wording elsewhere in the
  corpus drifts from this matrix, the matrix wins.
- [`../../EVIDENCE_MANIFEST.md`](../../EVIDENCE_MANIFEST.md) — commit
  SHA, artifact versions, and the exact reproducible fixture referenced
  in the worked-finding section of the review brief.

## Architecture

- [`../../GOVERNMENT_READINESS_ARCHITECTURE_DECISION.md`](../../GOVERNMENT_READINESS_ARCHITECTURE_DECISION.md)
  — the reasoning that produced an additive read-only layer rather than a
  sector-specific scoring overlay.
- [`../../OCI_OCRA_GOVERNMENT_READINESS_MASTER_BLUEPRINT.md`](../../OCI_OCRA_GOVERNMENT_READINESS_MASTER_BLUEPRINT.md)
  — the program-level blueprint.
- [`../../OCI_OCRA_VALIDATION_BINDER.md`](../../OCI_OCRA_VALIDATION_BINDER.md)
  — the internal binder with the open-limits list (§3).
- [`../../OCI_OCRA_POLICY_TRACEABILITY_ARCHITECTURE.md`](../../OCI_OCRA_POLICY_TRACEABILITY_ARCHITECTURE.md)
  — the evidence → finding → obligation → dimension → consequence chain.
- [`../../OCI_OCRA_CONFIDENCE_ARCHITECTURE.md`](../../OCI_OCRA_CONFIDENCE_ARCHITECTURE.md)
  — the ordinal, evidence-fed confidence envelope.
- [`../../OCI_OCRA_EXPLAINABILITY_MODEL.md`](../../OCI_OCRA_EXPLAINABILITY_MODEL.md)
  — the seven-answer contract.
- [`../../OCI_OCRA_OBLIGATION_TAXONOMY.md`](../../OCI_OCRA_OBLIGATION_TAXONOMY.md)
  · [`../../OCI_OCRA_CONSEQUENCE_MODEL.md`](../../OCI_OCRA_CONSEQUENCE_MODEL.md).
- [`../../OCI_OCRA_SOURCE_INSTRUMENT_TRACEABILITY.md`](../../OCI_OCRA_SOURCE_INSTRUMENT_TRACEABILITY.md)
  — source-instrument model (seed catalogue `UNVERIFIED`).

## Security, privacy, and reliability

- [`../../SECURITY_AND_DATA_HANDLING_BRIEF.md`](../../SECURITY_AND_DATA_HANDLING_BRIEF.md)
  — data-handling posture, with an explicit register of security-
  assurance items that are `PROPOSED` per engagement and not yet
  independently attested.
- [`../../OCI_OCRA_INTER_RATER_RELIABILITY_MODEL.md`](../../OCI_OCRA_INTER_RATER_RELIABILITY_MODEL.md)
  — the IRR model (measurement not yet performed).
- [`../../OCI_OCRA_ASSESSOR_CERTIFICATION_STANDARD.md`](../../OCI_OCRA_ASSESSOR_CERTIFICATION_STANDARD.md)
  — assessor governance program (policy-only; no certified corps).
- [`../../OCI_OCRA_BENCHMARK_GOVERNANCE_REVIEW.md`](../../OCI_OCRA_BENCHMARK_GOVERNANCE_REVIEW.md)
  — the k-anonymity K = 5 publication rules.

## Procurement, standards, and go-to-market

- [`../../OCI_OCRA_PROCUREMENT_READINESS_ASSESSMENT.md`](../../OCI_OCRA_PROCUREMENT_READINESS_ASSESSMENT.md)
  — the honest procurement-readiness self-assessment.
- Standards crosswalks (ISO 22301 / 31000 / 37000; COBIT): available in
  the wider docs tree on request.

## Tests

- Government-readiness suite:
  [`apps/union-eyes/lib/icra/__tests__/government-readiness/`](../../../../apps/union-eyes/lib/icra/__tests__/government-readiness/).
- `@nzila/oci-confidence` package tests:
  [`packages/oci-confidence/`](../../../../packages/oci-confidence/).

## Internal-only (**not for external distribution**)

- [`../../INTERNAL_PRE_MORTEM_HYPOTHETICAL_REVIEWER_CHALLENGES.md`](../../INTERNAL_PRE_MORTEM_HYPOTHETICAL_REVIEWER_CHALLENGES.md)
  — Nzila red-team pre-mortem. **Not** external validation. **Must not**
  be attached to any external send. Renamed from the earlier, misleading
  title *"Government Validation Report V1"*.
