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

## Open, in order

1. Audit coverage: 271 mutating routes have no route-level atomic-audit evidence (scan now follows three import hops; 33 handlers were found to contain no writes). The authority-bearing ones to convert first: platform-admin member offboarding (`admin/users/[userId]`) and organization create/update, governance system-context routes, dues, finance and payments. Denial-path durability (separate transaction after rollback) is designed and proven for the audit primitive, not yet applied route by route.
2. Finance duties, WorkAid union-side engine, messaging UI and lifecycle.
3. `union_rep_id` backfill rehearsal and reader migration; the claims path needs a real-PostgreSQL qualification suite (the retired role-model suite is gone).
4. Voting extension and certified-result supersession workflows (inactive until adopted); voting options, eligibility and proxy routes.
5. Schema census (351), unscoped-mutation candidates (276), 30-second bridge window, aggregate test stability, persona acceptance matrix.
6. UI: status and workflow components still call retired stubs; OCR upload has no canonical equivalent; the legacy upload route remains for file uploads.

## Verdicts

ENGINEERING_CONVERGENCE NOT ACHIEVED; PERSONA_FOUNDATION_READINESS PARTIAL; CREDENTIALED_END_TO_END_ACCEPTANCE NOT STARTED; INSTITUTIONAL_POLICY_ADOPTION NOT ADOPTED; STAGING_QUALIFICATION NOT STARTED; PRODUCTION_RELEASE NO-GO.
