# CIVIC / OCI Doctrine Integrity Control

**Status:** implemented governance control

**Scope:** repository doctrine and CIVIC runtime authorization
**Baseline:** `e4602d3d02c650c19ae95299d9221e0b5caaada2`

This control detects material, deterministic drift in the boundary between CIVIC, CLEAR,
OCI, and OCRA. It does not interpret arbitrary prose, change the OCI method, or authorize a
CIVIC runtime.

## Authority map

| Concern                             | Current authority                                                                                                     | Machine authority before this control                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| OCI method identity and phase spine | `docs/oci/OCI_METHOD.md`; `apps/union-eyes/lib/oci/frameworks/index.ts`                                               | `OCI_METHOD` is executable code                                                |
| OCRA relationship to OCI            | `docs/oci/CANON.md`; `docs/oci/OCI_METHOD.md`                                                                         | None                                                                           |
| CIVIC and CLEAR relationship to OCI | `docs/CIVIC_OCI_ALIGNMENT.md`; `docs/public-service/civic-thesis.md`; `docs/public-service/clear-method-canonical.md` | None                                                                           |
| Human institutional authority       | `docs/oci/OCI_AI_BOUNDARY.md`; `docs/public-service/human-review-and-evidence-principles.md`                          | None specific to CIVIC / OCI                                                   |
| AI boundary                         | `docs/oci/OCI_AI_BOUNDARY.md`                                                                                         | General runtime AI controls exist, but no CIVIC / OCI doctrine-integrity check |
| Anti-surveillance boundary          | `docs/doctrine/ANTI_SURVEILLANCE_DOCTRINE.md`; `docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md`                           | General doctrine exists; no CIVIC / OCI non-regression check                   |
| CIVIC lifecycle and market posture  | `governance/portfolio/product-catalog.json`                                                                           | Portfolio schema, drift, and generated-artifact validators                     |
| CIVIC placeholder/runtime posture   | `apps/civic/README.md`; `packages/platform-contracts/src/registry.ts`                                                 | App-floor and control-manifest checks, but no runtime-introduction guard       |
| Historical scope                    | `docs/oci/SUPERSEDED.md`                                                                                              | Directory structure only                                                       |

`governance/portfolio/product-catalog.json` remains the only lifecycle and GTM authority. The
doctrine contract references that source; it does not copy its values.

## Gap audit

### Already deterministically enforced

- Portfolio catalog shape, app/catalog one-to-one mapping, generated portfolio surfaces, and
  platform-product drift.
- The executable five-phase OCI spine exposed as `OCI_METHOD`.
- General app control-manifest shape and repository architectural contract tests.

### Documented but not previously enforced

- CIVIC is a public-service front door to OCI, not an independent method or scoring system.
- CLEAR is the public-service articulation of OCI evidence discipline, not a competing method.
- OCRA is the Recognition-phase instrument inside OCI.
- Human review and institutional adoption remain authoritative.
- AI may assist but may not decide, issue authoritative findings, profile people, or turn
  unreviewed output into institutional output.
- Individual ranking, behavioural profiling, non-consensual inference, and ranked institutional
  comparison are prohibited; cross-institution aggregation is opt-in and privacy bounded.
- CIVIC runtime implementation is unauthorized while the explicit runtime authorization is false.

### Intentionally not machine-enforced

- Semantic interpretation of arbitrary prose.
- The full OCI methodology, facilitation practice, voice, pricing, or commercial design.
- Every numerical scoring weight or question-level contribution.
- Whether an institutional output is substantively correct, fair, or legally compliant.

The alignment document calls the scoring core frozen, but its detailed reference points into
`docs/oci/superseded/**`, while live scoring structures already exist in Union Eyes code. This
control therefore does not create another quantitative authority or modify Union Eyes. Existing
code and its own tests remain controlling for those structures.

## Enforcement model

The machine contract is `governance/foundations/civic-oci-doctrine.contract.json`. Every encoded
invariant carries an authority citation and a reason it must be machine-readable. The validator:

