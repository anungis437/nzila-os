# NZILAOS CHECKPOINT 3 - RUNTIME FOUNDATION CLOSEOUT

Date: 2026-10-12. This is the bounded local/synthetic foundation, not a production
implementation, rollout or Checkpoint 4 authorization. The
[Checkpoint 2 contract](./NZILA_OS_INSTITUTIONAL_OPERATING_MODEL.md) is unchanged.

## Baseline

- Starting SHA: `1c337567635bb86ea0df7831557d8d2d22df1e6f`.
- Ending SHA: unchanged; no commit was requested or created.
- Branch: `agents/pasted-text-processing-4a973147`.
- Worktree: existing isolated Checkpoint 1/2 worktree.
- Existing eight architecture documents were already untracked at the start.
  Their accepted design semantics are preserved.
- Changed runtime surfaces: platform-contracts additive scope/reference/context/
  binding schemas; governance-rationale additive decided-payload hashing/
  immutability path; institutional-intelligence opt-in local foundation, tests,
  package dependency declarations and corresponding lockfile links.
- Related documentation: package READMEs and this closeout.
- No new package, app, endpoint, UI, migration, backfill or production record.

Worktrees/dirty surfaces were inspected before edits. Shared DB manifest/schema/
migration work was present in another worktree. It was not required for the
authorized fixture-first proof and was not edited. No visible agent owned the
three selected package surfaces. No unrelated dirty work was reverted.

## Gates

| Gate | Disposition | Evidence |
| --- | --- | --- |
| A - Contracts | CP3_GATE_A_PASS | Explicit discriminated schemas, strict caller envelope, scope type identity, source revisions/mapping versions; contract tests and typecheck |
| B - Persistence/adapters | CP3_GATE_B_PASS | Local SQLite scoped revisions, BEGIN IMMEDIATE transaction/CAS, rollback, restart and explicit source adapters; no shared DB migration |
| C - Authority/audit | CP3_GATE_C_PASS | Trusted session/target/CP/approval ports, actual existing policy evaluator, request-bound persisted-decision validation, atomic intent, PENDING proof denial and NAR retry |
| D - Decision/Mission runtime | CP3_GATE_D_PASS | Existing analysis/rationale schema reuse, frozen decided payload/hash, single successor, Mission lifecycle/independence, specialist expiry/revocation/attribution |
| E - Synthetic runtime proof | CP3_GATE_E_PASS | Ten-step fictional scenario, enrollment/assignment proof gating, durable local restart and explicit negative proofs |

No later gate was begun while a previous gate remained failed. A Gate C proof
test initially found an unawaited NAR verification Promise; it was corrected and
the gate tests and typecheck rerun successfully before Gate D.

## Runtime proof

| Concern | Implemented proof and boundary |
| --- | --- |
| Scope binding | Fictional I explicitly enrolled against fictional GI by internal bootstrap actor with policy/approval/CP proof; enrollment cannot be used while its mutation proof is PENDING |
| Assignments | Fictional H1 assigned through guarded runtime and durable audit; assignment is not usable before recorded receipt, and only internal-human principals qualify |
| Authority | Identity/affiliation/target/acting scope/roles come from trusted adapter ports, not caller fields. Registered policy evaluates explicit allow; no policy/membership/label/decision-ID shortcut |
| Audit | Source revision/history, audit intent, receipt and proof state commit atomically. Verified existing NAR receipts use stable event identity, deduplicate and retain hash-chain history in fixture storage |
| Mission | Proposed/authorized/active/blocked/completed/closed/cancelled remain separate from execution/deploy. Completed does not imply accepted. Closure checks independent internal human and accepted criteria evidence |
| Specialist | DRAFT approval precedes ACTIVE. Attributed SUBMITTED recommendation is evidence only. Expired/revoked engagement denies later work even through old references; no specialist approval/extension/ownership/self-acceptance |
| Rationale | Existing DecisionAnalysis is analytical input. Existing GovernanceRationale schema is the material choice payload; all decided content is canonical-hashed and immutable. Supersession appends successor/link atomically without editing predecessor |
| Change separation | Operational, Mission and rationale authorization cannot satisfy request-bound deployment authorization. Actual deployment remains exclusively outside the foundation |

