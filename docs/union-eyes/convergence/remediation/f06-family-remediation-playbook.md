# Family remediation playbook, from F06 (audit atomicity and access records)

Written after the F06 campaign (batches B105 to B110). It is the method that worked, with the traps that cost time. It describes how to remediate one family of the 777-defect register; it is not a status report. Status is in `ue-gate0-defect-elimination.json` and `families.json`.

## 1. Freeze, baseline, then change

1. Freeze the family's membership before touching code: `outstanding3.cjs <FAMILY>` (or read `families.json`) at an exact commit. A defect is only ever counted once, in one batch.
2. Re-read each defect against the live source. Several F06 items were already partly fixed by earlier batches; the ledger's own `remaining` text says what is left. Start from that, not from the register sentence.
3. Group by shared root cause, not by route. F06 fell into seven groups: audit primitives, local transaction atomicity, truthful outcomes, durable lifecycles, control-plane and read records, claim and entitlement binding, signature evidence.

## 2. The decision tests that sort a defect

| Question | If yes |
| --- | --- |
| Is the effect rows in our own database? | `performAtomicAuditedOperation` (change and one hash-chained audit row in one transaction). |
| Is the effect somewhere a transaction cannot reach (provider, mail, payment, queue, session store)? | `performAuditedOperation`: durable intent, then outcome, labelled `INTENT_OUTCOME` in the route manifest, never `ATOMIC`. Put the local state change in its own transaction with its own record. |
| Does the record claim something happened? | Write it only after the thing happened or can be shown (membership row, contract row, remittance row), and refuse otherwise. A "staged only" note on a committed state is the defect. |
| Is the control stored but no code performs it (second factor, SSO sign-in, integration sync)? | Do not accept and ignore it. Refuse it, or say on every response and audit row that it is not in effect. Refusal is not implementation: the item stays PARTIAL. |
| Is a bearer link or an unverified assertion carrying authority? | Serve through the route so the grant is checked on every read, or bind the claim to something the server holds (purchaser e-mail, member row). |

## 3. Per-defect proof, in this order

Adversarial tests first: audit failure rolls the change back; business failure records nothing; replay is idempotent; the second concurrent caller loses; another tenant is refused; the provider fails; the disclosure or record cannot be written, so nothing is released. Prefer a real SQL engine (PGlite, then native PostgreSQL 15 and 16) over mocks for anything that depends on locking, ordering, grants or constraints; F06's chain, dues lifecycle and download tests found nothing a mock would have, but they would have found it if there had been something.

Native tests: `npx vitest run -c vitest.native.config.ts <file>` from `apps/union-eyes` with `UE_AUTHORITY_COMBINED_URL` set. New migrations: register with the codemods, regenerate the catalog contract from the repo root, bump the registry pin.

## 4. Existing tests you must replace

Some tests pin the defect (for example "a miss records nothing", "the link lives five minutes"). Replace them, say so in a comment at the test, and say so in the ledger explanation. Never loosen a test to make code pass; change it because the contract it pinned was wrong.

## 5. Ledger accounting, per batch

1. Add `scripts/codemods/add-bNNN-ledger.cjs` using `f06-ledger-lib.cjs` `addBatch` (`previousEvidence` carries the prior batch's commit).
2. In `docs/union-eyes/convergence/remediation`: `node build-gate0-elimination.cjs`, `node sync-into-777-register.cjs`, `node classify-families.cjs`, `node reconcile-accounting.cjs` (must say `consistent: true`).
3. Edit `elimination-batches.json`, never the built `ue-gate0-defect-elimination.json`. Annotations other contributors add to the built file (`uncreditedSourceEvidence`) are carried through the build from the same key in `elimination-batches.json`; port them first or the next rebuild erases them.
4. Status: `IMPLEMENTED_PENDING_QUALIFICATION` only when the substantive source defect is gone. Anything needing a mandate, a provider, a product or legal decision, or a capability that does not exist stays `PARTIAL`, with the precise remaining work. Nothing is `CLOSED` here; closure needs qualification this campaign does not do.
5. Add a pin test `sNN-...` that reads the changed source and asserts the structural property (order of calls, absence of the old path), so the fix cannot be quietly undone.
6. After any route change, regenerate the route manifest (`npx tsx scripts/generate-route-manifest.ts`); after any scanner change, expect the audit-gap ratchet to move and decide each case on its merits.

## 6. Traps

- A route importing `operation-audit.ts` is not thereby atomic. The scanner now reads the call that is actually made.
- A scanner window of 900 characters decides whether an UPDATE is scoped: build large `set` payloads before the statement.
- Under FORCE RLS even the owner cannot insert without a policy; seed native tests through the runtime role.
- `ON CONFLICT` under FORCE RLS needs a SELECT policy; avoid it.
- Authoring files with a shell that expands `$` and backticks silently eats template literals. Use the editor for TypeScript with `${...}`.
- LF versus CRLF changes migration hashes; normalize new migration files to LF before applying them.
- Run the focused tests before shipping; the ship helper type-checks and commits but does not run tests.
- Concurrent contributors edit the same ledger and routes. Rebase, re-run the build, and report (do not silently fix) failures that come from their in-flight work.

## 7. What F06 left PARTIAL, and why

Ten items stay partial with named, non-trivial remaining work: external-effect operations that are inherently two-phase and the finance-frozen billing-cycle generation; SSO sign-in and integration synchronization (no consumer exists, so the configuration now says it is not in effect); the pseudonymous ICRA capability that outlives a claim (no account-based access path exists yet for a claimed assessment); knowledge-base entitlement (a product decision); report classification, consent and small-group suppression; provider-verified counterpart acceptance of a pilot contract; a second factor for signing; unclaimed-workbook attribution; and notice to the people recorded in a workbook.
