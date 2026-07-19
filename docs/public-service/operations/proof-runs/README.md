# CLEAR/SAGE Proof Runs — Index

> **Internal operating draft. Not public copy. Not for external use unless separately reviewed and approved.**

## 1. Purpose

This index tracks the internal CLEAR/SAGE dry runs. Each proof run exercises the Alpha Operating Kit
end to end against one fictional institutional question, so the kit improves from actual use rather than
theory. Proof runs are internal operations material only.

## 2. Proof-run rules

- Fictional unless explicitly approved otherwise.
- Internal only.
- No real institution named (and no real institution named in negation).
- No public outreach asset.
- No product, procurement, pricing, pilot, demo, or SOW language.
- No SAGE availability claim.
- No prohibited conclusions.
- Every run must end with a feedback-integration decision.
- Every run should be followed by a retrospective before the next calibration.
- For regulator or regulator-adjacent proof runs, use the regulator-boundary convention in
  [../kit-conventions.md](../kit-conventions.md) before drafting the intake, evidence register, CLEAR
  brief, SAGE workspace, assurance checklist, or decision record.
- For tribunal, ombuds, public accountability, oversight, or adjudication-adjacent proof runs, use the
  tribunal / ombuds boundary convention in [../kit-conventions.md](../kit-conventions.md) before drafting
  the intake, evidence register, CLEAR brief, SAGE workspace, assurance checklist, or decision record.

## 3. Proof-run index

| Run | Fictional institution | Institution type | Risk surface tested | Status |
| --- | --- | --- | --- | --- |
| 001 | Example Crown Corporation | Crown corporation | mandate traceability / institutional memory / modernization reviewability | Complete — retrospective complete |
| 002 | Example Federal Regulator | Regulator | regulatory independence / enforcement-boundary / compliance-determination risk | Complete — retrospective complete |
| 003 | Example Public Accountability Office | Tribunal / ombuds office | adjudication-adjacent independence / complaint-handling / protected-disclosure / findings-and-recommendations boundary risk | Complete — retrospective complete |

## 4. Index maintenance

The proof-runs index must be updated whenever a proof run changes state.

Allowed status values:

- In progress
- Complete — retrospective pending
- Complete — retrospective complete
- Archived / superseded

Required update points:

- when a proof run branch is opened
- before merging a completed proof run
- when a retrospective is added
- when a retrospective changes the recommended next step
- when a proof run is archived or superseded

The index must not be left in a stale state after merge.

## 5. Manual synchronization rule

Each proof run must keep the following aligned:

- institution type
- institutional question
- safe wedge
- red lines and exclusions
- evidence source categories
- authorized-only markers
- confidence levels
- risk tier
- human-review path
- assurance checklist status
- feedback-integration decision

For regulator proof runs, regulator-specific exclusions must remain consistent across:

- institution intake
- evidence source register
- CLEAR brief
- SAGE workspace
- assurance checklist
- feedback-integration decision record
- retrospective, if added

For tribunal / ombuds proof runs, tribunal/ombuds-specific exclusions must remain consistent across:

- institution intake
- evidence source register
- CLEAR brief
- SAGE workspace
- assurance checklist
- feedback-integration decision record
- retrospective, if added

The public-guidance-versus-case-material distinction must be preserved throughout the proof run.

Synchronization drift is treated as a calibration issue, not a reason to create public copy or software.

## 6. What proof runs can demonstrate

- That the Alpha Operating Kit can be run manually end to end.
- That CLEAR can be executed by hand as an evidence-organizing method.
- That a SAGE-style workspace can be assembled manually as an internal document set.
- That institution-specific red lines can be recorded before evidence review.
- That the calibrated conventions (disclaimer, status, confidence, authorized-only marker, risk-tier
  phrasing, manual-sync discipline) hold in practice.

## 7. What proof runs cannot demonstrate

- No real institution validation.
- No external stakeholder feedback.
- No software, automation, or deployment readiness.
- No procurement, pricing, pilot, or demo readiness.
- No data-access readiness.
- No assurance opinion, audit opinion, or compliance certification.
- No regulatory validation or enforcement-related conclusion.

## 8. Next-run discipline

Run → learn → calibrate → run again. Each proof run is followed by a retrospective; calibration notes are
applied to the kit before the next run tests a new risk surface. Proof runs do not lead to public copy,
outreach assets, or software claims.