1. validates the contract and its fixed constitutional values;
2. verifies narrow, intentional anchors in current canonical documents;
3. reads CIVIC lifecycle posture directly from the portfolio catalog;
4. checks the declared first-touch surfaces only when that catalog describes CIVIC as pre-product;
5. rejects recognizable runtime capabilities under `apps/civic`, and runtime-bearing CIVIC aliases
   under any other `apps/**` path, while runtime authorization is false; and
6. ignores `docs/oci/superseded/**` and other undeclared material by construction.

The validator fails with invariant ID, artifact, authority, expected state, and observed state.
Run it locally with `pnpm exec tsx scripts/validate-civic-oci-doctrine.ts`. It is included in
`validate:doctrine` and exercised by the normal contract-test CI gate.

## Legitimate change process

A legitimate doctrine change updates the canonical doctrine first, then the contract and its
adversarial tests in the same reviewed change. A lifecycle change starts in the portfolio catalog.
Runtime authorization requires an explicit change to the contract plus the corresponding portfolio
and governance approvals; adding code to `apps/civic` does not authorize itself.

This control proves repository conformance to explicit invariants. It does not prove CIVIC product
readiness, deployment, operational fitness, market validation, or pilot authorization.

## Human-approved synthetic Slice 0 exception

The [decision packet](../public-service/operations/CIVIC_RUNTIME_SLICE_0_AUTHORIZATION_PACKET.md)
records a bounded human approval effective 2026-10-10T16:17:50Z until
2026-10-17T16:17:50Z. Schema v2 retains general `authorized=false` and adds only
an exact `runtimeAuthorization.slice0` exception. Revocation, expiry, pending or
inconsistent decision, wrong branch/worktree/ancestry, unapproved changed paths,
or unsupported fields fail closed. No automatic renewal or Slice 1 permission.

Runtime scanning remains active: only local CIVIC source/test/fixture/config
surfaces are permitted; other-app aliases, live/network capabilities, arbitrary
imports, deployment/public routes and persistent infrastructure are rejected.
Synthetic fixture declarations are checked, not treated as proof of real-data
absence. Runtime entrypoints must invoke the exported authorization guard and
independently enforce synthetic-only inputs and final human authority. The guard
does not turn platform roles into delegated institutional authority.

The test-only validation context permits deterministic clock/isolation fixtures.
Normal CLI/runtime guard execution reads the actual clock and Git context. Passing
unit tests is not a maintainer's final proof acceptance or deployed readiness.

The approved [proof disposition](../public-service/operations/CIVIC_RUNTIME_SLICE_0_PROOF.md)
terminates execution permission. The runtime guard rejects the termination marker;
static validation still scans the retained exact Slice 0 source for archival
review, including after expiry. Archival PASS does not reopen execution or accept
the proof on behalf of its human owner. Git isolation checks include committed
changes since the approved baseline as well as uncommitted paths.

## Documentation-only archival gate amendment

**Amendment:** `DOCUMENTATION_REVIEW_ALLOWED`

**Maintainer:** Aubert Nungisa

**Decision date:** 2026-10-10

**Exact review path:** `docs/public-service/operations/CIVIC_RUNTIME_SLICE_1_AUTHORIZATION_PACKET.md`

**Runtime execution:** `NOT_AUTHORIZED`

The human maintainer explicitly approved this documentation-only amendment after
accepting Slice 0 with limitations. It permits review of that exact Markdown
packet only, with its Slice 1 decision still `PENDING_HUMAN_MAINTAINER`, its
implementation authorization NONE and proposed data boundary SYNTHETIC_ONLY.
The validator checks accepted Slice 0 proof, termination and this recorded
amendment before allowing the extra changed path. No arbitrary documentation
directory, executable source, database, migration or shared package is authorized.

Retained Slice 0 files are identified by an explicit path/SHA-256 inventory in
the validator, normalized only for CRLF/LF. Source, tests, package, configs and
existing non-runtime metadata must match; new files, missing files or content
changes fail archival validation. The README remains documentation, not an
executable allowance. Existing source/import/fixture/alias scans still run;
the inventory is an additional retention check, not a replacement scan.
Updating the retained-source inventory requires separate human approval.

