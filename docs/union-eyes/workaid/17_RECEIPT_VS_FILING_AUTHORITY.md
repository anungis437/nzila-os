# 17 — Receipt versus filing: evidence and authority (WA-C-001) and write isolation (WA-C-002)

Status: v0.3 candidate. Synthetic contract only. Nothing here is a legal conclusion, and no requirement source has been loaded.

## 1. What was wrong in v0.2 (WA-C-001)

v0.2 exported `submissionCountsAsFiled(sub)`, which returned `true` when a submission reached `RECEIPT_CONFIRMED` with a receipt record. That treated a documented acknowledgement of receipt as proof that the submission was properly filed. Those are different facts. A document can be received and still be on the wrong form, name the wrong claim or decision, omit a required element, or be addressed to the wrong body. Whether it is valid is a professional conclusion that needs a source for the requirement; whether the authority accepted it is the authority's own act.

v0.2 also collapsed "someone tried to send it" and "it was sent" into one `DISPATCHED` state.

The helper is deleted, and a test (`[WA-T102]`, "the old helper … no longer exists") asserts it stays deleted.

## 2. The seven facts, each with its own state or record

| # | Fact | Where it lives | Evidence required | Who may record it |
|---|---|---|---|---|
| 1 | Document generated | `DRAFT` | Content and links (claim, decision, issues) | WorkAid professional |
| 2 | Professionally approved | `REVIEWED` → `APPROVED` | Approver equals the authenticated principal; role allowed by policy; live professional authorization for the matter; for ARF/NOA the attested readiness gate; preparer ≠ approver if policy says so | Professional only; never the system, the provider or a union user |
| 3 | Dispatch attempted | `DISPATCH_ATTEMPTED` | Request id and method; for every kind except DOA, a live authority to act as WSIB representative; live professional authorization | Professional only |
| 4 | Dispatch confirmed | `DISPATCHED` | A transmission reference matching the attempt | Professional, or the dispatch provider reporting a transmission outcome |
| 5 | Receipt acknowledged | `RECEIPT_CONFIRMED` + `receipt` record | A recognized human method (phone call, portal confirmation, written confirmation, email reply) **and** a named contact or an evidence reference; live professional authorization | A human professional only. The provider may record delivery (`DELIVERY_ACK`) but never receipt |
| 6 | Professional determination of valid filing | `FilingRecord.determinations` (append-only) | See §3 | A WorkAid professional who is the authenticated assessor |
| 7 | Procedural acceptance or rejection | `FilingRecord.authorityResponses` (append-only) | The authority's own document | A professional recording it; it is a record of the authority's act, never an inference from receipt |

Nothing in facts 1–5 carries a validity, acceptance or timeliness field. `receipt` has no such property (asserted by `[WA-T103]`).

## 3. Valid-filing determination: the gates

`determineFilingValid` returns a record only if every one of these holds; otherwise it refuses and changes nothing.

| Gate | Failure code |
|---|---|
| Caller is a WorkAid professional | `NOT_PROFESSIONAL` |
| Assessor identity equals the authenticated principal | `ASSESSOR_MISMATCH` |
| Live professional authorization for this matter | `AUTHORITY_DENIED` |
| Submission belongs to this matter | `WRONG_MATTER` |
| Submission is not withdrawn, superseded or rejected; assessed version is current | `SUBMISSION_CLOSED`, `STALE_VERSION` |
| Dispatch confirmed | `DISPATCH_NOT_CONFIRMED` |
| Receipt documented (assumption F-01, below) | `RECEIPT_NOT_DOCUMENTED` |
| A requirement source exists in the registry | `REQUIREMENT_SOURCE_UNKNOWN` |
| The source has been reviewed, is for this form kind and is effective | `REQUIREMENT_SOURCE_UNREVIEWED`, `_WRONG_FORM`, `_NOT_EFFECTIVE` |
| The submission matches the professional's stated intent: matter, kind, recipient, claim, decision, disputed issues, required links | `MALFORMED`, `MISDIRECTED` |
| Every element of the source is attested with a non-empty evidence reference | `INCOMPLETE_ATTESTATIONS`, `EVIDENCE_REQUIRED` |
| Reasoning recorded | `REASONING_REQUIRED` |

Consequences:

- The **requirement-source registry is empty by default.** Until a reviewed source is loaded, the status of every submission is `UNDETERMINED` with an explicit reason. This is the intended state, not a defect: the semantics of "validly filed" for each WSIB and WSIAT form are not supported by anything this programme holds.
- The **filing intent is taken from the objection record, not from the submission**, so a tampered or mislinked submission cannot assert its own correctness.
- `timeliness` is the literal `'NOT_ASSERTED'` and cannot be set. A late but received and procedurally complete filing is not something this contract can say anything about.
- A defect finding (`determineFilingDefective`) needs concrete defects and reasoning, and it may be recorded without receipt. Determinations are append-only: a later defect finding supersedes an earlier valid one without erasing it.
- Superseding the submission voids its determination (`VOID_SUBMISSION_CLOSED`); the new version needs its own.

## 4. Status vocabulary

`UNDETERMINED` · `PROFESSIONALLY_DETERMINED_VALID` · `PROFESSIONALLY_DETERMINED_DEFECTIVE` · `AUTHORITY_ACCEPTED` · `AUTHORITY_REJECTED` · `VOID_SUBMISSION_CLOSED`.

