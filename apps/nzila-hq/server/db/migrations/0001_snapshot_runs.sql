-- Reserve one complete snapshot batch per UTC day without rewriting history.
CREATE TABLE IF NOT EXISTS hq_snapshot_runs (
  snapshot_day date PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
