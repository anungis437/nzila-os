-- ─────────────────────────────────────────────────────────────────────────────
-- Rollback: Workbook child-table system read/write authority
--
-- Restores the round-58 grant state (union_eyes_system holds NO privilege on
-- these child tables; only union_eyes_runtime does). After this rollback the
-- pre-claim (bearer) authoring + export path can no longer read/write these
-- tables under the bounded system context.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF to_regclass('workbook_memory_holders') IS NOT NULL THEN
    EXECUTE format(
      'REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE %I FROM union_eyes_system',
      'workbook_memory_holders'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('workbook_governance_lineage_entries') IS NOT NULL THEN
    EXECUTE format(
      'REVOKE SELECT ON TABLE %I FROM union_eyes_system',
      'workbook_governance_lineage_entries'
    );
  END IF;
END $$;
