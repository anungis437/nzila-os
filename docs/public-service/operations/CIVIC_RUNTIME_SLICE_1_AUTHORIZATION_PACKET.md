# CIVIC Runtime Slice 1 Authorization Packet

**Artifact type:** Internal authorization proposal; not an executable grant

**Prepared:** 2026-10-10

**Status:** `AUTHORIZE_WITH_CONDITIONS`; storage/custody prerequisites supplied

**Proposed data boundary:** `SYNTHETIC_ONLY`

**Implementation authorization:** TERMINATED_AT_PROOF_CLOSEOUT

**Activation disposition:** `CIVIC_SLICE_1_ACTIVATION_PASS`

This packet began as a proposal and now records the explicit conditional
Slice 1 maintainer authorization supplied on 2026-10-10. Material implementation
remains blocked until the required activation checkpoint passes. The separate bounded Slice 1 governance grant is activated only after the
checkpoint checks pass. No material persistence implementation precedes that
checkpoint. Slice 0 execution remains terminated.

## 1. Slice 0 human acceptance and inherited limitations

Aubert Nungisa, designated proof owner, accepted the bounded synthetic proof on
2026-10-10 as `CIVIC_RUNTIME_SLICE_0_ACCEPTED_WITH_LIMITATIONS`. The canonical
[Slice 0 proof](CIVIC_RUNTIME_SLICE_0_PROOF.md) records the decision, accepted
R/D/T evidence and continuing termination marker. Technical gate passes remain
limited to 23 R-GATE, 13 D-GATE and 13 T-GATE synthetic tests.

Binding inherited limitations:

- `NOT_YET_VALIDATED_WITH_REAL_USERS`;
- in-memory state only; no durable persistence or database/concurrency proof;
- no evidence-grade audit integrity or legal evidentiary certification;
- no production identity integration or real institutional authority instruments;
- no live source integrations, government/customer data, real institutional
  validation or real-user pilot;
- no deployment, production runtime, public route or broad CIVIC authorization.

Slice 1 would investigate only persistence, integrity, history and concurrent
mutation. It would not remove the other limitations. Slice 0 execution remains
terminated; general `runtimeAuthorization.authorized = false`; no automatic
renewal. Human proof-owner acceptance is not Slice 1 maintainer authorization.

## 2. Objective

Answer the smallest next question:

> Can CIVIC preserve the successful Slice 0 authority/evidence/accountability
> model once state becomes durable, auditable and lifecycle-aware, without
> expanding into general platform scope?

Proposed output is one local, synthetic, process-restartable institutional
continuity proof for the same two fictional configurations, using one kernel and
one storage adapter. Require `EVIDENCE_INTEGRITY_PROOF`, never
`LEGAL_EVIDENCE_CERTIFIED`. No UI breadth or production-readiness claim.

## 3. Why this slice is necessary

The accepted kernel preserves categories, conflicts, delegated human authority,
expected/observed variance and immutable decisions in memory. Restart currently
loses that state. An ordered in-memory audit does not establish durable history,
atomic decision/audit commits, tamper detection or decision-time authority after
later delegation changes. Retry and multi-process write correctness were not
proved. These are continuity gaps in the same operating model, not reasons to
add product features.

## 4. Proposed bounded runtime chain

Preserve the Slice 0 chain:

Institution -> Actor/Position -> Delegated Authority -> Evidence Source ->
Evidence -> Interpretation/Finding -> Intervention -> Commitment -> Execution ->
Expected Outcome -> Observed Outcome -> Variance -> Decision Required ->
Human Decision.

Add only: scoped command -> current authorization/authority validation ->
transactional expected-version check -> immutable authority/evidence snapshot ->
durable event + command receipt + projection commit -> integrity checkpoint ->
restart -> verified replay -> historical read -> explicit superseding decision.

Use the existing A/B fictional professional-services cases, including CAD 80,000
ceiling, four expected/three received deliverables, contradictory receipt claim,
10 versus 14 working days, missing spend/deliverable evidence and preserved
interpretations. New continuity cases must not invent resolution of those
conflicts. One authorized human decision may explicitly supersede a prior one;
the prior decision remains retrievable and immutable.

## 5. Persistence model

### Recommended smallest backend

Assess a CIVIC-owned adapter using Node's built-in `node:sqlite`, backed by one
explicitly approved local synthetic file. It avoids a shared platform schema,
ambient `DATABASE_URL`, cloud service, new server or dependency install.
Availability and platform support must be verified before implementation.
This is a proposed choice, not evidence that SQLite integration already works.

PostgreSQL is deferred: shared connection/schema/registry changes and a separately
provisioned server widen the mission. If SQLite cannot satisfy the required
transaction/restart/concurrency proof, stop for a backend/scope decision rather
than silently switching database or falling back to volatile memory/JSON files.

### Proposed logical records

