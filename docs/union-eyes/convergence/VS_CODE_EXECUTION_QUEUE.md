# VS Code execution queue

Cursor prepares these suites. VS Code executes them. `READY_FOR_VS_EXECUTION` is not a pass. Cursor does not start Docker and does not set `AUTH_NATIVE_PROOF` or `UE_AUTH_CONCURRENCY_PROOF`.

Machine-readable copy: `docs/union-eyes/convergence/VS_CODE_EXECUTION_QUEUE.json`.

Preserved commit: `960a88481aa1f5a9db2ddfaa6f3da510b743a1bc`. Pull request: #1014. Branch: `agents/ue-cursor-final-closure`. Base: `agents/ue-final-convergence`.

Invitation items are source commit `215b21e6cc37276ba08d9f37c26bb7d504eff452`. The conversation-lifecycle item is source commit `b4dde796fbee63291d4d96896692ad869071dc2c`. A skipped Vitest run is not evidence.

## auth-native-pg16

| Field | Value |
| --- | --- |
| Status | `READY_FOR_VS_EXECUTION` |
| Risk | P0. Run this before the concurrency suite. |
| Register | `UE-CONV-A-003`, `UE-CONV-A-004` |
| Test | `apps/union-eyes/scripts/bootstrap-v2/auth-native.test.ts` |
| Command | `AUTH_NATIVE_PROOF=1 pnpm exec vitest run apps/union-eyes/scripts/bootstrap-v2/auth-native.test.ts` |
| Environment | Docker. Image `pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337`. The file starts and removes the container. |
| Fixture | Synthetic auth fixture, then `compileAuthBootstrapSql()`. Roles `auth_proof_login` and `auth_proof_system_login`. |
| Cleanup | `afterAll` runs `docker rm --force` on the container it created. A killed run can leave `ue-auth-v2-*`. |
| Success | Privilege inspection matches the revoke-function contract. Restoring an inviter does not revive a revoked invitation. A parent-linked bridge follows the parent. A parentless bridge is denied unless `device_info.bridgeClass` is `provider-no-parent`. |
| Denial | Forged inviter, foreign organization, revoked or expired parent, and a parentless bridge without that class confer nothing. The compiler describe that runs without `AUTH_NATIVE_PROOF` is not this proof. |
| Evidence | `docs/union-eyes/convergence/evidence/auth-native-pg16.json` |
| Failure | Privilege mismatch, a revived token, or a parentless bridge allowed without the class. |
| Recovery | Remove the suite container. Do not retarget a shared database. |

## auth-invite-concurrency

| Field | Value |
| --- | --- |
| Status | `READY_FOR_VS_EXECUTION` |
| Risk | P0. Depends on `auth-native-pg16`. |
| Register | `UE-CONV-A-003` |
| Test | `apps/union-eyes/scripts/bootstrap-v2/auth-invite-concurrency.native.test.ts` |
| Command | `UE_AUTH_CONCURRENCY_PROOF=1 UE_AUTH_OWNER_URL=<empty-localhost-superuser-url> pnpm exec vitest run apps/union-eyes/scripts/bootstrap-v2/auth-invite-concurrency.native.test.ts` |
| Environment | Empty disposable PostgreSQL 16 superuser database. This file does not start Docker. |
| Fixture | Same bootstrap SQL. Seeds `concurrency-inviter` as admin of `11111111-1111-4111-8111-111111111111` only. |
| Cleanup | Drop that database. If the redemption-first test is killed while its gate is closed, set `user_management.concurrency_gate.open` to true and drop trigger `concurrency_wait`. |
| Success | Both orderings. Offboarding or membership removal that commits first leaves redemption with nothing. Redemption that holds `auth-inviter:<user>` first still succeeds, and the waiting suspend revokes only the invitation that is still pending. Rollback releases the lock. Replay fails. Reactivation does not clear `revoked_at`. Organization B is not redeemed. |
| Denial | The file is skipped unless `UE_AUTH_CONCURRENCY_PROOF=1`. Bootstrap refuses a database that already has auth policies. |
| Evidence | `docs/union-eyes/convergence/evidence/auth-invite-concurrency.json` |
| Failure | The lock, the revoke trigger, or the redemption re-read did not serialize. |
| Recovery | Drop the disposable database. Do not grant `nzila_auth_system_mutation` a general `invites` update. |