There is deliberately no `VALIDLY_FILED` status. The mission asked that a malformed, incomplete, unauthorized or misdirected submission cannot become `VALIDLY_FILED` because receipt was acknowledged; the contract goes further and has no value by that name, so no code path, UI mapping or Clio import can produce one. The strongest claim available is "a named professional determined, against a named source, with attached evidence, that the filing was valid", and the authority's response is a separate field. An authority acceptance recorded without a professional determination does not create one (`[WA-T107]`).

## 5. Negative proof (executed, synthetic)

| Case | Claim | Test tag |
|---|---|---|
| T101 | An ITO cannot be addressed to the Tribunal; a tampered recipient is refused | `[WA-T101]` |
| T102 | An attempt is not a dispatch; confirmation needs a matching attempt and a transmission reference; the provider cannot report receipt, approval or an attempt; the old helper is gone | `[WA-T102]` ×6 |
| T103 | No state, with or without receipt, yields a valid-filing status without a determination; unresolved reasons distinguish "not sent", "sent, no receipt", "receipt, no determination"; an authority response cannot be fabricated from receipt | `[WA-T103]` ×4 |
| T104 | Union user, member, inactive session, forged assessor, missing authorization, closed or stale submission are all refused | `[WA-T104]` ×2 |
| T105 | Never sent, sent without receipt, unknown source, or any unattested element: refused | `[WA-T105]` ×3 |
| T106 | Wrong claim, decision, issues, matter, form kind, tampered recipient, missing link: refused even when receipt was acknowledged; a refusal changes nothing | `[WA-T106]` ×4 |
| T107 | Positive path needs every gate; authority response is separate; superseded submission voids the determination | `[WA-T107]` ×4 |
| T108 | Defect determination, append-only supersession | `[WA-T108]` ×2 |

Journey steps that exercise the same contract in a composed world: A-15 to A-19, X-29, X-31, X-34a, X-34 (see `18_SLICE_C_TEST_REPORT.md`).

The exhaustive state-machine matrix in `test/submission.test.ts` checks all 11 × 11 state pairs against `ALLOWED_SUBMISSION_TRANSITIONS`; any pair not listed is forbidden.

## 6. Assumptions and decisions for Angelo (not resolved by this slice)

- **F-01:** receipt documentation is a prerequisite for a *valid* determination. This was chosen because a valid determination without any record that the authority received the document would be hard to defend. It is an assumption. If Angelo rules that a filing can be assessed on dispatch evidence alone (for example, a portal submission receipt that is itself the transmission proof), the gate changes; the defect path already does not require receipt.
- **D-19:** who may determine valid filing (specialist or principal only), which requirement sources count, who reviews and approves a source, and how a source version is retired.
- Whether a rejected-then-resubmitted document is a new version (modelled) or a continuation.
- Procedural effects of receipt methods other than the four recognized ones.

## 7. Write isolation (WA-C-002)

### What actually happened (corrected record)

During the v0.2 slice the document validator (`validate:docs`) was run using another checkout's `tsx` binary with this worktree as the working directory. Its report directory is derived from the working directory, so it wrote reports into **this** worktree, not the main checkout. I restored them with `git checkout` and none were committed. The main checkout showed no change under `reports/`. The accurate statement of the defect is therefore: preparation tooling executed binaries from another checkout, and nothing structurally prevented a write into any checkout. v0.2's "no lasting changes" was true but depended on luck and discipline.

### What is now structural

| Control | Mechanism | Test |
|---|---|---|
| Only an isolated worktree on an `agents/workaid-prep*` branch may run scripts | `preflight()` | `[WA-T109]` |
| Writes go through `safeWrite` / `safeAppend` / `safeMkdir`, which accept only the two preparation prefixes or the OS temp directory, and refuse any other registered worktree including the main checkout | `scripts/guard.ts` | `[WA-T109]` ×3 |
| Path traversal is refused | normalization before prefix check | `[WA-T109]` |
| No source imports write-capable `fs` functions except `guard.ts` | static scan | `[WA-T109]` |
| No mutating git command; no other checkout named by path; spawned processes use a restricted `cwd` | static scan | `[WA-T109]` ×2 |
| The repository validator runs with plain `node` from this worktree's copy inside a temp sandbox containing copies of the workaid docs and tooling; reports land in the sandbox only | `scripts/validate-docs-sandboxed.ts` | `[WA-T110]` ×2 |
| Type-check is `--noEmit --incremental false` and verifies afterward that the worktree is unchanged | `scripts/typecheck.ts` | `[WA-T109]` |

### Residual risk (stated, not hidden)

- The type-check still needs a TypeScript install. This worktree has no `node_modules`, so it reads TypeScript from another checkout's `node_modules` (read-only; named by environment variable, never in source). It cannot write there (`--noEmit`, no incremental file), and the script verifies the worktree is unchanged afterward, but it still executes another checkout's `tsc`. A clean install in this worktree would remove the dependency; that is a workspace change and was not done.
- The guard governs the harness. It cannot stop a human or another tool from writing elsewhere.
- The guard's list of worktrees comes from `git worktree list` (read-only) and is cached for the process.

No finding is marked fixed. WA-C-002 is `PARTIALLY_MITIGATED` with synthetic proof.
