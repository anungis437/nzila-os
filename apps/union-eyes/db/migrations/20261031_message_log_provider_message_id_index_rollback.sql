-- Rollback for 20261031_message_log_provider_message_id_index.sql. Drops whichever index the forward migration created; no data changes.
DROP INDEX IF EXISTS uq_message_log_provider_message;
DROP INDEX IF EXISTS idx_message_log_provider_message_id;
