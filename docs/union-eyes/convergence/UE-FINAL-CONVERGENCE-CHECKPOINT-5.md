# UE Final Convergence — Checkpoint 5 (Continuation 5, in progress)

Status: progress, not completion. Staging and production remain NO-GO.

## Delivered since checkpoint 4 (`0d9d6d50f`)

| Commit | Change |
| --- | --- |
| `4670e65f8` | The generic `case:write` is removed. Case authority is now `write_notes`, `draft_action`, `upload_evidence`, `modify_document` and `transition` for handlers, plus `disclose_to_member`, `export_sealed_evidence` and `close` for the owner or assignee only. A collaborator cannot hold the primary-only actions, and any stored permission outside the collaborator ceiling (including legacy `write`) maps to nothing. Case access now makes one kernel decision per capability. Storage constraint `ue_authority_deleg_nondelegable_chk` (migration 0013) was edited with its lineage hash; the 0013 entry is UNQUALIFIED and applies only to disposable databases. |
| this commit | Real-PostgreSQL audit fault-injection suite, run as `union_eyes_runtime` with row-level security. |

## Audit fault injection (UE-CONV-K-005)

`db/__tests__/atomic-audit-fault.postgres.test.ts` proves on PostgreSQL 15 and 16, 6/6 on each:

- business row and audit record commit together;
- an injected fault in `audit_security.audit_logs` rolls the business row back;
- an audit record for another organization is refused by RLS and the mutation rolls back;
- an audit record attributed to a principal other than the transaction's is refused and the mutation rolls back;
- a denial recorded in its own transaction survives the rollback of the refused operation;
- a failing transaction never rolls back a concurrent neighbour.

Denial-path audits are therefore only durable when written in a separate transaction after the rollback; the converted routes' best-effort denial calls remain a designed, documented exception, not an atomicity claim.

## Still open

Route-wide kernel adoption (claims/cases, documents, messaging, directory, finance, governance, WorkAid) with a coverage manifest; granular actions beyond cases; the 351 census entries; the 309 unscoped-mutation candidates; legacy-access and `union_rep_id` migration; finance, WorkAid and messaging completion; identity-bridge revocation window; final full-suite qualification of the latest commit.

## Verdicts

ENGINEERING_CONVERGENCE NOT ACHIEVED; PERSONA_FOUNDATION_READINESS PARTIAL; CREDENTIALED_END_TO_END_ACCEPTANCE NOT STARTED; INSTITUTIONAL_POLICY_ADOPTION NOT ADOPTED; STAGING_QUALIFICATION NOT STARTED; PRODUCTION_RELEASE NO-GO.
