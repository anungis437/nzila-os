# OCI Auditor Guide

DOCTRINE_VERSION: 1.0.0

> **Read this first.** OCI™ is the **human continuity layer** beneath operational resilience and governance continuity systems. It does not certify, replace, or substitute for any ISO, COBIT, or BCMS framework. Treat OCI outputs as **structural context with explicit confidence envelopes**.

## What OCI gives an auditor

1. **Bands, not scores.** Every primary output is a categorical band (e.g., `CONCENTRATED`, `PATTERNED`, `SEVERE`). Numerical indices are reported only to support the band.
2. **Confidence envelopes.** Every output carries a `confidence` state (`HIGH | MODERATE | LOW | INSUFFICIENT`), a `sampleSize`, a `dataCompleteness` value, a `stability` classification, a `decay` band, and a list of `cautionStates`. **Auditors must record the envelope alongside the band.**
3. **Reproducibility hashes.** Every Entropy Audit Packet™ carries a `reproducibilityHash` (SHA-256 over canonicalised inputs). Two reviewers running the same observations produce the same hash.
4. **Caution states.** Six canonical cautions: `SMALL_SAMPLE`, `INCOMPLETE_VISIBILITY`, `HIGH_VARIANCE`, `TRANSITIONAL_INSTABILITY`, `OUTDATED_ASSESSMENT`, `LIMITED_GOVERNANCE_EVIDENCE`.

## What OCI does NOT give an auditor

- Risk scores, risk rankings, risk treatments.
- BCMS conformance evidence.
- Quantitative recovery objectives.
- Personal information about carriers.
- Predictive probabilities.

## Auditor validation checklist

For each OCI reading cited in a finding or report:

- [ ] Is the band stated explicitly?
- [ ] Is the `confidence` state recorded (one of `HIGH | MODERATE | LOW | INSUFFICIENT`)?
- [ ] Are all `cautionStates` reproduced verbatim?
- [ ] Is `sampleSize` ≥ the sample-size policy threshold for the cited band? If not, is the caution `SMALL_SAMPLE` present?
- [ ] Is `decay` ≤ `MILD`? If not, has a refresh been requested?
- [ ] Is the `reproducibilityHash` of the underlying Entropy Audit Packet™ recorded in the audit workpaper?
- [ ] If the Reviewer Variance Model™ reports `calibrationConfidence ∈ {LOW, INSUFFICIENT}`, has reviewer-led re-examination been scheduled?
- [ ] Have escalation flags from the Evidence Sufficiency Engine™ been triaged?

## How to read the bands without over-reading

| Band kind | Interpret as | NEVER interpret as |
|---|---|---|
| `CONCENTRATED` (SDI/HHI) | Continuity risk surface | Institutional misconduct |
| `PATTERNED`/`INSTITUTIONAL` (GES) | Governance documentation asymmetry | Bad governance |
| `SEVERE`/`SUBSTANTIAL` (CBM/RBI) | Reconstruction burden posture | Imminent failure |
| `EXTREME` (Gini) | Stewardship-burden asymmetry | Worker exploitation finding |
| `INSUFFICIENT` (confidence) | We don't know yet | The institution is at fault |

## Anti-surveillance reminder

OCI **never** inspects holder names, free-text notes, or individual identities. If you encounter a report that does, it is not OCI-compliant.

See also: [`OCI_COVERAGE_MATRIX.md`](./OCI_COVERAGE_MATRIX.md), [`../methodology/OCI_METHOD_WHITEPAPER_v1.md`](../methodology/OCI_METHOD_WHITEPAPER_v1.md).
