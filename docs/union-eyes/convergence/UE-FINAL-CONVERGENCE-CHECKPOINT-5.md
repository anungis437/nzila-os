# UE Final Convergence — Checkpoint 5 (Continuation 5)

Status: progress, not completion. Staging and production remain NO-GO.

## Delivered since checkpoint 4 (`0d9d6d50f`)

| Commit | Change |
| --- | --- |
| `4670e65f8` | The generic `case:write` is removed. Case authority is `write_notes`, `draft_action`, `upload_evidence`, `modify_document` and `transition` for handlers, plus `disclose_to_member`, `export_sealed_evidence` and `close` for the owner or assignee only. A collaborator cannot hold the primary-only actions; any stored permission outside the collaborator ceiling (including legacy `write`) maps to nothing. Case access makes one kernel decision per capability. Migration 0013's `ue_authority_deleg_nondelegable_chk` was edited with its lineage hash (the 0013 entry is UNQUALIFIED and applies only to disposable databases). |
| `c3e4eaff8` | Real-PostgreSQL audit fault injection as `union_eyes_runtime` (6/6 on PostgreSQL 15 and 16). |
| `862417405`, `372b558db` | Generic CRUD governance (K-007): every table behind `crudRoutes` is classified DENIED, SUBJECT_OWNED, OWN_ROWS_READ, READ_ONLY or OPERATIONAL; unlisted tables are denied; every remaining generic write commits with a durable audit record in one tenant transaction. |
| `394e75d6a` | Route-coverage manifest and shrink-only ratchets (K-008). Emergency activate, recovery and dashboard stop returning invented declarations, break-glass state, notification and audit claims and fabricated preparedness figures; they return 501 (capability `UE-EMERGENCY-DECLARATION`). |
| `658b29695` | Voting-session lifecycle and council-election certification (K-009); organization predicates on 34 integration-adapter writes. Mutation-scope baseline 309 → 276 statements. |

## Evidence

- Audit fault injection (K-005), PostgreSQL 15 and 16: commit together; an injected audit-table fault rolls the business row back; an audit record for another organization or attributed to another principal is refused by RLS and the mutation rolls back; a denial recorded in its own transaction survives the rollback; a failing transaction never rolls back a concurrent one. Denial-path audits are only durable when written in a separate transaction after the rollback; the converted routes' best-effort denial calls remain a documented exception, not an atomicity claim.
- Route manifest (968 routes; 695 mutating): guard classes are recorded for every route. Eight mutating routes have no authentication mechanism and are in a documented public allowlist; two of them (`staging-proof/deadline-engine/scenario`, `workbook/start`) write rows without a session and are recorded for review. 313 mutating routes have no route-level atomic-audit evidence (a service they call may still audit; the scan follows one import hop) and 42 case, claim, document and message mutations are not kernel-decided. Both numbers are baselines that may only shrink.
- Full `pnpm test:fast` on `394e75d6a`: 2,345 files and 32,019 tests passed; the run exited 1 only because three files (`workspace-shell`, `sidebar`, `workbench-console`) hit "Timeout waiting for worker to respond" at pool start under load; all three pass when run directly (18/18).

## Institutional decisions now open

- May an election officer extend an open voting session's closing time? (Currently no field of an opened session is editable.)
- What independent procedure may correct a certified council-election result? (Currently none; results are locked, disputes may be recorded.)
- Whether the two public routes that write rows without a session (`workbook/start`, the staging-proof harness) are acceptable.
- Retire or migrate the flag-gated legacy documents API, still called by several components.

## Still open

Kernel adoption of the 42 backlog routes (claims/cases, documents, messaging, grievances) with triage designations as a governed subordinate policy; granular actions beyond cases; the 351 census entries; the 276 unscoped-mutation candidates; the `union_rep_id` backfill (not run on any organization) and its readers; finance duties, WorkAid and the staff messaging lifecycle; the 30-second identity-bridge revocation window (needs a definer-predicate migration proven on the native image); voting options, eligibility and proxy routes; the remaining audit gap; native, browser and credentialed acceptance.

## Verdicts

ENGINEERING_CONVERGENCE NOT ACHIEVED; PERSONA_FOUNDATION_READINESS PARTIAL; CREDENTIALED_END_TO_END_ACCEPTANCE NOT STARTED; INSTITUTIONAL_POLICY_ADOPTION NOT ADOPTED; STAGING_QUALIFICATION NOT STARTED; PRODUCTION_RELEASE NO-GO.
