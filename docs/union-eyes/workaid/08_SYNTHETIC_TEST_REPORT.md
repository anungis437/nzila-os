# 08 — Synthetic test report

> Generated from the recorded run in `evidence/test-results.json`. A pass here proves that an isolated, pure contract behaves as specified against fabricated data. It is **not** runtime evidence and closes no runtime gate.

## Run

- Command: `node --test --test-reporter=junit test\authorization.test.ts test\claims.test.ts test\deadlines.test.ts test\followup.test.ts test\integration-contracts.test.ts test\isolation.test.ts test\pack-integrity.test.ts test\platform-repro.test.ts test\publication-revocation.test.ts test\referral.test.ts test\submission.test.ts` (from `tooling/workaid-prep`, via `node scripts/run-tests.ts`)
- Node v24.13.1; no dependency installed, no workspace file changed.
- Base commit: `38a824918cf2e7d7cfb7fcb0e796cbde45433be8`; working tree dirty at run time: true (the files under test are uncommitted until the slice is committed).
- Result: **177 passed, 0 failed, 0 skipped** of 177 test cases.

| Test file | Cases |
|---|---:|
| test/authorization.test.ts | 24 |
| test/claims.test.ts | 14 |
| test/deadlines.test.ts | 11 |
| test/followup.test.ts | 26 |
| test/integration-contracts.test.ts | 11 |
| test/isolation.test.ts | 4 |
| test/pack-integrity.test.ts | 14 |
| test/platform-repro.test.ts | 19 |
| test/publication-revocation.test.ts | 11 |
| test/referral.test.ts | 22 |
| test/submission.test.ts | 21 |

No failing tests.

## Acceptance matrix v0.2 (100 cases: WA-T001–T080 from the pack, WA-T081–T100 from the Grok delta)

| State | Count | Meaning |
|---|---:|---|
| EXECUTED_SYNTHETIC_PASS | 71 | At least one tagged test, all passing. Scope is the tagged test titles in the CSV; see caveat below. |
| EXECUTED_SYNTHETIC_FAIL | 0 | A tagged test failed. |
| BLOCKED_RUNTIME_OR_EXTERNAL | 17 | Cannot be executed in isolation (needs deployed runtime, UI, identity provider, legal decision or pilot data). |
| DESIGNED_NOT_EXECUTED | 12 | Could be executed in the isolated harness but has not been. |

**Caveat.** A matrix row is marked `EXECUTED_SYNTHETIC_PASS` when a test carrying its id passes. Several rows describe a platform surface (search, export, aggregates, runtime sessions) of which the harness exercises only the domain contract; the `Evidence` column in `data/WORKAID_ACCEPTANCE_MATRIX_v0.2.csv` names exactly what ran, and `Runtime_gate` is `NOT_CLOSED` on every row. Rows whose only tests are `platform-repro.test.ts` are labelled `SYNTHETIC_REPRO_OF_PLATFORM_DEFECT`: they show the defect is reproducible and the proposed assertion is satisfiable, not that the platform is fixed.

- **EXECUTED_SYNTHETIC_PASS (71):** T001, T002, T003, T004, T005, T006, T007, T008, T010, T011, T012, T013, T015, T016, T017, T018, T019, T023, T025, T026, T027, T028, T029, T030, T031, T032, T037, T038, T039, T040, T041, T042, T043, T044, T045, T046, T047, T048, T049, T051, T052, T053, T054, T055, T056, T066, T071, T072, T073, T074, T075, T076, T077, T078, T079, T081, T082, T083, T084, T085, T086, T090, T091, T092, T094, T095, T096, T097, T098, T099, T100
- **BLOCKED_RUNTIME_OR_EXTERNAL (17):** T022, T057, T059, T060, T061, T062, T063, T064, T065, T067, T068, T069, T070, T087, T088, T089, T093
- **DESIGNED_NOT_EXECUTED (12):** T009, T014, T020, T021, T024, T033, T034, T035, T036, T050, T058, T080

## Required adversarial tests (mission §8)

