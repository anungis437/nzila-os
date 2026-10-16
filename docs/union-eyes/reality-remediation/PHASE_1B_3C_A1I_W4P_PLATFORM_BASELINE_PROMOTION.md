# W4P platform baseline promotion implementation - PASS

## Architecture and exact coverage

[Promotion engine](../../../apps/union-eyes/scripts/provisioning/platform-baseline-promotion.ts) implements pure PLAN/INSPECT/VERIFY,read-only parameterized catalog inspection and explicitly authorized future APPLY.162 immutable W4FR4 payloads:36 types/57 relation creates/69 add-columns;183 obligations linked once. Canonical DDL never regenerated or rewritten. Dependency ordering uses the fixed DAG;no post-W4P127/86/7/9 items are promotion preconditions.

## State,matching and drift

ABSENT -> APPLY_CANONICAL_PAYLOAD only after exact preconditions;PRESENT_MATCHING -> VERIFY_ONLY;PRESENT_DRIFTED/PRECONDITION_MISSING -> FAIL_CLOSED before mutation. Minimum relation subset matching permits extra contextual columns and does not reauthor them. Enum member order,column type/nullability/default/identity/generated state,and every actually emitted UNIQUE constraint including backing-index validity are inspected exactly. Seven deferred constraints are excluded,not dropped.

## Future apply,authorization and transactions

Default execution authorization DENY. Explicit authorization binds live-plan/payload/target digests and authenticated MIGRATION_ADMIN principal. W2 scope/target/search path,W3 existing snapshot verifier/extension/delegation/privilege doctrine,complete Django macro predecessor,and accepted parent/compound-UNIQUE operands remain prerequisites. Application-runtime actors rejected.
Future apply uses one pinned client,full pre-mutation inspection,exact SQL bytes,and a final complete catalog re-read. Any mutation/postcondition failure rejects the transaction;no partial-success commit. Matching replay is REPLAY_NOOP with0 mutations. Receipts are typed deterministic shapes;only fake tests exercise mutation;no receipt store invented.

CONCURRENCY_GUARD=EXPLICIT_IMPLEMENTATION_RESIDUAL. Bounded provisioning has no lock helper;no DB lock protocol invented. Future authenticated W8 connector must implement exclusive rollback-on-rejection withExclusiveTransaction;without that boundary apply is denied. This is explicitly not a runtime lock certification.

## Governance and preservation

Producer metadata W4P_IMPLEMENTATION_STATUS=COMPLETE_NOT_EXECUTED;entrypoint/plan digest/162 count recorded. MUTATING_OPERATIONS=[] and EXECUTION_ALLOWED=NO unchanged. Contract1.3.3 amendment PLATFORM_BASELINE_PROMOTION_IMPLEMENTATION records implementation availability only;inverse patches reconstruct exact1.3.2. W4FR4 definitions/payload SQL/types/context and W4PG cut/downstream127/86/7/9 remain unchanged.

Plan digest: `b213e1b6e5773d2f513ef2a0b55e199d0055ea7f3fb8202c96e761e75d04346a`.
Canonical1.3.2 SHA256: `89dda28394c53c1c9ed9222982c6fff4b0840186831129f32206ba451cc3b1fd`.
Canonical1.3.3 SHA256: `5e105985d6b99fbdb118b87454543f92e0053ae1b574c3dfe6417f9bbbc81e2d`.

## Gate and runtime boundary

W4P=PASS;PLATFORM_BASELINE_PROMOTION_IMPLEMENTATION=COMPLETE_NOT_EXECUTED;W4=PASS;W4P_RUNTIME_EXECUTION=NOT_AUTHORIZED;W5=AUTHORIZED_NOT_STARTED;CANONICAL_CONTRACT_VERSION=1.3.3;no1.4.
SQL_EXECUTED=0;PRODUCERS_ACTIVATED=0;W4P_EXECUTED=NO;W5_EXECUTED=NO;all materialization/role/config/replay/RLS/tenant proofs remain NO;BOOTSTRAP_IMPLEMENTATION_COMPLETE=NO;READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO.

895 focused tests+1154 W4PG/W4LB/W4LC/W4FR4 predecessor tests+141 W4C/W4S/W3/frozen-W4 tests=2190 distinct tests passed. Scoped TypeScript,ESLint(exit0 with existing Next pages-directory diagnostic),formatting,two-generation exact-byte equality and persisted `--check` passed. Documentation audit:0 errors/1215 existing warnings. Independent reconstruction proved1.3.3 ->1.3.2 ->1.3.1 ->1.3 ->1.2 ->1.1 ->1.0;all fixed input and inherited byte commitments verified with exact inverse handling for metadata-amended contracts. No database connection;fake adapters only. Exact validation commands/results are recorded in [the machine report](./PHASE_1B_3C_A1I_W4P_PLATFORM_BASELINE_PROMOTION.json).
