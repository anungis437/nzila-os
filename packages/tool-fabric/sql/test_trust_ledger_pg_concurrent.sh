#!/usr/bin/env bash
# P0 #1037: ephemeral PostgreSQL 16 concurrency proof only.
# Requires the committed rev=2 fixtures from test_trust_ledger_pg_durable.sql.
# This does NOT attest host roles, an independent witness, PITR or production.
set -euo pipefail

scratch="$(mktemp -d)"
writer_a=""
writer_b=""
cleanup() {
  if [[ -n "$writer_a" ]]; then kill "$writer_a" 2>/dev/null || true; fi
  if [[ -n "$writer_b" ]]; then kill "$writer_b" 2>/dev/null || true; fi
  rm -rf "$scratch"
}
trap cleanup EXIT

initial="$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT revision = 2 AND head_hash = repeat('2',64) FROM tool_fabric_trust_stream WHERE stream_id = 'platform:tool-fabric:trust'")"
if [[ "$initial" != "t" ]]; then
  echo "Expected committed revision-2 fixture before concurrency proof" >&2
  exit 1
fi

# Writer A obtains the same exclusive stream lock as the TypeScript CAS
# adapter, holds it long enough for B to block, then commits one receipt.
PGAPPNAME=nzila-trust-writer-a psql -X -v ON_ERROR_STOP=1 >"$scratch/a.log" 2>&1 <<'SQL' &
BEGIN;
SELECT revision FROM tool_fabric_trust_stream
  WHERE stream_id='platform:tool-fabric:trust' FOR UPDATE;
SELECT pg_sleep(8);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tool_fabric_trust_stream
      WHERE stream_id='platform:tool-fabric:trust'
        AND revision=2 AND head_hash=repeat('2',64)) THEN
    RAISE EXCEPTION 'Writer A lost its expected head';
  END IF;
END;
$$;
INSERT INTO tool_fabric_trust_entry(stream_id,seq,audit_id,entry_hash,entry)
VALUES ('platform:tool-fabric:trust',3,'00000000-0000-4000-8000-000000000031',
        repeat('3',64),'{"seq":3}'::jsonb);
UPDATE tool_fabric_trust_stream
  SET revision=3,head_hash=repeat('3',64),updated_at=now()
  WHERE stream_id='platform:tool-fabric:trust' AND revision=2 AND head_hash=repeat('2',64);
COMMIT;
SQL
writer_a=$!

# Confirm A is actually sleeping while holding its row lock.
a_ready=false
for _ in $(seq 1 60); do
  if ! kill -0 "$writer_a" 2>/dev/null; then break; fi
  observed="$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name='nzila-trust-writer-a' AND state='active' AND query LIKE 'SELECT pg_sleep(%')")"
  if [[ "$observed" == "t" ]]; then a_ready=true; break; fi
  sleep 0.1
done
if [[ "$a_ready" != true ]]; then
  echo "Writer A never held the expected test lock" >&2
  cat "$scratch/a.log" >&2
  exit 1
fi

# Writer B begins with the same expected rev=2. Once A commits, B must
# observe rev=3 under FOR UPDATE and reject its stale expected head.
PGAPPNAME=nzila-trust-writer-b psql -X -v ON_ERROR_STOP=1 >"$scratch/b.log" 2>&1 <<'SQL' &
BEGIN;
SELECT revision FROM tool_fabric_trust_stream
  WHERE stream_id='platform:tool-fabric:trust' FOR UPDATE;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tool_fabric_trust_stream
      WHERE stream_id='platform:tool-fabric:trust'
        AND revision=2 AND head_hash=repeat('2',64)) THEN
    RAISE EXCEPTION 'stale expected trust head' USING ERRCODE='40001';
  END IF;
END;
$$;
INSERT INTO tool_fabric_trust_entry(stream_id,seq,audit_id,entry_hash,entry)
VALUES ('platform:tool-fabric:trust',3,'00000000-0000-4000-8000-000000000032',
        repeat('4',64),'{"seq":3}'::jsonb);
UPDATE tool_fabric_trust_stream
  SET revision=3,head_hash=repeat('4',64),updated_at=now()
  WHERE stream_id='platform:tool-fabric:trust' AND revision=2 AND head_hash=repeat('2',64);
COMMIT;
SQL
writer_b=$!

# Prove real overlap: B must be waiting on A's PostgreSQL row lock.
b_waited=false
for _ in $(seq 1 60); do
  observed="$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name='nzila-trust-writer-b' AND wait_event_type='Lock')")"
  if [[ "$observed" == "t" ]]; then b_waited=true; break; fi
  if ! kill -0 "$writer_b" 2>/dev/null; then break; fi
  sleep 0.1
done
if [[ "$b_waited" != true ]]; then
  echo "No independently observed concurrent PostgreSQL row-lock contention" >&2
  cat "$scratch/a.log" "$scratch/b.log" >&2
  exit 1
fi

if ! wait "$writer_a"; then
  echo "Writer A did not commit its atomic receipt/head update" >&2
  cat "$scratch/a.log" >&2
  exit 1
fi
writer_a=""
if wait "$writer_b"; then
  echo "SECURITY FAILURE: stale writer B committed" >&2
  exit 1
fi
writer_b=""
if ! grep -Fq 'stale expected trust head' "$scratch/b.log"; then
  echo "Writer B failed for an unexpected reason, not the stale CAS guard" >&2
  cat "$scratch/b.log" >&2
  exit 1
fi

final="$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT s.revision=3 AND s.head_hash=repeat('3',64) AND
  (SELECT count(*) FROM tool_fabric_trust_entry e WHERE e.stream_id=s.stream_id)=3 AND
  (SELECT count(*) FROM tool_fabric_trust_entry e WHERE e.stream_id=s.stream_id AND e.seq=3 AND e.entry_hash=repeat('3',64))=1 AND
  (SELECT count(*) FROM tool_fabric_trust_entry e WHERE e.audit_id='00000000-0000-4000-8000-000000000032')=0
  FROM tool_fabric_trust_stream s WHERE s.stream_id='platform:tool-fabric:trust'")"
if [[ "$final" != "t" ]]; then
  echo "SECURITY FAILURE: concurrent CAS left inconsistent or orphaned receipts" >&2
  exit 1
fi
echo "Ephemeral PostgreSQL concurrent CAS: one committed writer, stale writer denied, no orphan"
