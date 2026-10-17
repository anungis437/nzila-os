# Cora Cross-Institutional Reuse Event Contract

**Status:** Slice 6B synthetic-only in-memory conformance contract.
No production persistence, live source, real certifier, selected second
consumer, or institutional acceptance is established.

## Contract and qualification

`CrossInstitutionalEvidenceReuseEvent` is separate from technical resolution
and recipient-owned disposition. Its pure qualifier evaluates both recipients
again at the reuse timestamp. It does not trust submitted resolution states or
copy Context A's decision into Context B.

Implementation:
[contracts](../../../../apps/cora/lib/evidence-reuse/contracts.ts),
[qualifier and strict event schema](../../../../apps/cora/lib/evidence-reuse/reuse.ts),
and [independent interpretation](../../../../apps/cora/lib/evidence-reuse/resolve-use.ts).

| Field                                                                | Meaning                                                                                                                                                                                                                              |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `eventId`                                                            | Caller-supplied synthetic event identity; conflicting content under one ID is rejected by measurement.                                                                                                                               |
| `opportunityKey`                                                     | Deterministic identity from exact evidence references and independently scoped context, recipient, purpose, requirement/version, authorization, and interpretation/version references. Repeated evaluation is not a new opportunity. |
| `evidenceId`, `evidenceVersion`, `provenanceRef`                     | Stable originating governed assertion identity/version and source provenance; not a payload hash substituted for evidence identity.                                                                                                  |
| `originating`, `consuming`                                           | Context/institution/recipient, decision authority, purpose, requirement/version, authorization, and interpretation/version references.                                                                                               |
| `reuseTimestamp`                                                     | Evaluation time, not source observation time or a currentness claim.                                                                                                                                                                 |
| `reconstructionAvoided`, `reconstructionEvidence`                    | Explicit state and a synthetic action trace bound to the consuming context and evidence version. Qualified reuse requires zero retrieval, re-entry, duplicate production, and reconstruction.                                        |
| `qualification`, `rejectionReasons`                                  | Explicit result; rejected attempts are retained as diagnostics, not counted as reuse.                                                                                                                                                |
| `eligibleOpportunity`                                                | Independently authorized, same-governed-assertion, technically evaluable reference-use opportunity. An unproven reconstruction-avoidance opportunity can enter the denominator but not the numerator.                                |
| `originatingResolution`, `consumingResolution`, `supportingEvidence` | Reference-only technical outcomes and all evaluated evidence/authority references, including conflicts. No claim payload or institutional disposition.                                                                               |

The bounded implementation requires the **same immutable governed assertion
envelope**, not merely equal document bytes or matching names. Identity,
version, issuer binding, source record/version, provenance, scope and claims
are retained. A new technical record around the same payload is not reused
evidence. Changed issuer/identity/version/provenance fails qualification.

Distinct contexts must have distinct institutions, recipients, decision
authorities, authorization references and independently owned interpretation
references. Using A's disposition as B's authority is expressly rejected.
This is a conservative bounded test, not a general institutional identity
registry or permission service.

## Classification

| Classification            | Meaning / measurement                                                                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `QUALIFIED_REUSE`         | Same governed assertion, independent authorized contexts, evaluable technical results, and evidenced reconstruction avoidance. Counts once.                                        |
| `DUPLICATE_UPLOAD`        | Repeated upload or replacement technical record, not governed evidence-reference reuse. Excluded.                                                                                  |
| `RECONSTRUCTED_ASSERTION` | Assertion recreated for the consuming context. Excluded.                                                                                                                           |
| `TECHNICAL_COPY_ONLY`     | Copies, caches, mappings, and repeated Cora-internal processing. Excluded.                                                                                                         |
| `NOT_AUTHORIZED`          | Required source or recipient disclosure authorization absent/unknown/denied/conditional/revoked/not yet valid. Excluded.                                                           |
| `NOT_SAME_EVIDENCE`       | Different governed identity, version, authority, provenance or immutable envelope. Excluded.                                                                                       |
| `NOT_INDEPENDENT_CONTEXT` | Institutional/context/decision independence not established. Excluded.                                                                                                             |
| `INELIGIBLE`              | Blocked technical resolution or reconstruction avoidance not established. Counts in denominator only when the underlying governed reference-use opportunity is otherwise eligible. |

`MATCHED`, `PARTIAL`, and `NOT_SATISFIED` can each accompany qualified reuse.
Use is not acceptance. `UNKNOWN`, `CONFLICT`, `EXPIRED`, and
`NOT_AUTHORIZED` cannot qualify. Expired rights remain `EXPIRED` in resolution,
with an excluded `INELIGIBLE` diagnostic rather than a new resolution state.
No winning claim is selected in a conflict.

## Authority and rights boundary

[Continuity support and assertion binding](../../../../apps/cora/lib/evidence-reuse/authority.ts)
recompute mapped support from an integrity-checked capsule using the existing
rights-aware mapping helper. Support keeps lineage to capsule, capture,
source record/version, provider, issuer, mapping/version, provenance and
source rights. It is not automatically an assertion.

An assertion requires an exact candidate-bound issuer decision from the
`IssuerAuthorityPort`: established issuer-for-assertion relationship,
matching issuer/reference/digest and a valid binding period. The digest binds
evidence identity/version, class, subject, scope, methodology, temporal
metadata, support claims, source lineage and rights metadata. Authority is
rechecked for every use; the cached binding on the assertion is not sufficient.

The port is a trust boundary. The synthetic registry is fixture code, not
cryptographic issuer verification, accreditation evidence, an authority
registry, or production authorization. A real port must verify issuer role,
relationship, assertion scope and current authority from approved canonical
services. No route or app is wired to this port.

Each recipient has its own complete rights vector. Underlying source
disclosure and recipient disclosure are evaluated separately for the exact
purpose/recipient/time. Disclosure does not authorize persistence,
transformation, export, rehydration, deletion or post-disconnect retention.
The synthetic continuity support path has its own bounded capture/mapping/
assembly rights; those do not transfer to recipients.

## Internal measurement

`EvidenceReuseRatio` returns:

- numerator: unique qualified reuse opportunities;
- denominator: unique eligible cross-context governed evidence-use opportunities;
- ratio, or `null` with `NO_ELIGIBLE_OPPORTUNITIES`;
- excluded-event counts by classification;
- repeated-evaluation count.

Idempotency ignores event ID and evaluation time when the evaluated content
is unchanged. Interpretation/requirement versions remain part of opportunity
identity. Conflicting content under an event ID or contradictory evaluations
of one opportunity cause an explicit error requiring reconciliation. This
in-memory metric does not provide durable idempotency, lifecycle aggregation
or a historical authorization ledger.

The metric is internal only. The synthetic sample `1 / 2 = 0.5` includes one
qualified reference-use opportunity and one otherwise eligible opportunity
whose reconstruction avoidance is unknown; duplicate, reconstructed and
technical-copy attempts are excluded. Three alternative A/B/C interpretations
are not three observed real-world reuse events.

See [Slice 6 proof](CORA_INSTITUTIONAL_EVIDENCE_REUSE_SLICE_6.md) and the
[normative live-proof contract](CORA_FIRST_CROSS_INSTITUTIONAL_PROOF_CONTRACT.md).
