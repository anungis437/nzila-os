-- seed-staging-fk-fix-patch.sql  (fixes for tables that failed v2)
-- Addresses: missing created_at/updated_at, wrong enum values, wrong column names
-- Run: psql -h nzila-staging-db.postgres.database.azure.com -U nzilaadmin -d nzila_os_staging -f scripts/seed-staging-fk-fix-patch.sql

-- ============================================================
-- Tables that need explicit created_at / updated_at (no DEFAULT)
-- ============================================================

-- message_threads
INSERT INTO message_threads (id, created_at, updated_at, subject, member_id, organization_id, status, is_archived)
VALUES
  ('cc000010-0001-4000-8000-000000000001', now(), now(), 'Dues payment question', 'member_cape_01', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'open', false),
  ('cc000010-0001-4000-8000-000000000002', now(), now(), 'Benefits inquiry', 'member_clc_01', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'open', false)
ON CONFLICT DO NOTHING;

-- board_packet_sections
INSERT INTO board_packet_sections (id, created_at, updated_at, packet_id)
VALUES
  ('cc00000b-0001-4000-8000-000000000001', now(), now(), '092ef7ad-e211-4778-8086-0d81b56bbc3e'),
  ('cc00000b-0001-4000-8000-000000000002', now(), now(), '88c69699-c85c-46ba-b93d-8bb2fccc222f')
ON CONFLICT DO NOTHING;

-- board_packet_distributions
INSERT INTO board_packet_distributions (id, created_at, updated_at, packet_id)
VALUES
  ('cc100036-0001-4000-8000-000000000001', now(), now(), '092ef7ad-e211-4778-8086-0d81b56bbc3e'),
  ('cc100036-0001-4000-8000-000000000002', now(), now(), '88c69699-c85c-46ba-b93d-8bb2fccc222f')
ON CONFLICT DO NOTHING;

-- calendar_sharing
INSERT INTO calendar_sharing (id, created_at, updated_at, calendar_id)
VALUES
  ('cc100015-0001-4000-8000-000000000001', now(), now(), 'ca800001-0001-4000-8000-000000000001'),
  ('cc100015-0001-4000-8000-000000000002', now(), now(), 'ca800001-0001-4000-8000-000000000002')
ON CONFLICT DO NOTHING;

-- event_reminders
INSERT INTO event_reminders (id, created_at, updated_at, event_id)
VALUES
  ('cc100014-0001-4000-8000-000000000001', now(), now(), 'ca810001-0001-4000-8000-000000000001'),
  ('cc100014-0001-4000-8000-000000000002', now(), now(), 'ca810001-0001-4000-8000-000000000002')
ON CONFLICT DO NOTHING;

-- message_notifications
INSERT INTO message_notifications (id, created_at, updated_at, user_id, message_id)
VALUES
  ('cc10000d-0001-4000-8000-000000000001', now(), now(), 'user_cape_01', '5e733b6e-3502-4a21-a5ff-40680efbbd57'),
  ('cc10000d-0001-4000-8000-000000000002', now(), now(), 'user_clc_01', 'b7d240bf-5e08-474c-9a03-fe8e69ddd226')
ON CONFLICT DO NOTHING;

-- message_read_receipts
INSERT INTO message_read_receipts (id, created_at, updated_at, message_id)
VALUES
  ('cc10000f-0001-4000-8000-000000000001', now(), now(), '5e733b6e-3502-4a21-a5ff-40680efbbd57'),
  ('cc10000f-0001-4000-8000-000000000002', now(), now(), 'b7d240bf-5e08-474c-9a03-fe8e69ddd226')
ON CONFLICT DO NOTHING;

-- message_participants (thread_id → message_threads just seeded above)
INSERT INTO message_participants (id, created_at, updated_at, thread_id)
VALUES
  ('cc10000e-0001-4000-8000-000000000001', now(), now(), 'cc000010-0001-4000-8000-000000000001'),
  ('cc10000e-0001-4000-8000-000000000002', now(), now(), 'cc000010-0001-4000-8000-000000000002')
ON CONFLICT DO NOTHING;

-- voting_audit_log
INSERT INTO voting_audit_log (id, created_at, updated_at, session_id)
VALUES
  ('cc100012-0001-4000-8000-000000000001', now(), now(), '69000001-0001-4000-8000-000000000001'),
  ('cc100012-0001-4000-8000-000000000002', now(), now(), '69000001-0001-4000-8000-000000000003')
ON CONFLICT DO NOTHING;

-- voting_notifications
INSERT INTO voting_notifications (id, created_at, updated_at, session_id)
VALUES
  ('cc100013-0001-4000-8000-000000000001', now(), now(), '69000001-0001-4000-8000-000000000001'),
  ('cc100013-0001-4000-8000-000000000002', now(), now(), '69000001-0001-4000-8000-000000000003')