`DOCUMENTATION_REVIEW_ALLOWED` is not `RUNTIME_EXECUTION_AUTHORIZED`.
General runtime authorization stays false and no Slice 1 exception exists.
Runtime entrypoints reject Slice 0 termination; this recorded archival amendment
also denies execution if someone removes the proof termination marker. The
packet cannot serve as an executable grant or renew Slice 0. Static archival
validation retains the approved branch/worktree/ancestry and changed-path checks.

### Recorded Slice 1 conditional decision - activation blocked

On 2026-10-10 Aubert Nungisa supplied `AUTHORIZE_WITH_CONDITIONS` for Slice 1,
effective `2026-10-10T17:56:14Z` until `2026-10-17T17:56:14Z`, with Aubert Nungisa
as proof owner. The [packet](../public-service/operations/CIVIC_RUNTIME_SLICE_1_AUTHORIZATION_PACKET.md)
records that decision, but its requirement for a human-approved exact local
storage directory and checkpoint custody/location is unresolved.

The documentation gate now also recognizes this exact recorded decision only
with `CIVIC_SLICE_1_ACTIVATION_BLOCKED` and implementation authorization NONE.
It verifies the decision, maintainer/date, conditions, SHA/branch/worktree,
window and proof owner; incomplete or changed blocked records fail closed.
This is scan-only decision retention, not a Slice 1 runtime exception. The
contract is unchanged, Slice 0 execution remains terminated and any added
Slice 1 runtime grant/code still fails validation. No storage path approval is
inferred and no database, directory, checkpoint or migration is created.

## Human-completed Slice 1 activation

The human subsequently approved the exact worktree-local
`.civic-runtime\slice1` storage and `checkpoints` child, custodian Aubert Nungisa,
and agent generation/inspection without self-acceptance. A distinct exact
schema-v2 `runtimeAuthorization.slice1` grant binds that decision, seven-day
window, proof owner, storage, synthetic/non-production flags and narrower
`src/slice1` / `tests/slice1` source surfaces. Slice 0 stays terminated and its
original source/config/package inventory is preserved unchanged.

Actual runtime validation checks live clock, decision, revocation/termination,
branch/worktree/ancestry/changed paths, source scans, local directory structure,
no symlink artifacts, exclusion and no tracked generated storage. No public/
deployment/network/shared database capabilities are granted. Only the bounded
storage adapter may import local SQLite/filesystem/crypto primitives; tests may
spawn local proof processes. Material source still needs its own synthetic,
institutional-authority and path/transaction controls: static scanning is not a
semantic sandbox.

At termination, the runtime guard denies while static archival scanning remains
active, including after expiry. Checkpoint custody is separate from authority
or human acceptance. Local Git exclusion protects only the exact synthetic
storage subtree; generated artifacts must not be committed.

Slice 1 closeout is recorded in the [proof](../public-service/operations/CIVIC_RUNTIME_SLICE_1_PROOF.md).
Its termination marker denies runtime admission while static source scanning
continues. Both slices' retained executable/config files are fingerprinted;
new/modified source fails archival review after termination. The bounded
technical proof does not constitute human acceptance or production readiness.
The proof now separately records Aubert Nungisa's 2026-10-10 human decision,
`CIVIC_RUNTIME_SLICE_1_ACCEPTED_WITH_LIMITATIONS`; this does not reopen either
slice, approve production, authorize Slice 2 or imply artifact cleanup.

## Slice 2 documentation-only archival gate amendment

**Amendment:** `DOCUMENTATION_REVIEW_ALLOWED`

**Maintainer:** Aubert Nungisa

**Decision date:** 2026-10-12

**Exact review path:** `docs/public-service/operations/CIVIC_RUNTIME_SLICE_2_AUTHORIZATION_PACKET.md`

**Runtime execution:** `NOT_AUTHORIZED`

The human maintainer approved only this exact pending Markdown artifact for
review. Static archival validation checks both accepted-with-limitations,
terminated proofs; all retained Slice 0/1 file fingerprints; absence of new
application files; general authorization false; no Slice 2 grant; synthetic-only
non-executable packet declarations; and every pending human approval field.
The packet and its ancestor directories must not traverse symlinks.

