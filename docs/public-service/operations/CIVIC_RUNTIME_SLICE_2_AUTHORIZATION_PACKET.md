# CIVIC Runtime Slice 2 - Proposed Final Synthetic Technical Hardening

**Prepared:** 2026-10-10

**Artifact class:** PENDING_GOVERNANCE_DESIGN_ARTIFACT

**Implementation authorization:** TERMINATED_AT_PROOF_CLOSEOUT

**Proposed data boundary:** `SLICE_2_DATA_BOUNDARY = SYNTHETIC_ONLY`

**Execution state:** TERMINATED

**Activation disposition:** `CIVIC_SLICE_2_ACTIVATION_PASS`

**Current closeout:** `CIVIC_RUNTIME_SLICE_2_PASS_WITH_LIMITATIONS`

**Human proof-owner acceptance:** `CIVIC_RUNTIME_SLICE_2_ACCEPTED_WITH_LIMITATIONS`

**Proof owner / acceptance date:** Aubert Nungisa / 2026-10-12

**Synthetic phase:** `CIVIC_SYNTHETIC_TECHNICAL_HARDENING_COMPLETE`

**Next phase:** `CONTROLLED_HUMAN_OPERATOR_VALIDATION_PREPARATION`

The explicit post-closeout acceptance is recorded in the
[Slice 2 proof](CIVIC_RUNTIME_SLICE_2_PROOF.md). It accepts the stated limitations,
not production/pilot readiness or external validation. The activation decision
below is historical and does not reopen execution. Retained evidence and custody
remain unchanged; no cleanup, outreach or Slice 3 is authorized.

**Execution terminated at:** `2026-10-12T20:28:37.5704126+00:00`

**Immediate activation amendment:** HUMAN_MAINTAINER_APPROVED

The previously approved future effective timestamp of `2026-10-12T18:00:00Z`
was superseded by explicit human-maintainer authorization for immediate activation.
The actual host UTC timestamp captured at the start of this amendment mission is
`2026-10-12T14:38:49.5329498+00:00`; its exact seven-day expiry is
`2026-10-19T14:38:49.5329498+00:00`. The old start and expiry below are historical,
superseded values only, not active conditions. The canonical decision at the end
of this packet governs. No automatic renewal.

## 1. Accepted baseline and mission

Aubert Nungisa accepted the [Slice 1 proof](CIVIC_RUNTIME_SLICE_1_PROOF.md) as
`CIVIC_RUNTIME_SLICE_1_ACCEPTED_WITH_LIMITATIONS` on 2026-10-10. Its technical
disposition remains `CIVIC_RUNTIME_SLICE_1_PASS_WITH_LIMITATIONS`: 34 runtime
tests and 107 doctrine tests passed at closeout. The accepted Slice 0 R/D/T
operating model is inherited, not re-certified by this document.

General `runtimeAuthorization.authorized = false` remains false. Slice 0,
Slice 1 and Slice 2 remain terminated and their executable/configuration
fingerprints remain archival controls. The historical Slice 2 grant is revoked.
Preparation neither reopens an old
grant nor permits executable code, persistence access or proof execution.

Question:

> Can CIVIC preserve correct authority, integrity, and institutional history under
> adversarial timing, recovery, and integrity conditions while establishing an
> honest local performance envelope?

Slice 2 is proposed as the final synthetic technical-hardening slice, unless it
exposes a major defect requiring an explicit corrective decision. It is not a
feature-expansion mission.

The unproven 25% performance target is not carried forward as an achievement or
new target. Coordinated store/checkpoint compromise and the missing
decision-versus-revocation process race remain unresolved baseline limitations.
Local SQLite is not production persistence architecture. Production backup/restore,
disaster recovery, key management, identity integration, real users, real authority
instruments, real data and production runtime remain unproved and unauthorized.

## 2. Invariants and proposed authoritative ordering

`AUTHENTICATION != AUTHORIZATION != DELEGATED_INSTITUTIONAL_AUTHORITY`

`FINAL_CONSEQUENTIAL_DECISION = AUTHORIZED_HUMAN_ONLY`

Only fictional synthetic institutions and synthetic human-role principals may
participate. The human-role fixture is not a real person or real identity provider.
Machine identity, membership alone and an old client timestamp never confer
delegated institutional authority.

