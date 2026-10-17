-- Canonical NzilaOS provider identity, organization membership, and app grants.
-- Additive only. This migration is an unapplied artifact; do not apply it to
-- any environment without the separately governed migration approval.

BEGIN;

CREATE TABLE "platform_identity_bindings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" varchar(80) NOT NULL,
  "provider_subject" varchar(512) NOT NULL,
  "platform_user_id" varchar(255) NOT NULL,
  "state" varchar(16) NOT NULL DEFAULT 'active',
  "verified_at" timestamptz NOT NULL,
  "provisioned_by" varchar(255) NOT NULL,
  "disabled_at" timestamptz,
  "disabled_by" varchar(255),
  "revoked_at" timestamptz,
  "revoked_by" varchar(255),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "platform_identity_user_fk"
    FOREIGN KEY ("platform_user_id")
    REFERENCES "user_management"."users"("user_id") ON DELETE RESTRICT,
  CONSTRAINT "platform_identity_provider_subject_uidx"
    UNIQUE ("provider", "provider_subject"),
  CONSTRAINT "platform_identity_provider_ck"
    CHECK ("provider" = lower(btrim("provider")) AND length(btrim("provider")) > 0),
  CONSTRAINT "platform_identity_subject_ck"
    CHECK (length(btrim("provider_subject")) > 0),
  CONSTRAINT "platform_identity_state_ck"
    CHECK ("state" IN ('active', 'disabled', 'revoked'))
);

CREATE INDEX "platform_identity_user_idx"
  ON "platform_identity_bindings" ("platform_user_id");

CREATE TABLE "platform_organization_memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "platform_user_id" varchar(255) NOT NULL,
  "organization_id" uuid NOT NULL,
  "role" varchar(80) NOT NULL,
  "state" varchar(16) NOT NULL,
  "provisioning_source" varchar(120) NOT NULL,
  "effective_from" timestamptz NOT NULL,
  "effective_to" timestamptz,
  "created_by" varchar(255) NOT NULL,
  "updated_by" varchar(255) NOT NULL,
  "revoked_at" timestamptz,
  "revoked_by" varchar(255),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "platform_org_membership_user_fk"
    FOREIGN KEY ("platform_user_id")
    REFERENCES "user_management"."users"("user_id") ON DELETE RESTRICT,
  CONSTRAINT "platform_org_membership_org_fk"
    FOREIGN KEY ("organization_id")
    REFERENCES "orgs"("id") ON DELETE RESTRICT,
  CONSTRAINT "platform_org_membership_user_org_uidx"
    UNIQUE ("platform_user_id", "organization_id"),
  CONSTRAINT "platform_org_membership_id_org_uidx"
    UNIQUE ("id", "organization_id"),
  CONSTRAINT "platform_org_membership_state_ck"
    CHECK ("state" IN ('active', 'invited', 'suspended', 'revoked')),
  CONSTRAINT "platform_org_membership_effective_period_ck"
    CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"),
  CONSTRAINT "platform_org_membership_role_ck"
    CHECK (length(btrim("role")) > 0),
  CONSTRAINT "platform_org_membership_source_ck"
    CHECK (length(btrim("provisioning_source")) > 0)
);

CREATE INDEX "platform_org_membership_user_state_idx"
  ON "platform_organization_memberships" ("platform_user_id", "state");

CREATE TABLE "platform_application_permission_grants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "membership_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "application_id" varchar(80) NOT NULL,
  "permission" varchar(180) NOT NULL,
  "state" varchar(16) NOT NULL DEFAULT 'active',
  "grant_source" varchar(120) NOT NULL,
  "effective_from" timestamptz NOT NULL,
  "expires_at" timestamptz,
  "granted_by" varchar(255) NOT NULL,
  "revoked_at" timestamptz,
  "revoked_by" varchar(255),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "platform_permission_membership_fk"
    FOREIGN KEY ("membership_id", "organization_id")
    REFERENCES "platform_organization_memberships"("id", "organization_id")
    ON DELETE RESTRICT,
  CONSTRAINT "platform_permission_state_ck"
    CHECK ("state" IN ('active', 'revoked')),
  CONSTRAINT "platform_permission_app_id_ck"
    CHECK ("application_id" = lower(btrim("application_id")) AND length(btrim("application_id")) > 0),
  CONSTRAINT "platform_permission_app_scope_ck"
    CHECK ("permission" LIKE "application_id" || ':%' AND "permission" NOT LIKE '%*%'),
  CONSTRAINT "platform_permission_effective_period_ck"
    CHECK ("expires_at" IS NULL OR "expires_at" > "effective_from"),
  CONSTRAINT "platform_permission_source_ck"
    CHECK (length(btrim("grant_source")) > 0)
);

CREATE UNIQUE INDEX "platform_permission_membership_app_permission_uidx"
  ON "platform_application_permission_grants" ("membership_id", "application_id", "permission")
  WHERE "state" = 'active';

CREATE INDEX "platform_permission_org_app_state_idx"
  ON "platform_application_permission_grants" ("organization_id", "application_id", "state");

COMMIT;
