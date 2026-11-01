-- 0045_audit_security_runtime_read rollback: restores the INSERT-only runtime sink.
DO $$ BEGIN
  IF to_regclass('audit_security.audit_logs') IS NOT NULL THEN
    DROP POLICY IF EXISTS ue_runtime_audit_select ON audit_security.audit_logs;
    REVOKE SELECT ON TABLE audit_security.audit_logs FROM union_eyes_runtime;
  END IF;
END $$;