The [Slice 1 store](../../../apps/civic/src/slice1/store.ts) currently uses
`BEGIN IMMEDIATE`, rebuilds committed state, checks live admission authority before
receipt lookup and checks runtime governance again before commit. That last check
is a runtime-grant check, not a second institutional-authority evaluation.
Slice 2 must not describe this as already-proven commit-boundary TOCTOU protection.

Proposed linearization point: the final successful authority and runtime-grant
validation against the locked latest institutional revision, immediately before
SQLite COMMIT. A successful committed transaction records that authoritative
admission boundary; a rolled-back transaction has no consequential effect.
No callback, await, barrier or consequential work may occur between final validation
and COMMIT. Physical disk completion time is not claimed to be a separately
measured instantaneous authority boundary.

- Revocation, membership suspension and decisions use the same serialized
  transaction boundary and org revision, not a separately mutable authority table.
- Replay verifies the institutional predecessor revision and authority snapshot.
  Live authority expiry is checked using a trusted local proof clock at final
  validation, not the operation's client-supplied `at`.
- A revocation that commits first denies the decision using the revoked state.
  Version conflicts must not mask the required authority rejection assertion.
- If the decision obtains the writer lock, passes final validation and commits
  first, a later revocation does not invalidate that historical decision.
  A revocation request waiting for the lock is not a committed revocation.
- No retrospectively effective revocation may rewrite a legitimately committed
  prior decision. Backdated correction semantics remain deferred.
- Failed attempts have no success receipt. Retry revalidates current authority
  before receipt access. A formerly valid receipt cannot authorize a new action
  after revocation; denied retry does not delete the original committed history.

Record per committed event: synthetic org, sequence, predecessor/head digest,
expected and actual authority revision, human actor/session/membership/position/
instrument/delegation snapshot, effective timestamp, final trusted evaluated-at
time, command key and result digest. Record attempt ordering/barrier identifiers
and denials in separate synthetic technical scenario evidence, never as fabricated
committed institutional decisions.

## 3. Mandatory decision-versus-revocation and TOCTOU proofs

Use two distinct OS processes and transactions over a new approved local proof
store, not two in-memory promises. A parent proof coordinator may use bounded
local process pipes/barriers; no public/network control channel or arbitrary sleep
as the ordering oracle. Set deadlines and record lock timeout explicitly; timeout
is not evidence of correct authority resolution.

Required forced schedules, each with at least 20 successful repeated schedules:

1. **Revocation wins:** decision process pauses after preliminary authority check
   but before writer lock. Another process commits revocation. Resume decision;
   latest locked state must deny it. Retry with identical key and old timestamp
   must also deny, with no decision/receipt effect.
2. **Decision wins:** decision acquires writer lock, revocation process attempts
   its transaction and is observably waiting. Decision final-validates and commits;
   revocation then reloads the latest version and commits. Restart/replay preserves
   the original decision snapshot and ordering.
3. **Authority expires during work:** pause after initial locked admission but
   before final validation, advance only a controlled synthetic test clock past
   the delegated grant's expiry, resume and require rollback. Separately prove
   runtime-grant expiry/termination/revocation denial; fixture clocks must never
   override actual governance admission.
4. **Revoked retry:** exercise both a rolled-back pre-revocation attempt and an
   already committed operation retried after revocation. Both requests are denied
   under current authority; the prior committed record remains reconstructable.
5. **Contested start:** release both processes together, repeatedly. Either legal
   serial order is acceptable, but sequence and authority snapshot must explain
   exactly one order and never a decision admitted after committed revocation.

Add membership suspension, wrong-org revocation/decision, expired instrument,
machine-only actor and same-key/different-payload negative variants. Verify no
duplicate decisions, no uncommitted receipts and stable predecessor linkage in a
fresh reader. Decisions remain authorized-human-only regardless of performance.

## 4. Independent integrity anchor and declared trust model

Target claim: `INDEPENDENT_INTEGRITY_ANCHOR_PROOF`.

Integrity wording: `TAMPER_EVIDENT_WITHIN_DECLARED_TRUST_MODEL`, never tamper-proof.