The file-backed scenario tests use only fictional actors/org/institution IDs and
temporary files. The files are closed and removed in finally blocks. No production
database, policy grant, identity provider, customer data or deployment is contacted.

## Negative proof

Each rejection is asserted, not inferred from a passing happy path.

| Required case | Result / assertion |
| --- | --- |
| Missing institution binding | PASS - MISSING_OR_REVOKED_BINDING |
| Ambiguous institution binding | PASS - AMBIGUOUS_BINDING |
| Revoked binding | PASS - MISSING_OR_REVOKED_BINDING |
| Org member attempts institutional mutation | PASS - CROSS_SCOPE_DENIED even for synthetic org-admin role |
| SYSTEM used as wildcard | PASS - wildcard schema rejected; SYSTEM acting scope does not grant institutional access |
| Cross-scope mutation/reference without grant | PASS - CROSS_SCOPE_DENIED / CROSS_SCOPE_REFERENCE_DENIED, no source mutation |
| Agent attempts Mission ownership | PASS - ASSIGNED_INTERNAL_HUMAN_REQUIRED / ASSIGNED_INTERNAL_OWNER_REQUIRED |
| Specialist attempts approval | PASS - ASSIGNED_INTERNAL_HUMAN_REQUIRED |
| Specialist work at/after expiry | PASS - ENGAGEMENT_NOT_ACTIVE at exact expiry boundary |
| Specialist self-acceptance | PASS - ASSIGNED_INTERNAL_HUMAN_REQUIRED |
| Same human producer and independent acceptor | PASS - INDEPENDENT_ACCEPTOR_REQUIRED for sponsor approval/own Mission closure |
| Stale authorization | PASS - INVALID_OR_STALE_AUTHORIZATION |
| Revoked authorization | PASS - INVALID_OR_STALE_AUTHORIZATION |
| Caller-supplied actor classification/affiliation | PASS - strict command rejects fields; fabricated context rejected |
| Caller-supplied scope escalation | PASS - strict command rejects acting/target scope fields; scoped adapters deny escalation |
| Direct decided-rationale mutation | PASS - runtime and local store reject DECIDED_RATIONALE_IMMUTABLE_USE_SUPERSESSION |
| Competing supersession | PASS - one fulfilled successor, one conflict, original unchanged |
| Mission completion treated as closure | PASS - completed remains completed; closure needs independent actor and accepted criteria |
| Operational approval used as deploy approval | PASS - request action/target/revision/policy binding rejects substitution |
| Audit-intent failure | PASS - source/history/intent transaction fully rolls back |
| Audit proof remains PENDING | PASS - intent remains durable, effective rationale/continuation blocked, retry reuses event ID |

Additional proof covers premature engagement activation, revoked engagement with
old source ref, specialist expiry expansion injection, terminal Missions, outcome
amendment reauthorization, governance-org membership, source namespace/version
mapping and local restart preservation.

## Existing-system preservation

Unchanged and reused: decision-intelligence-engine schema, legacy rationale
schema/engine/replay, platform-policy-engine evaluator, NAR signing/verification,
existing policy/identity/approval/Control Plane adapter contracts and DB migration/
org-scoping conventions. Old institutional lineage/dependency exports remain
unchanged. New foundation is opt-in, not attached to a production host.

SAGE, CIVIC, MISSION product domain, UE, Cora, House, ITSM, Git deployment
governance and existing audit/evidence implementations were not modified. ITSM
and platform-change-management regression suites pass; no deployment was run.

## Limitations

1. Local persistence uses Node 24's experimental SQLite API. PostgreSQL/Drizzle
   production constraints, multi-host recovery and production durability are
   unproved. No migration is generated or needed for this local proof.
2. Platform auth, org, Control Plane and human-approval providers are trusted
   **synthetic adapters** in this scenario. Actual platform policy evaluation and
   NAR cryptography run, but no live identity/CP/approval grant is created. Real
   server wiring and policy registration are not claimed.
3. Local NAR fixture persistence/keys prove durable intent/verification/retry and
   chain composition, not Azure immutable storage, production signing, sink SLA
   or delivery operations. Fixture keys are explicitly non-production.