Only the exact path is additionally admitted by the static changed-path check.
Other documents, shared-package modifications and executable/public/network/
deployment/migration/database additions remain rejected. Existing runtime
scanners, isolation/storage checks and archive inventories are unchanged.
`DOCUMENTATION_REVIEW_ALLOWED` never grants `RUNTIME_EXECUTION_AUTHORIZED`.
Both runtime guards continue to reject terminated execution; removing a proof
termination marker invalidates the documentation exception rather than renewing
execution. No runtime grant, database, dependency or proof-store change is approved.

### Historical Slice 2 conditional decision - superseded start time

On 2026-10-12 Aubert Nungisa authorized bounded Slice 2 with conditions, with a
window `2026-10-12T18:00:00Z <= now < 2026-10-19T18:00:00Z`, exact local storage
and anchor paths, Aubert Nungisa as proof owner and integrity-anchor custodian.
The host clock at activation inspection was `2026-10-12T14:11:58Z`, before the
effective time. Activation is `CIVIC_SLICE_2_ACTIVATION_BLOCKED`.

The documentation gate additionally retains this exact complete human decision
as a scan-only blocked record. Implementation authorization remains NONE,
execution NOT_AUTHORIZED and no Slice 2 runtime grant exists. Changing the
recorded decision, window, location, owner or blocked disposition fails review.
Accepted Slice 0/1 archives, their termination and fingerprints, exact changed
paths and source scans remain mandatory. This retention does not activate the
grant automatically when the clock reaches its effective time.

### Slice 2 immediate activation amendment

On 2026-10-12 Aubert Nungisa explicitly superseded the future start time with
immediate activation. Exact host capture: `2026-10-12T14:38:49.5329498+00:00`;
exact seven-day expiry: `2026-10-19T14:38:49.5329498+00:00`.
A separate exact `runtimeAuthorization.slice2` grant binds the amended decision,
finite window, approved SHA/branch/worktree, synthetic-only/local/non-production
scope, storage/checkpoints/adversarial copies and independent-anchor custody/location.
General authorization stays false. Both accepted Slice 0/1 sources remain
fingerprinted, terminated and scan-only. No shared-package modification is allowed.

The guard checks live time, revocation, termination, production, decision/grant
equality, branch/worktree/ancestry/changed paths, archive integrity, exact local
regular directory structure and Git exclusion/no tracked generated artifacts.
Source/import scanning distinguishes dedicated Slice 2 surfaces; only bounded
local storage, anchor and proof-worker capabilities are admitted. No cache,
general runtime, deployment, signing keys, external anchor or human validation.
Static scanning is not a semantic sandbox: executable proof must separately
enforce synthetic identity, authority, path and transaction boundaries.

Concurrent SQLite writers can remove rollback/WAL/shared-memory sidecars between
directory enumeration and inspection. Generated-storage traversal tolerates only
`ENOENT` for an enumerated regular `-journal`, `-wal` or `-shm` sidecar.
Missing primary stores, access failures, disappearing non-sidecar artifacts and
symlinks are not suppressed. Source/archive fingerprint scans are unchanged.

### Slice 2 proof termination

Slice 2 proof execution terminated at `2026-10-12T20:28:37.5704126+00:00`.
The contract's exact revokedAt and the governed literal termination record agree.
Actual runtime admission denies regardless of removal of the proof marker;
static archival review requires the closed grant and proof marker to remain
consistent. Retained Slice 2 source/tests/configs now have exact normalized
SHA-256 fingerprints in addition to the unchanged Slice 0/1 inventories.
All source scanners remain active. No further executable source can inherit
the terminated grant.

Technical `CIVIC_RUNTIME_SLICE_2_PASS_WITH_LIMITATIONS` is not itself human
acceptance. On 2026-10-12 Aubert Nungisa explicitly recorded
`CIVIC_RUNTIME_SLICE_2_ACCEPTED_WITH_LIMITATIONS` in the
[Slice 2 proof](../public-service/operations/CIVIC_RUNTIME_SLICE_2_PROOF.md).
The performance target deficit and declared same-host trust limitations remain
explicit and unresolved.

