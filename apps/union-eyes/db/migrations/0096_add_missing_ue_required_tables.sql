-- 0096: Add missing required UE tables for union-structure/member-segmentation parity
-- Safe/idempotent migration for staging reconciliation.

BEGIN;

CREATE TABLE IF NOT EXISTS org_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  category text NOT NULL,
  key text NOT NULL,
  value jsonb,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_configurations_org_cat_key
  ON org_configurations (organization_id, category, key);
CREATE INDEX IF NOT EXISTS idx_org_configurations_org
  ON org_configurations (organization_id);

CREATE TABLE IF NOT EXISTS org_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  storage_used_bytes integer NOT NULL DEFAULT 0,
  document_count integer NOT NULL DEFAULT 0,
  api_call_count integer NOT NULL DEFAULT 0,
  last_calculated_at timestamptz DEFAULT now(),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_usage_org_period
  ON org_usage (organization_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_org_usage_org
  ON org_usage (organization_id);

CREATE TABLE IF NOT EXISTS committee_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  title varchar(500) NOT NULL,
  meeting_date timestamptz NOT NULL,
  end_time timestamptz,
  location text,
  virtual_link text,
  status text NOT NULL DEFAULT 'scheduled',
  agenda text,
  agenda_items jsonb,
  minutes text,
  minutes_approved_by text,
  minutes_approved_at timestamptz,
  quorum_met boolean,
  attendee_count integer DEFAULT 0,
  external_attendees jsonb,
  decisions jsonb,
  next_meeting_date timestamptz,
  attachment_ids jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text,
  updated_by text
);

CREATE INDEX IF NOT EXISTS idx_committee_meetings_committee
  ON committee_meetings (committee_id);
CREATE INDEX IF NOT EXISTS idx_committee_meetings_organization
  ON committee_meetings (organization_id);
CREATE INDEX IF NOT EXISTS idx_committee_meetings_date
  ON committee_meetings (meeting_date);
CREATE INDEX IF NOT EXISTS idx_committee_meetings_status
  ON committee_meetings (status);

CREATE TABLE IF NOT EXISTS committee_meeting_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL,
  member_id text NOT NULL,
  attended boolean NOT NULL DEFAULT false,
  arrived_late boolean DEFAULT false,
  left_early boolean DEFAULT false,
  proxy text,
  regrets boolean DEFAULT false,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_meeting_attendees_meeting
  ON committee_meeting_attendees (meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_member
  ON committee_meeting_attendees (member_id);

CREATE TABLE IF NOT EXISTS committee_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id uuid NOT NULL,
  meeting_id uuid,
  organization_id uuid NOT NULL,
  title varchar(500) NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  priority text NOT NULL DEFAULT 'medium',
  assigned_to text,
  due_date date,
  completed_at timestamptz,
  completed_by text,
  resolution text,
  carried_from_meeting_id uuid,
  carry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text,
  updated_by text
);

CREATE INDEX IF NOT EXISTS idx_committee_action_items_committee
  ON committee_action_items (committee_id);
CREATE INDEX IF NOT EXISTS idx_committee_action_items_meeting
  ON committee_action_items (meeting_id);
CREATE INDEX IF NOT EXISTS idx_committee_action_items_status
  ON committee_action_items (status);
CREATE INDEX IF NOT EXISTS idx_committee_action_items_assigned
  ON committee_action_items (assigned_to);
CREATE INDEX IF NOT EXISTS idx_committee_action_items_due
  ON committee_action_items (due_date);
CREATE INDEX IF NOT EXISTS idx_committee_action_items_org
  ON committee_action_items (organization_id);

CREATE TABLE IF NOT EXISTS committee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  document_id uuid,
  meeting_id uuid,
  title varchar(500) NOT NULL,
  file_url text,
  file_type text,
  file_size integer,
  category varchar(100),
  created_at timestamptz DEFAULT now(),
  uploaded_by text
);

CREATE INDEX IF NOT EXISTS idx_committee_documents_committee
  ON committee_documents (committee_id);
CREATE INDEX IF NOT EXISTS idx_committee_documents_meeting
  ON committee_documents (meeting_id);
CREATE INDEX IF NOT EXISTS idx_committee_documents_category
  ON committee_documents (category);
CREATE INDEX IF NOT EXISTS idx_committee_documents_org
  ON committee_documents (organization_id);

CREATE TABLE IF NOT EXISTS committee_intelligence_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  committee_id uuid,
  title varchar(500) NOT NULL,
  summary text NOT NULL,
  key_themes jsonb,
  positions jsonb,
  recommendations jsonb,
  source_meeting_ids jsonb,
  source_committee_ids jsonb,
  period_start timestamptz,
  period_end timestamptz,
  generated_at timestamptz DEFAULT now(),
  generated_by text,
  model varchar(100)
);

CREATE INDEX IF NOT EXISTS idx_committee_intel_org
  ON committee_intelligence_snapshots (organization_id);
CREATE INDEX IF NOT EXISTS idx_committee_intel_committee
  ON committee_intelligence_snapshots (committee_id);
CREATE INDEX IF NOT EXISTS idx_committee_intel_period
  ON committee_intelligence_snapshots (period_start, period_end);

COMMIT;