Recommended smallest bounded mechanism: a canonical manifest/head receipt copied
to a separately approved location under explicit human custody. Pin the expected
receipt digest outside the attacker-writable primary store and ordinary checkpoint
copy, with a separately custody-bound verifier input. Same-host path separation is
only a test permission/custody assumption, not security against host administration.
If meaningful independent custody cannot be established, stop rather than claiming
independence from two writable paths controlled by the same adversarial process.

Receipt proposal: schema version, proof/scenario id, synthetic institution,
monotonic anchor position, previous anchor digest, journal sequence/head digest,
state digest, authority snapshot digest, checkpoint digest, creation timestamp and
custodian/classification. Compare canonical structured data, not only mutable file
bytes. A trusted minimum position detects rollback to an older otherwise valid anchor.
No unnecessary source documents or real identity material.

| Candidate                                        | Assessment                                                                                                                          |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Separate checkpoint head                         | Smallest adapter reuse; meaningful only with protected custody and independently pinned expected position/digest                    |
| Custody-bound manifest/append-only proof receipt | Recommended combined local synthetic mechanism; append-only rule alone cannot constrain a host administrator                        |
| Signed digest                                    | DEFER unless separately approved keys/custody and verification dependency exist; does not solve stolen-key or all-anchor compromise |
| Cloud anchor/external institutional attestation  | NOT_AUTHORIZED                                                                                                                      |

### Trusted

Verifier code and governed source fingerprints; local proof clock/OS/SQLite
transaction behavior within the bounded test; approved synthetic fixture genesis;
the separately pinned expected anchor digest/minimum position; human anchor
custody and tested separation of attacker access.

### Untrusted

Copied primary SQLite bytes, copied checkpoints, head projections, receipt/decision
rows and replay/recovery inputs. Adversarial workers may alter only approved copies,
not canonical accepted Slice 1 evidence or the independent trusted input.

### Detectable compromise

| Attack                                           | Required detection/oracle                                                         |
| ------------------------------------------------ | --------------------------------------------------------------------------------- |
| Store altered, checkpoint intact                 | Replay/envelope/receipt/decision invariants or trusted checkpoint/anchor mismatch |
| Checkpoint altered, store intact                 | Checkpoint canonical digest and trusted anchor mismatch                           |
| Both altered inconsistently                      | Cross-artifact digests/positions and replay mismatch                              |
| Both coherently rewritten                        | Trusted independently held anchor differs; no claim without that anchor           |
| History truncated                                | Trusted minimum sequence/head; even coherent suffix removal fails                 |
| History reordered                                | Org sequence/predecessor and independently pinned head mismatch                   |
| Nested event modified                            | Canonical event hash, replayed state and anchor mismatch                          |
| Authority snapshot modified                      | Historical authority reconstruction plus anchor mismatch                          |
| Decision artifact modified                       | Decision row/journal/snapshot correspondence plus anchor mismatch                 |
| Older valid anchor or recovery artifact replayed | Trusted minimum position detects rollback; explicit stale-artifact error          |

### Undetectable coordinated compromise

An attacker rewriting every store, checkpoint, anchor, independently pinned verifier
input and trusted code consistently is outside the model. Compromised OS/clock,
stolen signing keys if later introduced, and compromised human custody are not
solved by local hashing. A valid pre-anchor suffix cannot be externally certified
without a later trustworthy anchor; report this uncertainty instead of accepting
it silently.

## 5. Recovery, replay and anchor publication boundaries

Propose abrupt process termination before append, within an incomplete transaction,
after append/before commit, after commit/before response, and between database commit
and anchor publication. A fresh process must recover committed state without
reseeding, exclude rolled-back decisions, replay deterministically and retry without
duplicate effects.

SQLite commit and independently held anchor publication are not one atomic
transaction. Do not roll back or lose a committed decision because publication
failed. Mark missing publication explicitly as unanchored/pending review, preserve
the prior trusted anchor, verify the known prefix and refuse to assert complete
anchored integrity for the suffix. Recovery from this window requires an explicitly
defined, human-reviewed reconciliation step, not a silent repair or fresh trust anchor.

