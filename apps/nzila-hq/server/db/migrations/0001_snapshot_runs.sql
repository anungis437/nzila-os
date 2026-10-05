-- Reserve one complete snapshot batch per UTC day without rewriting history.
CREATE TABLE IF NOT EXISTS hq_snapshot_runs (
  snapshot_day date PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Preserve the one-batch-per-day invariant for snapshots captured before rollout.
INSERT INTO hq_snapshot_runs (snapshot_day)
SELECT DISTINCT (captured_at AT TIME ZONE 'UTC')::date FROM hq_metrics_snapshots
ON CONFLICT (snapshot_day) DO NOTHING;
