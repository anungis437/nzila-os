-- Runtime acceptance closure for external-specialist P1/P2.
--
-- 1. Reconcile the live documents table with its canonical Drizzle shape.
-- 2. Permit authenticated runtime audit inserts only when both tenant and
--    actor match the transaction-scoped RLS context.

ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "checksum" text;--> statement-breakpoint

CREATE SCHEMA IF NOT EXISTS "audit_security";--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_security"."audit_logs" (
  "audit_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid,
  "user_id" varchar(255),
  "action" varchar(100) NOT NULL,
  "resource_type" varchar(50) NOT NULL,
  "resource_id" uuid,
  "old_values" jsonb,
  "new_values" jsonb,
  "ip_address" varchar(45),
  "user_agent" text,
  "session_id" uuid,
  "correlation_id" uuid,
  "severity" varchar(20) DEFAULT 'info',
  "outcome" varchar(20) DEFAULT 'success',
  "error_message" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "archived" boolean DEFAULT false NOT NULL,
  "archived_at" timestamp with time zone,
  "archived_path" text,
  "created_at" timestamp with time zone DEFAULT now()
);--> statement-breakpoint

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