| Record | Minimum continuity contract |
| --- | --- |
| Institution and configuration revisions | Synthetic org identity, immutable configuration version, recorded sequence and effective time |
| Actor, membership, position and instrument revisions | Distinct authentication/membership/authority references; fictional instrument source version |
| Delegation revisions | Actor/position/instrument/resource/actions, effective/expiry/revocation times, recorded sequence, predecessor |
| Evidence revisions | Category, source locator/version/owner, claim key, derived inputs, recorded/occurred times; reference-only remains reference-only |
| Interpretation revisions | Author, exact evidence revision IDs, competing statements, supersession link |
| Intervention and item events | Authorization, objective, owner, review due, configuration revision |
| Commitment/execution/outcomes | Source revision links, quantities, measures/unit/window, expected/observed distinction |
| Consequential decisions | Immutable rationale, disposition, exact input revisions, authority snapshot, predecessor/supersedes relation |
| Institutional journal | Org sequence, event/schema version, actor, resource, command ID, payload, previous hash, entry hash, recorded time |
| Command receipts | Org + command type + idempotency key, canonical request digest, committed event IDs/result and version |
| Stream heads/projections | Mutable derived current state and revision; transactionally consistent with immutable journal |
| Integrity checkpoint | Org, event count, sequence/head hash, schema/canonicalization version; separately retained proof manifest |

All identifiers and composite foreign keys carry org scope. No nullable
platform-wide org. A reference to another org fails even with a valid identifier.
Journal and historical revisions are authoritative; projections are rebuildable,
not an alternate mutable source of truth. Trusted synthetic seed material must
be persisted as an explicit genesis revision, not re-injected differently after
restart. Sessions/credentials are not serialized as production identity secrets.

### Transaction boundary

One transaction checks current org/aggregate revision and authority, allocates
the next org journal sequence, inserts domain revisions/decision snapshot,
appends attributable audit events, stores the durable command receipt and
updates projections/head. No successful response before commit. Inject failure
at every boundary and require all-or-nothing state, decision, audit and receipt.

Propose SQLite foreign keys enabled, explicit busy timeout, `BEGIN IMMEDIATE`
write serialization and verified durable synchronization settings. Any WAL mode
must account for database/WAL/SHM together during backup and cleanup. Do not use
copies of an open database as a proof checkpoint. Document local-filesystem and
power-loss limits; process restart proof is not disaster-recovery certification.

## 6. Audit-integrity model

Every material event is attributable and ordered by unique `(orgId, sequence)`,
not timestamp alone. Hash a versioned, recursively canonical representation of
all material fields: org, sequence, event type, payload, input revision links,
actor and authority snapshot digest, command ID, schema version, recorded time
and previous hash. Reject unsupported values/non-finite numbers; arrays retain
order. Identical content with reordered object keys must hash identically;
nested content mutation must change the digest.

Reuse the exported OS hash primitive only through an approved CIVIC adapter
with validated canonical payload. Do not blindly reuse shallow JSON replacer
canonicalization for nested decision evidence. Serialization semantics and hash
algorithm/version must be fixed and included in verification fixtures.

Append-only database triggers reject UPDATE/DELETE of journal, final decisions
and historical revisions. Narrow repository APIs expose no destructive history
method. Sequence/head serialization prevents forked predecessor selection.
Verification checks org binding, genesis, gaps, duplicates, order, payload hash,
head and complete event count before reconstruction.

A recomputable hash chain alone cannot detect privileged wholesale rewrite or
tail truncation. Record a separate proof-owner-held checkpoint manifest outside
the writable database, with expected count/head digest; compare on restart and
final verification. No signing service, external anchor or legal certification
is proposed. Threat model: accidental/caller corruption and tampering relative
to a retained trusted checkpoint; an attacker controlling database AND checkpoint
or privileged removal of triggers is outside the proof's guarantees.
Detection before checkpoint, trust in manifest custody and host clock remain
explicit limitations. Never describe local hashes/triggers as tamper-proof.

## 7. Temporal-history model

Keep two independent dimensions:

- `recordedAt` plus monotonic org sequence: what was known at a cutoff;
- `effectiveAt` / `expiresAt` / revocation or supersession effective time:
  when a recorded institutional fact applies.

Historical reads specify org, recorded-sequence cutoff and effective instant.
An event recorded later cannot appear in an earlier known-at reconstruction.
Late evidence and backdated corrections append new revisions, never overwrite
prior recorded knowledge. Distinguish "known at decision time" from a later
retrospective assessment; a later revocation may invalidate future authority but
must not silently rewrite the snapshot of an already committed decision.

Replay applies fixed schema-version rules in sequence; unknown event versions,
missing references, cycles, corrupted hashes or incomplete streams fail
explicitly. Configuration is versioned so later thresholds do not recalculate
past decisions as though the institution had used them then. Compare rebuilt
projections to stored heads; discrepancies require diagnostics, not silent repair.
Read-only archival reconstruction after runtime termination is proposed only if
separately approved; no retained executable permission is presumed.

## 8. Authority-snapshot model

At decision commit, capture the human actor ID/kind, institution, membership
revision, position revision, authority revision and full action/resource/time
binding, instrument reference/version, configuration revision, evaluation time
and outcome, plus exact evidence/interpretation revisions used.

Evaluate authority from current transactional records; snapshot ID references
alone are insufficient if their targets are mutable. Preserve immutable contents
or verified revision digests with immutable retrievable revisions. Do not infer
authority from authentication or role membership. Authentication remains a
separate trusted synthetic session input, not production identity verification.