### Synthetic acceptance and human-validation preparation

`CIVIC_SYNTHETIC_TECHNICAL_HARDENING_COMPLETE`

`READY_TO_CONSIDER_CONTROLLED_HUMAN_OPERATOR_VALIDATION`

The human proof owner authorized preparation of exactly
`docs/public-service/operations/CIVIC_CONTROLLED_HUMAN_VALIDATION_PLAN.md`.
This is documentation/research design only, not outreach, recruitment, meetings,
product access, live demonstrations, real accounts, real data or deployment.
No Slice 3 is proposed; further synthetic technical work requires a material
defect discovered through future validation and separate authorization.

All three slices remain terminated, general runtime authorization remains false,
and retained source/evidence/custody remain unchanged. Acceptance grants no
cleanup authority. At preparation closeout, this record alone did not expand the
validator allowlist: the plan was blocked pending the exact documentation-only
amendment now recorded below.

## Human validation plan documentation-only archival gate amendment

**Amendment:** `DOCUMENTATION_REVIEW_ALLOWED`

**Maintainer:** Aubert Nungisa

**Decision date:** 2026-10-12

**Exact review path:** `docs/public-service/operations/CIVIC_CONTROLLED_HUMAN_VALIDATION_PLAN.md`

**Runtime execution:** `NOT_AUTHORIZED`

**Human session execution:** `NOT_AUTHORIZED`

**Outreach:** `NOT_AUTHORIZED`

**Real data:** `NOT_AUTHORIZED`

This explicit amendment supersedes only the plan's previously blocked
documentation-review posture. It creates no runtime grant or generic document
category. The validator admits only this exact regular, non-symlink Markdown
path and its reviewed normalized-LF fingerprint. Changed content, including
completed human-validation claims or permission conversion, requires a separate
reviewed governance update; it cannot inherit this exception.

Admission requires all three human acceptances, all three termination records,
`CIVIC_SYNTHETIC_TECHNICAL_HARDENING_COMPLETE`, general authorization false and
the existing exact revoked Slice 2 grant. Unexpected contract permission fields,
including Slice 3, outreach, sessions or real-data authorization, fail closed.
Existing source fingerprints and scanners are not weakened. The pinned original
Slice 1 retained inventory, Slice 2 retained manifest and final source inventory
are verified read-only, including every listed proof/anchor payload. A changed
manifest cannot redefine the trusted payloads. Missing files, bad hashes and
symlink/reparse traversal block admission as
`CIVIC_HUMAN_VALIDATION_DOC_GATE_BLOCKED`.

These are archival evidence checks, not product-runtime execution. Closeout
manifests keep their historical pending-acceptance metadata; the subsequent human
acceptance lives in the proof document. No re-hashing or editing of archived
runtime source, no proof cleanup, outreach, participant records or sessions is
authorized.

`VALIDATION_PLAN` is not `VALIDATION_FINDINGS`: the plan records NONE, no completed
human-session evidence and UNSCORED gates. The pinned plan contains no
Daphne/Richard/Tom validation finding, passed D/R/T gate or demonstrated burden
reduction. Proposed task criteria remain hypotheses, not results.

Next decision: a separately bounded session authorization naming participants,
materials, count, finite window, facilitator, consent/accessibility, exact
evidence location/custodian, retention and stop/revocation rules. Documentation
review alone is insufficient.

### Human-validation documentation gate verification

Reviewed plan normalized-LF SHA-256:
`cba853116a3982e3432d7c6c76dbd65bf896dc1d1fa66455b577e1494c283434`.
Only the plan's documentation posture is amended. No source fingerprint,
runtime grant, archived manifest, generated proof or anchor was changed.

