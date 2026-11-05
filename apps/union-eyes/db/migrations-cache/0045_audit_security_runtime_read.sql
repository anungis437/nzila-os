-- 0045_audit_security_runtime_read
--
-- audit_security.audit_logs was reconciled (0008, 0017) to an INSERT-only runtime sink: FORCE RLS, a single INSERT policy, and
-- INSERT as the only runtime privilege. Every reader of the table (lib/audit/audit-reader.ts, activities, ai-usage, compliance audit
-- logs, case export) runs in the tenant transaction as union_eyes_runtime, so each failed natively with "permission denied for
-- table audit_logs". Their PGlite tests granted SELECT that the real schema never gave, which is how the defect went unseen.
--
-- Adds the missing read path and nothing else: SELECT for the runtime role, limited by FORCE RLS to the caller's own organization.
-- A row with no organization stays invisible to every tenant. UPDATE, DELETE and TRUNCATE stay ungranted, so the table remains
-- append-only from the tenant's side. Whether a given caller may read is still decided by the route's role check.

DO $$
BEGIN
  IF to_regclass('audit_security.audit_logs') IS NULL THEN
    RAISE EXCEPTION 'RLS 0045 fail-closed: audit_security.audit_logs does not exist.';
  END IF;
  IF to_regrole('union_eyes_runtime') IS NULL THEN
    RAISE EXCEPTION 'RLS 0045 fail-closed: role union_eyes_runtime does not exist.';
  END IF;
END $$;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_runtime_audit_select ON audit_security.audit_logs;
--> statement-breakpoint
CREATE POLICY ue_runtime_audit_select ON audit_security.audit_logs
  FOR SELECT TO union_eyes_runtime
  USING (organization_id IS NOT NULL AND organization_id::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
GRANT SELECT ON TABLE audit_security.audit_logs TO union_eyes_runtime;
