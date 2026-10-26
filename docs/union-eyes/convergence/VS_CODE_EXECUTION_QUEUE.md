# VS Code execution queue

Cursor prepares these suites. VS Code executes them. `READY_FOR_VS_EXECUTION` is not a pass. Cursor does not start Docker and does not set `AUTH_NATIVE_PROOF`, `UE_AUTH_CONCURRENCY_PROOF`, `UE_DELIVERY_NATIVE_PROOF`, `UE_ELECTION_SUCCESSION_NATIVE_PROOF`, or `UE_OWNERSHIP_NATIVE_PROOF`.

Machine-readable copy: `docs/union-eyes/convergence/VS_CODE_EXECUTION_QUEUE.json`.

Preserved commit: `960a88481aa1f5a9db2ddfaa6f3da510b743a1bc`. Pull request: #1014. Branch: `agents/ue-cursor-final-closure`. Base: `agents/ue-final-convergence`.

Invitation items are source commit `215b21e6cc37276ba08d9f37c26bb7d504eff452`. Retention adoption is `b4dde796fbee63291d4d96896692ad869071dc2c`. The conversation-lifecycle suite file is source commit `c72d863d817facf62f672c688a99688eb6fb5b1a`. External grievance upload derivation is `31fc3e339750466b4661182f14476750db9dae68`. Grievance import session completion is `75538d09a18fd183fb4954abae6221e932a439d6`. Case intake and bulk-import audits are `db6934b0d8cf700442286b248a439ab5c7668799`. Platform ledger appends are `f44ed6276778f3900e42ef7f158b531816da3320`. A skipped Vitest run is not evidence.

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
| Source | `c72d863d817facf62f672c688a99688eb6fb5b1a` |
| Test | `apps/union-eyes/db/__tests__/message-lifecycle.postgres.test.ts` |
| Command | `UE_AUTHORITY_COMBINED_URL=<admin-url-of-a-fresh-disposable-combined-database> pnpm exec vitest run apps/union-eyes/db/__tests__/message-lifecycle.postgres.test.ts` |
| Environment | Fresh disposable combined schema: Django migrate, approved Drizzle bootstrap, platform `0013`, `0014`, `0025`, `0029` and `0030`, RLS `0020`, `0021` and `0024`. This file does not start Docker. |
| Fixture | Same preparation as `thread-assignment.postgres.test.ts`. Do not insert a governance mandate by SQL. The ceremony describe adopts the rules and issues two mandates through the store. Earlier tests still expect an administrator denial. The Canonical V2 conversation test skips unless `public.ue_conversation_assignee_authorized` is installed. `ue_case_assignee_authorized` is not that predicate. |
| Cleanup | Drop the database. If a fault test is killed, drop the audit fault trigger it installed. |
| Success | Administrator, steward and foreign actors do not write a hold. An administrator receives `forbidden` from `adoptRetentionPolicy` for a valid period and `invalid` outside 1..36500. The ceremony describe then lets the issued mandate holder place and release a hold and adopt a 30-day policy. Revocation ends each power. An audit fault rolls the release and the second adoption back. |
| Denial | Skipped unless `UE_AUTHORITY_COMBINED_URL` is set. Cursor ran `message-authority-issuance.pglite.test.ts` in process (4 passed). That run is not this proof. |
| Evidence | `docs/union-eyes/convergence/evidence/message-lifecycle-combined.json` |
| Failure | A throw instead of `forbidden` means the authority load aborted the transaction. An administrator `ok` means the role is still authority. A ceremony failure before any hold means issuance or platform `0029` and `0030` did not load. An audit fault that leaves `hold_release` or a second live policy means the write committed without its audit. |
| Recovery | Drop the database. Apply `0029` and `0030` through the platform journal. Do not edit `0013` and do not insert a mandate outside issuance. |

## notification-delivery-native

