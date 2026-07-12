# Proof-Run Runbook

> **Internal operating template. Not public copy. Not for external use unless separately reviewed and approved.**

## 1. Purpose

A step-by-step runbook for completing a future internal, fictional CLEAR/SAGE proof run using the Alpha
Operating Kit and the calibrated conventions. Follow it in order; do not improvise boundary language.

> **Usability dry-run mode:** To rehearse the setup logic without creating a proof run, walk Steps 1–12 on
> paper only — do **not** create a proof-run folder, a `NNN-*` directory, a proof-runs index row, or any
> completed proof-run file. Record the rehearsal under
> [usability-dry-runs/](usability-dry-runs/) instead. A proof run is only *created* when Step 1 actually
> adds a folder and index row.

## 2. Inputs required

- A fictional institution label (never a real institution).
- Institution type (selected from the adaptation framework).
- The safe wedge and the institutional question.
- The applicable boundary convention from [kit-conventions.md](../kit-conventions.md) (base, regulator §8,
  or tribunal/ombuds §9).

## 3. Step 1 — create proof-run folder

Create `docs/public-service/operations/proof-runs/NNN-example-<label>/` and add the run to the proof-runs
index with status `In progress`.

## 4. Step 2 — complete institution intake

Complete `institution-intake.md`. Select institution type before framing; record red lines and exclusions
before evidence review.

## 5. Step 3 — complete evidence source register

Complete `evidence-source-register.md`. Classify every source (see
[evidence-source-classification-guide.md](evidence-source-classification-guide.md)); mark authorized-only
placeholders `[AUTHORIZED-ONLY]`; exclude prohibited material.

## 6. Step 4 — draft CLEAR brief

Complete `clear-brief.md`. Keep findings evidence-organizing; use calibrated confidence levels and the
reusable risk-tier phrasing; run the boundary check.

## 7. Step 5 — assemble manual SAGE workspace

Complete `sage-workspace.md`. Mirror sources from the register and CLEAR brief; complete the manual
synchronization check; keep the non-availability warning.

## 8. Step 6 — complete assurance checklist

Complete `assurance-package-checklist.md` using PASS / NEEDS REVIEW / N/A; mark external sharing
NEEDS REVIEW; confirm the prohibited-conclusions list is all absent.

## 9. Step 7 — complete feedback integration decision record

Complete `feedback-integration-decision-record.md`. Decide the affected layer (internal operations only for
a dry run); prevent public-copy drift (see
[decision-record-checklist.md](decision-record-checklist.md)).

## 10. Step 8 — run scans

Run the scans in [boundary-scan-checklist.md](boundary-scan-checklist.md) and record results. Any hit
outside no-go/boundary/expected-match context is a blocker.

## 11. Step 9 — update proof-runs index

Move the run status to `Complete — retrospective pending`. **A proof run is not complete until the
proof-runs index status is accurate.**

## 12. Step 10 — decide on retrospective

If the run is finalized, create the retrospective (see
[retrospective-checklist.md](retrospective-checklist.md)) and update the index status to
`Complete — retrospective complete`.

## 13. Step 11 — decide on calibration

If the retrospective surfaces a reusable drift risk, open a small calibration PR before the next run. Do
not calibrate speculatively.

## 14. Step 12 — close or defer next run

Record whether another proof run is warranted (see the readiness summary go/no-go criteria) or whether to
pause. Proof Run 0.4 (health-system) remains deferred unless a specific health-system rehearsal is needed.

## 15. Completion criteria

- All proof-run files present and internally consistent.
- Proof-runs index status accurate (allowed sequence:
  `In progress → Complete — retrospective pending → Complete — retrospective complete`).
- All scans reviewed with only no-go/boundary/expected-match matches.
- No public copy, product, pricing, procurement, pilot/demo, or external package produced.

> **Warning:** Do not move from a proof run directly to UI, public copy, productization, pricing,
> procurement, or external outreach.
