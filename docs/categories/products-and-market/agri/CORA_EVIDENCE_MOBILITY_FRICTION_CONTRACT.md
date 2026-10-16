# Cora Evidence Mobility Friction Contract

**Status:** Internal synthetic action-count measurement only; not a public KPI,
elapsed-time study, producer productivity claim, or institutional acceptance.

## Measurement boundary

The [strict input and comparison](../../../../apps/cora/lib/evidence-reuse/metrics.ts)
use `EvidenceMobilityFriction` to compare the same evidence ID/version and
consuming context in `BASELINE_WITHOUT_REUSE` and `GOVERNED_REUSE` scenarios.
Proof kind is explicitly `SYNTHETIC_ACTION_COUNTS`. All counts are nonnegative
integers. Mismatched contexts, versions or scenario roles are rejected.

| Count                         | Meaning                                             |
| ----------------------------- | --------------------------------------------------- |
| `sourceRetrieval`             | Separate retrieval for the consuming context.       |
| `manualReentry`               | Operator re-entry of evidence facts.                |
| `duplicateDocumentProduction` | Making a replacement/repeated document.             |
| `semanticClarification`       | Clarifying interpretation or limitations.           |
| `permissionRemediation`       | Recipient-specific permission work.                 |
| `institutionalReverification` | The recipient's independent verification/review.    |
| `evidenceReconstruction`      | Rebuilding an assertion rather than referencing it. |

The comparison returns both complete input records, total baseline and reuse
counts, `frictionDelta = baselineTotal - reuseTotal`, per-step avoided counts,
remaining counts, and added counts. Negative delta is permitted and represents
more friction; it is not converted into a success. Steps have no assumed
duration or weight. Zero eligible events in the separate reuse metric is not
represented as perfect reuse.

## Bounded synthetic result

| Step                          | Baseline B without governed reuse | Cora B with governed reuse |
| ----------------------------- | --------------------------------- | -------------------------- |
| Source retrieval              | 1                                 | 0                          |
| Manual re-entry               | 1                                 | 0                          |
| Duplicate document production | 1                                 | 0                          |
| Semantic clarification        | 1                                 | 1                          |
| Permission remediation        | 1                                 | 1                          |
| Institutional re-verification | 1                                 | 1                          |
| Evidence reconstruction       | 1                                 | 0                          |
| **Total**                     | **7**                             | **3**                      |

**Synthetic friction delta: 4 actions avoided.** Clarification, permission work
and institutional re-verification remain. The qualifier's reconstruction
trace is bound to the same consuming context and evidence ID/version; its
four reconstruction-related counts must be zero for qualified reuse. The
tests assert those counts rather than relying on a label.

The comparison is a designed fixture, not observed operator activity or
telemetry. The baseline, trace and issuer registry are synthetic evidence of
local conformance only. This does not meet the normative live proof's
observed median elapsed-time threshold of at least 30%, written recipient
acceptance, or actual operator-control workflow requirements.

See [reuse event contract](CORA_CROSS_INSTITUTIONAL_REUSE_EVENT_CONTRACT.md),
[Slice 6 proof](CORA_INSTITUTIONAL_EVIDENCE_REUSE_SLICE_6.md), and
[first cross-institutional proof contract](CORA_FIRST_CROSS_INSTITUTIONAL_PROOF_CONTRACT.md).
