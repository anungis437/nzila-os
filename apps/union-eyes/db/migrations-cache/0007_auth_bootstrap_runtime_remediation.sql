-- Runtime auth-bootstrap remediation.
--
-- Password login must resolve credentials and sessions before
-- app.current_user_id exists. Keep that boundary narrow: only the dedicated
-- union_eyes_system auth executor receives the auth-table privileges required
-- for credential lookup, session issuance/validation, risk checks, and audit
-- logging. Tenant application routes continue to use union_eyes_runtime.

CREATE TABLE IF NOT EXISTS "user_management"."user_sessions" (
  "session_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar(255) NOT NULL REFERENCES "user_management"."users"("user_id") ON DELETE cascade,
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE cascade,
  "session_token" text NOT NULL UNIQUE,
  "refresh_token" text UNIQUE,
  "device_info" jsonb DEFAULT '{}'::jsonb,
  "ip_address" varchar(45),
  "user_agent" text,
  "expires_at" timestamp with time zone NOT NULL,
  "is_active" boolean DEFAULT true,
  "session_token_hash" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "last_used_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "valid_expiry" CHECK ("expires_at" > "created_at")
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_management_user_sessions_token_hash"
  ON "user_management"."user_sessions"("session_token_hash")
  WHERE "session_token_hash" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_user_management_user_sessions_user_id"
  ON "user_management"."user_sessions"("user_id");

CREATE INDEX IF NOT EXISTS "idx_user_management_user_sessions_user_active"
  ON "user_management"."user_sessions"("user_id", "is_active")
  WHERE "is_active" = true;

ALTER TABLE "user_management"."user_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_management"."user_sessions" FORCE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA "user_management" TO "union_eyes_system";

GRANT SELECT, UPDATE ON TABLE "user_management"."users" TO "union_eyes_system";
GRANT SELECT ON TABLE "user_management"."organization_users" TO "union_eyes_system";
GRANT SELECT, INSERT ON TABLE "user_management"."auth_audit_log" TO "union_eyes_system";
GRANT SELECT ON TABLE "user_management"."mfa_totp" TO "union_eyes_system";
GRANT SELECT ON TABLE "user_management"."org_auth_policies" TO "union_eyes_system";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "user_management"."user_sessions" TO "union_eyes_system";

DROP POLICY IF EXISTS "ue_auth_bootstrap_users_system" ON "user_management"."users";
DROP POLICY IF EXISTS "ue_auth_bootstrap_users_select_system" ON "user_management"."users";
CREATE POLICY "ue_auth_bootstrap_users_select_system"
  ON "user_management"."users"
  FOR SELECT
  TO "union_eyes_system"
  USING (true);

DROP POLICY IF EXISTS "ue_auth_bootstrap_users_update_system" ON "user_management"."users";
CREATE POLICY "ue_auth_bootstrap_users_update_system"
  ON "user_management"."users"
  FOR UPDATE
  TO "union_eyes_system"
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "ue_auth_bootstrap_organization_users_system" ON "user_management"."organization_users";
CREATE POLICY "ue_auth_bootstrap_organization_users_system"
  ON "user_management"."organization_users"
  FOR SELECT
  TO "union_eyes_system"
  USING (true);

DROP POLICY IF EXISTS "ue_auth_bootstrap_audit_system" ON "user_management"."auth_audit_log";
CREATE POLICY "ue_auth_bootstrap_audit_system"
  ON "user_management"."auth_audit_log"
  FOR ALL
  TO "union_eyes_system"
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "ue_auth_bootstrap_mfa_system" ON "user_management"."mfa_totp";
CREATE POLICY "ue_auth_bootstrap_mfa_system"
  ON "user_management"."mfa_totp"
  FOR SELECT
  TO "union_eyes_system"
  USING (true);

DROP POLICY IF EXISTS "ue_auth_bootstrap_org_policies_system" ON "user_management"."org_auth_policies";
CREATE POLICY "ue_auth_bootstrap_org_policies_system"
  ON "user_management"."org_auth_policies"
  FOR SELECT
  TO "union_eyes_system"
  USING (true);

DROP POLICY IF EXISTS "ue_auth_bootstrap_sessions_system" ON "user_management"."user_sessions";
CREATE POLICY "ue_auth_bootstrap_sessions_system"
  ON "user_management"."user_sessions"
  FOR ALL
  TO "union_eyes_system"
  USING (true)
  WITH CHECK (true);
