# Manual Operating Pack — Operator Usability Dry Run 001

> **Internal operating dry run. Not public copy. Not for external use unless separately reviewed and approved.**

## Template metadata

| Field | Value |
| --- | --- |
| Status | Internal operating dry run (completed) |
| Owner | Nzila Ventures |
| Last updated | 2026-07-12 |
| Related framework | CIVIC / CLEAR / SAGE |
| Public or internal | Internal only |
| Dry-run type | Operator usability test of the Manual Operating Pack |
| Proof run created? | No — paper-only usability test |

## 1. Purpose

This dry run tests whether the CLEAR/SAGE Manual Operating Pack can guide an internal operator through the
setup logic for a fictional proof run without creating a new proof run, public copy, software claim,
external package, or Proof Run 0.4.

## 2. Dry-run type

This is an operator usability dry run of the Manual Operating Pack. It is not a CLEAR/SAGE proof run.

## 3. Scenario used

- **Fictional scenario:** Example Service Review Office
- **Institution type:** Public accountability / service review office
- **Risk surface:** service-pathway continuity / public-guidance traceability / complaint-pathway boundary
  risk
- **Safe wedge:** service-pathway continuity + public-guidance traceability + accessibility implementation
  evidence + modernization reviewability

No-go zones for this scenario: no complaint files, no investigation files, no protected-disclosure files, no
adjudicative records, no evidence records, no witness records, no complainant/respondent records, no
findings, no reasons, no recommendations, no remedies, no individual case outcomes, no personal information,
no real institution named or targeted.

The scenario is used only to test whether the pack instructions are followable. It does not create a new
proof-run folder, index row, CLEAR brief, SAGE workspace, assurance package, or feedback decision record.

## 4. Pack files tested

- [manual-operating-pack/README.md](../README.md)
- [operator-checklist.md](../operator-checklist.md)
- [proof-run-runbook.md](../proof-run-runbook.md)
- [evidence-source-classification-guide.md](../evidence-source-classification-guide.md)
- [boundary-scan-checklist.md](../boundary-scan-checklist.md)
- [decision-record-checklist.md](../decision-record-checklist.md)
- [retrospective-checklist.md](../retrospective-checklist.md)
- [packaging-export-prohibition-checklist.md](../packaging-export-prohibition-checklist.md)

## 5. Operator sequence tested

Walking the pack's required sequence on paper only:

1. Confirm fictional/internal scope. — followable.
2. Select institution type before framing. — followable (Public accountability / service review office).
3. Choose the safe wedge. — followable.
4. Record red lines and exclusions. — followable using the no-go zones above.
5. Classify evidence sources. — followable (see Section 8).
6. Mark authorized-only placeholders. — followable (`[AUTHORIZED-ONLY]`).
7. Determine whether a CLEAR brief would be created. — yes, in a real run; not created here.
8. Determine whether a manual SAGE workspace would be assembled. — yes, in a real run; not created here.
9. Determine whether an assurance checklist would be completed. — yes, in a real run; not created here.
10. Determine whether a feedback integration decision record would be needed. — yes, in a real run; not
    created here.
11. Identify required scans. — governance, SAGE, real-institution, tribunal/ombuds boundary, health/PHI.
12. Determine whether a retrospective would be required. — only if a real run is created and finalized.
13. Confirm proof-runs index would not be updated because no proof run is created. — confirmed.
14. Confirm no external package/export is allowed. — confirmed (external sharing = NEEDS REVIEW).

No CLEAR brief, SAGE workspace, assurance checklist, feedback decision record, retrospective, or proof-runs
index row was created.

## 6. Operator checklist usability

| Checklist area | Usability result | Notes | Improvement needed? |
| --- | --- | --- | --- |
| Pre-run / scope gate | Usable | Fictional/internal scope and no-real-institution checks are explicit | No |
| Evidence gate | Usable | Classification + authorized-only markers map cleanly to the guide | No |
| CLEAR / SAGE gates | Usable | Clear that these are gates, not required to be completed in a rehearsal | No |
| Status values | Usable | PASS / NEEDS REVIEW / N/A are unambiguous | No |
| Packaging / export gate | Usable | Catches public/product drift and external-package prohibition | No |
| No-004 rule | Usable via runbook | Checklist assumes a real run; the no-004 rule lives in the runbook | Minor — see §15 |

The checklist can be followed without inventing new gates; statuses are clear; it prevents public/product
drift. The explicit "no 004 folder in a rehearsal" rule is carried by the runbook, not the checklist.

## 7. Proof-run runbook usability

- Makes clear a proof run *starts* at Step 1 (create proof-run folder + index row `In progress`).
- Makes clear when index status changes are required (Steps 9, 10, 12).
- Prevents direct movement from proof run to UI/public/product/procurement (closing warning).
- Distinguishes setup rehearsal from proof-run creation only implicitly — a "usability dry-run mode" note
  would make the boundary explicit (see §15).