Later role change, reassignment, expiry or revocation must not alter prior
decision provenance. New consequential decisions require current human authority
and expected state version. Machine or foreign actors remain denied. Historical
snapshot access is also org-scoped; replay is not authorization to act.

## 9. Idempotency, concurrency and authorization performance

### Durable command semantics

Use an unambiguous tuple `(orgId, commandType, idempotencyKey)` with canonical
payload digest. Same key/same payload returns the original committed result
after current authorization and read-access checks; same key/different payload
raises explicit conflict. No response-cache TTL may permit a historical decision
to be duplicated. Durable receipts live for the proof history's lifetime.

Atomic unique receipt insertion, journal/domain writes and expected-version
comparison share the same transaction. A crash before commit leaves no effect;
a crash after commit but before response is resolved by receipt lookup. Leases
and fencing are useful prior art but not a replacement for atomic domain commit.
Different keys attempting the same final decision still obey aggregate
version/finality constraints.

Two processes race on the same synthetic item and authority stream: at most one
conflicting transition commits; the loser receives bounded busy/stale-state
diagnostics requiring reload and explicit human resolution. Revocation versus
decision races use the same org serialization boundary. Never auto-merge
consequential decisions or blindly retry stale authority/state. Read models use
a consistent transaction snapshot.

### Performance without cached authorization

Assess a CIVIC-owned authorization-context port with immutable per-command
context, not a process-wide `authorized=true` cache. Proposal: collect full
actual clock/Git/grant/decision/termination evidence once at command admission,
use it only inside that command's pure calculations, and revalidate the full
live boundary immediately before committing any material mutation. Independent
reads and each retry require fresh admission checks. Expiry, revocation,
termination or changed branch/worktree/paths between admission and commit deny.

Do not reuse context across commands, accept caller-supplied approval context,
use stale successful validation on I/O errors, or skip static scans for speed.
The separation between host-file/Git authorization and a database transaction
has residual TOCTOU risk; do not claim atomic revocation across both systems.
If immediate fail-closed revocation cannot be demonstrated under the approved
threat model, keep the existing stricter checks and report performance unchanged.

Benchmark at least 50 equivalent read commands and 50 write commands on the same
machine/fixtures, report median/p95 and check counts against Slice 0 baseline.
Candidate target is at least 25% median reduction without a correctness loss.
Performance is secondary: no speedup is grounds to weaken authorization; missed
target is reported separately, not disguised as integrity PASS.

## 10. Reuse classification and source-backed review

Classifications are proposals for Slice 1, not permission to import now.
All shared packages and SAGE remain read-only during this preparation mission.

| Required capability / surface | Classification | Evidence and boundary |
| --- | --- | --- |
| Local transactional storage driver | `REUSE_AS_IS` | Candidate built-in `node:sqlite`; verify Node/runtime support, explicit local file only |
| CIVIC persistence/repository port | `CIVIC_NEW` | Current [kernel](../../../apps/civic/src/kernel.ts) uses Maps; no durable CIVIC repository exists |
| CIVIC local schema/journal/projections | `CIVIC_NEW` | Org-composite constraints, revisions and transaction semantics stay CIVIC-owned |
| Shared PostgreSQL client | `DEFER` | [DB client](../../../packages/db/src/client.ts) reads ambient `DATABASE_URL` and imports full shared schema; no reuse of a real/default DB |
| Scoped DB abstraction | `REUSE_WITH_CIVIC_ADAPTER` | [Scoped DAL](../../../packages/db/src/scoped.ts) is useful org-scoping prior art but PostgreSQL-specific; reuse scoped-port semantics, not an unauthorized import/registry change |
| Shared database schemas/migrations | `NOT_AUTHORIZED` | [Decision events](../../../packages/db/src/schema/decision-events.ts) concern platform authorization, not CIVIC institutional decisions; no new CIVIC columns/tables there |
| Identity shape | `REUSE_WITH_CIVIC_ADAPTER` | [Identity contract](../../../packages/platform-contracts/src/identity.ts); synthetic sessions remain separate from institution authority |
| Organization/membership shapes | `REUSE_WITH_CIVIC_ADAPTER` | [Org contract](../../../packages/platform-contracts/src/org-scope.ts); persistent composite boundaries need CIVIC checks |
| Role shape | `REUSE_WITH_CIVIC_ADAPTER` | [Role contract](../../../packages/platform-contracts/src/role.ts); role never becomes delegation |
| Audit event envelope | `REUSE_WITH_CIVIC_ADAPTER` | [Audit contract](../../../packages/platform-contracts/src/audit-event.ts); `evidenceGrade` boolean alone is not integrity proof |
| Hash computation and chain verification | `REUSE_WITH_CIVIC_ADAPTER` | Exported [OS hash](../../../packages/os-core/src/hash.ts) uses JSON serialization; canonical nested inputs, complete-head checks and org sequence needed |
| Audit engine/store | `DEFER` | [Engine](../../../packages/audit/src/engine.ts) reads head then appends separately; [store](../../../packages/audit/src/store.ts) is in-memory; no transactional continuity guarantee inherited |
| Canonical nested encoding | `CIVIC_NEW` | [Seal prior art](../../../packages/os-core/src/evidence/seal.ts) distinguishes shallow exported canonicalization from internal recursive sorting; no shared helper edits or unverified nested hash coverage |
| Integrity checkpoint and custody | `CIVIC_NEW` | [Audit snapshots](../../../packages/audit/src/snapshot.ts) are in-memory and bounded reads; need complete durable head/count against separately retained manifest |
| Platform event persistence/dispatch | `DEFER` | [Event store](../../../packages/platform-events/src/store.ts) offers limited queries; no exposed atomic aggregate/receipt/hash commit and no org parameter on correlation lookup; no cross-app bus publishing |
| Temporal lifecycle prior art | `REUSE_WITH_CIVIC_ADAPTER` | [Policy events](../../../packages/db/src/schema/policy-governance-events.ts) distinguish lifecycle from authorization; reuse concept, not policy tables/enums |
| Temporal revision/reconstruction records | `CIVIC_NEW` | CIVIC bitemporal/known-at and supersession semantics cannot be pushed into neutral shared contracts |
| Authority snapshot and supersession | `CIVIC_NEW` | Exact decision-time authority/evidence remains CIVIC-owned |
| Idempotency port/lease semantics | `REUSE_WITH_CIVIC_ADAPTER` | [OS idempotency](../../../packages/os-core/src/idempotency.ts) and [lease migration](../../../packages/db/drizzle/0031_idempotency_reservation_lease.sql) provide acquisition/fencing prior art; HTTP cache with TTL is not lifetime decision receipt |
| Durable receipts + atomic concurrent decisions | `CIVIC_NEW` | CIVIC transaction must include effect, receipt and audit; no shared cache import assumed |
| Append-only trigger pattern | `REUSE_WITH_CIVIC_ADAPTER` | [Existing triggers](../../../migrations/platform/hash-chain-immutability-triggers.sql) are table-specific and structural; not evidence that CIVIC or referenced decision tables have verified protections |
| Scoped authorization-context adapter | `CIVIC_NEW` | Existing [guard](../../../scripts/lib/civic-oci-doctrine.ts) remains prior art; no cached grant bypass |
| Two fictional configuration/chain fixtures | `REUSE_WITH_CIVIC_ADAPTER` | [Slice 0 scenario](../../../apps/civic/src/scenario.ts) needs explicit revision/genesis persistence, not new institutional semantics |
| SAGE runtime | `NOT_AUTHORIZED` | `READ_ONLY_PRIOR_ART` only; no dependency or product edits |
| Production identity, live integrations, legal certification, UI/pilot | `NOT_AUTHORIZED` | Outside this institutional continuity proof |

