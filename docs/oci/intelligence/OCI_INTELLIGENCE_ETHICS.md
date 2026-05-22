# OCI Intelligence Ethics™

**Artifact type:** Doctrine
**Module:** OCI Intelligence Network
**Doctrine version:** 1.0.0
**Posture:** reviewer-led · refusal-first · anti-surveillance · opt-in only

---

OCI Intelligence Ethics™ is the doctrinal protection layer of Product 5. It
is implemented as runtime validators, not as guidance prose: the network
**refuses** outputs that would violate doctrine.

## Required principles

| Principle                            | Mechanism                                                |
| ------------------------------------ | -------------------------------------------------------- |
| k-anonymity enforcement              | `checkKAnonymity()`; `K_ANONYMITY_FLOOR = 5`            |
| Opt-in participation                 | `checkParticipation()` against the participation grants  |
| No institutional exposure            | `checkAnonymisationIntegrity()`; handle whitelist        |
| No rankings                          | `checkAgainstRanking()`; forbidden key list              |
| No worker profiling                  | Contracts carry no worker fields; ingest refuses extras  |
| No governance reputation scoring     | `checkAgainstRanking()`; profile prose is non-evaluative |
| Reviewer-led interpretation          | `checkReviewerReference()`; reports invite, not conclude |
| Institutional dignity preservation   | Refusal envelopes return rather than inferred readings   |

## Rejection reasons

`EthicsRejectionReason` is a closed set:

- `cohort_below_k_anonymity_floor`
- `institution_not_opted_in`
- `scope_not_granted`
- `institution_handle_exposed`
- `ranking_payload_detected`
- `reviewer_reference_missing`
- `sector_mismatch`

## Refusal posture

Refusals are returned as `EthicsVerdict { readable: false, reasons: [...] }`.
The network never throws on policy refusals; refusal is a first-class outcome
so callers can route the refusal back to the reviewer.

## Cross-references

- `docs/oci/intelligence/OCI_INTELLIGENCE_NETWORK.md`
- `docs/oci/intelligence/OCI_INTELLIGENCE_CONTRACTS.md`
- `docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md`
- `docs/oci/OCI_AI_BOUNDARY.md`
- `docs/oci/OCI_DATA_HANDLING.md`
