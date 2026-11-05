# 19 — Grok R7 adversarial handoff

**To:** Grok (independent challenger). **From:** WorkAid preparation worktree, Slice C (`UE-WORKAID-PREP-20261023-C`).
**Outcome of R7: not yet known.** Nothing in this package is pre-labelled as passing. A clean R7 would mean "no defect found by this reviewer in this scope", never "correct".

## 0. Exact revision binding

| Item | Value |
|---|---|
| Platform base inspected (all platform references) | `anungis437/nzila-os` `origin/main` `38a824918cf2e7d7cfb7fcb0e796cbde45433be8` |
| Branch | `agents/workaid-prep-20261023` (local only; never pushed) |
| v0.2 content commit | `4f7be0337b9a395499c868e43e10e30e830be7a4` |
| v0.2 branch tip (Slice C started here) | `023712d6ab3b40b43ef7f487183315e846de21fc` |
| Slice C content commit | Named in `evidence/COMMIT_BINDING.md` and `evidence/R7_MANIFEST.json`, which are committed *after* it (a file cannot contain the id of its own commit) |
| Per-file content hashes | `evidence/harness-manifest.json` (all files) and `evidence/R7_MANIFEST.json` (the challenge set, hashed from the content commit) |

If any hash does not match, the package was altered after handoff: stop and say so.

## 1. What to challenge (package contents)

| # | Item | Where |
|---|---|---|
| 1 | v0.3 candidate specification and its changes from v0.2 | [WORKAID_PRODUCT_SPEC_v0.3.md](WORKAID_PRODUCT_SPEC_v0.3.md) §1 |
| 2 | Four persona journey contracts and cross-persona consistency | [14](14_PERSONA_JOURNEY_CONTRACTS.md), [15](15_CROSS_PERSONA_CONSISTENCY.md) |
| 3 | State-machine and authorization invariants | §2 below; `src/submission.ts`, `src/filing.ts`, `src/tribunal.ts`, `src/authorization.ts`, `src/journey.ts` |
| 4 | Synthetic fixtures and test evidence | `test/scenario.ts`, `test/helpers.ts`, `test/*.test.ts`, [18](18_SLICE_C_TEST_REPORT.md), `evidence/test-results.json`, `evidence/journey-trace.json`, `data/WORKAID_ACCEPTANCE_MATRIX_v0.3.csv` |
| 5 | Remaining P0/P1 findings | [09](09_ADVERSARIAL_FINDINGS_REGISTER.md), `data/findings-register.json` |
| 6 | Evidence for WA-C-001 and WA-C-002 | [17](17_RECEIPT_VS_FILING_AUTHORITY.md), `test/filing.test.ts`, `test/submission.test.ts`, `test/write-isolation.test.ts` |
| 7 | Known non-executed runtime tests | §4 below and the `BLOCKED_RUNTIME_OR_EXTERNAL` / `DESIGNED_NOT_EXECUTED` rows of the matrix |
| 8 | Outstanding Domenic, Angelo and security decisions | [11](11_WORKAID_VALIDATION_DECISIONS.md) D-01…D-24; [DECISION_LOG](DECISION_LOG.md) E-19…E-32 |
| 9 | Assumptions to falsify | §5 below |
| 10 | Exact source and commit hashes | §0 |

How to reproduce (from this worktree only; do not run against another checkout): `node scripts/run-tests.ts`, then `node scripts/build-baseline.ts`. Read-only alternative: read `evidence/journey-trace.json` and the test files.

## 2. Invariants the contracts are meant to hold

State machine (`submission.ts`):

- I-1. Only the 11 listed states exist; any (from, to) pair not in `ALLOWED_SUBMISSION_TRANSITIONS` is refused (exhaustive 121-pair test).
- I-2. `DISPATCH_ATTEMPTED` is human-only; `DISPATCHED` needs a transmission reference matching the attempt; the provider can never attempt, approve or confirm receipt.
- I-3. `RECEIPT_CONFIRMED` needs a recognized human method, a contact or evidence reference, and live professional authorization.
- I-4. A receipt record has no validity, acceptance or timeliness field.
- I-5. A submission kind cannot be addressed to the wrong authority.
- I-6. Replays with the same request id are idempotent; a different request id after an attempt is refused.

Filing (`filing.ts`):

- I-7. No code path yields a status named `VALIDLY_FILED`; the only statuses are `UNDETERMINED`, professionally determined valid/defective, authority accepted/rejected, `VOID_SUBMISSION_CLOSED`.
- I-8. A valid determination requires every gate in [17 §3](17_RECEIPT_VS_FILING_AUTHORITY.md); with all other inputs perfect, only a submission in `RECEIPT_CONFIRMED` can be assessed valid (exhaustive over the 11 states).
- I-9. Determinations and authority responses are append-only.
- I-10. `timeliness` is the constant `NOT_ASSERTED`.

Authorization and disclosure:

- I-11. Acceptance of representation, a view grant, a signed DOA/retainer authorization and a WSIB authorization are four separate records; none stands in for another.
- I-12. Every denial that could reveal existence is not-found.
- I-13. A specialist reads a document only with an assigned matter, a live matter grant **and** a live per-document grant; a supervisor is not exempt.
- I-14. Medical and held documents never reach the union or member audiences.
- I-15. A refusal appends nothing to any audit trail and is logged once on the actor's organization.

Publication:

- I-16. No publication, no member content; a stage needs matching evidence; wording that claims receipt, filing, validity or acceptance is refused; a decision notice never states the outcome.
- I-17. Union-visible is an explicit flag; the union sees stage, text and version only.