Only the four existing platform-contract subpaths and `@nzila/os-core/hash` are
candidate shared runtime imports. Semantic prior-art rows do not authorize their
modules. All transitive imports must be examined before activation; a narrow
subpath does not authorize the OS barrel, database, telemetry, blob or secrets
composition. Any new shared helper requirement means
`STOP_AND_REPORT_SCOPE_EXTENSION_REQUIRED`, not a multi-product refactor.

## 11. Proposed writable, read-only and prohibited surfaces

### Current preparation mission

Writable: the existing Slice 0 proof's human acceptance record and this packet
only. Everything else is read-only. The read-only pasted attachment is not edited.
No change to runtime, contract, validator, tests, shared packages or lockfile.

### Future implementation allowlist - requires separate approval

- `apps/civic/src` and `apps/civic/tests`: bounded repository, local storage,
  temporal replay, snapshot/receipt logic and proof tests only.
- `apps/civic/fixtures`: fictional JSON input only.
- `apps/civic/migrations`: proposed CIVIC-local SQLite DDL only; never shared DB
  migrations or runtime auto-migrations against an ambient database.
- Existing CIVIC package/TypeScript/Vitest configs and README: only local proof
  scripts, approved driver/import wiring and directly related documentation.
- This packet and proposed `docs/public-service/operations/CIVIC_RUNTIME_SLICE_1_PROOF.md`.
- Existing CIVIC doctrine contract, validator, doctrine tests and integrity
  documentation: only a separately human-approved fail-closed Slice 1 exception.

Generated database/checkpoint/test scratch is outside tracked source at a
human-approved exact local directory. Record the approved path in the grant;
reject symlinks, arbitrary paths, network shares and inherited ambient DB URLs.
Do not presume a storage location or include private database files in commits.

Read-only: Slice 0 packet/proof history, shared contracts, DB/audit/events/OS
prior art, doctrine, portfolio metadata and other products.

Prohibited: `packages/**` edits, shared migrations, root workspace/lockfile edits,
other apps, product-neutral contracts carrying CIVIC semantics, public routes,
deployment/infrastructure/cloud, connector/provider composition, real data,
cross-product refactoring and automatic grant renewal.

## 12. Data boundary

`SYNTHETIC_ONLY`. Both institutions, actors, instruments, source references,
timestamps, statements and scenarios remain explicitly fictional. Persist only
approved fictional fixture-derived data; reject non-synthetic scope and external
locators. No copied government/customer documents, production session tokens,
credentials, personal data or secrets. Synthetic markers alone cannot certify
arbitrary text: fixture review and input-path restrictions are also required.

Beyond-synthetic data requires a distinct explicit human authorization; do not
interpret durability or proof-owner acceptance as real-data approval.