## 8. Evidence-source classification usability

Classifying sample candidates on paper (no evidence register created):

| Source candidate | Classification | Reason | Use allowed in hypothetical setup? |
| --- | --- | --- | --- |
| public mandate statement | Public | Published, openly available | Yes |
| public service pathway guide | Public | Published public guidance | Yes |
| public annual report | Public | Published report | Yes |
| public accessibility plan | Public | Published plan | Yes |
| public service standards | Public | Published standard | Yes |
| public modernization strategy | Public | Published strategy | Yes |
| `[AUTHORIZED-ONLY]` internal service owner interview notes | Authorized-only | Usable only with recorded authorization; placeholder, not accessed | No (placeholder only) |
| complaint file | Excluded | Case/complaint material | No |
| investigation file | Excluded | Investigation material | No |
| personal information | Excluded | Not collected unless authorized, minimized, necessary | No |

The classification guide is usable: every candidate resolved to a single class without improvisation.

## 9. Boundary-scan checklist usability

Scan categories identified for this scenario: governance scan, SAGE productization scan, real-institution
containment scan, tribunal/ombuds boundary scan (adjudication-adjacent), and health/PHI premature-claim
scan. A regulator boundary scan is not applicable to this scenario.

The scan checklist is usable if it helps distinguish prohibited hits from expected boundary/no-go/
scan-instruction hits. It does, via the expected-match rule; a one-line rubric at the top would make that
faster to apply (see §15).

## 10. Decision-record checklist usability

Allowed affected layers remain: Internal operations only, Kit calibration, Proof-run documentation,
Retrospective documentation, No change. Prohibited affected layers remain: Public copy, Product, SAGE UI,
Pricing, Procurement, Pilot/demo, External assurance, Real-institution positioning. The checklist keeps
affected layers controlled without improvisation.

## 11. Retrospective checklist usability

- The 15-section structure is clear and matches the completed proof-run retrospectives.
- It prevents skipping boundary/evidence/SAGE-posture review (each is a required section).
- It ties retrospective completion to the index status (`Complete — retrospective complete`).
- It makes clear no retrospective is required unless an actual proof run is created and finalized — this
  dry run correctly required none.

## 12. Packaging / export prohibition checklist usability

Confirmed: external sharing remains NEEDS REVIEW; no proof-run material may be used as public copy; no
sales/procurement/pilot/demo language may be created; no real institution may be named or targeted; no
clinical/PHI, legal, regulatory, tribunal, procedural-fairness, or compliance validation may be claimed. One
gap: the checklist prohibits *external* export but does not explicitly say a polished *internal* export
package still needs review (see §15).

## 13. What worked

- The pack sequence is followable end to end on paper.
- The internal-only posture is repeated enough to prevent drift.
- Evidence classification is usable; every sample candidate resolved to one class.
- Boundary scans are operationalized with runnable commands and an expected-match rule.
- The packaging/export prohibition is explicit.
- No Proof Run 0.4 was needed to test the pack.

## 14. What was unclear or manual-heavy

- An operator could confuse setup rehearsal with proof-run creation; the runbook lacks an explicit
  "usability dry-run mode" note.
- The evidence-source classification guide would be faster to apply with a compact quick-reference table.
- The boundary-scan checklist expected-match rule is correct but sits mid-document; a top-level one-line
  rubric would speed review.
- The packaging/export checklist covers external export but not polished internal export packages.

## 15. Required pack improvements

Low-risk only:

- add a "usability dry-run mode" note to `proof-run-runbook.md`
- add a quick-reference source-classification table to `evidence-source-classification-guide.md`
- add a top-level expected-match rubric to `boundary-scan-checklist.md`
- add a line to `packaging-export-prohibition-checklist.md` clarifying that polished internal export
  packages remain NEEDS REVIEW

No UI or automation is recommended.

## 16. What this dry run did not do

- did not create Proof Run 0.4
- did not create a 004 folder
- did not create a new proof-runs index row
- did not complete a CLEAR brief
- did not assemble a SAGE workspace
- did not complete an assurance package
- did not complete a feedback decision record
- did not create public copy
- did not create software, automation, or product claims
- did not validate real-institution use
- did not validate clinical/PHI/health-system readiness

## 17. Decision

The Manual Operating Pack is usable for internal operator guidance, with minor low-risk improvements
recommended before relying on it as the default execution aid for future proof runs.

## 18. Next recommended action

Apply only low-risk usability refinements to the Manual Operating Pack. Do not create Proof Run 0.4, UI,
public copy, product claims, or external packaging.