| Check                                                                                                                                                                  | Result                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `pnpm exec vitest run --config tooling\contract-tests\vitest.config.ts tooling\contract-tests\civic-oci-doctrine-integrity.test.ts`                                    | PASS, 247 tests including 53 exact-plan gate cases; previous 194 preserved                           |
| `pnpm exec tsx scripts\validate-civic-oci-doctrine.ts`                                                                                                                 | PASS, actual accepted/terminated archival context with plan present                                  |
| `pnpm exec tsc --noEmit --skipLibCheck --esModuleInterop --types node --target ES2022 --module NodeNext --moduleResolution NodeNext scripts\lib\civic-oci-doctrine.ts` | PASS                                                                                                 |
| Same targeted TypeScript options plus `--noImplicitAny tooling\contract-tests\civic-oci-doctrine-integrity.test.ts`                                                    | PASS                                                                                                 |
| Existing Sage-core ESLint configuration adapted in memory for validator/tests                                                                                          | Zero errors; two pre-existing explicit-any fixture warnings                                          |
| Read-only existing `runDocConsistency`, scoped to plan and integrity document                                                                                          | Zero errors, warnings or informational findings                                                      |
| Internal relative links in both changed documents                                                                                                                      | PASS, seven links                                                                                    |
| Scoped Prettier and `git diff --check`                                                                                                                                 | PASS                                                                                                 |
| Slice 0/1/2 exported guards                                                                                                                                            | Expected termination denial for all three; no product execution                                      |
| Pinned original evidence inventories and payload digests                                                                                                               | Unchanged: 22 Slice 1 payloads, 204 Slice 2/anchor payloads and 11 final Slice 2 source fingerprints |
| Other-worktree exact-surface collisions                                                                                                                                | None in all three other worktrees                                                                    |

No shared-package changes, external validation, outreach, participant records,
real data, deployment or merge. General runtime authorization remains false.
Synthetic hardening is complete; no Slice 3 exists.

`CIVIC_HUMAN_VALIDATION_DOC_GATE_PASS`

`HUMAN_VALIDATION_PLAN_READY_FOR_SESSION_AUTHORIZATION_REVIEW`

## Round 1 evidence governance and plan reconciliation

**Amendment:** `ROUND_1_EVIDENCE_GOVERNANCE_AND_PLAN_RECONCILIATION`

**Maintainer:** Aubert Nungisa

**Human decision date:** 2026-10-12

**Exact authorization path:** `docs/public-service/operations/CIVIC_HUMAN_VALIDATION_ROUND_1_AUTHORIZATION.md`

**Exact materials path:** `docs/public-service/operations/CIVIC_HUMAN_VALIDATION_ROUND_1_MATERIALS.md`

**Exact revised plan:** `docs/public-service/operations/CIVIC_CONTROLLED_HUMAN_VALIDATION_PLAN.md`

**Research path:** `C:\APPS\nzila-os.worktrees\pasted-text-processing\.civic-research\round1`

**Custodian / facilitator:** Aubert Nungisa

**Access:** `CUSTODIAN_ONLY`

**Retention:** `90 DAYS AFTER ROUND_1_CLOSEOUT`; human review, no silent extension.

**Recording default:** `NO_AUDIO_VIDEO_RECORDING`

**Data boundary:** `SYNTHETIC_SCENARIO_ONLY`

**Runtime execution:** `NOT_AUTHORIZED`

This amendment supersedes the previous plan fingerprint and nine-participant/
two-of-three proposal only for the six-session, exact-window Round 1 grant.
The old documentation-only decision is historical; changing it alone still cannot
grant sessions. The two new exact paths and reconciled plan are reviewed-version
bound; no future-round wildcard or arbitrary findings/report path is admitted.
The canonical separate authorization record retains the originally captured
effective/expiry timestamps. It is not added to runtimeAuthorization.

General runtime authorization remains false; Slice 0/1/2 accepted and terminated,
Slice 3 absent. All source fingerprints, inventories, proof and anchor payloads
remain unchanged. Static archival review can continue after the human grant
expires, but current governance admission for preparation/outreach/sessions/capture
must deny before effectiveness, at expiry or on revoked/mismatched authority.

