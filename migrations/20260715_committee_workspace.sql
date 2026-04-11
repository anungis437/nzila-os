-- =====================================================================================
-- MIGRATION: Committee Workspace
-- =====================================================================================
-- Adds meeting minutes repository, action items, document linkage, and
-- cross-committee intelligence synthesis for internal and external committees.
-- =====================================================================================

BEGIN;

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE committee_scope AS ENUM (
  'internal',
  'external',
  'national',
  'joint'
);

CREATE TYPE committee_meeting_status AS ENUM (
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'postponed'
);

CREATE TYPE committee_action_item_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'deferred',
  'cancelled'
);

CREATE TYPE committee_action_item_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

-- ── Extend committees table ───────────────────────────────────────────────────

ALTER TABLE committees
  ADD COLUMN IF NOT EXISTS scope committee_scope DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS external_participants jsonb;

COMMENT ON COLUMN committees.scope IS 'internal = union subcommittee, external = outside stakeholders, national = UMCC/NLMCC, joint = union-management';
COMMENT ON COLUMN committees.external_participants IS 'Array of {name, organization, role} for external/national committees';

-- ── committee_meetings ────────────────────────────────────────────────────────

CREATE TABLE committee_meetings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id  uuid NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Meeting Details
  title         varchar(500) NOT NULL,
  meeting_date  timestamptz NOT NULL,
  end_time      timestamptz,
  location      text,
  virtual_link  text,
  status        committee_meeting_status NOT NULL DEFAULT 'scheduled',

  -- Agenda
  agenda        text,
  agenda_items  jsonb,

  -- Minutes
  minutes                text,
  minutes_approved_by    text REFERENCES profiles(user_id),
  minutes_approved_at    timestamptz,

  -- Attendance summary
  quorum_met      boolean,
  attendee_count  integer DEFAULT 0,

  -- External participants (for external/national committees)
  external_attendees jsonb,

  -- Key decisions & outcomes
  decisions jsonb,

  -- Next meeting reference
  next_meeting_date timestamptz,

  -- Attachments
  attachment_ids jsonb,

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text REFERENCES profiles(user_id),
  updated_by text REFERENCES profiles(user_id)
);

CREATE INDEX idx_committee_meetings_committee ON committee_meetings(committee_id);
CREATE INDEX idx_committee_meetings_organization ON committee_meetings(organization_id);
CREATE INDEX idx_committee_meetings_date ON committee_meetings(meeting_date);
CREATE INDEX idx_committee_meetings_status ON committee_meetings(status);

-- ── committee_meeting_attendees ───────────────────────────────────────────────

CREATE TABLE committee_meeting_attendees (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES committee_meetings(id) ON DELETE CASCADE,
  member_id  text NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,

  -- Attendance
  attended     boolean NOT NULL DEFAULT false,
  arrived_late boolean DEFAULT false,
  left_early   boolean DEFAULT false,
  proxy        text,
  regrets      boolean DEFAULT false,

  notes text,

  UNIQUE(meeting_id, member_id)
);

CREATE INDEX idx_meeting_attendees_meeting ON committee_meeting_attendees(meeting_id);
CREATE INDEX idx_meeting_attendees_member ON committee_meeting_attendees(member_id);

-- ── committee_action_items ────────────────────────────────────────────────────

CREATE TABLE committee_action_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id    uuid NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
  meeting_id      uuid REFERENCES committee_meetings(id) ON DELETE SET NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Item details
  title       varchar(500) NOT NULL,
  description text,
  status      committee_action_item_status NOT NULL DEFAULT 'pending',
  priority    committee_action_item_priority NOT NULL DEFAULT 'medium',

  -- Assignment
  assigned_to text REFERENCES profiles(user_id),
  due_date    date,

  -- Resolution
  completed_at timestamptz,
  completed_by text REFERENCES profiles(user_id),
  resolution   text,

  -- Carry-forward tracking
  carried_from_meeting_id uuid REFERENCES committee_meetings(id) ON DELETE SET NULL,
  carry_count             integer DEFAULT 0,

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text REFERENCES profiles(user_id),
  updated_by text REFERENCES profiles(user_id)
);

CREATE INDEX idx_committee_action_items_committee ON committee_action_items(committee_id);
CREATE INDEX idx_committee_action_items_meeting ON committee_action_items(meeting_id);
CREATE INDEX idx_committee_action_items_status ON committee_action_items(status);
CREATE INDEX idx_committee_action_items_assigned ON committee_action_items(assigned_to);
CREATE INDEX idx_committee_action_items_due ON committee_action_items(due_date);
CREATE INDEX idx_committee_action_items_org ON committee_action_items(organization_id);

-- ── committee_documents ───────────────────────────────────────────────────────

CREATE TABLE committee_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id    uuid NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Document reference
  document_id uuid,
  meeting_id  uuid REFERENCES committee_meetings(id) ON DELETE SET NULL,

  -- For standalone files
  title     varchar(500) NOT NULL,
  file_url  text,
  file_type text,
  file_size integer,

  -- Classification
  category varchar(100),

  -- Metadata
  created_at  timestamptz DEFAULT now(),
  uploaded_by text REFERENCES profiles(user_id)
);

CREATE INDEX idx_committee_documents_committee ON committee_documents(committee_id);
CREATE INDEX idx_committee_documents_meeting ON committee_documents(meeting_id);
CREATE INDEX idx_committee_documents_category ON committee_documents(category);
CREATE INDEX idx_committee_documents_org ON committee_documents(organization_id);

-- ── committee_intelligence_snapshots ──────────────────────────────────────────

CREATE TABLE committee_intelligence_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  committee_id    uuid REFERENCES committees(id) ON DELETE CASCADE,

  -- Intelligence content
  title           varchar(500) NOT NULL,
  summary         text NOT NULL,
  key_themes      jsonb,
  positions       jsonb,
  recommendations jsonb,

  -- Sources
  source_meeting_ids  jsonb,
  source_committee_ids jsonb,
  period_start        timestamptz,
  period_end          timestamptz,

  -- Metadata
  generated_at timestamptz DEFAULT now(),
  generated_by text REFERENCES profiles(user_id),
  model        varchar(100)
);

CREATE INDEX idx_committee_intel_org ON committee_intelligence_snapshots(organization_id);
CREATE INDEX idx_committee_intel_committee ON committee_intelligence_snapshots(committee_id);
CREATE INDEX idx_committee_intel_period ON committee_intelligence_snapshots(period_start, period_end);

COMMIT;
