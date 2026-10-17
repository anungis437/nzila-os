# CIVIC Runtime Slice 1 - Durable Synthetic Continuity Proof

**Date:** 2026-10-10

**Technical disposition:** `CIVIC_RUNTIME_SLICE_1_PASS_WITH_LIMITATIONS`

**Proof class:** `EVIDENCE_INTEGRITY_PROOF`

**Human proof-owner acceptance:** `CIVIC_RUNTIME_SLICE_1_ACCEPTED_WITH_LIMITATIONS`

**Authorization terminated:** YES

This closes only the authorized local synthetic proof. General runtime
authorization remains false; Slice 0 remains terminated. No deployment, merge,
production, real-user pilot, legal evidence certification or Slice 2 is claimed.

## Human proof-owner decision

**Decision:** `CIVIC_RUNTIME_SLICE_1_ACCEPTED_WITH_LIMITATIONS`

**Proof owner:** Aubert Nungisa

**Decision date:** 2026-10-10

The designated human proof owner reviewed and accepted only the bounded synthetic
durability and institutional-continuity evidence: local persistence, fresh-process
recovery, temporal reconstruction, immutable historical authority surviving later
revocation, supersession without deletion, durable idempotency, concurrent/stale-write
protection, crash-before-commit rollback, post-commit retry recovery, ordered history,
copied-store tamper detection, cross-institution isolation, human-only consequential
decisions and termination at closeout. The accepted Slice 0 R/D/T operating model
remains inherited.

All limitations below remain unresolved, including the unproven performance target,
coordinated store/checkpoint compromise outside the guarantee and the unexecuted
decision-versus-revocation process race. Local SQLite is not production architecture;
production backup/restore, disaster recovery, key management, identity integration,
real users, real authority instruments and real institutional data remain unproved.

This decision is not production persistence certification, database approval,
institutional or real-user validation, legal evidentiary certification, security
accreditation, deployment approval, real-data authorization, pilot authorization
or Slice 2 runtime authorization. Slice 0 and Slice 1 remain terminated, general
runtime authorization remains false, and archival scanning/fingerprints remain
enforced. Existing local artifacts remain under Aubert Nungisa's custody.
Acceptance does not imply cleanup or retention instructions; those require a
separate explicit human decision.

## Authorization activation checkpoint

`CIVIC_SLICE_1_ACTIVATION_PASS` was returned before material implementation.
The [human decision packet](CIVIC_RUNTIME_SLICE_1_AUTHORIZATION_PACKET.md) records
maintainer/proof owner/custodian Aubert Nungisa, exact approved starting SHA,
branch/worktree, storage/custody completion and finite window:
`2026-10-10T17:56:14Z <= now < 2026-10-17T17:56:14Z`. No automatic renewal.

Storage was absent on initial inspection. Created only
`C:\APPS\nzila-os.worktrees\pasted-text-processing\.civic-runtime\slice1`
and its empty `checkpoints` child. There was no storage collision or deletion
of unknown content. Exact `/.civic-runtime/slice1/` local Git exclusion was added
to Git metadata, not a committed repository-wide ignore policy. Probe database/
checkpoint paths were ignored, with no tracked generated artifacts.

Activation checks: 106 doctrine tests, actual-context validator, targeted
governance typecheck, scoped docs/whitespace and collision checks passed.
Only scoped guard admission was invoked before the checkpoint, not product
runtime. Original Slice 0 source/config/package fingerprints remain unchanged.

## Implemented boundary

The CIVIC-owned [store](../../../apps/civic/src/slice1/store.ts) uses built-in
Node SQLite with DELETE journaling, FULL synchronization, foreign keys and
`BEGIN IMMEDIATE` transactional writes. It does not import shared database,
audit/event bus, SAGE runtime, cloud/hosted persistence or provisioning.

- Immutable journal is authoritative; current head/state projection is checked
  against replay. Unknown existing table layouts are storage collisions.
- Org-composite keys/foreign keys bind journals, receipts, decisions and
  supersession; only Fictional A/B org identifiers are accepted.
- One transaction writes event, projection, lifetime idempotency receipt and
  consequential decision. Response occurs after commit.
- Consequential records, journal and receipts reject direct UPDATE/DELETE.
- Events include full operation/evidence links, org sequence, predecessor hash,
  recursively canonical payload hash, resulting state digest, actor and both
  synthetic effective-time and live admission-time authority snapshots.
- Retry requires current live authority as well as operation-time authority;
  later revocation cannot be bypassed by replaying an old operation timestamp.
- Stale expected version and conflicting predecessor decisions fail; no
  last-write-wins or automatic consequential conflict merge.
- Two fictional configuration journeys share one [model](../../../apps/civic/src/slice1/model.ts)
  and one adapter. No institution-specific runtime fork.
