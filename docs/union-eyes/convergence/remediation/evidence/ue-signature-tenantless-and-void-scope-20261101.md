# Union Eyes Gate 0 — signature document tenant-context and provider outcome repair

Status: **SOURCE_CHANGED_TESTS_AUTHORED_NOT_QUALIFIED**. This is additive engineering evidence, not independent qualification or an accepted institutional decision.

## Frozen defect linkage

- `DEF-0B11-SOC-SIGNATURE-READS-AND-ACCESS-CHECK-USE-THE-BARE-DB-HANDLE-WITH-NO-ORGANIZATION-PREDICATE-AND-ACCEPT-ANY-USER-ID-A-SENDER-TYPED-AS-SIGNER` (supplemental correction; remains PARTIAL).
- Related signature-status honesty and provider lifecycle concerns remain in the frozen Gate 0 population and are not claimed closed by this patch.

## Observed baseline

At `e11e53ab255dba5d361b4ccf347ab158a61b4214`, the whole-app CI reported a signature audit test failure: a signed-in user with no organization received HTTP 200 rather than 403 because the route passed an empty organization string to a mocked downstream check. The service had a tenant guard, but the route did not enforce one before invoking that check. The signature-document GET/PATCH/POST routes had the same implicit empty-tenant delegation. `SignatureService.voidDocument` read the document using the shared `db` handle by document id alone before contacting the external provider.

## Source corrections

1. Signature audit GET refuses an authenticated user without a current organization before any access check, sender lookup or audit query. The authorized tenant id is propagated to every downstream read.
2. Signature document GET, PATCH (void) and POST (provider refresh) refuse missing organization context before service calls.
3. The void service requires the caller's organization id and resolves the document inside `withRLSContext`, with both document id and organization predicates, before provider-side effects. A matching sender id without the tenant is insufficient.
4. Provider refresh responses no longer claim `success: true` when `synced: false`. Provider outage is HTTP 503, missing envelope HTTP 409, and idempotent no-op remains HTTP 200 with explicit `success: false` and `synced: false`.

## Regression tests authored

- `apps/union-eyes/app/api/signatures/audit/[documentId]/__tests__/route.test.ts`: tenantless JSON/report requests fail closed without service access.
- `apps/union-eyes/app/api/signatures/documents/[id]/__tests__/tenant-bound-route.test.ts`: GET/PATCH/POST tenantless refusal; tenant propagation; sender authorization; provider unavailable/no-envelope/no-op outcomes.

## Verification and residual risks

- Source-level: GitHub commits and readback on the specified branch; no executable test outcome is claimed for these commits.
- Unit/contract: authored; exact-HEAD pass pending.
- Native PG15/16: prior baseline workflow passed, but the new source has not been natively qualified. Explicit tenant-bound void-service behavior needs native runtime-role cross-tenant tests.
- HTTP/browser/staging: baseline HTTP/browser acceptance failed in unrelated case escalation journeys; exact-HEAD signature journey and staging acceptance pending.
- Provider: external DocuSign/HelloSign void and refresh acceptance pending. Provider/database dual-write atomicity and reconciliation remain unresolved. This patch does not claim to solve the provider-first side-effect race.
- Independent reviewer, owner-persona ratification and institutional authority remain outstanding. No defect is CLOSED, no production GO and no completion credit.