| Field | Value |
| --- | --- |
| Status | `READY_FOR_VS_EXECUTION` |
| Risk | P0. Source duplicate-send protection is accepted. This file is the native race proof. A skipped run is not a pass. |
| Register | `UE-CONV-H-007` |
| Test | `apps/union-eyes/db/__tests__/notification-delivery-native.test.ts` |
| Command | `UE_DELIVERY_NATIVE_PROOF=1 pnpm exec vitest run apps/union-eyes/db/__tests__/notification-delivery-native.test.ts` |
| Environment | Docker. Image `pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337`. The file starts and removes `ue-delivery-native-*`. Cursor does not run this. |
| Fixture | Minimal `notification_queue` and `notification_delivery_log`, then platform `0032_notification_callback_identity`. No shared database. |
| Cleanup | `afterAll` closes the client and runs `docker rm --force` on the container it created. |
| Success | One of two sessions wins the retry claim (`status IN ('pending','failed','retrying')`). A row left in `processing` after a crash is not claimed. Two simultaneous `delivered` inserts for one provider message yield one row and one unique violation. A second organization for that provider message is refused. An `uncertain` row does not reopen the processing claim. |
| Denial | Do not record PASS from a run that leaves `UE_DELIVERY_NATIVE_PROOF` unset. Do not apply `0032` to a shared or production database. This is application-level at-most-once prevention, not a proof of exactly-once delivery by an external provider. |
| Evidence | `docs/union-eyes/convergence/evidence/notification-delivery-native.json` |
| Failure | Two claim updates both return a row, a second callback insert commits, or a second organization is stored for one provider message. |
| Recovery | Remove the suite container. Do not delete ledger rows to force `0032` through existing duplicates. |

## election-certificate-succession-native

| Field | Value |
| --- | --- |
| Status | `READY_FOR_VS_EXECUTION` |
| Risk | P0. Source persistence is `889880502664e125023d7ed7972963d6ac337937`. A skipped run is not a pass. |
| Register | `UE-CONV-K-009` |
| Test | `apps/union-eyes/db/__tests__/election-certificate-succession.native.test.ts` |
| Command | `UE_ELECTION_SUCCESSION_NATIVE_PROOF=1 pnpm exec vitest run apps/union-eyes/db/__tests__/election-certificate-succession.native.test.ts` |
| Environment | Docker. Image `pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337`. The file starts and removes `ue-election-succession-*`. Cursor does not run this. |
| Fixture | Minimal `council_elections` and `public.audit_logs`, then unqualified platform `0033_election_certificate_successions` and `0034_election_organization_ownership`, plus an ownership row for the seeded election. No shared database. |
| Cleanup | `afterAll` closes the pool and runs `docker rm --force` on the container it created. |
| Success | Two concurrent kernel grants for one certified election and one decision store one succession row and one uncertified successor. `verified_by` on the predecessor stays `Auditor`. |
| Denial | Do not record PASS from a skipped run. Do not apply `0033` or `0034` to a shared database. The HTTP route returns 200 only when the kernel loads a grant. A native pass does not prove that HTTP path. The council vote route stays 501. |
| Evidence | `docs/union-eyes/convergence/evidence/election-certificate-succession-native.json` |
| Failure | Two succession rows, or a rewritten `verified_by`, means the lock or the immutability check failed. |
| Recovery | Remove the suite container. Do not rewrite the certified predecessor. |

## ownership-backfill-native

| Field | Value |
| --- | --- |
| Status | `READY_FOR_VS_EXECUTION` |
| Risk | P0. PGlite freshness and replay are source evidence only. This file is the concurrent execution proof. |
| Register | `UE-CONV-B-001` |
| Test | `apps/union-eyes/db/__tests__/authority-kernel-case-backfill.native.test.ts` |
| Command | `UE_OWNERSHIP_NATIVE_PROOF=1 pnpm exec vitest run apps/union-eyes/db/__tests__/authority-kernel-case-backfill.native.test.ts` |
| Environment | Docker. Same pinned image. The file starts and removes `ue-ownership-backfill-*`. Cursor does not run this. |
| Fixture | Authority-kernel fixture schema and two synthetic grievances. This is not an institutional backfill. |
| Cleanup | `afterAll` closes the admin client and runs `docker rm --force` on the container it created. |
| Success | Two concurrent executions of one approved plan leave exactly two live assignee relationships. One result is `replayed: false` and the other `replayed: true`. A later execution of that approval replays and adds nothing. |
| Denial | Do not record PASS from a skipped run or from the PGlite file. Do not execute a protected institutional backfill. A stale source revision must fail. |
| Evidence | `docs/union-eyes/convergence/evidence/ownership-backfill-native.json` |
| Failure | More than two live assignee rows means both transactions assigned. A unique-violation throw means the advisory lock did not serialize them. |
| Recovery | Remove the suite container. Do not insert relationships by hand. |

