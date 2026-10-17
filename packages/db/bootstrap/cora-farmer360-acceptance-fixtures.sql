-- TEST_ONLY / NON_PRODUCTION synthetic fixtures for the disposable acceptance DB.
-- Stable UUIDs make the harness reproducible; no production-derived data is used.

DO $acceptance_database_guard$
BEGIN
  IF current_database() <> 'cora_farmer360_acceptance' THEN
    RAISE EXCEPTION 'Refusing Farmer 360 fixtures outside its disposable database';
  END IF;
END
$acceptance_database_guard$;

INSERT INTO "orgs" ("id", "legal_name", "jurisdiction")
VALUES
  ('36000000-0000-4000-8000-000000000001', 'TEST ONLY - Cora Farmer 360 Acceptance Org', 'CA-ON'),
  ('36000000-0000-4000-8000-000000000002', 'TEST ONLY - Cora Farmer 360 Other Org', 'CA-ON');

INSERT INTO "user_management"."users" ("user_id", "email")
VALUES (
  'cora-farmer360-route-platform-user',
  'farmer360-route@example.test'
);

INSERT INTO "platform_identity_bindings" (
  "provider",
  "provider_subject",
  "platform_user_id",
  "state",
  "verified_at",
  "provisioned_by"
)
VALUES (
  'cora-acceptance',
  'farmer360-route-actor',
  'cora-farmer360-route-platform-user',
  'active',
  now() - interval '1 day',
  'test-only:cora-farmer360-acceptance'
);

INSERT INTO "platform_organization_memberships" (
  "platform_user_id",
  "organization_id",
  "role",
  "state",
  "provisioning_source",
  "effective_from",
  "created_by",
  "updated_by"
)
VALUES (
  'cora-farmer360-route-platform-user',
  '36000000-0000-4000-8000-000000000001',
  'viewer',
  'active',
  'test-only:cora-farmer360-acceptance',
  now() - interval '1 day',
  'test-only:cora-farmer360-acceptance',
  'test-only:cora-farmer360-acceptance'
);

INSERT INTO "platform_application_permission_grants" (
  "membership_id",
  "organization_id",
  "application_id",
  "permission",
  "state",
  "grant_source",
  "effective_from",
  "granted_by"
)
SELECT
  membership."id",
  membership."organization_id",
  'cora',
  'cora:farmer360:read',
  'active',
  'test-only:cora-farmer360-acceptance',
  now() - interval '1 day',
  'test-only:cora-farmer360-acceptance'
FROM "platform_organization_memberships" AS membership
WHERE membership."platform_user_id" = 'cora-farmer360-route-platform-user'
  AND membership."organization_id" = '36000000-0000-4000-8000-000000000001';

INSERT INTO "agri_producers" (
  "id", "org_id", "name", "status", "metadata", "created_at", "updated_at"
)
VALUES (
  '36000000-0000-4000-8000-000000000101',
  '36000000-0000-4000-8000-000000000001',
  'TEST ONLY - Synthetic Producer',
  'active',
  '{"fixture":"cora-farmer360-acceptance","synthetic":true}'::jsonb,
  now() - interval '1 day',
  now()
);

INSERT INTO "platform_methodology_versions" (
  "authority_id",
  "methodology_id",
  "version",
  "name",
  "definition_sha256",
  "definition_ref",
  "effective_from",
  "created_by"
)
VALUES (
  'cora',
  'farmer-assertion',
  '1.0.0',
  'TEST ONLY - Farmer assertion acceptance fixture; not a production methodology',
  encode(
    sha256(convert_to(
      'TEST ONLY: exercises Farmer 360 assertion consent, policy, evidence, audit, and immutability contracts.',
      'UTF8'
    )),
    'hex'
  ),
  'test-only://cora-farmer360-acceptance/cora/farmer-assertion/1.0.0',
  now() - interval '1 day',
  'test-only:cora-farmer360-acceptance'
);