## 13. Risks and unresolved design prerequisites

| Risk | Proposed control / residual limitation |
| --- | --- |
| Historical authority rewritten by current role | Immutable decision-time snapshots and revision-bound reads |
| Partial domain/audit/receipt persistence | Single atomic transaction and crash injection |
| Retry or stale writer duplicates decision | Lifetime receipt + unique constraints + expected version |
| Forked journal heads | Org sequence allocation under write serialization |
| Late evidence contaminates earlier knowledge | Independent effective time and recorded-sequence cutoff |
| Hash misses nested fields or tail truncation | Canonical coverage tests and separately held count/head checkpoint |
| Host/DB administrator rewrites all artifacts | Explicitly outside custody threat model; no legal/tamper-proof claim |
| SQLite locking/runtime/filesystem limitations | Verify driver/platform and two-process proof; fail, do not fall back |
| Ambient DB or path expansion | Exact approved local storage binding and no shared DB client |
| Cached authorization or TOCTOU | Fresh admission/commit checks; demonstrate failure paths; no speed bypass |
| Expanded archival execution permission | Separate closure policy; retain static scans without an active grant |
| Unreviewed new dependency/import | Exact subpaths, transitive review; stop before shared changes |

The human decision below supplies the finite effective/expiry dates, proof owner,
conditional packet reuse and preference for the smallest CIVIC-owned persistence
boundary. Still unresolved before activation: a human-approved exact local
storage directory and checkpoint custody/location. Node local-driver support
and precise filesystem/import boundaries must be validated before activation
can PASS; no storage approval or checkpoint custody is inferred.

## 14. Stop conditions

Return `STOP_AND_REPORT_SCOPE_EXTENSION_REQUIRED` if shared-package changes,
new server/cloud infrastructure, alternate backend or wider imports are required.
Stop on any real data/external connector, unsupported local driver, missing human
grant/date/owner, wrong worktree/branch/ancestry, expiry/revocation/termination,
cross-org access, authority history mutation, failed integrity/replay, unsafe
concurrency or duplicate consequential effect.

Failed proof gates are FAIL/BLOCKED, not PASS_WITH_LIMITATIONS. Do not continue
material implementation after an activation check fails. Unresolved custody/
threat-model requirements prevent an evidence-integrity claim.

## 15. Rollback and closure posture

First revoke/terminate the future grant; verify constructors, reads, writes,
retries and restarted workers deny execution. Preserve proof and human decision
records, static archival scanning and general false authorization.

Retain the exact synthetic DB/checkpoint set for human review if approved;
cleanup only enumerated resolved proof files after explicit retention decision,
never broad recursive deletion or shared database operations. Roll back only
mission-owned code/config changes with human approval; never reset unrelated
dirty work or erase decision history in place. No downgrade migration that
silently rewrites accepted history. Any further execution needs a new finite
human decision, not a toggled generic boolean.

## 16. Required proof suite

| Proof | Required measurable assertion |
| --- | --- |
| Persistence | Writer process commits A/B chain; a distinct new process reconstructs identical IDs, decisions, variance, conflicts and receipt results from the approved file without reseeding |
| Reconstruction | Before/after evidence, revocation, configuration and supersession cutoffs exactly match independently specified expected records; late-recorded evidence absent at earlier known-at cutoff |
| Immutability | API and direct test SQL UPDATE/DELETE attempts against final decisions/journal/revisions fail; original values/head unchanged |
| Supersession | New authorized decision references old decision; both histories survive restart; no cycle or cross-org predecessor |
| Authority history | Role/delegation/instrument changes leave old snapshot byte/digest equivalent; new decision evaluated under current revisions |
| Idempotency | At least 20 concurrent same-key/same-payload attempts yield exactly one consequential record, one receipt and one corresponding decision event; different payload conflicts |
| Crash/retry | Crash before commit has zero effect; crash after commit/before response replays original result; failure injections leave no orphan audit/domain/receipt |
| Concurrency | Two processes, different keys, same expected revision: exactly one conflicting final transition commits; loser receives explicit conflict; decision/revocation race follows serialized revision order |
| Audit integrity | Nested payload changes, missing/reordered/duplicated/cross-org events, broken link and checkpoint-relative tail truncation each fail; complete pristine history verifies |
| Isolation | Org A cannot read, replay, reference, supersede or write org B records through any adapter/read/receipt/snapshot path, including restart |
| Closure | Termination/expiry/revocation deny existing and new workers and retries; retained source still scanned, with no active permission |
| Regression | Preserve all accepted Slice 0 R/D/T semantics using separately authorized Slice 1 harness; never remove Slice 0 termination to rerun it |
| Performance | Admission/commit boundary changes deny; benchmark 50 reads/50 writes, median/p95/check counts and proposed 25% target; do not trade correctness for latency |

Required future checks: CIVIC doctrine/authorization tests, actual-context
validator, scoped runtime/restart/concurrency/integrity suite, CIVIC and governance
typechecks, existing lint rules, docs and whitespace/isolation checks. Before any
future PR review, run repository-required lint, typecheck, test:fast, validate:docs
and governance:audit, reporting exact results. No CI/PR/merge permission is implied.