## message-lifecycle-combined

| Field | Value |
| --- | --- |
| Status | `READY_FOR_VS_EXECUTION` |
| Risk | P0. Depends on `auth-native-pg16` only for environment order. The suite itself is independent. |
| Register | `UE-CONV-I-002` |
| Source | `b5caa1a1abea738cc7589e6010e99c70bef2324b` |
| Test | `apps/union-eyes/db/__tests__/message-lifecycle.postgres.test.ts` |
| Command | `UE_AUTHORITY_COMBINED_URL=<admin-url-of-a-fresh-disposable-combined-database> pnpm exec vitest run apps/union-eyes/db/__tests__/message-lifecycle.postgres.test.ts` |
| Environment | Fresh disposable combined schema: Django migrate, approved Drizzle bootstrap, platform `0013`, `0014`, `0025`, `0029` and `0030`, RLS `0020`, `0021` and `0024`. This file does not start Docker. |
| Fixture | Same preparation as `thread-assignment.postgres.test.ts`. Do not insert a governance mandate by SQL. The ceremony describe adopts the rules and issues two mandates through the store. Earlier tests still expect an administrator denial. |
| Cleanup | Drop the database. If a fault test is killed, drop the audit fault trigger it installed. |
| Success | Administrator, steward and foreign actors do not write a hold. An administrator receives `forbidden` from `adoptRetentionPolicy` for a valid period and `invalid` outside 1..36500. The ceremony describe then lets the issued mandate holder place and release a hold and adopt a 30-day policy. Revocation ends each power. An audit fault rolls the release and the second adoption back. |
| Denial | Skipped unless `UE_AUTHORITY_COMBINED_URL` is set. Cursor ran `message-authority-issuance.pglite.test.ts` in process (4 passed). That run is not this proof. |
| Evidence | `docs/union-eyes/convergence/evidence/message-lifecycle-combined.json` |
| Failure | A throw instead of `forbidden` means the authority load aborted the transaction. An administrator `ok` means the role is still authority. A ceremony failure before any hold means issuance or platform `0029` and `0030` did not load. An audit fault that leaves `hold_release` or a second live policy means the write committed without its audit. |
| Recovery | Drop the database. Apply `0029` and `0030` through the platform journal. Do not edit `0013` and do not insert a mandate outside issuance. |

## Next engineering action

Legal hold is a kernel decision as of `6ce6e945406b693a948601aecadf99e27b6b09dc`. Retention read and adoption are kernel decisions as of `b4dde796fbee63291d4d96896692ad869071dc2c`. The scanner still labels both routes `THREAD_POLICY`. Do not edit the scanner. An administrator title is denied. The powers stay unconferred until a live governance-review rule names them. Platform `0029` and `0030` are UNQUALIFIED.

The in-process issuance proof is `apps/union-eyes/db/__tests__/message-authority-issuance.pglite.test.ts` at `b5caa1a1abea738cc7589e6010e99c70bef2324b`. Cursor ran it: 4 passed. The same ceremony is in `message-lifecycle.postgres.test.ts` and stays `READY_FOR_VS_EXECUTION`. Do not mock the kernel. Do not mark the combined file PASS from the in-process run.

Message read, reply, assign and close still use thread participation. `staffActing` still uses `caseActionAllowed('note_add_internal')`. `external/grievances/[id]/documents/upload` remains `EXTERNAL_AUTHORITY`. Each still needs operative action-level authority. The route-coverage baseline's empty `kernelPending` does not change that.

Schema census on this branch is 231 entries. The mutation-scope baseline sums to 13. Checkpoint 5 recorded 351 and 276 before those later shrinks. Continue entries that still lack a machine-verifiable disposition. Do not regenerate either baseline to change the count.

`CURSOR_IMPLEMENTATION_COMPLETE` is false. `VS_NATIVE_VALIDATION_COMPLETE`, `CREDENTIALED_PERSONA_ACCEPTANCE_COMPLETE`, `INSTITUTIONAL_POLICY_ADOPTED`, `STAGING_RELEASE_AUTHORIZED` and `PRODUCTION_RELEASE_AUTHORIZED` are false.
