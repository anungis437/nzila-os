# OCI Auditor Quick Reference

DOCTRINE_VERSION: 1.0.0

A one-page operational checklist for an external auditor encountering OCI™ output.

## At-a-glance interpretation

| You see | It means | It does NOT mean |
|---|---|---|
| `confidence: HIGH` | The reading meets every Universal Confidence threshold | The reading is a probability or guarantee |
| `confidence: INSUFFICIENT` | The methodology refuses to interpret | The institution is at fault |
| `band: CONCENTRATED` / `HIGHLY_CONCENTRATED` | Continuity risk surface — successor pathways are not documented | The institution is misgoverned |
| `band: SEVERE` (RBI/decay) | Reconstruction burden / refresh urgency | Imminent failure |
| `cautionState: SMALL_SAMPLE` | Below the methodology's sample-size policy | The reviewer is unreliable |
| `cautionState: TRANSITIONAL_INSTABILITY` | Reading was taken in a transition window | The institution is unstable |
| `escalationFlags: ["escalation:urgent", …]` | Reviewer-led re-examination required | Audit failure |
| `contradictoryEvidence: […]` | Strong observations disagree — re-examine | Either side is wrong |

## Three things to record per OCI citation

1. The **band** (verbatim).
2. The **confidence envelope**: `confidence`, `sampleSize`, `dataCompleteness`, `decay`, full `cautionStates` list.
3. The Entropy Audit Packet™ `reproducibilityHash` (if applicable).

## When to escalate

Escalate for reviewer-led re-examination when **any** of these holds:

- `confidence == INSUFFICIENT`
- `decay == SEVERE`
- `contradictionsDetected == true`
- `escalationRequired == true`
- Reviewer Variance Model™ reports `calibrationConfidence ∈ { LOW, INSUFFICIENT }`

## Anti-claims (memorise)

- OCI is **not** equivalent to ISO 22301, ISO 37000, ISO 31000, or COBIT 2019.
- OCI does **not** certify compliance.
- OCI does **not** rank institutions.
- OCI does **not** infer behaviour of individuals.

See also: [`../compliance/OCI_AUDITOR_GUIDE.md`](../compliance/OCI_AUDITOR_GUIDE.md), [`OCI_CONFIDENCE_INTERPRETATION_GUIDE.md`](./OCI_CONFIDENCE_INTERPRETATION_GUIDE.md).
