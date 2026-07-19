-- SAGE Phase 8A.1 – invitation-secret destruction lifecycle
-- Terminal messages retain safe operational metadata only. The encrypted invitation
-- token/address payload is destroyed immediately once a provider accepts it or the
-- message reaches the terminal dead-letter state. Retryable messages remain pending
-- with ciphertext until their next permitted attempt.

-- Allow the fenced terminal transition to clear encrypted invitation material.
drop trigger if exists trg_sage_notification_outbox_immutable on sage_notification_outbox;
create trigger trg_sage_notification_outbox_immutable
  before update on sage_notification_outbox
  for each row
  execute function assert_immutable_except(
    'status', 'dispatch_owner', 'lease_expires_at', 'attempt_count',
    'provider_message_id', 'provider_request_id', 'last_error_code',
    'last_error_message', 'next_attempt_at', 'dead_lettered_at',
    'dispatched_at', 'payload_destroyed_at', 'encrypted_payload'
  );

-- Existing terminal records can no longer be retried, so remove their invitation
-- secrets on migration as well. Error and provider metadata remain for restricted
-- operational reconciliation.
update sage_notification_outbox
  set encrypted_payload = '',
      payload_destroyed_at = coalesce(payload_destroyed_at, now())
  where status in ('dispatched', 'dead_letter')
    and encrypted_payload <> '';
