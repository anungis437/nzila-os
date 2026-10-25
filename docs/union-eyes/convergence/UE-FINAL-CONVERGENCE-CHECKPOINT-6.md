# UE Final Convergence — Checkpoint 6 (Continuation 6)

Status: progress, not completion. Staging and production remain NO-GO.

## Priority zero — unauthenticated mutations

| Route | Disposition |
| --- | --- |
| `staging-proof/deadline-engine/scenario` | Answers only an image **built** for staging (build-time `NEXT_PUBLIC_APP_ENV`), in addition to the runtime switches, the HMAC over a fresh timestamp and a single-use nonce. A production build can never answer a proof request whatever its runtime variables say. Each run creates and retires its own synthetic organization. |
| `workbook/start`, `workbook/checkout`, `contact`, `whop/unauthenticated-checkout`, `icra/start`, `icra/checkout` | Public intake is bounded by `lib/public-intake/guard.ts`: per-client limit that refuses (503) when the limiter is unavailable outside development, a 16 KB body cap, strict JSON. The workbook created holds no tenant data and grants no access to any. |
| `icra/[assessmentId]/submit`, other capability-token routes | Limited per client before any lookup, to slow guessing. |
| `auth/forgot-password`, `auth/magic-link/request` | Limited per IP by the proxy; neutral responses. |

The route-coverage ratchet now asserts that every public write carries its control.

Also fixed on the way: array binding in the kernel route adapter was corrupted by an earlier edit (a quote or backslash in an element would have been mangled); it is fixed and tested.

## Kernel adoption — the 42-route backlog is closed (K-010)

The claims model is now decided by the authority kernel: `findReadableCase` takes a kernel action per operation, returns 404 when the caller cannot read, a recorded 403 when they can read but not act, and carries the decision's visibility into history filtering and redaction. Assignment goes through the governed kernel assignment; `assigned_to` is a compatibility mirror only. Opening a case is a canonical-membership capacity (member / handler / bulk). A triage designation lists the unassigned queue as metadata only. Grievance convert, priority override and steward recommendation are kernel decisions; grievance create and import use capacity. Document version append needs the uploader or the kernel's modify-document decision and commits with its audit; external document upload is audited atomically.

Retired to 501 (no second authorization implementation kept): ten generic-CRUD stub routes over claims and grievances and six legacy documents routes (role-ranked, behind `LEGACY_DOCUMENT_API_ENABLED`).

Message routes are governed by the thread-participant and thread-assignment policy (the kernel has no message resource) and external matter routes by the external representation authority; the manifest records both as subordinate policies.

Proof: `lib/cases/kernel-claims.pglite.test.ts` (21 tests on the real kernel storage with the real `findReadableCase`), `app/api` route tests rewritten around kernel decisions and capacity.

## Voting (K-009, continued)

Ballots are secret: an identified ballot is refused, and the one-vote check now covers both the anonymous id and the member id (previously one identified plus one anonymous ballot both counted). The session list no longer discloses per-option tallies to members; results stay an officer-level view of a closed session.

## Aggregate test stability (measured, not resolved)

Six aggregate `pnpm test:fast` runs on this branch, each with every individual test passing when run alone:

| Run | Workers | Result |
| --- | --- | --- |
| 6, 7 | 4 | exit 1: three worker-start timeouts (vitest 5 hard-codes a 60 s start timeout), then three 120 s cold-import timeouts |
| 8 | 3 | one real failure (a delegate to a retired route), fixed; no infrastructure failure |
| 9 | 3 | one failure: the Flow invoices page test. Root cause found and fixed: it loaded a large module graph under fake timers, which stalled to the test timeout (20 s in isolation, 0.9 s after) |
| 10 | 3 | cold-cache run after many route edits: the first route-matrix test paid for importing the `googleapis` SDK and hit the 120 s timeout; the SDK is now mocked in the three route matrices |
| 11 | 3 | one 120 s timeout in a full-tree file scan and three worker-start timeouts in `apps/control-plane` |
| 12 | 2 | 2,353 files and 32,135 tests passed, none failed; one worker-start timeout (`workspace-shell.test.tsx`, which passes alone) |

The aggregate cap is now 3 workers. The remaining failures are start-up and I/O starvation on a machine shared with other agents' dev servers and containers (C: is 94% full); the 60 s worker-start timeout is not configurable. **No clean aggregate exit has been achieved**, so this stays an open qualification defect: it needs a quiet, dedicated runner, not further test edits.

## Audit coverage (K-011): 271 to 243

Authority-bearing mutations now commit with their audit record on the transaction that does the work; a failed audit write fails and rolls back the change, and a change that matches nothing is a 404 with no audit.

- Governance: golden-share issue, reserved-matter vote recording, policy draft, snapshot, conflict resolution, replay start, mission audit, policy rule.
- Dues: manual match, reject, arrears payment, remittance update, payment plan (reconciliation writes are also now organization-scoped).
- Organizations: create, update, archive, settings. An organization administrator can no longer change a parent affiliation or status (platform authority required; resubmitting current values is allowed).
- Members: deactivate and delete audit with the local status change (an incomplete offboarding is recorded as a failure while the denial is still applied); reactivation records its attempt first and grants nothing if the attempt cannot be recorded.
- Platform-auth: invite creation, organization auth-policy update and MFA disable previously swallowed audit failures; they now fail with the operation. The manifest counts a platform-auth service as audited only while a ratchet proves that.
- SSO provider creation is audited, and a group-to-role mapping is limited to roles a tenant administrator can assign.
- Voting session creation is audited. Governance election sessions were hardened: they took the organization and opening status from the request body, listed every organization's sessions, and let PATCH and DELETE bypass the session-lifecycle rules (terms lock; cancelling a closed election). They are now drafts in the caller's own organization under the lifecycle rules. A board packet can no longer be marked distributed outside its distribution workflow. Ballot-casting routes are deliberately unaudited per ballot (G12) and pinned by a ratchet; the ballot error log no longer carries the member or the option.
- Kernel case-assignment mutators count as audited while a ratchet proves the store audits on the same executor.

Open institutional decision: `votes.cast_at` is an exact timestamp and can be correlated with participation records; its granularity is a product decision, not an engineering default.

## Open, in order

1. Audit coverage: 243 mutating routes still have no route-level atomic-audit evidence (scan follows three import hops; 33 handlers were found to contain no writes). Remaining families: finance, billing, correspondence, signatures, committees, pension, ICRA/OCRA, exit interviews, AI, employer execution, and the board-packet and election-session routes. Denial-path durability (separate transaction after rollback) is designed and proven for the audit primitive, not yet applied route by route.
2. Finance duties, WorkAid union-side engine, messaging UI and lifecycle.
3. `union_rep_id` backfill rehearsal and reader migration; the claims path needs a real-PostgreSQL qualification suite (the retired role-model suite is gone).
4. Voting extension and certified-result supersession workflows (inactive until adopted); voting options, eligibility and proxy routes.
5. Schema census (351), unscoped-mutation candidates (276), 30-second bridge window, aggregate test stability, persona acceptance matrix.
6. UI: status and workflow components still call retired stubs; OCR upload has no canonical equivalent; the legacy upload route remains for file uploads.

## Verdicts

ENGINEERING_CONVERGENCE NOT ACHIEVED; PERSONA_FOUNDATION_READINESS PARTIAL; CREDENTIALED_END_TO_END_ACCEPTANCE NOT STARTED; INSTITUTIONAL_POLICY_ADOPTION NOT ADOPTED; STAGING_QUALIFICATION NOT STARTED; PRODUCTION_RELEASE NO-GO.