The exact excluded research root is local and custodian-only. Regular path,
no reparse traversal, ACL and tracked-evidence checks apply before capture.
Only approved coded JSON research records are allowed; administrative contacts
stay separate. Six counted sessions, affirmative consent, lens attribution and
default no-recording are enforced. Names/contact keys and detectable identifiers
in coded evidence, changed retention, unapproved files and real-data boundary
conversion fail closed. This check does not prove arbitrary prose anonymous:
facilitator minimization and custodian review are still required. Findings cannot
exist before actual consented session evidence. Expiry never authorizes cleanup.

Once activation passes, `OUTREACH_PREPARATION_AUTHORIZED` permits candidate
selection, invitations and scheduling options, not autonomous sending. Aubert
retains approval of actual people and messages. No participant record, invitation,
session or outcome is created during this amendment.

### Round 1 activation verification

The original exact window remains effective
`2026-10-12T23:59:13.9553409+00:00`, expires
`2026-11-11T23:59:13.9553409+00:00`. No timestamp reset or renewal.
Reviewed normalized-LF versions:

| Artifact                         | SHA-256                                                            |
| -------------------------------- | ------------------------------------------------------------------ |
| Reconciled human-validation plan | `ee65c0a785db2201064189f011b5b8703d00413bd9a7433cd4e6c2bb0f005bc0` |
| Round 1 authorization            | `370b4d25f067889ad77d88f88e75077f8ec489e8cf22c68eadfe2142f428140c` |
| Round 1 materials                | `35cfab75645624659f6eb18d2696743a4883a6f344f4888dd4b39882758129d0` |

| Check                                                                                                                               | Result                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm exec vitest run --config tooling\contract-tests\vitest.config.ts tooling\contract-tests\civic-oci-doctrine-integrity.test.ts` | PASS, 301 tests; previous 247 preserved and 54 Round 1 cases added                                                                              |
| `pnpm exec tsx scripts\validate-civic-oci-doctrine.ts`                                                                              | PASS, actual archival context with both new documents                                                                                           |
| Exported `validateCivicHumanRound1Admission(process.cwd())` through `pnpm exec tsx`                                                 | PASS, actual host clock, storage, exclusion and custody checks                                                                                  |
| Targeted validator/test TypeScript checks with existing NodeNext options                                                            | PASS; test check also uses `--noImplicitAny`                                                                                                    |
| Existing scoped ESLint configuration                                                                                                | Zero errors; two pre-existing fixture-helper explicit-any warnings                                                                              |
| Read-only documentation consistency and internal links                                                                              | No scoped errors/warnings; three informational suggestions on exact Windows repository paths; 15 links resolve                                  |
| Scoped Prettier and `git diff --check`                                                                                              | PASS                                                                                                                                            |
| Retained proof/source fingerprints                                                                                                  | Unchanged: 22 Slice 1 payloads, 204 Slice 2/anchor payloads, 11 final Slice 2 source fingerprints; existing Slice 0/1/2 archival scanner intact |
| Research path, clean start and NTFS custody                                                                                         | PASS; only five empty subdirectories, zero participant records, no reparse points, custodian-only owner/access rules                            |
| Exact local Git exclusion and non-personal probe                                                                                    | PASS; research artifacts not tracked; probe removed                                                                                             |
| Other-worktree exact-surface collisions                                                                                             | None across all three other worktrees                                                                                                           |

ACL checks use the installed PowerShell 7 host, `pwsh.exe`; legacy Windows
PowerShell could not load its security module in the inherited environment.
No access checks were bypassed or permissions widened. Privileged host compromise
remains outside local custodian-only ACL protection.

General runtime false, all three slice guards deny execution, Slice 3 absent.
No participant selection records, outreach drafts, outbound messages, scheduling,
sessions, findings, real data, product runtime or deployment occurred.

`CIVIC_HUMAN_VALIDATION_ACTIVATION_PASS`

`OUTREACH_PREPARATION_AUTHORIZED`

Stop before actual sending. The next action is human-controlled participant
selection and outreach drafting, not another synthetic runtime mission.

`ROUND_1_READY_FOR_PARTICIPANT_SELECTION_AND_OUTREACH_DRAFTING`
