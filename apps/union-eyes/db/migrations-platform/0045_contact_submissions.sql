-- PLATFORM_SQL 0045_contact_submissions
--
-- The public contact form recorded a submission only in the CRM, so an unconfigured or failing CRM refused every visitor and a
-- successful one left no local evidence of what was submitted or when. contact_submissions is the local record: the submission is
-- stored first, then synchronised to the CRM, and crm_status says which of pending, recorded or failed it reached. The visitor is
-- acknowledged only once the local record exists.
--
-- Anonymous personal data, so it is bounded and time-limited: every text column has a length limit, the message is capped, and
-- retain_until (default two years from receipt) states when the row is due for deletion. The table is platform-wide, not tenant
-- data (no organization column); access is the system role only (cache migration 0036). Idempotent. Registered UNQUALIFIED. Not
-- applied here; native PostgreSQL execution is READY_FOR_VS_EXECUTION.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  first_name varchar(100) NOT NULL,
  last_name varchar(100),
  email varchar(254) NOT NULL,
  organization varchar(200),
  role varchar(100),
  inquiry_type varchar(100),
  message varchar(2000),
  crm_status varchar(20) NOT NULL DEFAULT 'pending',
  crm_contact_id varchar(100),
  crm_deal_id varchar(100),
  crm_synced_at timestamptz,
  retain_until timestamptz NOT NULL DEFAULT (now() + interval '2 years'),
  CONSTRAINT contact_submissions_crm_status_check CHECK (crm_status IN ('pending', 'recorded', 'failed'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS contact_submissions_received_idx ON public.contact_submissions (received_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS contact_submissions_retention_idx ON public.contact_submissions (retain_until);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS contact_submissions_unsynced_idx ON public.contact_submissions (received_at) WHERE crm_status <> 'recorded';