## Next engineering action

Legal hold is a kernel decision as of `6ce6e945406b693a948601aecadf99e27b6b09dc`. Retention read and adoption are kernel decisions as of `b4dde796fbee63291d4d96896692ad869071dc2c`. The scanner still labels both routes `THREAD_POLICY`. Do not edit the scanner. An administrator title is denied. The powers stay unconferred until a live governance-review rule names them. Platform `0029` and `0030` are UNQUALIFIED.

The in-process issuance proof is `apps/union-eyes/db/__tests__/message-authority-issuance.pglite.test.ts` at `b5caa1a1abea738cc7589e6010e99c70bef2324b`. Cursor ran it: 4 passed. The same ceremony is in `message-lifecycle.postgres.test.ts` and stays `READY_FOR_VS_EXECUTION`. Do not mock the kernel. Do not mark the combined file PASS from the in-process run.

Message read, reply, close, and archive are kernel decisions as of `c72d863d8`. `staffActing` reads the stored role through a conversation-assignee capacity and ignores the actor role label. An administrator title is denied. A legal-hold mandate does not confer a read. Canonical V2 calls `public.ue_conversation_assignee_authorized` and denies assignees when that function is absent. The scanner still labels the routes `THREAD_POLICY`. Do not edit the scanner.

External grievance document upload copies the live matter grant as of `31fc3e339750466b4661182f14476750db9dae68`. The write re-reads that grant inside the transaction. `canView` and `canDownload` come from `canViewDocuments` and `canDownloadDocuments`. `canShare` stays false. `grantedBy` stays the issuer on the matter grant. A missing, inactive, expired, or self-issued grant returns 403 before any insert. Labels `privileged` and `highly_sensitive` are an invalid payload. The scanner still labels the route `EXTERNAL_AUTHORITY`. Do not edit the scanner. Do not send the upload through `case:upload_evidence`. An institution that stored the representative as `grantedBy` cannot upload until a different issuer is recorded.

Grievance import session completion commits its status and `grievance.import_batch` together as of `75538d09a18fd183fb4954abae6221e932a439d6`. A failed audit leaves the session running and does not report success. Each imported row already committed with `grievance.import_row`.

Case intake commits `case.intake_submitted` in the claim transaction as of `db6934b0d8cf700442286b248a439ab5c7668799`. A failed audit rolls the intake back. Each bulk-import row commits with `case.bulk_import_row`. The batch summary `case.bulk_import` is its own durable write, and a failed summary withholds the success response. Both routes are `ATOMIC` on the route-coverage manifest. The scanner was not edited. Denial-path audits and `recommend-steward` stay on the separate-connection writer.

Platform ledger appends commit `ledger_entry_appended` in the same transaction as the entry as of `f44ed6276778f3900e42ef7f158b531816da3320`. A batch append audits every entry in that transaction. A failed audit leaves no new entry. This does not issue a financial mandate.

