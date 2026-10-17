DO $$
BEGIN
  IF current_database() <> 'nzila_platform_authz_acceptance' THEN
    RAISE EXCEPTION 'Refusing authz acceptance fixtures in unexpected database: %', current_database();
  END IF;
END
$$;

INSERT INTO orgs (id, legal_name, jurisdiction, status) VALUES
  ('61000000-0000-4000-8000-000000000001', 'Acceptance Organization A', 'CA-ON', 'active'),
  ('61000000-0000-4000-8000-000000000002', 'Acceptance Organization B', 'CA-ON', 'active'),
  ('61000000-0000-4000-8000-000000000003', 'Acceptance Inactive Organization', 'CA-ON', 'inactive');

INSERT INTO user_management.users (user_id, email, is_active, lifecycle_state) VALUES
  ('platform-owner-1', 'owner@example.test', true, 'active'),
  ('platform-no-grant', 'no-grant@example.test', true, 'active'),
  ('platform-disabled', 'disabled@example.test', true, 'active'),
  ('platform-revoked', 'revoked@example.test', true, 'active'),
  ('platform-unverified', 'unverified@example.test', true, 'active'),
  ('platform-inactive', 'inactive@example.test', false, 'suspended'),
  ('platform-ambiguous', 'ambiguous@example.test', true, 'active'),
  ('platform-no-membership', 'no-membership@example.test', true, 'active'),
  ('platform-membership-states', 'membership-states@example.test', true, 'active'),
  ('platform-expired-membership', 'expired-membership@example.test', true, 'active'),
  ('platform-inactive-org', 'inactive-org@example.test', true, 'active'),
  ('platform-cross-provider', 'cross-provider@example.test', true, 'active'),
  ('platform-future-membership', 'future-membership@example.test', true, 'active'),
  ('platform-cora-acceptance', 'cora-acceptance@example.test', true, 'active');

INSERT INTO user_management.organization_users (
  organization_id, user_id, role, permissions, is_active, is_primary
) VALUES
  ('61000000-0000-4000-8000-000000000001', 'platform-owner-1', 'admin', '["agri:write"]', true, false),
  ('61000000-0000-4000-8000-000000000002', 'platform-owner-1', 'admin', '["cora:farmer360:read"]', true, true),
  ('61000000-0000-4000-8000-000000000001', 'platform-no-grant', 'admin', '["cora:farmer360:read", "agri:write"]', true, true),
  ('61000000-0000-4000-8000-000000000001', 'platform-ambiguous', 'admin', '["cora:farmer360:read"]', true, true);