| # | Test | Requirement IDs | Threat | Preconditions | Inputs | Expected | Actual | Result | Outstanding gap |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | A union user requests another union's referral | WA-T020, WA-R1-02 | Cross-tenant referral access | Referral belongs to Union A; actor is a Union B referral rep with an active session | UPDATE_PACKET and view by the Union B principal | Non-disclosing NOT_FOUND; no state change | 1 test(s) passed, 0 failed | PASS (synthetic contract) | Search, export, aggregates and runtime RLS unproven (WA-T020, WA-T068) |
| 2 | A specialist accesses an unassigned matter | WA-R1-02, WA-R3-004 | Horizontal access inside the specialist organization | Specialist in the right organization with a grant but not assigned | Matter access VIEW | NOT_FOUND | 2 test(s) passed, 0 failed | PASS (synthetic contract) | Multi-org session switching (WA-T089) not executed |
| 3 | A revoked representative retries an old document link | WA-T018, WA-T084, WA-R1-13 | Stale link after revocation | Link issued while the grant was live; grant later revoked | Link redemption; authority cascade revoke | Denied; dependent grants revoked; epoch advanced | 2 test(s) passed, 0 failed | PASS (synthetic contract) | Platform revocation has no cascade (WA-R3-008); prior downloads irrevocable |
| 4 | A member guesses a restricted medical document id | WA-T019, WA-R1-03 | Identifier guessing | Member of the same matter without a release grant | Document VIEW by id | NOT_FOUND with no title or class | 1 test(s) passed, 0 failed | PASS (synthetic contract) | Platform blob and search paths unproven |
| 5 | An expired grant remains cached | WA-T025, WA-R1-13 | Stale authorization cache | Allow cached while the grant was live | Cache validity at expiry, newer revocation epoch, over-age and an inflated max-age | Entry unusable in all four cases | 1 test(s) passed, 0 failed | PASS (synthetic contract) | No real cache exists to test |
| 6 | A client has multiple claims and an objection is attached to the wrong claim | WA-T008, WA-R1-06 | Wrong-claim linkage | Two claims, five decisions | createObjection with the other claim id | WRONG_CLAIM | 1 test(s) passed, 0 failed | PASS (synthetic contract) | No persistence layer |
| 7 | The same denial is submitted twice | WA-T009, WA-R4-05 | Duplicate decision and objection | Letter already recorded | Same letter hash again; same objection request id again | Single decision and single objection; changed payload under same key rejected | 2 test(s) passed, 0 failed | PASS (synthetic contract) | Concurrent referral submit (WA-T009) needs persistence |
| 8 | A new objection is incorrectly deduplicated against a legitimate older one | WA-R4-02 | Over-eager deduplication hiding a real objection | Older objection withdrawn, or covering a different issue | New objection with a new request id | Created with its own sequence; overlapping active objection needs a human | 1 test(s) passed, 0 failed | PASS (synthetic contract) | Human resolution workflow not specified |
| 9 | A dispatch succeeds but WSIB receipt is never confirmed | WA-T040, WA-R1-04 | False assurance of receipt | Dispatched and provider-acknowledged submission | State inspection; forbidden jumps | Stays receipt-unconfirmed; never counts as filed | 2 test(s) passed, 0 failed | PASS (synthetic contract) | Escalation timing after silence needs Domenic rule |
| 10 | A receipt-confirmation reminder fires twice | WA-T038, WA-R1-07 | Duplicate notification | Scheduled reminder; two workers race | Lease claim, delivery outcome, late duplicate outcome | One lease, one delivery; later outcomes cannot regress state | 2 test(s) passed, 0 failed | PASS (synthetic contract) | Real worker and sink not executed |
| 11 | A task is reassigned while its reminder is queued | WA-T048 | Reminder sent to former assignee | Reminder scheduled for owner epoch 1 | Reassignment by principal; delivery decision | Old reminder cancelled; delivery refuses a stale snapshot; new epoch scheduled | 1 test(s) passed, 0 failed | PASS (synthetic contract) | Platform snapshot/convergence behaviour unproven for WSIB |
| 12 | A user changes time zones near a statutory deadline | WA-T036, WA-R1-11 | Wrong expiry from viewer time zone | Human-confirmed date; DST ends that day in the matter zone | Status one second before and at expiry; viewer zone not an input | Expiry at local midnight in the matter zone | 2 test(s) passed, 0 failed | PASS (synthetic contract) | Legal time-of-day rule for filing needs professional confirmation |
| 13 | A professional notes that a document must remain restricted | WA-R1-03 | Release despite a hold | Hold placed by a WorkAid professional | Release to member and union; lift attempts | Release denied until a principal lifts with a reason | 1 test(s) passed, 0 failed | PASS (synthetic contract) | Who may lift is an open decision (D-03) |
| 14 | An unapproved notification exposes a restricted document title | WA-T053, WA-T091 | Title leakage through notification | Restricted document with a canary title | buildNotification with and without preview | Generic text only; preview discarded for sensitive classes and for titles | 3 test(s) passed, 0 failed | PASS (synthetic contract) | Platform notification schema is free-form (WA-R3-010) |
| 15 | Clio and Union Eyes contain conflicting task states | WA-T056, WA-R1-10 | Dual master | Same submission tracked in both systems | Reconcile under each task-of-record value | Reconciliation exception; no writeback; external done is not receipt | 2 test(s) passed, 0 failed | PASS (synthetic contract) | Task-of-record unresolved (D-02) |
| 16 | A referral is returned for correction while an urgent professional review remains pending | WA-T011, WA-R1-16 | Urgent review lost on return | Referral offered under an urgent exception | RETURN, WITHDRAW, DECLINE | Review stays pending; withdraw and decline blocked until dispositioned | 1 test(s) passed, 0 failed | PASS (synthetic contract) | Who disposes of an urgent review (D-04) |
| 17 | A worker's authorization expires during an active matter | WA-T017 | Continued action on expired authority | DOA with an expiry one minute away | Professional action before and at expiry | Allowed before; denied from the instant of expiry | 1 test(s) passed, 0 failed | PASS (synthetic contract) | Renewal workflow not specified |
| 18 | A matter closes while a scheduled reminder remains outstanding | WA-T047 | Notifications after closure | Open task and scheduled reminder | Matter closure; delivery decision | Tasks and reminders cancelled; delivery refuses a closed matter | 1 test(s) passed, 0 failed | PASS (synthetic contract) | Reopen semantics not specified |
| 19 | A malicious attachment carries misleading metadata or instructions | WA-T058, WA-T098 | Metadata or content treated as instruction or classification | Filename with instruction-like text and a spoofed class and extension | assessUpload | Quarantined, unverified, class claim ignored, name neutralized | 2 test(s) passed, 0 failed | PASS (synthetic contract) | No malware scan or content parsing in the harness; platform ClamAV unproven |
| 20 | A purported professional approval is forged through an API request | WA-R1-17 | Forged approval | Approval request carries an asserted approver | Mismatched claim, union principal, inactive session, system actor | Refused with APPROVER_MISMATCH, NOT_PROFESSIONAL, HUMAN_ACTOR_REQUIRED | 2 test(s) passed, 0 failed | PASS (synthetic contract) | Real authentication and session binding are platform responsibilities |

Evidence for each adversarial case is the tagged test title in `evidence/test-results.json` (`[WA-ADV-nn]`). "PASS (synthetic contract)" is deliberately not the word PASS alone.