Schema and mutation work is the batch program `docs/union-eyes/convergence/register/ue-schema-mutation-batches.json`. It assigns all 231 census entries and the original 13 mutation-scope statements. Program `applyNow` stays false. The five mutation batches are implemented. `mutation-finance-latent` is `61487bc5c7b81084e8f59c27fb2ba0e6c4cb9fbe`: the seven statements bind the caller tenant and do not issue a financial mandate. `mutation-clc-sync-log` is `fdae2e3abe3abb5a302ff6b76dc12c14d693122c`: the partnership service no longer writes the tenant table, and the relation is not dropped. `mutation-pilot-rebind` is `8e99a08a08d2ff91553ed8a75f2bb250b2e3647a`: comments no longer hide or fake a predicate. `mutation-workbook-unclaimed` is `2443ef34ec0f68d7a2b5c76d3efed8035a9fee4c`. `mutation-location-retention` is `922e8e14a73da3055c10b29e8398ed2674a44f1d`. The live mutation scan counts 0. The source count stays 13. Workbook two-session proof and location combined-schema proof stay `READY_FOR_VS_EXECUTION`. The census is still 231. The next batch is `schema-retire-declaration`. `schema-retire-declaration` is source-retired at `08e1d4e185e310124337ff1b8d1e696ad21baf1e`. `org_usage`, `signature_templates`, and `signature_webhooks_log` are no longer Drizzle declarations. Django still defines the two signature tables. No DROP was added. The census file still lists the three tables. Census regeneration is `READY_FOR_VS_EXECUTION`. The census is still 231. `schema-live-unreferenced` is source-retired at `ad8a2c05b97d0b2bc8a13e57a991b79350569854`. `bank_accounts`, `bank_reconciliations`, `erp_invoices`, `clc_remittance_mapping`, and `grievance_timeline` are no longer union-eyes Drizzle declarations. Django still defines them. `packages/db` `exec-data.ts` still declares `erp_invoices`. No DROP was added. The census file still lists them. Census regeneration is `READY_FOR_VS_EXECUTION`. `budget_pool`, `dues_rates`, `gl_account_mappings`, `grievance_settlements`, `integration_webhooks`, `payment_cycles`, `payment_disputes`, and `safety_training_records` stay declared. The unwired admin-actions reader no longer returns a storage figure. `signature_documents.template_id` stays, and a schema diff must not drop `signature_documents_template_id_signature_templates_id_fk`. The census is still 231. `0031_reachable_stub_shape` was revised in place at `d4f67bc1b177da3adc2b663cb6e7c951211627c0` before any apply. The previous unqualified bytes were never executed. It still covers `data_anonymization_log`, `employment_history`, `job_classifications`, and `member_leaves`. An existing column of the wrong type, length, or numeric precision fails the transaction. Constraint counts and row security must be unchanged at the end. NOT NULL only when the relation is empty. Populated tables keep the new columns nullable. No keys, no RLS change, no destructive statement. It is registered `UNQUALIFIED`. Do not apply it here. Native role, grant, and RLS proof is `READY_FOR_VS_EXECUTION`. Census regeneration after apply is `READY_FOR_VS_EXECUTION`. `notification_history` is no longer a union-eyes Drizzle declaration. The financial-service shadow schema still declares it. The BullMQ email, SMS, and notification workers are removed. They had no production importer. The live sender is `lib/services/notification-service.ts`. It writes `notification_delivery_log` for queued, attempted, accepted, retried, delivered, failed, and suppressed communications. Provider acceptance is `accepted`. Confirmed delivery is `delivered`. A user-preference suppression is not a successful send. A rejected ledger write does not report success. `bfb81cae6816acb45b4e1825ebbde62ff0d6c8d8` holds an attempt with no outcome, a provider acceptance, a bounce, and a suppression instead of sending again. A confirmed failure may be retried under the same idempotency key. A provider acceptance that fails to record returns uncertain, and a later send with that key does not call the provider. Duplicate callbacks and a callback that matches more than one tenant are not written. Confirmed delivery is still only the delivered event. `0031` now compares constraint, index, policy, and grant definitions. A second worker loses the retry when the queue row is no longer pending, failed, or retrying, and does not send. `0032_notification_callback_identity` is an UNQUALIFIED forward migration. It adds a partial unique index on `(external_event_id, event)` and a locked owner check so one provider message belongs to one organization. It refuses existing duplicates and does not delete a row. A unique callback insert is treated as a duplicate. A cross-tenant constraint is treated as ambiguous. Native execution of `0031`, `0032`, concurrent sends, simultaneous callbacks, a crashed `processing` row, uncertain acceptance, retry competition, and cross-tenant identity is `notification-delivery-native` and stays `READY_FOR_VS_EXECUTION`. No DROP was added. The sixteen dependency holds and the six service-imported declarations are `schema-verify-dead-required`. `accessibility_audits`, `accessibility_issues`, `financial_audit_log`, `gss_applications`, `indigenous_member_data`, and `member_addresses` stay because their services read or write them. Accessibility, indigenous data, and LMBP immigration compatibility files re-export the domain declaration. None of those six services is reached from an App Router entry. Census column gaps are not evolved here. The only remaining `schema-verify-dead-module` row is `notification_history`, whose union-eyes declaration is already removed. The census is still 231. Do not execute a hold batch by shrinking a ratchet. Do not edit the route-coverage scanner. Do not hand-edit the census. Do not DROP a relation. `UE-CONV-H-007` and `UE-CONV-K-006` stay `IN_PROGRESS`.