INSERT INTO platform_identity_bindings (
  id, provider, provider_subject, platform_user_id, state, verified_at, provisioned_by
) VALUES
  ('62000000-0000-4000-8000-000000000001', 'test.acceptance', 'subject-owner', 'platform-owner-1', 'active', now() - interval '1 day', 'acceptance-seed'),
  ('62000000-0000-4000-8000-000000000002', 'test.acceptance', 'subject-no-grant', 'platform-no-grant', 'active', now() - interval '1 day', 'acceptance-seed'),
  ('62000000-0000-4000-8000-000000000003', 'test.acceptance', 'subject-disabled', 'platform-disabled', 'disabled', now() - interval '1 day', 'acceptance-seed'),
  ('62000000-0000-4000-8000-000000000004', 'test.acceptance', 'subject-revoked', 'platform-revoked', 'revoked', now() - interval '1 day', 'acceptance-seed'),
  ('62000000-0000-4000-8000-000000000005', 'test.acceptance', 'subject-unverified', 'platform-unverified', 'active', now() + interval '1 day', 'acceptance-seed'),
  ('62000000-0000-4000-8000-000000000006', 'test.acceptance', 'subject-inactive', 'platform-inactive', 'active', now() - interval '1 day', 'acceptance-seed'),
  ('62000000-0000-4000-8000-000000000007', 'test.acceptance', 'subject-ambiguous', 'platform-ambiguous', 'active', now() - interval '1 day', 'acceptance-seed'),
  ('62000000-0000-4000-8000-000000000008', 'test.acceptance', 'subject-no-membership', 'platform-no-membership', 'active', now() - interval '1 day', 'acceptance-seed'),
  ('62000000-0000-4000-8000-000000000009', 'test.acceptance', 'subject-membership-states', 'platform-membership-states', 'active', now() - interval '1 day', 'acceptance-seed'),
  ('62000000-0000-4000-8000-000000000010', 'test.acceptance', 'subject-expired-membership', 'platform-expired-membership', 'active', now() - interval '1 day', 'acceptance-seed'),
  ('62000000-0000-4000-8000-000000000011', 'test.acceptance', 'subject-inactive-org', 'platform-inactive-org', 'active', now() - interval '1 day', 'acceptance-seed'),
  ('62000000-0000-4000-8000-000000000012', 'test.acceptance', 'subject-shared', 'platform-owner-1', 'active', now() - interval '1 day', 'acceptance-seed'),
  ('62000000-0000-4000-8000-000000000013', 'test.other', 'subject-shared', 'platform-cross-provider', 'active', now() - interval '1 day', 'acceptance-seed'),
  ('62000000-0000-4000-8000-000000000014', 'entra', 'acceptance-tenant:entra-owner', 'platform-owner-1', 'active', now() - interval '1 day', 'acceptance-seed'),
  ('62000000-0000-4000-8000-000000000015', 'test.acceptance', 'subject-future-membership', 'platform-future-membership', 'active', now() - interval '1 day', 'acceptance-seed'),
  ('62000000-0000-4000-8000-000000000016', 'cora-acceptance', 'actor-a', 'platform-cora-acceptance', 'active', now() - interval '1 day', 'acceptance-seed'),
  ('62000000-0000-4000-8000-000000000017', 'cora-acceptance', 'actor-b', 'platform-cross-provider', 'active', now() - interval '1 day', 'acceptance-seed'),
  ('62000000-0000-4000-8000-000000000018', 'cora-acceptance', 'actor-no-permission', 'platform-no-grant', 'active', now() - interval '1 day', 'acceptance-seed'),
  ('62000000-0000-4000-8000-000000000019', 'cora-acceptance', 'actor-no-membership', 'platform-no-membership', 'active', now() - interval '1 day', 'acceptance-seed'),
  ('62000000-0000-4000-8000-000000000020', 'cora-acceptance', 'actor-ambiguous', 'platform-ambiguous', 'active', now() - interval '1 day', 'acceptance-seed'),
  ('62000000-0000-4000-8000-000000000021', 'cora-acceptance', 'actor-disabled', 'platform-disabled', 'disabled', now() - interval '1 day', 'acceptance-seed'),
  ('62000000-0000-4000-8000-000000000022', 'cora-acceptance', 'actor-suspended', 'platform-membership-states', 'active', now() - interval '1 day', 'acceptance-seed');