- Historical reads verify the entire journal, receipts, projection and decisions,
  then return a recorded-sequence/effective-time cutoff. Operational timestamps
  must be monotonic; late source evidence can retain its earlier occurred time
  without appearing in earlier known-at state.
- Authority/membership/configuration revisions are append-only operation history;
  prior final decision snapshots never resolve through mutable current records.
- Separate count/position/state/authority/head checkpoints detect coherent tail
  truncation relative to the retained checkpoint. Canonical valid store is never
  damaged for tamper tests.

Current authority, membership and trusted synthetic session checks are not
production identity integration or real legal-instrument verification.

## Executed proofs

| Required proof | Executed result |
| --- | --- |
| Persistence/restart | A/B writer processes committed and exited; distinct reader processes recovered identical state and journal without reseeding |
| Temporal reconstruction | Genesis, commitment, pre-outcome, pre-decision and effective-time cutoffs matched expected records; late evidence absent before its recorded sequence |
| Authority history | Old decision actor/membership/role/instrument/delegation/configuration snapshot preserved through membership suspension, revocation and threshold change |
| Supersession | `SYN-A-DECISION-2` explicitly supersedes `SYN-A-DECISION-1`; both remain immutable and reconstructable after restart |
| Idempotency | Identical evidence/commitment/outcome/decision retries return original receipt; different payload conflicts; same keys across A/B remain isolated |
| Concurrency | Two independent conflicting-decision processes: exactly one commits, loser reports `STALE_STATE`; 20 same-key attempts from two processes yield one effect and identical result hash |
| Crash atomicity | Process exits with uncommitted append: restart has zero effect; exits after commit/before response: original receipt replays without duplicate; injected failures before/after append roll back all records |
| Audit integrity | Nested event changes, authority snapshot changes, broken predecessor and coherent tail truncation in bounded copies deterministically fail `INTEGRITY_FAILED`; valid store bytes unchanged |
| Immutability | Direct test SQL UPDATE/DELETE of journal, decisions and receipts rejected by triggers |
| Isolation | A principal cannot read B durable history, foreign supersession rejected; org-bound receipts/journal maintained |
| Human decision | Nondelegated/machine/foreign, expired, revoked and mismatched authority denied; human snapshot and unresolved-conflict disposition retained |
| Runtime closure | Existing/new instances deny at exact expiry; expiry between admission and commit rolls back; final termination guard denies without executing product code |

The professional-services chain still reports CAD 80,000 ceiling, four
expected/three received deliverables, conflicting receipt claim, 10 expected
versus 14 observed working days (+4), missing final deliverable/spend and
unresolved competing explanations. Supersession does not pretend to resolve them.

Final verified A store: version 16, two historical decisions, state digest
`e21bdda1d1eb555316e0c0e156cc12b1c06b4a23670e7e768c79bc67aa8013cb`,
head `b52830339a92b880d885d584554b63b9460ccdef2fd6ce977ab057bfe89afd01`.
These are technical digests, not legal certification or external attestation.

## Validation commands and results

| Exact command/check | Result |
| --- | --- |
| From `apps\civic`: `pnpm exec vitest run --config slice1.vitest.config.ts` | PASS, 34 tests across continuity and boundary suites; final run about 762 seconds |
| `pnpm exec vitest run --config tooling\contract-tests\vitest.config.ts tooling\contract-tests\civic-oci-doctrine-integrity.test.ts` | PASS, 107 tests at closeout; original negatives preserved with isolated legacy fixtures; changed/new archived source rejected |
| `pnpm exec tsc --noEmit -p apps\civic\slice1.tsconfig.json` | PASS |
| `pnpm exec tsc --noEmit --skipLibCheck --esModuleInterop --types node --target ES2022 --module NodeNext --moduleResolution NodeNext scripts\lib\civic-oci-doctrine.ts` | PASS |
| `pnpm exec tsx scripts\validate-civic-oci-doctrine.ts` | PASS with actual context and runtime source present, including after termination for archival source |
| Existing ESLint recommended rules via Node API, scoped to mission files | PASS, zero errors; two existing explicit-any fixture-helper warnings |
| Prettier and `git diff --check`, explicit new-file whitespace | PASS |
| Read-only scoped docs consistency and internal links | PASS; no errors/warnings, informational naming notices only |
| Fresh worker read from final SQLite file | PASS; summary persisted in approved checkpoints directory |
| Actual exported Slice 1 guard after proof termination | EXPECTED DENIAL, `Slice 1 authorization terminated`; no proof runtime reopened |

No full-monorepo lint/typecheck/test:fast/docs/governance audit, PR review or
deployment occurred. Slice 0 runtime tests were not reexecuted after termination;
Slice 1 boundary tests preserve the relevant accepted semantics without reopening
the old runtime.

