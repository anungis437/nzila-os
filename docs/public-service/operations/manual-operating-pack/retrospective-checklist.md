# Retrospective Checklist

> **Internal operating template. Not public copy. Not for external use unless separately reviewed and approved.**

## 1. Purpose

Standardize retrospective creation so every completed proof run is evaluated the same way and the
proof-runs index stays accurate.

## 2. When a retrospective is required

Create a retrospective when a proof run is finalized (status `Complete — retrospective pending`). A run is
not fully closed until its retrospective lands and the index reads `Complete — retrospective complete`.

## 3. Required retrospective sections

1. Purpose
2. What the proof run tested
3. What worked
4. What was unclear or manual-heavy
5. What the calibrated kit proved
6. What the calibrated kit did not prove
7. Template calibration notes
8. Boundary performance
9. Evidence-handling performance
10. SAGE posture performance
11. Domain-specific stress-test result
12. Changes recommended now
13. Changes to defer
14. Decision
15. Next proof-run recommendation

## 4. Boundary-performance review

Confirm the run preserved: no prohibited conclusions, no scoring, no automated decisions, no source-system
replacement, no direct data-access assumption, no SAGE availability/product claim, no public-copy drift, and
all domain-specific exclusions.

## 5. Evidence-handling review

Confirm reference/link-first posture, `[AUTHORIZED-ONLY]` handling, exclusion of prohibited material,
personal-information minimization, provenance, confidence, freshness, and open questions.

## 6. SAGE-posture review

Confirm SAGE remained a manual internal workspace pattern with no software, availability, launch,
productization, procurement, or external-use implication.

## 7. Calibration recommendation review

Recommend only low-risk, reusable calibrations. Route them to a small calibration PR before the next run.

## 8. Deferred-items review

Confirm UI, automation, app route, SAGE public page, real-institution runs, external assurance,
health/PHI runs, and any validation material remain deferred.

## 9. Index-update rule

When a retrospective lands, update the proof-runs index status to `Complete — retrospective complete`.

## 10. Completion criteria

- All 15 sections present.
- Boundary, evidence-handling, and SAGE-posture reviews pass.
- Calibration recommendations (if any) are low-risk and routed separately.
- Proof-runs index updated to `Complete — retrospective complete`.