ON CONFLICT DO NOTHING;

-- dsr_activity_log
INSERT INTO dsr_activity_log (id, created_at, updated_at, request_id)
VALUES
  ('cc100017-0001-4000-8000-000000000001', now(), now(), 'e83d370d-b23a-4486-8b3c-1c39d4fa0818'),
  ('cc100017-0001-4000-8000-000000000002', now(), now(), 'cc7c04d8-16ee-42a6-b607-8cf441be29fe')
ON CONFLICT DO NOTHING;

-- integration_sync_logs
INSERT INTO integration_sync_logs (id, created_at, updated_at, integration_id, sync_type, direction, started_at, completed_at, duration_ms, status, records_processed, records_succeeded, records_failed, records_skipped)
VALUES
  ('cc100016-0001-4000-8000-000000000001', now(), now(), '7f6bb2d2-0ba1-4712-ba00-141855dde355', 'full', 'inbound', now() - interval '1 hour', now(), 3600000, 'completed', 50, 48, 1, 1),
  ('cc100016-0001-4000-8000-000000000002', now(), now(), '728688de-121d-4abc-a3b6-46089ce94df7', 'incremental', 'outbound', now() - interval '30 minutes', now(), 1800000, 'completed', 30, 30, 0, 0)
ON CONFLICT DO NOTHING;

-- bank_transactions
INSERT INTO bank_transactions (id, created_at, updated_at, bank_account_id, transaction_date, description, amount, balance)
VALUES
  ('cc100018-0001-4000-8000-000000000001', now(), now(), '1aa06337-fe09-44b8-a4b8-4759e82b5deb', now() - interval '15 days', 'Dues deposit', 5000.00, 25000.00),
  ('cc100018-0001-4000-8000-000000000002', now(), now(), '733b8dd8-9834-412b-aeeb-39b743fe588f', now() - interval '15 days', 'Operating expense', -1200.00, 18000.00)
ON CONFLICT DO NOTHING;

-- policy_evaluations
INSERT INTO policy_evaluations (id, created_at, updated_at, rule_id)
VALUES
  ('cc100019-0001-4000-8000-000000000001', now(), now(), '9b29218f-2a69-40ec-a653-638df8b5eb01'),
  ('cc100019-0001-4000-8000-000000000002', now(), now(), '4598ee35-256e-4db9-9ac7-5186eac236f1')
ON CONFLICT DO NOTHING;

-- policy_exceptions
INSERT INTO policy_exceptions (id, created_at, updated_at, rule_id)
VALUES
  ('cc10001a-0001-4000-8000-000000000001', now(), now(), '9b29218f-2a69-40ec-a653-638df8b5eb01'),
  ('cc10001a-0001-4000-8000-000000000002', now(), now(), '4598ee35-256e-4db9-9ac7-5186eac236f1')
ON CONFLICT DO NOTHING;

-- automation_schedules
INSERT INTO automation_schedules (id, created_at, updated_at, schedule_type, rule_id)
VALUES
  ('cc100040-0001-4000-8000-000000000001', now(), now(), 'daily', 'bf5ab448-cad7-40b6-b994-10651ecfe577'),
  ('cc100040-0001-4000-8000-000000000002', now(), now(), 'weekly', '3fbcfbdb-4deb-4e3d-a5bb-c06339baa261')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Fixed enum values
-- ============================================================

-- commerce_invoices (status: issued/paid instead of confirmed/completed)
INSERT INTO commerce_invoices (id, entity_id, order_id, customer_id, ref, status, currency, subtotal, tax_total, total, amount_paid, amount_due, created_by)
VALUES
  ('cc00000c-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc000003-0001-4000-8000-000000000001', '5360b048-9a28-4edf-827f-1e7d59bba958', 'INV-CAPE-001', 'issued', 'CAD', 500.00, 65.00, 565.00, 0.00, 565.00, 'user_cape_01'),
  ('cc00000c-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc000003-0001-4000-8000-000000000002', 'd5fc028a-419c-4772-9901-0a698a3c4bbd', 'INV-CLC-001', 'paid', 'CAD', 750.00, 97.50, 847.50, 847.50, 0.00, 'user_clc_01')
ON CONFLICT DO NOTHING;

