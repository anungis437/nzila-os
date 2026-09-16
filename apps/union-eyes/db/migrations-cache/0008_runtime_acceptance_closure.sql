-- Runtime acceptance closure for external-specialist P1/P2.
--
-- 1. Reconcile the live documents table with its canonical Drizzle shape.
-- 2. Permit authenticated runtime audit inserts only when both tenant and
--    actor match the transaction-scoped RLS context.

ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "checksum" text;--> statement-breakpoint

ALTER TABLE "audit_security"."audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_security"."audit_logs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS "audit_insert_all" ON "audit_security"."audit_logs";--> statement-breakpoint
DROP POLICY IF EXISTS "ue_runtime_audit_insert" ON "audit_security"."audit_logs";--> statement-breakpoint
CREATE POLICY "ue_runtime_audit_insert"
  ON "audit_security"."audit_logs"
  FOR INSERT
  TO "union_eyes_runtime"
  WITH CHECK (
    "organization_id" IS NOT NULL
    AND "organization_id"::text = current_setting('app.current_org_id', true)
    AND "user_id" IS NOT NULL
    AND "user_id"::text = current_setting('app.current_user_id', true)
  );--> statement-breakpoint

REVOKE ALL ON TABLE "audit_security"."audit_logs" FROM "union_eyes_runtime";--> statement-breakpoint
GRANT USAGE ON SCHEMA "audit_security" TO "union_eyes_runtime";--> statement-breakpoint
GRANT INSERT ON TABLE "audit_security"."audit_logs" TO "union_eyes_runtime";
