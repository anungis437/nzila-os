# Convergence tranche 9: the Django service endpoints that nothing calls are contained

Date: 2026-11-02. Branch `agents/ue-cursor-final-closure`. Base commit `36d39b349` (tranche 8 test fix); source commit `e1e31237427de9ac64936c1f33291ae48c18ee0f`.
Credit: none (cross-cutting source evidence, `defectCredit` 0, `closureCredit` 0). Nothing is closed. `READY_FOR_STAGING` stays `NO`.
This tranche acts on the direction "if you identify flaws or missing aspects, fix them too": tranche 8 found, while checking which Django defaults a live endpoint could change, that the generated
service ViewSets take every key of the request body, and that anyone signed in can reach them.

## What was wrong

`services/api` registers 23 generated ViewSets under `/api/services/`. Five were already contained by `DenyAllPermission` (rounds 49 and 50). The other 18 were `permission_classes = [IsAuthenticated]` and nothing
else: no role, and no tenant scope on most reads. Any signed-in user of any organization could, by name:

- send a push notification to any device, user or topic (`fcm-service`), an SMS to any number or in bulk (`twilio-sms-service`), or an email (`email`);
- switch location tracking on or off and delete location history (`geofence-privacy-service`);
- record or approve indigenous-data consent, sharing agreements and access to traditional knowledge (`indigenous-data-service`);
- report a privacy breach, submit and fulfil a data-subject access request, change the privacy configuration (`provincial-privacy-service`);
- change the fair-market-value policy and file procurement bids and appraisals (`joint-trust-fmv-service`), the currency policy (`currency-enforcement-service`), transfer-pricing documents and T106 filings
  (`transfer-pricing-service`), the payment-classification policy and violations (`whiplash-prevention-service`), a carbon-provider integration (`carbon-accounting-integration`, which writes `IntegrationConfigs`),
  and declare or lift force majeure (`force-majeure-integration`);
- issue, vote on, audit, sunset and convert a golden share, and run council elections (`governance-service`);
- register foreign workers and generate LMBP letters (`lmbp-immigration-service`), generate tax slips (`tax-slip-service`), define and trigger workflows (`workflows-test`), and read every Django model and field
  name (`schema`).

Sixty-four create paths in fifteen of these modules build the row from every key of the request body (`Model.objects.create(organization_id=..., **{k: v for k, v in data.items() if k != 'organization_id'})`): the
caller chooses any column but the tenant. Forty-eight of them were in the twelve modules that are `IsAuthenticated` only; the other sixteen were already contained.

The application calls exactly one of these endpoints. `services/governance-service.ts` calls `/api/services/governance-service/check_status/`, and only `checkGoldenShareStatus()` is used, by
`lib/middleware/admin-auth.ts` and `lib/trust/system-metrics.ts`. A search of the whole repository outside `backend/` for every other router prefix finds no caller (the other `/api/services/<name>` strings
in the application are its own Next.js routes).

## What changed

- **Seventeen ViewSets are contained** with the shared `core.isolation.DenyAllPermission` (the class the earlier rounds introduced for exactly this case: no consumer, so there is nothing to scope, only to close):
  `fcm-service`, `twilio-sms-service`, `email`, `geofence-privacy-service`, `indigenous-data-service`, `joint-trust-fmv-service`, `provincial-privacy-service`, `currency-enforcement-service`,
  `transfer-pricing-service`, `whiplash-prevention-service`, `carbon-accounting-integration`, `force-majeure-integration`, `carbon-accounting-service`, `lmbp-immigration-service`, `tax-slip-service`,
  `workflows-test`, `schema`.
- **`governance-service` is default-deny with one live action.** `permission_classes = [DenyAllPermission]`, and `get_permissions()` returns `IsAuthenticated` only for `LIVE_ACTIONS = {'check_status'}`. A new
  action is denied until it is listed, so issuing, voting, auditing, sunsetting and converting a golden share and council elections are closed. `check_status` reads the one active golden share and writes nothing.
- No existing test pinned the old behaviour. `notifications/tasks.py` mentions `FcmServiceViewSet` in a comment and calls nothing from it. The routes stay registered; they answer 403.

## Proof

`services/tests_service_write_path_containment.py` (9 tests, view layer through `APIRequestFactory`, so no middleware and no Redis):

- the only (router prefix, action) pairs an authenticated caller can reach, over every registered ViewSet and every standard and extra action, are exactly `{('governance-service', 'check_status')}`;
- an unauthenticated caller reaches none;
- every extra action of every ViewSet is called with an authenticated user: the live one answers 200, all others (more than 150 routes) answer 403, and none wrote an `AuditLogs` row;
- the live action is `IsAuthenticated` only and its source holds no create, update, delete or save; a new action of the live ViewSet is denied until listed;
- a static check that no module that builds a row from every request key assigns `IsAuthenticated` to `permission_classes`.

Mutations, to show the tests are not vacuous: reopening `twilio-sms-service` fails three of them; adding `issue_golden_share` to `LIVE_ACTIONS` fails two; the contained tree passes. The whole Django suite is run in
faithful mode against the converged PG16 database (see the ledger entry for the final count).

## What is not claimed

- No HTTP-level proof: the middleware stack needs Redis and request signing, and the proof is at DRF's view layer, which is where permission classes run.
- **Not reviewed here:** the four control-plane modules `services/integration_control_plane`, `services/events`, `services/evidence_pack` and `services/compliance_snapshot` are `IsAuthenticated` with
  serializer-based views and write through service modules; they look like real features with callers and need their own authorization review. `task_enqueue_views` gates every view on `_require_admin`.
- `check_status` returns the global golden share to any authenticated caller. That is by design (the share is platform-level) and what the application needs; whether it needs a role is a decision for the
  institution.
- `docs/union-eyes/bootstrap-v2/UE_V2_APPLICATION_ACTOR_MAP.json` pins file hashes of these modules; it was last generated on 2026-10-26, is not verified by any test or workflow, and is not regenerated here.
- Reopening any contained ViewSet needs a reviewed, tenant-scoped, role-gated design and a caller.
- No defect or CLOSED credit, no staging or production claim.