Test intact/stale/tampered checkpoints and anchors, coherent truncation, foreign-org
artifacts, duplicate keys and response loss. Recovery must not restore an older
snapshot over newer committed history, resurrect uncommitted decisions, rewrite
authority snapshots or accept corrupted receipts. Preserve detection evidence and
canonical valid stores; all tamper operations use bounded approved copies.

## 6. Honest local synthetic performance envelope

Start uncached. No fake improvement target and no equivalent Slice 0 rerun is
assumed authorized. Measure with a monotonic high-resolution timer, excluding
fixture construction while stating what each metric includes.

| Metric                        | Measurement boundary                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| Authorization check           | Actual scoped runtime guard including clock/Git/changed-path/source checks               |
| Read                          | Command admission through verified state return                                          |
| Write                         | Admission, lock wait, institution validation, append, final checks and commit            |
| Consequential decision commit | Human decision command through committed receipt, with lock wait separated               |
| Replay/reconstruction         | Requested known-at/effective-time reconstruction; separate guarded end-to-end measure    |
| Restart/recovery              | Child process launch through reopened, verified recovered state; separate spawn overhead |
| Integrity verification        | Full journal/receipt/decision/checkpoint/independent-anchor verification                 |

Require at least 100 measured samples per metric/state-size after 10 reported
warm-up samples; propose 16, 64 and 256 journal events per synthetic institution,
two institutions, fixed documented payload sizes. Report actual sizes, successful
sample count, failures/timeouts separately, median and nearest-rank p95, raw
machine-readable samples and deterministic scenario identifiers. Do not silently
exclude slow samples or present failed operations as successful latency measurements.
If insufficient samples fit the authorized window, report an incomplete envelope.

Record OS/Node/SQLite versions, CPU/memory, disk type, worktree/SHA, governance
scan surface size, contention mode, clock method, warm/cold process/page-cache
assumptions, checks performed per operation and measured phase durations.
Fresh process does not imply a cold OS disk cache. Integrity work and live
authorization overhead must not be hidden in an optimization claim.

Any proposed authorization-context optimization must separately prove expiry,
revocation, termination, branch/worktree/ancestry binding, changed-path enforcement,
archival fingerprints and synthetic-only enforcement for existing/new instances.
No TTL may extend an authorization window or mask a governance change. Do not cache
institutional authority across revisions. Prefer phase instrumentation without
caching; leave admission uncached if invalidation cannot be proven. Correctness
takes precedence over speed; local samples are not production capacity estimates.

## 7. Capability reuse classification

| Capability                     | Classification           | Boundary                                                                                                             |
| ------------------------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Local persistence              | REUSE_WITH_CIVIC_ADAPTER | Built-in Node SQLite transactional pattern; separate Slice 2 store/admission adapter, no Slice 1 execution reopening |
| Hashing                        | REUSE_AS_IS              | Node crypto and existing canonical digest algorithm as read-only prior art; no shared contract changes               |
| Checkpointing                  | REUSE_WITH_CIVIC_ADAPTER | Existing metadata/position semantics plus independently anchored receipt verification                                |
| Independent anchor             | CIVIC_NEW                | Custody-bound location and pinned verifier input, awaiting human approval                                            |
| Idempotency                    | REUSE_WITH_CIVIC_ADAPTER | Org/operation/key durable receipt semantics; current authority checked before replay                                 |
| Concurrency primitives         | REUSE_WITH_CIVIC_ADAPTER | SQLite writer serialization plus bounded process barriers and authority-boundary checks                              |
| Authorization context          | CIVIC_NEW                | Exact finite Slice 2 governance guard, requiring separate human activation; no generic boolean                       |
| Temporal reconstruction        | REUSE_WITH_CIVIC_ADAPTER | Existing pure replay/monotonic history semantics; never instantiate terminated Slice 1 store                         |
| Audit verification             | REUSE_WITH_CIVIC_ADAPTER | Journal/receipt/decision replay and independently anchored expected position                                         |
| Performance harness            | CIVIC_NEW                | All seven metrics, phase/check counts, reproducible samples, no automatic caching                                    |
| Signed anchors/production keys | DEFER                    | Separate dependency and custody decisions required                                                                   |
| Backdated branching histories  | DEFER                    | Not necessary for this final bounded hardening question                                                              |
| SAGE runtime/other products    | NOT_AUTHORIZED           | SAGE remains READ_ONLY_PRIOR_ART                                                                                     |
| Shared-package modifications   | NOT_AUTHORIZED           | Product-neutral contracts cannot carry CIVIC semantics                                                               |