INSERT INTO platform_organization_memberships (
  id, platform_user_id, organization_id, role, state, provisioning_source,
  effective_from, created_by, updated_by
) VALUES
  ('63000000-0000-4000-8000-000000000001', 'platform-owner-1', '61000000-0000-4000-8000-000000000001', 'admin', 'active', 'acceptance-seed', now() - interval '1 day', 'acceptance-seed', 'acceptance-seed'),
  ('63000000-0000-4000-8000-000000000002', 'platform-no-grant', '61000000-0000-4000-8000-000000000001', 'admin', 'active', 'acceptance-seed', now() - interval '1 day', 'acceptance-seed', 'acceptance-seed'),
  ('63000000-0000-4000-8000-000000000003', 'platform-disabled', '61000000-0000-4000-8000-000000000001', 'admin', 'active', 'acceptance-seed', now() - interval '1 day', 'acceptance-seed', 'acceptance-seed'),
  ('63000000-0000-4000-8000-000000000004', 'platform-revoked', '61000000-0000-4000-8000-000000000001', 'admin', 'active', 'acceptance-seed', now() - interval '1 day', 'acceptance-seed', 'acceptance-seed'),
  ('63000000-0000-4000-8000-000000000005', 'platform-unverified', '61000000-0000-4000-8000-000000000001', 'admin', 'active', 'acceptance-seed', now() - interval '1 day', 'acceptance-seed', 'acceptance-seed'),
  ('63000000-0000-4000-8000-000000000006', 'platform-inactive', '61000000-0000-4000-8000-000000000001', 'admin', 'active', 'acceptance-seed', now() - interval '1 day', 'acceptance-seed', 'acceptance-seed'),
  ('63000000-0000-4000-8000-000000000007', 'platform-ambiguous', '61000000-0000-4000-8000-000000000001', 'admin', 'active', 'acceptance-seed', now() - interval '1 day', 'acceptance-seed', 'acceptance-seed'),
  ('63000000-0000-4000-8000-000000000008', 'platform-ambiguous', '61000000-0000-4000-8000-000000000002', 'viewer', 'active', 'acceptance-seed', now() - interval '1 day', 'acceptance-seed', 'acceptance-seed'),
  ('63000000-0000-4000-8000-000000000009', 'platform-no-membership', '61000000-0000-4000-8000-000000000001', 'viewer', 'invited', 'acceptance-seed', now() - interval '1 day', 'acceptance-seed', 'acceptance-seed'),
  ('63000000-0000-4000-8000-000000000010', 'platform-membership-states', '61000000-0000-4000-8000-000000000001', 'viewer', 'invited', 'acceptance-seed', now() - interval '1 day', 'acceptance-seed', 'acceptance-seed'),
  ('63000000-0000-4000-8000-000000000011', 'platform-membership-states', '61000000-0000-4000-8000-000000000002', 'viewer', 'suspended', 'acceptance-seed', now() - interval '1 day', 'acceptance-seed', 'acceptance-seed'),
  ('63000000-0000-4000-8000-000000000012', 'platform-membership-states', '61000000-0000-4000-8000-000000000003', 'viewer', 'revoked', 'acceptance-seed', now() - interval '1 day', 'acceptance-seed', 'acceptance-seed'),
  ('63000000-0000-4000-8000-000000000013', 'platform-expired-membership', '61000000-0000-4000-8000-000000000001', 'viewer', 'active', 'acceptance-seed', now() - interval '2 days', 'acceptance-seed', 'acceptance-seed'),
  ('63000000-0000-4000-8000-000000000014', 'platform-inactive-org', '61000000-0000-4000-8000-000000000003', 'viewer', 'active', 'acceptance-seed', now() - interval '1 day', 'acceptance-seed', 'acceptance-seed'),
  ('63000000-0000-4000-8000-000000000015', 'platform-cross-provider', '61000000-0000-4000-8000-000000000002', 'viewer', 'active', 'acceptance-seed', now() - interval '1 day', 'acceptance-seed', 'acceptance-seed'),
  ('63000000-0000-4000-8000-000000000016', 'platform-future-membership', '61000000-0000-4000-8000-000000000001', 'viewer', 'active', 'acceptance-seed', now() + interval '1 day', 'acceptance-seed', 'acceptance-seed'),
  ('63000000-0000-4000-8000-000000000017', 'platform-cora-acceptance', '61000000-0000-4000-8000-000000000001', 'viewer', 'active', 'acceptance-seed', now() - interval '1 day', 'acceptance-seed', 'acceptance-seed');

UPDATE platform_organization_memberships
SET effective_to = now() - interval '1 hour'
WHERE id = '63000000-0000-4000-8000-000000000013';

INSERT INTO platform_application_permission_grants (
  id, membership_id, organization_id, application_id, permission, state,
  grant_source, effective_from, expires_at, granted_by
) VALUES
  ('64000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', 'cora', 'cora:farmer360:read', 'active', 'acceptance-seed', now() - interval '1 day', NULL, 'acceptance-seed'),
  ('64000000-0000-4000-8000-000000000002', '63000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', 'union-eyes', 'union-eyes:case:read', 'active', 'acceptance-seed', now() - interval '1 day', NULL, 'acceptance-seed'),
  ('64000000-0000-4000-8000-000000000003', '63000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', 'cora', 'cora:expired:read', 'active', 'acceptance-seed', now() - interval '2 days', now() - interval '1 day', 'acceptance-seed'),
  ('64000000-0000-4000-8000-000000000004', '63000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', 'cora', 'cora:future:read', 'active', 'acceptance-seed', now() + interval '1 day', NULL, 'acceptance-seed'),
  ('64000000-0000-4000-8000-000000000005', '63000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', 'cora', 'cora:revoked:read', 'revoked', 'acceptance-seed', now() - interval '1 day', NULL, 'acceptance-seed'),
  ('64000000-0000-4000-8000-000000000006', '63000000-0000-4000-8000-000000000015', '61000000-0000-4000-8000-000000000002', 'cora', 'cora:farmer360:read', 'active', 'acceptance-seed', now() - interval '1 day', NULL, 'acceptance-seed'),
  ('64000000-0000-4000-8000-000000000007', '63000000-0000-4000-8000-000000000017', '61000000-0000-4000-8000-000000000001', 'cora', 'cora:farmer360:read', 'active', 'acceptance-seed', now() - interval '1 day', NULL, 'acceptance-seed');

UPDATE platform_application_permission_grants
SET state = 'revoked', revoked_at = now() - interval '1 hour', revoked_by = 'acceptance-seed'
WHERE id = '64000000-0000-4000-8000-000000000005';