Member and staff WorkAid screens call the union-side consent, document and referral routes. A member can record a referral of their own live consent. Consent wording becomes current only when a second executive adopts a proposal whose body the caller supplied. Source commit `e59f37baf43b98ba95470b97c861bd8d4962b1eb`. Platform `0036_workaid_consent_wording_proposals` and cache `0028_workaid_consent_wording_proposal_rls` are UNQUALIFIED and unapplied. Until that adoption, consent capture stays unavailable. A recorded referral is listed for a principal the kernel still allows to refer that matter, and the list omits the member and the referrer. Staff can narrow the referred categories. Source commit `69fd81ef8d93cdc420b02dca7b6e72a2e2044f1e`. Source commit `7b105f0bc6e2f1725fd5bd8b3dbe47fa8a83e69e` stores those categories on the referral and shows them only when they match the referral audit. A missing or conflicting record is unavailable. Consent categories are not copied. Release sends only the categories the representative selects and confirms. The member sees release and withdrawal history. Delivery to counsel, counsel acknowledgement, and notification delivery stay false. No adopted policy requires a WorkAid notice. Platform `0037_workaid_referral_scope` is UNQUALIFIED and unapplied. Documents stay with the member. Counsel execution stays closed. `UE-CONV-G-002` stays `IN_PROGRESS`. Credentialed browser acceptance and native concurrency of release against revocation stay `READY_FOR_VS_EXECUTION` and were not run here.

Certified election succession now requires organization ownership and a kernel grant for the authenticated principal. Source commit `889880502664e125023d7ed7972963d6ac337937`. Platform `0033`, `0034` and `0035` are UNQUALIFIED and unapplied. `election-certificate-succession-native` and `ownership-backfill-native` stay `READY_FOR_VS_EXECUTION`. The HTTP route returns 200 only when that grant loads. The council vote route stays 501. Remittance, payroll, reconciliation and the union financial reads require the caller's own mandate. `UE-CONV-K-009`, `UE-CONV-H-007` and `UE-CONV-K-006` stay `IN_PROGRESS`. Finance issuance still does nothing until a live issuance rule exists. Platform billing routes stay on the role floor. Persona journeys remain open. The route-coverage baseline's empty `kernelPending` does not close those.

Member review intake is source commit `08f20236c540b556e022d7b430ba0cbf3e8470e2`. An active member opens a complaint, an appeal or a reconsideration as themselves from My Union. The list returns reviews that member opened or filed. An oversight row is returned only when `review:monitor` allows that exact review. A stranger, a foreign organization, an adverse party and a recused monitor receive no row. No review-notification policy is adopted, so no notice is sent. The governance overview links to the same screen. `UE-CONV-I-001` stays `IN_PROGRESS`. The PGlite file is not a native pass. Credentialed browser acceptance stays pending VS Code.

When referral provenance is unavailable, the recorded-referral listing may still use consent categories for the visibility decision and returns no inferred categories. Confirm that a malformed record does not reveal the referral to a principal who would not be allowed to see the recorded scope. Native release against withdrawal, recusal, mandate revocation and tenant crossover stays `READY_FOR_VS_EXECUTION`.

`CURSOR_IMPLEMENTATION_COMPLETE` is false. `VS_NATIVE_VALIDATION_COMPLETE`, `CREDENTIALED_PERSONA_ACCEPTANCE_COMPLETE`, `INSTITUTIONAL_POLICY_ADOPTED`, `STAGING_RELEASE_AUTHORIZED` and `PRODUCTION_RELEASE_AUTHORIZED` are false.