Reuse describes a design approach, not permission to modify or execute archived
Slice 1 files. If reuse requires editing fingerprinted files, explicitly propose
that surface for separate approval or use a Slice 2-owned adapter; do not unseal
archives by changing a hash. No dependency/manifest/shared-platform changes are
approved in preparation. Any future required expansion must stop and report.

## 8. Storage, custody and future activation prerequisites

Existing Slice 1 storage/checkpoints remain retained under Aubert Nungisa's custody.
This acceptance/preparation mission does not create, open through product code,
tamper with or clean up any proof store.

Propose a new Slice 2 canonical proof store, separately enumerated adversarial
copies, local checkpoint/evidence structure, and an independently custody-bound
anchor location/verifier-input location. **All exact locations and their custody
are PENDING human approval.** Do not presume the Slice 1 directory is approved for
Slice 2 or prescribe a new path as an approval.

Future activation must require: explicit maintainer decision; starting SHA,
isolated branch/worktree and exact writable allowlist; proof owner; effective and
exclusive expiry time; revocation/termination mechanism; local non-production
synthetic-only restrictions; exact storage/anchor/checkpoint locations and custodian;
clean-start/collision/symlink checks and narrow source-control exclusion.
No automatic renewal, no general authorization bypass, no deployment exception.

Suggested future writable surfaces are a dedicated CIVIC Slice 2 source/test/config
boundary, exact packet/proof and narrowly approved governance tests/guard artifacts.
These are proposals, not current allowlists. Existing accepted source is read-only.
No real people/data, secrets, customer records or institutional integrations.
Generated databases/journals/locks/checkpoints/anchors must never be committed.
Retain minimum synthetic review artifacts; cleanup after acceptance requires a
separate explicit instruction.

## 9. Required proof suite and exit decision

| Proof                | Required acceptance evidence                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| Authority race       | Both forced serial orders and contested two-process runs, recorded sequence/authority snapshots                 |
| TOCTOU               | Institutional expiry/revocation between preliminary check and authoritative boundary cannot authorize commit    |
| Historical validity  | Legitimate prior decision survives later revocation and fresh replay                                            |
| Retry safety         | Failed/committed old attempts cannot use receipt or timestamp to resurrect authority                            |
| Integrity            | Every declared attack yields its specified deterministic detection                                              |
| Independent anchor   | Primary-store tampering detected using a meaningfully separated trusted synthetic anchor                        |
| Recovery             | Crash windows retain committed state, exclude uncommitted state, explicitly surface anchor publication gaps     |
| Replay               | Stable state/authority/decision order at historical cutoffs                                                     |
| Isolation            | Every adversarial scenario preserves institution keys, receipts and custody boundaries                          |
| Performance envelope | Reproducible seven-metric samples with median, p95, count, size, environment and checks                         |
| Closure              | Exact Slice 2 termination denies all admissions; retained proof source still scanned; human acceptance separate |

Retain accepted unresolved/conflicting evidence and human-only consequential
dispositions. R-GATE assesses executable correctness within these bounds; T-GATE
assesses trustworthy institutional history and honest limitations. Synthetic tests
do not pass the human D-GATE.

Successful Slice 2 proof plus explicit human acceptance would support considering
`CONTROLLED_HUMAN_OPERATOR_VALIDATION`, not claiming that phase has been validated,
authorized or delivered. The next proposed phase should shift to Daphne's operational
reality: comprehensibility, workflow burden, configurability, support expectations
and decision usefulness. Richard and Tom may assess institutional/executive relevance.
That human phase needs its own protocol, participants/consent, data restrictions,
support and maintainer authorization; it is neither production nor pilot readiness.
Do not keep deepening synthetic architecture unless a major defect justifies a
separately bounded corrective mission.

## 10. Prohibited breadth and stop conditions