-- entity_roles (officer instead of treasurer)
INSERT INTO entity_roles (id, entity_id, person_id, role, start_date)
VALUES
  ('cc100008-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'a0000001-0001-4000-8000-000000000004', 'officer', '2024-01-01')
ON CONFLICT DO NOTHING;

-- tax_notices (Reassessment instead of T2S1)
INSERT INTO tax_notices (id, entity_id, tax_year_id, authority, notice_type, received_date)
VALUES
  ('cc100029-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc000002-0001-4000-8000-000000000002', 'CRA', 'Reassessment', '2024-05-01')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Fixed column names / FK references
-- ============================================================

-- journal_entry_lines (entry_id NOT NULL, not account_code)
INSERT INTO journal_entry_lines (id, created_at, updated_at, entry_id, journal_entry_id, description, debit, credit)
VALUES
  ('cc10000c-0001-4000-8000-000000000001', now(), now(), 'a497e932-2c39-469c-b23f-b193eb1b2321', 'a497e932-2c39-469c-b23f-b193eb1b2321', 'Cash debit', 1000.00, 0.00),
  ('cc10000c-0001-4000-8000-000000000002', now(), now(), 'dcccbfbe-9609-4761-876d-c337dd24960e', 'dcccbfbe-9609-4761-876d-c337dd24960e', 'Revenue credit', 0.00, 1500.00)
ON CONFLICT DO NOTHING;

-- clause_library_tags (clause_id → shared_clause_library, not cba_clauses)
INSERT INTO clause_library_tags (id, clause_id, tag_name, created_by)
VALUES
  ('cc10001e-0001-4000-8000-000000000001', 'd63c2725-0493-4c52-aa35-71111d2186ea', 'wages', 'user_cape_01'),
  ('cc10001e-0001-4000-8000-000000000002', 'cca4923d-c463-4c77-9988-b6ed49cc25e7', 'benefits', 'user_clc_01')
ON CONFLICT DO NOTHING;

-- evidence_pack_artifacts (document_id → documents, use real IDs)
INSERT INTO evidence_pack_artifacts (id, pack_id, document_id, artifact_id, artifact_type, retention_class)
VALUES
  ('cc100037-0001-4000-8000-000000000001', 'cc000007-0001-4000-8000-000000000001', 'd2100001-0001-4000-8000-000000000001', 'ART-CAPE-001', 'general', 'PERMANENT'),
  ('cc100037-0001-4000-8000-000000000002', 'cc000007-0001-4000-8000-000000000002', 'd2100001-0001-4000-8000-000000000002', 'ART-CLC-001', 'general', 'PERMANENT')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Cascading children of commerce_invoices (now seeded above)
-- ============================================================

-- commerce_invoice_lines
INSERT INTO commerce_invoice_lines (id, entity_id, invoice_id, description, quantity, unit_price, line_total)
VALUES
  ('cc10002b-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc00000c-0001-4000-8000-000000000001', 'Dues management - monthly', 1, 500.00, 500.00),
  ('cc10002b-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc00000c-0001-4000-8000-000000000002', 'Full platform suite', 1, 750.00, 750.00)
ON CONFLICT DO NOTHING;

-- commerce_credit_notes
INSERT INTO commerce_credit_notes (id, entity_id, invoice_id, ref, amount, reason)
VALUES
  ('cc10002c-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc00000c-0001-4000-8000-000000000001', 'CN-CAPE-001', 50.00, 'Billing adjustment'),
  ('cc10002c-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc00000c-0001-4000-8000-000000000002', 'CN-CLC-001', 75.00, 'Early payment discount')
ON CONFLICT DO NOTHING;

-- commerce_disputes
INSERT INTO commerce_disputes (id, entity_id, invoice_id, reason, description)
VALUES
  ('cc10002d-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc00000c-0001-4000-8000-000000000001', 'Overcharge', 'Billed for premium features not used'),
  ('cc10002d-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc00000c-0001-4000-8000-000000000002', 'Duplicate', 'Same invoice issued twice')
ON CONFLICT DO NOTHING;

-- commerce_payments (invoice_id → commerce_invoices)
INSERT INTO commerce_payments (id, entity_id, invoice_id, amount, method, paid_at)
VALUES
  ('cc10002e-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc00000c-0001-4000-8000-000000000001', 565.00, 'bank_transfer', now()),
  ('cc10002e-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc00000c-0001-4000-8000-000000000002', 847.50, 'credit_card', now())
ON CONFLICT DO NOTHING;

-- commerce_refunds (payment_id → commerce_payments, status enum: pending/processed/failed)
INSERT INTO commerce_refunds (id, entity_id, payment_id, invoice_id, amount, reason, status)
VALUES
  ('cc100039-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc10002e-0001-4000-8000-000000000001', 'cc00000c-0001-4000-8000-000000000001', 50.00, 'Partial refund for adjustment', 'processed'),
  ('cc100039-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc10002e-0001-4000-8000-000000000002', 'cc00000c-0001-4000-8000-000000000002', 75.00, 'Credit note refund', 'pending')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Done.
-- ============================================================