## 17. Contract and governance changes required - NOT APPLIED

The existing schema-v2 exception is Slice 0-only and terminated. Do not reuse its
window, remove its termination marker, flip general authorization or infer a
Slice 1 grant from this packet.

Propose a distinct optional `runtimeAuthorization.slice1` under a separately
approved schema revision, with exact slice/mission ID, canonical human decision
artifact, approved baseline SHA/branch/worktree, finite effective/expiry times,
revocation, synthetic/non-production flags, proof owner, storage/checkpoint
locations, exact writable paths/import subpaths and closure artifact.
Absent/pending/malformed/expired/revoked grants deny execution. Exact version and
values must be approved, not guessed at implementation.

Scanner changes would narrowly permit the local driver/crypto and explicitly
approved CIVIC migrations/storage adapter, not arbitrary filesystem/network or
shared packages. Every runtime entrypoint must enforce the same boundary.
Authorization tests must cover driver/path escapes, ambient database rejection,
all unsupported grants and closure, retaining Slice 0 archival scanning and
all doctrine/cross-app checks.

The original preparation was blocked because the terminated Slice 0 changed-path
allowlist did not include this packet. On 2026-10-10, the human maintainer separately
approved the [documentation-only archival amendment](../../oci/CIVIC_OCI_DOCTRINE_INTEGRITY.md#documentation-only-archival-gate-amendment).
It permits only this pending packet for governance review and fingerprints the
retained Slice 0 source. The old grant is unchanged; no Slice 1 exception or
runtime permission is created. Broader future governance changes still require
separate explicit human approval.

## 18. Recommendation, preparation validation and isolation

**Non-binding recommendation:** `AUTHORIZE_WITH_CONDITIONS` for the future bounded
technical continuity proof only, after reviewing the backend/custody model,
approving all finite grant prerequisites. The documentation gate is now resolved;
this recommendation is still not implementation permission.

**Current implementation posture:** Conditional human decision recorded;
no executable grant and no material implementation until activation PASS.

**Packet disposition:** `CIVIC_RUNTIME_SLICE_1_AUTHORIZATION_PACKET_READY`

**Current activation:** `CIVIC_SLICE_1_ACTIVATION_PASS`; execution subsequently
terminated at bounded proof closeout

The design packet is prepared and reviewable after the separately authorized
documentation amendment. Runtime remains closed. The initial blocked preparation
and its validation evidence are retained below as history, not current gate state.

Preparation validation:

- Slice 0 acceptance was recorded documentation-only; actual CIVIC validator
  passed before this new packet was created.
- After packet creation, `pnpm exec tsx scripts\validate-civic-oci-doctrine.ts`
  FAILED, exit 1: `CIVIC_SLICE0_AUTHORIZATION_INVALID` names this packet's
  unapproved changed path. Losing archival permission also produces cascading
  `CIVIC_RUNTIME_UNAUTHORIZED` findings for the retained Slice 0 source/test
  surfaces. No context override or code/contract adjustment was used.
- `pnpm exec vitest run --config tooling\contract-tests\vitest.config.ts tooling\contract-tests\civic-oci-doctrine-integrity.test.ts`
  PASSED, 46 tests. These use the existing deterministic fixture context and do
  not negate the actual-context gate failure.
- Read-only `runDocConsistency` API, scoped to the two changed documents:
  PASSED, no errors/warnings, four informational naming notices.
- Internal-link, new-file whitespace, acceptance/termination and unchanged
  contract assertions: PASSED. `git diff --check`: PASSED.
- Exact document-path collision checks in main/G2 worktrees found no changes;
  baseline HEAD and current branch remain unchanged.
- No runtime suite or proof was rerun after termination.
- Shared prior-art review is source inspection, not new executed integrity,
  database, concurrency or production claims.

Baseline/current HEAD: `1c337567635bb86ea0df7831557d8d2d22df1e6f`.
Branch: `civic/three-reality-hardening`.
Worktree: `C:\APPS\nzila-os.worktrees\pasted-text-processing`.
Existing Slice 0 dirty changes are retained; this mission changes only its proof
acceptance text and adds this packet. No commits, database creation, migration,
dependency install, runtime implementation, deployment, merge or publication.

### Documentation-only archival amendment checkpoint - 2026-10-10

Human maintainer: Aubert Nungisa. Scope: this exact pending Markdown packet only;
`DOCUMENTATION_REVIEW_ALLOWED` never means `RUNTIME_EXECUTION_AUTHORIZED`.
General runtime authorization stays false; Slice 0 remains accepted with
limitations and terminated; Slice 1 runtime has no grant.

Mechanism: exact path, pending decision, synthetic-only declaration, implementation
authorization NONE, recorded human amendment and accepted/terminated Slice 0
proof checks. Existing branch/worktree/ancestry and changed-path checks remain.
Retained executable/config/metadata files are bound to an explicit SHA-256
inventory; new files or changed/missing archived bytes fail. All existing source,
import, network, fixture and cross-app scans remain in force. Removing the proof
termination marker cannot reopen runtime under the recorded archival amendment.

The amendment changes only the existing validator, doctrine tests, integrity
documentation and this packet's current gate/evidence text. No source/config/
package/contract changes, new entrypoints, shared dependencies, database or
migrations. The pending maintainer decision below is unchanged.

Amendment validation:

| Check | Result |
| --- | --- |
| `pnpm exec vitest run --config tooling\contract-tests\vitest.config.ts tooling\contract-tests\civic-oci-doctrine-integrity.test.ts` | PASS, 71 tests; original 46 retained plus 25 archival/documentation cases |
| `pnpm exec tsx scripts\validate-civic-oci-doctrine.ts` | PASS with actual clock/Git context, terminated Slice 0, pending packet and exact archived source |
| `pnpm exec tsc --noEmit --skipLibCheck --esModuleInterop --types node --target ES2022 --module NodeNext --moduleResolution NodeNext scripts\lib\civic-oci-doctrine.ts` | PASS |
| Actual exported runtime guard, invoked without executing CIVIC proof | EXPECTED DENIAL: bounded proof authorization terminated |
| Read-only scoped `runDocConsistency` API and internal-link checks | PASS, no errors/warnings; three informational naming notices |
| `git diff --check` and explicit new-packet whitespace check | PASS |
| Exact amendment-path collision checks in main/G2 worktrees | PASS, no collisions; unrelated changes preserved |

Checkpoint disposition: `CIVIC_SLICE_1_DOC_GATE_PASS`.
Stop at `SLICE_1_PACKET_READY_FOR_HUMAN_REVIEW`; no runtime implementation,
activation, renewal or change to the pending human decision is permitted.

### Slice 1 implementation closeout

The later human decision and storage/custody completion supersede the earlier
pending/blocked prerequisite posture above; historical validation remains on
file. Activation passed with 106 doctrine tests, actual-context validation,
targeted typecheck, docs/whitespace and collision checks before material runtime.

The [durable proof](CIVIC_RUNTIME_SLICE_1_PROOF.md) records 34 passing runtime tests,
fresh-process recovery, temporal/authority history, supersession, durable receipts,
concurrency, immutability and checkpoint-relative tamper evidence. Technical
disposition: `CIVIC_RUNTIME_SLICE_1_PASS_WITH_LIMITATIONS`. Aubert Nungisa subsequently
recorded `CIVIC_RUNTIME_SLICE_1_ACCEPTED_WITH_LIMITATIONS` on 2026-10-10 in that proof;
the limitations remain unresolved and execution remains terminated.
Authorization is terminated at proof closeout; general authorization stays false,
Slice 0 remains terminated, and retained source fingerprints/scanning are enforced.
Local proof artifacts remain under Aubert Nungisa's custody for review; subsequent
retention/cleanup needs separate instruction. No deployment, merge or Slice 2.

## 19. Decision boundary

The explicit human decision is recorded below. It is not an executable grant.
Only `CIVIC_SLICE_1_ACTIVATION_PASS` permits material Slice 1 implementation.
Neither the historical documentation checkpoint nor Slice 0 acceptance
substitutes for that checkpoint.

### Activation prerequisite checkpoint - 2026-10-10

General `runtimeAuthorization.authorized = false`; Slice 0 stays terminated.
No `runtimeAuthorization.slice1` exception exists. The exact packet remains
scan-only when its complete conditional decision and BLOCKED activation are
present. The runtime guard remains unchanged and denies terminated Slice 0.

The packet's approved section 11 requires generated database/checkpoint scratch
at a human-approved exact local directory, recorded in the grant, and says not
to presume a storage location. The supplied decision does not name that directory
or establish checkpoint custody/location. Naming the proof owner does not by
itself create a separately retained trusted checkpoint or approve its storage.

**Required human completion:** Explicit exact local synthetic storage directory
and checkpoint custody/location. The checkpoint must remain outside the mutable
database and its trust/custody assumptions must be recorded. No directory, file,
database, checkpoint or migration is created by this activation attempt.

Writable in this activation attempt: this packet, the existing CIVIC validator,
its doctrine tests and directly related integrity documentation only. Read-only:
Slice 0 retained source/config/proof, doctrine contract, all shared packages and
other products. Prohibited: material runtime, database creation, migrations,
external integrations, live/real data, production, deployment and Slice 2.
The broader future implementation surfaces proposed in section 11 are not
activated.

Activation-attempt validation:

| Check | Result |
| --- | --- |
| `pnpm exec vitest run --config tooling\contract-tests\vitest.config.ts tooling\contract-tests\civic-oci-doctrine-integrity.test.ts` | PASS, 77 tests; prior 71 retained and six recorded-blocked-decision cases added |
| `pnpm exec tsx scripts\validate-civic-oci-doctrine.ts` | PASS with actual context; this verifies scan-only record retention, not Slice 1 activation |
| `pnpm exec tsc --noEmit --skipLibCheck --esModuleInterop --types node --target ES2022 --module NodeNext --moduleResolution NodeNext scripts\lib\civic-oci-doctrine.ts` | PASS |
| Actual exported runtime guard | EXPECTED DENIAL: bounded proof authorization terminated |
| Scoped read-only docs consistency | PASS, no errors/warnings; informational naming notices only |
| Diff/whitespace | PASS |
| Exact changed-surface collision checks in main/G2 worktrees | No collisions |

HEAD remains `1c337567635bb86ea0df7831557d8d2d22df1e6f` on
`civic/three-reality-hardening` in the existing isolated worktree. Unrelated
changes are preserved. No runtime, shared-package, doctrine-contract, database,
migration, deployment, merge or commit changes in this activation attempt.
Passing validation of the blocked decision does not remove the missing
human storage/custody prerequisite.

**Disposition:** `CIVIC_SLICE_1_ACTIVATION_BLOCKED`

## MAINTAINER DECISION

**Decision:** `AUTHORIZE_WITH_CONDITIONS`

Permitted values:

- `AUTHORIZE_CIVIC_RUNTIME_SLICE_1`
- `AUTHORIZE_WITH_CONDITIONS`
- `DO_NOT_AUTHORIZE`

**Maintainer:** Aubert Nungisa

**Decision date:** 2026-10-10

**Conditions:** Runtime Slice 1 only; `SLICE_1_DATA_BOUNDARY = SYNTHETIC_ONLY`.
General runtime authorization stays false and Slice 0 remains terminated.
Use a separate bounded fail-closed mechanism; no automatic renewal. Preserve
durable, temporal, reconstructable, idempotent, concurrency-aware, tamper-evident
and historically faithful institutional state without silently rewriting
authority, evidence, decisions or accountability. Require persistence/restart,
temporal, authority-history, supersession, idempotency, concurrency,
audit-integrity, replay, isolation, human-decision and closure proofs, and all
supplied negative cases. `SUPERSEDED != DELETED`. Final consequential decisions
remain human-authorized. Use `EVIDENCE_INTEGRITY_PROOF`, not legal certification.

Prefer the smallest CIVIC-owned persistence boundary; shared primitives only
under the packet classifications. No shared-package modification or
CIVIC-specific generic semantics; otherwise
`STOP_AND_REPORT_SCOPE_EXTENSION_REQUIRED`. SAGE remains `READ_ONLY_PRIOR_ART`,
not a runtime dependency or persistence layer. Any authorization-context
optimization must preserve expiry, revocation, branch/worktree and termination
denial without stale caching. Human proof-owner acceptance remains separate
from technical completion.

No real/production/government/customer/procurement/employee/health/external
records, or real people as fixtures. No public UI/routes, pilot, onboarding,
production identity/database, deployment/Azure, government/procurement/ERP/HR
integrations, BI/case management, AI autonomy, MISSION, UE, SAGE, WorkAid, Cora,
House or Slice 2 work. Local durability does not prove production architecture,
backup/restore, disaster recovery, encryption/key operations, scale, regulatory
retention/legal hold, monitoring, production identity or live integration.

Only activation checkpoint work is requested in this mission. No material
Slice 1 implementation before `CIVIC_SLICE_1_ACTIVATION_PASS`. Technical final
dispositions do not constitute human proof-owner acceptance. Even after a pass,
`CIVIC_SLICE_2_REQUIRES_SEPARATE_AUTHORIZATION`.

**Authorized starting SHA:** `1c337567635bb86ea0df7831557d8d2d22df1e6f`

**Authorized branch/worktree:** `civic/three-reality-hardening` /
`C:\APPS\nzila-os.worktrees\pasted-text-processing`

**Effective:** `2026-10-10T17:56:14Z`

**Expires:** `2026-10-17T17:56:14Z`

**Slice 1 proof owner:** Aubert Nungisa

**Approved storage directory:** `C:\APPS\nzila-os.worktrees\pasted-text-processing\.civic-runtime\slice1`

**Approved checkpoint directory:** `C:\APPS\nzila-os.worktrees\pasted-text-processing\.civic-runtime\slice1\checkpoints`

**Checkpoint custodian:** Aubert Nungisa

The human explicitly completed storage and checkpoint custody approval. The
agent may create/inspect only synthetic technical proof checkpoints on behalf
of the owner, not self-accept them. At closeout retain minimum proof artifacts
as `LOCAL_SYNTHETIC_PROOF_ARTIFACT`, report disk inventory and wait for separate
post-acceptance retention/cleanup instructions. No canonical proof corruption;
tamper detection uses bounded test copies.

Storage clean start: approved directory and its parent were absent on inspection.
Created only the approved directory and empty `checkpoints` child. No unknown
files were deleted. Local Git `info/exclude` has the exact
`/.civic-runtime/slice1/` rule; probe database/checkpoint paths are ignored and
no runtime artifact is tracked. This local exclusion is shared Git metadata,
not a repository-wide committed ignore change.

Activation surfaces are narrowed to `apps/civic/src/slice1`,
`apps/civic/tests/slice1` and dedicated `slice1.tsconfig.json` /
`slice1.vitest.config.ts`, plus this packet, future Slice 1 proof, contract,
validator/tests and integrity documentation. Original Slice 0 source/config/
package fingerprints remain unchanged. No shared-package dependencies, shared
migrations, root workspace/lockfile changes or external services are approved.
The approved engine is built-in `node:sqlite`; Node 24.13.1 availability verified
without opening a database. Any unsupported backend requirement stops for scope
approval. Governance guard validates exact dates, grant/decision, local path
structure/no symlinks, exclusion/no tracked data, isolation, scanning and
revocation/termination. No automatic renewal, deployment, production or Slice 2.