No UI expansion, routes, dashboards, customer onboarding, government connectors,
procurement/ERP/HR/BI features, generic workflow expansion, AI autonomy, external
services, cloud/hosted databases, infrastructure, migrations or deployment.
No real institutional instruments/data and no fixtures identifying real people.

Future implementation must stop if authority checks must be weakened; idempotency
would replay under revoked authority; trustworthy ordering cannot be established;
independent anchor separation cannot be meaningful; shared packages/dependencies
need unauthorized changes; real data/production infrastructure becomes necessary;
another agent owns a required surface; or scope becomes product breadth.

Use `STOP_AND_REPORT_SCOPE_EXTENSION_REQUIRED` for unauthorized expansion.
Preserve failed integrity evidence; never silently repair, bypass or self-accept.
No merge or deployment is authorized.

## 11. Preparation gate and review status

The new packet is a pending design document, not a runtime exception. During
initial preparation the archival changed-path allowlist admitted the Slice 1
packet/proof but not this new Slice 2 path. Preparation did not broaden that
mechanism. The later explicit human amendment below admits documentation review
only.

Preparation validation must record acceptance-only actual-context validation,
post-packet actual-context validation, narrow doctrine/documentation checks,
whitespace and collisions. If the new path is rejected, disposition is
`CIVIC_RUNTIME_SLICE_2_AUTHORIZATION_PACKET_BLOCKED`. The next prerequisite is a
separate exact documentation-only archival amendment, preserving terminated runtime
and this pending human decision. Do not reopen Slice 1 or implement Slice 2 to
make this packet validate.

### Historical preparation checks (2026-10-10)