## Performance and remaining limitations

Final same-host benchmark executed 50 durable writes and 50 reads:

- reads: median 2036.07 ms, p95 2827.64 ms;
- writes: median 4007.01 ms, p95 5144.79 ms;
- full live governance checks: one per read, admission and pre-commit for writes;
- no authorization cache or persisted authorization.

The proposed 25% improvement is NOT PROVEN: no equivalent Slice 0 reexecution
was authorized and no caching optimization was introduced. Performance remains
a limitation, not an integrity-gate failure or claimed improvement.

Other binding limitations:

- `NOT_YET_VALIDATED_WITH_REAL_USERS`; no UI, customer/pilot or real institutional
  validity claim.
- Built-in SQLite emits Node's experimental feature warning; local restart
  correctness is not production database architecture, power-loss/disaster
  recovery, scale, backup operations, encryption/key management or legal retention.
- Hash chains/checkpoints detect corruption relative to trusted retained manifest;
  a privileged attacker controlling both DB and checkpoints, removing triggers
  or rewriting all trusted artifacts is outside the proof guarantees.
- Checkpoint is outside the database but on the same local host under delegated
  custodian control, not independent external attestation or immutable cloud
  storage. Human custody/acceptance remains required.
- Operational history uses monotonic effective-time transitions; arbitrary
  backdated institutional corrections/branching temporal histories are deferred,
  not silently supported.
- Decision-vs-decision and same-key process races were executed; a separate
  simultaneous decision-vs-revocation process race was not executed. Both use
  the same serialized org version boundary, but broader race certification is
  not claimed.
- Static scanning is not a semantic sandbox. Real sessions, roles, instruments,
  source connectors and source-document authenticity are unproved.

## Retained disk artifacts and custody

All retained files are `LOCAL_SYNTHETIC_PROOF_ARTIFACT`, never production backups,
institutional records, legal evidence or customer data.

Under the exact approved storage root, retained:

- `proof-1791658253183.sqlite`: valid final A/B proof store;
- six suffix stores: `concurrency`, `crash`, `idempotent`, `membership`, `rollback`,
  `same-key-race`;
- four safe copied tamper stores: `tamper-authority`, `tamper-nested`,
  `tamper-predecessor`, `tamper-truncate`;
- `commit-expiry-1791658995752.sqlite` and `expiry-proof-1791658992271.sqlite`;
- `benchmark-1791659085308.sqlite`.

Under approved `checkpoints`: final A checkpoint, truncation-copy checkpoint,
four detection JSON records, final verified summary, final performance JSON and
`retained-inventory.json` containing file sizes/SHA-256 digests and custodian.
Total: 23 files including the inventory; 22 inventoried payload files occupy
2,460,091 bytes before the inventory itself. No lock/journal/WAL artifacts remain.

Only explicitly identified superseded agent-owned preliminary test runs and the
earlier benchmark were removed; no unknown pre-existing data was deleted.
Final valid/damaged-copy evidence remains for Aubert Nungisa's review. No further
cleanup or retention is inferred after human acceptance.

## Isolation, changed surfaces and closure

Starting/ending HEAD: `1c337567635bb86ea0df7831557d8d2d22df1e6f`.
Branch `civic/three-reality-hardening`, worktree
`C:\APPS\nzila-os.worktrees\pasted-text-processing`.
No commits, merge or deployment. No SAGE/other-product/shared-package/root
workspace/lockfile changes. Original Slice 0 source/config/package remain unchanged.

New material files: [authorization adapter](../../../apps/civic/src/slice1/authorization.ts),
[model](../../../apps/civic/src/slice1/model.ts),
[store](../../../apps/civic/src/slice1/store.ts),
[scenario](../../../apps/civic/src/slice1/scenario.ts),
[worker](../../../apps/civic/src/slice1/worker.ts),
[continuity tests](../../../apps/civic/tests/slice1/continuity.test.ts),
[boundary tests](../../../apps/civic/tests/slice1/boundaries.test.ts),
[TypeScript config](../../../apps/civic/slice1.tsconfig.json),
[Vitest config](../../../apps/civic/slice1.vitest.config.ts).
Scoped governance changes: doctrine contract, validator/tests, integrity
documentation and authorization packet. This proof is the closeout artifact.
The local Git exclude rule is exact untracked storage protection only.

Termination marker denies constructors/reads/writes/retries/restarted workers.
Static archival validation retains source scans and explicit Slice 0/Slice 1
file fingerprints after closure; new or changed runtime files cannot inherit
ongoing permission. The technical disposition remains distinct from the separately
recorded human proof-owner acceptance above.

`CIVIC_SLICE_2_REQUIRES_SEPARATE_AUTHORIZATION`
