-- SAGE Phase 8A.1 – Notification Outbox
-- Durable invitation notification with encrypted payload recovery

create table if not exists sage_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  
  -- Idempotency and deduplication
  message_id text not null unique,
  org_id text not null,
  workspace_id text not null,
  
  -- Foreign keys
  delivery_request_id text not null,
  grant_id uuid not null references sage_delivery_grant (id),
  recipient_id text not null,
  
  -- Notification provider and template
  provider text not null,
  template text not null,
  recipient_address_hash text not null,
  
  -- Encrypted payload: contains invitation token + recipient email + claim URL template
  -- Stored as enc:v1:iv:ciphertext:tag (identical to qbo-token-crypto.ts format)
  -- Plaintext contains: { invitationToken: string, recipientEmail: string, claimUrlTemplate: string, expiresAt: string }
  -- NEVER plaintext, ONLY encrypted
  encrypted_payload text not null,
  
  -- Encryption key reference (for key rotation)
  encryption_key_reference text not null default 'sage-notification:v1',
  
  -- Dispatch lease (identical to sage_audit_outbox pattern)
  status text not null default 'pending',
  dispatch_owner text,
  lease_expires_at timestamp with time zone,
  attempt_count integer not null default 0,
  max_retries integer not null default 5,
  
  -- Provider idempotency tracking
  provider_message_id text,
  provider_request_id text,
  
  -- Error tracking
  last_error_code text,
  last_error_message text,
  
  -- Timestamps
  created_at timestamp with time zone not null,
  dispatched_at timestamp with time zone,
  payload_destroyed_at timestamp with time zone,
  
  -- RLS
  constraint org_workspace_fk foreign key (org_id, workspace_id) references sage_workspace (org_id, id),
  constraint recipient_fk foreign key (recipient_id, workspace_id, org_id) references sage_delivery_recipient (id, workspace_id, org_id),
  constraint valid_status check (status in ('pending', 'dispatching', 'dispatched', 'failed')),
  constraint lease_guard check (
    (status = 'pending' and dispatch_owner is null and lease_expires_at is null)
    or
    (status = 'dispatching' and dispatch_owner is not null and lease_expires_at is not null)
    or
    (status in ('dispatched', 'failed') and dispatch_owner is not null and lease_expires_at is not null)
  )
);

create index idx_sage_notification_outbox_status_lease on sage_notification_outbox (
  status,
  lease_expires_at,
  created_at,
  id
) where status = 'pending' or (status = 'dispatching' and lease_expires_at < now());

create index idx_sage_notification_outbox_grant on sage_notification_outbox (
  grant_id,
  org_id,
  workspace_id
);

create index idx_sage_notification_outbox_provider_message on sage_notification_outbox (
  provider,
  provider_message_id
) where provider_message_id is not null;

-- Append-only trigger: prevent updates except status/dispatch_owner/lease_expires_at/attempt_count
create trigger trg_sage_notification_outbox_immutable
  before update on sage_notification_outbox
  for each row
  execute function assert_immutable_except(
    'status',
    'dispatch_owner',
    'lease_expires_at',
    'attempt_count',
    'provider_message_id',
    'provider_request_id',
    'last_error_code',
    'last_error_message',
    'dispatched_at',
    'payload_destroyed_at'
  );

alter table sage_notification_outbox enable row level security;

create policy sage_notification_outbox_rls on sage_notification_outbox
  using (org_id = current_setting('app.tenant_id'))
  with check (org_id = current_setting('app.tenant_id'));
