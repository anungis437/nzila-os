-- ExecutiveOS Learning Loop
-- Persistent recommendation memory + feedback + outcomes + priority snapshots.
-- All tables are platform-scoped (reference platform orgs.id).

CREATE TABLE IF NOT EXISTS executive_recommendations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES orgs(id),
    dedupe_key varchar(256) NOT NULL,
    source_agent varchar(64) NOT NULL,
    source_run_id uuid,
    source_action_id uuid,
    kind varchar(16) NOT NULL,
    domains jsonb NOT NULL DEFAULT '[]'::jsonb,
    title text NOT NULL,
    narrative text NOT NULL,
    rank_score real NOT NULL,
    rank_bucket varchar(16) NOT NULL,
    rank_explanation jsonb NOT NULL DEFAULT '[]'::jsonb,
    confidence real NOT NULL DEFAULT 0.5,
    reversibility real NOT NULL DEFAULT 0.5,
    estimated_value_cad numeric(18,2),
    owner varchar(128),
    evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
    status varchar(24) NOT NULL DEFAULT 'open',
    first_seen_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    closed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS executive_recommendations_org_dedupe_idx
    ON executive_recommendations (org_id, dedupe_key);
CREATE INDEX IF NOT EXISTS executive_recommendations_org_status_idx
    ON executive_recommendations (org_id, status, rank_score);
CREATE INDEX IF NOT EXISTS executive_recommendations_org_kind_idx
    ON executive_recommendations (org_id, kind, rank_bucket);
CREATE INDEX IF NOT EXISTS executive_recommendations_org_agent_idx
    ON executive_recommendations (org_id, source_agent);

CREATE TABLE IF NOT EXISTS executive_recommendation_feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id uuid NOT NULL REFERENCES executive_recommendations(id) ON DELETE CASCADE,
    actor_id varchar(128) NOT NULL,
    verdict varchar(24) NOT NULL,
    note text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS executive_recommendation_feedback_rec_idx
    ON executive_recommendation_feedback (recommendation_id, created_at);
CREATE INDEX IF NOT EXISTS executive_recommendation_feedback_verdict_idx
    ON executive_recommendation_feedback (verdict);

CREATE TABLE IF NOT EXISTS executive_recommendation_outcomes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id uuid NOT NULL REFERENCES executive_recommendations(id) ON DELETE CASCADE,
    outcome varchar(24) NOT NULL,
    realized_value_cad numeric(18,2),
    days_to_resolve integer,
    notes text,
    recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS executive_recommendation_outcomes_rec_idx
    ON executive_recommendation_outcomes (recommendation_id, recorded_at);
CREATE INDEX IF NOT EXISTS executive_recommendation_outcomes_class_idx
    ON executive_recommendation_outcomes (outcome);

CREATE TABLE IF NOT EXISTS executive_priority_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES orgs(id),
    snapshot_at timestamptz NOT NULL DEFAULT now(),
    top_ranked jsonb NOT NULL DEFAULT '[]'::jsonb,
    metrics jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS executive_priority_snapshots_org_time_idx
    ON executive_priority_snapshots (org_id, snapshot_at);