| Check                                                                                                                               | Result                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm exec tsx scripts\validate-civic-oci-doctrine.ts`, after recording acceptance and before adding this packet                    | PASS; accepted proof remains terminated                                                                                                                             |
| Same actual-context command with this packet present                                                                                | BLOCKED: `CIVIC_SLICE1_AUTHORIZATION_INVALID` reports this exact path in `unauthorizedChangedPaths`; runtime fallback findings follow the denied archival path gate |
| `pnpm exec vitest run --config tooling\contract-tests\vitest.config.ts tooling\contract-tests\civic-oci-doctrine-integrity.test.ts` | PASS, 107 tests; no product runtime tests reexecuted                                                                                                                |
| Read-only scoped `runDocConsistency()` and internal-link checks                                                                     | PASS, no errors/warnings; informational naming notices in existing documents only                                                                                   |
| `git diff --check` and explicit untracked Markdown whitespace/newline checks                                                        | PASS                                                                                                                                                                |
| Exact documentation-surface status checks in the other two worktrees                                                                | No collisions found                                                                                                                                                 |

Observed preparation HEAD: `1c337567635bb86ea0df7831557d8d2d22df1e6f`, branch
`civic/three-reality-hardening`, existing isolated worktree. This observation does
not populate the pending authorized starting SHA or branch/worktree fields.
Only documentation changed in this mission: the Slice 1 proof acceptance, current
acceptance references in its packet/integrity documentation, and this new packet.
Existing unrelated/prior work remains untouched. No governance mechanism, source,
test, dependency, database or storage artifact was changed; no deployment, merge
or commit occurred.

**Historical preparation disposition:** `CIVIC_RUNTIME_SLICE_2_AUTHORIZATION_PACKET_BLOCKED`

The then-unresolved prerequisite was an explicit documentation-only archival
allowlist amendment for
`docs/public-service/operations/CIVIC_RUNTIME_SLICE_2_AUTHORIZATION_PACKET.md`.
Runtime must remain closed and the decision below must remain pending during that
amendment. A passing documentation gate would enable human review, not execution.

### Documentation gate checkpoint (2026-10-12)

Aubert Nungisa explicitly authorized the
[documentation-only archival amendment](../../oci/CIVIC_OCI_DOCTRINE_INTEGRITY.md#slice-2-documentation-only-archival-gate-amendment)
for this exact path. `DOCUMENTATION_REVIEW_ALLOWED` is not
`RUNTIME_EXECUTION_AUTHORIZED`. Both accepted proofs remain terminated and general
runtime authorization remains false; there is no Slice 2 runtime exception/code.
All approval fields below remain pending, including storage and integrity-anchor
custody/location.

The validator admits only this exact additional changed path for static review.
It requires both accepted/terminated proofs, unchanged retained Slice 0/1
fingerprints, no new application files, exact amendment record, regular
non-symlink packet/ancestors, implementation NONE, execution NOT_AUTHORIZED,
synthetic-only boundary and one pending maintainer decision with every approval
field pending. Other changed paths remain subject to the existing allowlist.
Scanners still reject executable/public/network/deployment/database/migration/
shared-dependency additions; fingerprint inventories are not modified.

| Documentation amendment validation                                                                                                                                     | Result                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `pnpm exec vitest run --config tooling\contract-tests\vitest.config.ts tooling\contract-tests\civic-oci-doctrine-integrity.test.ts`                                    | PASS, 147 tests; all prior negatives retained                              |
| `pnpm exec tsx scripts\validate-civic-oci-doctrine.ts`                                                                                                                 | PASS, actual context including this pending packet and terminated archives |
| `pnpm exec tsc --noEmit --skipLibCheck --esModuleInterop --types node --target ES2022 --module NodeNext --moduleResolution NodeNext scripts\lib\civic-oci-doctrine.ts` | PASS                                                                       |
| Existing ESLint rules scoped to validator/tests                                                                                                                        | PASS, zero errors; two pre-existing explicit-any fixture-helper warnings   |
| Scoped read-only docs consistency, local links/anchors and whitespace                                                                                                  | PASS; no findings or broken links; no product runtime suite reexecuted     |
| Prettier on the four modified surfaces                                                                                                                                 | PASS after formatting the packet                                           |
| Actual exported Slice 0/1 guards                                                                                                                                       | EXPECTED TERMINATION DENIAL; no product code executed                      |
| Exact-path collision checks in the other worktrees                                                                                                                     | No collisions                                                              |
| Retained synthetic evidence                                                                                                                                            | All 22 inventoried payload hashes unchanged                                |

No contract/runtime grant, application source, shared package, dependency, storage
artifact, fingerprint, deployment or human decision is changed by this amendment.
Documentation gate disposition: `CIVIC_SLICE_2_DOC_GATE_PASS`.
Stop: `SLICE_2_PACKET_READY_FOR_HUMAN_REVIEW`.

### Conditional authorization activation checkpoint (2026-10-12)

This current checkpoint supersedes the historical pending decision state above,
not its documentation-only validation results. The human supplied the decision
below and requested activation only. At inspection the host clock was
`2026-10-12T14:11:58Z`, before the approved `2026-10-12T18:00:00Z` effective
time. Activation is blocked; no executable exception has been installed.

Approved canonical/checkpoint/adversarial/anchor paths and Aubert Nungisa's custody
are recorded exactly below. Canonical storage root and anchor parent were absent;
no unrelated contents were found at those roots. Full ancestor/reparse-point,
directory creation and source-control exclusion establishment are deferred with
activation; no directory or artifact was created. Existing Slice 1 evidence is
not reopened, modified or cleaned up.

General authorization remains false; Slice 0/1 remain terminated. Dedicated
Slice 2 source/test/config and narrow governance/docs are approved future surfaces,
but are not executable allowances yet. Fingerprinted Slice 0/1, shared packages,
SAGE/other products, infrastructure and deployment remain read-only/prohibited.
No signing keys, cloud anchors, real data, outreach or human validation.

The exact blocked human decision can be retained for static scanning only,
with implementation NONE and execution NOT_AUTHORIZED; it cannot self-activate
on reaching the effective time. Resume activation checks within the approved
window before any material source work. No implementation is requested this turn.

**Current disposition:** `CIVIC_SLICE_2_ACTIVATION_BLOCKED`

Activation-only validation: 154 doctrine tests passed, including exact blocked
decision retention and rejection of altered dates/custody/scope/disposition.
Actual-context governance validation and targeted validator typecheck passed.
Both exported Slice 0/1 guards returned expected termination denials. Scoped
lint had zero errors and two existing fixture-helper warnings; Prettier,
docs consistency (informational path-name notices only), local links/anchors
and whitespace passed. Cross-worktree exact-path checks found no collisions.
All 22 retained Slice 1 payload hashes are unchanged.

Four scoped governance/docs/test files changed; no contract, archived runtime,
shared-package, dependency or proof-storage change. HEAD remains
`1c337567635bb86ea0df7831557d8d2d22df1e6f` on `civic/three-reality-hardening`.
No deployment, merge, commit, product runtime test or material implementation.
Storage exclusion, full clean-start checks and the scoped executable grant remain
unestablished; a static validator PASS is not an activation PASS.

### Immediate activation checkpoint

`CIVIC_SLICE_2_ACTIVATION_PASS` supersedes the historical time-blocked checkpoint.
Exact live guard admission and actual-context validator passed within the amended
window; 174 doctrine tests passed including before-effective, exact-expiry,
altered/extended/revoked grant, isolation and source negatives. Validator typecheck,
scoped lint (zero errors, two pre-existing warnings), docs/whitespace passed.

All existing ancestors through the worktree/storage parent were regular directories,
without reparse points. Slice 2 storage root and anchor parent were absent; clean
collision checks passed before creating only canonical root, empty checkpoints,
empty adversarial-copies and empty independent-anchor root. No unknown data was
deleted. Exact local Git exclude rules `/.civic-runtime/slice2/` and
`/.civic-anchor/slice2/` protect generated data without changing repository-wide
ignore policy; probes under all four approved locations are ignored and no
generated artifact is tracked.

No material Slice 2 implementation ran before this checkpoint. Accepted Slice 0/1
fingerprints remain unchanged. The implementation mission may now proceed under
the separate exact grant only; no signing keys, cloud, shared-package edits,
deployment, merge, real data, Slice 3 or human/operator phase. Runtime scanning
and uncached guard checks remain mandatory; human proof acceptance stays separate.

### Bounded proof closeout

The [Slice 2 proof](CIVIC_RUNTIME_SLICE_2_PROOF.md) records corrected authority
boundary, 15 distinct correctness tests, 100 required process schedules, crash
and adversarial integrity evidence, and seven final performance tests.
All 42 metric/size/institution cells have ten warmups and ten measured samples
with zero failures. The target of 100 measured samples per cell remains unfulfilled
and disclosed; no performance improvement or production extrapolation is claimed.

Execution is terminated at the exact timestamp above through the contract and
guarded literal closure record. General authorization stays false; Slice 0/1 remain
terminated; all three source inventories are fingerprinted and statically scanned.
Minimum local synthetic proof/anchor evidence remains under Aubert Nungisa's custody.
Human proof-owner acceptance is PENDING. Subsequent retention/cleanup requires a
separate instruction; no human/operator protocol, Slice 3, deployment or merge.

## MAINTAINER DECISION

**Decision:** `AUTHORIZE_WITH_CONDITIONS`

**Maintainer:** Aubert Nungisa

**Decision date:** 2026-10-12

**Conditions:** Activation and bounded technical-hardening proof; `SLICE_2_DATA_BOUNDARY = SYNTHETIC_ONLY`; local-only; non-production; no deployment; no general runtime; Slice 0/1 remain terminated; no Slice 3; no controlled human-operator validation.

**Authorized starting SHA:** `1c337567635bb86ea0df7831557d8d2d22df1e6f`

**Authorized branch/worktree:** `civic/three-reality-hardening` / `C:\APPS\nzila-os.worktrees\pasted-text-processing`

**Effective:** `2026-10-12T14:38:49.5329498+00:00`

**Expires:** `2026-10-19T14:38:49.5329498+00:00`

**Storage locations:** `C:\APPS\nzila-os.worktrees\pasted-text-processing\.civic-runtime\slice2`

**Checkpoint directory:** `C:\APPS\nzila-os.worktrees\pasted-text-processing\.civic-runtime\slice2\checkpoints`

**Adversarial copies:** `C:\APPS\nzila-os.worktrees\pasted-text-processing\.civic-runtime\slice2\adversarial-copies`

**Integrity-anchor custody/location:** Aubert Nungisa / `C:\APPS\nzila-os.worktrees\pasted-text-processing\.civic-anchor\slice2`

**Integrity-anchor custodian:** Aubert Nungisa

**Proof owner:** Aubert Nungisa