4. Race proof covers competing runtime commands and the local transactional
   single-successor constraint; distributed process/network races remain unproved.
5. Mission scope amendments support unstarted reauthorization and reject active
   expansion. No broad amendment/workflow orchestration is implemented.
6. Engagement is the minimum authorization/submission boundary, not comprehensive
   closeout, supplier stewardship or procurement. No Console/COMMAND, estate graph,
   planning, operational bridge, benefit or migration estate implementation.
7. New immutable institutional rationale path does not silently harden legacy
   by-ID rationale mutation callers. Legacy hashes/status behavior remain unchanged
   and must not be used as the new institutional write path.
8. Repository-wide governance acceptance is not proven: the full existing audit
   fails in the unchanged financial-service typecheck with unresolved workspace
   imports/configuration after the earlier audit stages succeed. This was not
   converted into a successful result or fixed outside the authorized slice.

## Validation

Scoped commands and counts are recorded below; no monorepo-wide readiness claim.

| Exact command | Result |
| --- | --- |
| `pnpm --filter @nzila/platform-contracts test -- src\institutional.test.ts` | PASS, 3 Gate A tests |
| `pnpm --filter @nzila/institutional-intelligence test -- src\foundation\local-store.test.ts src\foundation\bindings.test.ts` | PASS, 3 Gate B tests |
| `pnpm --filter @nzila/institutional-intelligence test -- src\foundation\authority-audit.test.ts` | PASS after correction, 7 Gate C tests |
| `pnpm --filter @nzila/institutional-intelligence test -- src\foundation\runtime.test.ts` | PASS, 4 Gate D tests |
| `pnpm --filter @nzila/institutional-intelligence test -- src\foundation\scenario.test.ts` | PASS, 2 Gate E tests |
| `pnpm --filter @nzila/platform-contracts --filter @nzila/institutional-intelligence --filter @nzila/governance-rationale --filter @nzila/decision-intelligence-engine --filter @nzila/platform-policy-engine --filter @nzila/nar test` | PASS, 143 tests across six packages including existing regressions |
| `pnpm --filter @nzila/platform-change-management --filter @nzila/itsm-core test` | PASS, 66 unchanged Change/ITSM regression tests |
| `pnpm --filter @nzila/platform-contracts --filter @nzila/institutional-intelligence --filter @nzila/governance-rationale typecheck` | PASS, all three modified packages |
| `pnpm --filter @nzila/platform-contracts --filter @nzila/institutional-intelligence --filter @nzila/governance-rationale lint` | PASS, all three modified packages |
| `pnpm deps:check` | PASS, 224 packages, zero violations |
| `pnpm platform:contract:check` | PASS, zero errors/warnings |
| `pnpm validate:docs` | PASS, exit 0; 2,456 documents scanned, zero errors; zero checkpoint warnings, five informational naming notices retain requested heading/exact identifiers |
| `pnpm governance:audit` | FAILED, exit 2 in unchanged financial-service typecheck: unresolved config/Entra/financial workspace imports and logger target-library errors. Earlier audit stages completed; no full-governance readiness claim |
| `git diff --check` plus new-file/local-reference scope check | PASS; 26 untracked source/docs files checked for ASCII/whitespace, 140 local links verified, only selected package surfaces changed, no retained SQLite/migration files |
| `pnpm --filter @nzila/institutional-intelligence test`, then `typecheck`, then `lint` | Final rerun PASS: 18 tests, package types and lint after the external execution-owner rejection was added |

Final six-package suites contain 143 passing tests; the two unchanged operational/
deployment packages add 66 passing tests: **209 passed, zero failed, zero skipped**.
Generated docs/ownership/index/release/repo audit outputs were restored to their
exact pre-run bytes; no generated output drift is retained.
Dependencies were restored offline only after the initial Vitest command failed
because dependencies were missing. Seven existing workspace dependency links are
the only intended lockfile change; unrelated package-manager peer-resolution
churn was removed. No dependency versions were upgraded.

## Disposition

**NZILAOS_CP3_RUNTIME_FOUNDATION_PASS_WITH_LIMITATIONS**

The minimum local runtime foundation passes. Production wiring/persistence and
deployment are not certified. No merge, deployment or Checkpoint 4 implementation.