Tribunal:

- I-18. The tribunal assessment records a professional decision only; `timeLimit` is `null`; no preparation without a recorded "proceeding".

Isolation:

- I-19. No script writes outside the two prefixes or OS temp, or into another worktree.

## 3. Remaining P0/P1 findings

Counts are generated in [09](09_ADVERSARIAL_FINDINGS_REGISTER.md) and are **source entries, not independent defects** (they overlap in groups). At the time of writing: 22 P0 entries (6 open, 16 partially mitigated) and 55 P1 entries (19 open, 34 partially mitigated, 1 blocked on external evidence, 1 out of scope with a boundary), i.e. 54 P1 entries not closed. `FIXED_PROVEN` = 0. "Partially mitigated" means a synthetic contract test exists; it is never runtime proof. Platform-owned entries (6 P0, 16 P1) are routed to Codex and remain `OPEN`.

New in Slice C (self-identified, none renumbered): WA-C-001 receipt vs filing, WA-C-002 write isolation, WA-C-003 misleading status wording. All three are `PARTIALLY_MITIGATED` with synthetic proof only.

## 4. Known non-executed runtime tests

Not executable in isolation and therefore **not run**: deployed tenant isolation and RLS, real sessions and revocation propagation, signed-URL behaviour, search and export surfaces, notification delivery, durable outbox and restart behaviour, concurrency and race conditions on referral persistence (WA-T009), accessibility and assistive technology, small-screen behaviour, French translation quality, plain-language comprehension, load, Clio behaviour of any kind, and every platform surface in [13](13_INTEGRATION_HANDOFF_CONTRACT.md) §2. The generated matrix lists each case with its state. Platform unit tests were not run (no installed workspace); `pnpm lint`, `typecheck`, `test:fast` and `governance:audit` were not run.

## 5. Specific assumptions to try to falsify

Ordered by how much damage a false assumption would do.

1. **The filing gates are sufficient and not over-strict.** Can a submission that is *not* validly filed reach `PROFESSIONALLY_DETERMINED_VALID`? Conversely, is receipt-as-prerequisite (F-01) wrong for portal submissions where the transmission receipt is itself the evidence? Try forging a `FilingIntent`, a requirement source (`reviewedBy` of a non-reviewer), or an element attestation with a plausible evidence reference.
2. **`UNDETERMINED` is a safe default.** Does any view, wording rule or task path let a user infer "filed" from an `UNDETERMINED` status, a receipt, or a Clio report? Search the journey views and publication rules for such a path.
3. **The status lint plus stage-evidence checks stop misleading progress.** Find English or French wording that implies receipt, filing, validity, acceptance or an outcome yet passes. The lint is a pattern backstop; the claim to attack is that the stage-evidence gate is a sufficient primary control.
4. **Denials are not vacuous.** For any denial step, can the same operation also be denied for an *unrelated* reason that makes the test pass while the intended control is missing? (Two such cases were found and fixed in my own tests: [15 §7](15_CROSS_PERSONA_CONSISTENCY.md).) Look for more, especially not-found assertions with no paired positive control.
5. **No view leaks across personas.** Build a matter with every record type and compare all four views and the denial log for any identifier, title, count or timing difference that reveals a record the viewer may not see, including through error codes (not-found vs forbidden layering, E-32).
6. **Refusal logging does not leak.** The actor's organization receives the refusal entry; confirm no path writes to the target's trail or to a shared trail, and that the entry itself carries no target detail.
7. **Reassignment and revocation cannot strand a deadline or leak a reminder.** Try revoke-then-reassign, reassign-then-revoke, and a reassignment during a reminder lease.
8. **Supervisor is not privileged by accident.** Find any operation where a principal succeeds without assignment and a grant.
9. **Duplicate identity handling cannot be bypassed** by case, whitespace, birth-year variants or a different union.
10. **The tribunal boundary states nothing procedural.** Find any string, field or default that implies a time limit, an in-time status, or that a notice is due.
11. **Grievance deadlines are not reused anywhere** for WSIB obligations or waits.
12. **Task-of-record `UNRESOLVED` delivers nothing**, including through reassignment, replay, worker restart simulation and a Clio report.
13. **The write guard cannot be evaded** by a relative path, a junction, a case variation on Windows, a short (8.3) temp path, or a symlinked worktree.
14. **The corrected account in [17 §7](17_RECEIPT_VS_FILING_AUTHORITY.md) is accurate.** It is a statement about my own earlier run; verify it against `git` state and the scripts rather than trusting it.
15. **Counting honesty.** Does any generated count credit one test or step to a requirement it does not exercise? Compare `evidence/journey-trace.json` step by step against the requirement and case ids it lists.
16. **Fixture policy is not a hidden default.** Find any fixture value (who accepts representation, who lifts a hold, who assesses a tribunal outcome, task-of-record) that the code treats as a default outside tests.

## 6. Questions I could not answer from source

- Whether WSIB or WSIAT recognizes any of the receipt methods as evidence of anything beyond receipt.
- Which requirement sources an authority publishes for each form, and who within WorkAid is authorized to assess against them.
- Whether the Tribunal "Confirmation of Appeal" and "Hearing Ready Form" naming reflects current process (D-06).
- Whether a supervising principal should see documents without being assigned (D-22).

## 7. Out of bounds for this review

Anything that requires real claimants, medical records, WorkAid accounts, Clio, staging or production, or counterpart communication. No pilot or production authorization is implied by any part of this package.
