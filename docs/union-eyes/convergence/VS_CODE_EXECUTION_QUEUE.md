# VS Code execution queue

Cursor prepares these suites. VS Code executes them. `READY_FOR_VS_EXECUTION` is not a pass. Cursor does not start Docker and does not set `AUTH_NATIVE_PROOF` or `UE_AUTH_CONCURRENCY_PROOF`.

Machine-readable copy: `docs/union-eyes/convergence/VS_CODE_EXECUTION_QUEUE.json`.

Preserved commit: `960a88481aa1f5a9db2ddfaa6f3da510b743a1bc`. Pull request: #1014. Branch: `agents/ue-cursor-final-closure`. Base: `agents/ue-final-convergence`.

Replace `PENDING_INTRODUCING_COMMIT` in the JSON with the output of each item's `sourceCommitCommand` after this tranche is committed. That command is the source commit. A skipped Vitest run is not evidence.

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

## Next engineering action

The route-coverage baseline on this branch has an empty `auditGap` and an empty `kernelPending`. Checkpoint 5 recorded 313 mutating routes without route-level atomic-audit evidence and 42 case, claim, document and message mutations that were not kernel-decided. Eight live domain mutations are outside the kernel flag because the scanner sets `subordinate`: the seven `messages/` thread routes (`THREAD_POLICY`) and `external/grievances/[id]/documents/upload` (`EXTERNAL_AUTHORITY`). The next implementation reads those routes, and any kernel-flagged domain route whose decision is only an import, and supplies operative action-level authority. The scanner is not edited to shrink the count.

Schema census on this branch is 231 entries. The mutation-scope baseline sums to 13. Checkpoint 5 recorded 351 and 276 before those later shrinks. Continue entries that still lack a machine-verifiable disposition. Do not regenerate either baseline to change the count.

`CURSOR_IMPLEMENTATION_COMPLETE` is false. `VS_NATIVE_VALIDATION_COMPLETE`, `CREDENTIALED_PERSONA_ACCEPTANCE_COMPLETE`, `INSTITUTIONAL_POLICY_ADOPTED`, `STAGING_RELEASE_AUTHORIZED` and `PRODUCTION_RELEASE_AUTHORIZED` are false.
