#!/usr/bin/env bash
# #1037: ephemeral PostgreSQL 16 proof that a transaction started before a
# newer committed head can still perform a valid, monotonic CAS after waiting.
# PostgreSQL now() is transaction-start time; clock_timestamp() is wall time.
# This is NOT independent DBA/rollback-witness or production certification.
set -euo pipefail
scratch="$(mktemp -d)"
early=""
cleanup() {
  if [[ -n "$early" ]]; then kill "$early" 2>/dev/null || true; fi
  rm -rf "$scratch"
}
trap cleanup EXIT

before="$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT revision=5 AND head_hash=repeat('5',64) FROM public.tool_fabric_trust_stream WHERE stream_id='platform:tool-fabric:trust'")"
if [[ "$before" != "t" ]]; then
  echo "Expected committed revision-5 fixture before timestamp-order proof" >&2
  exit 1
fi

# Start early transaction A but deliberately do not acquire the stream lock.
# B must commit revision 6 after A's transaction timestamp was fixed.
PGAPPNAME=nzila-trust-early-clock psql -X -v ON_ERROR_STOP=1 >"$scratch/early.log" 2>&1 <<'SQL' &
BEGIN;
SELECT now();
SELECT pg_sleep(8);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tool_fabric_trust_stream
    WHERE stream_id='platform:tool-fabric:trust'
      AND revision=6 AND head_hash=repeat('6',64)
      AND updated_at > now()
  ) THEN
    RAISE EXCEPTION 'Earlier transaction timestamp was not reproduced';
  END IF;
END;
$$;
SELECT revision FROM public.tool_fabric_trust_stream
WHERE stream_id='platform:tool-fabric:trust' FOR UPDATE;
INSERT INTO public.tool_fabric_trust_entry
  (stream_id,seq,audit_id,entry_hash,entry)
VALUES ('platform:tool-fabric:trust',7,
  '00000000-0000-4000-8000-000000000071',
  repeat('7',64),'{"seq":7}'::jsonb);
UPDATE public.tool_fabric_trust_stream
SET revision=7, head_hash=repeat('7',64),
    updated_at=GREATEST(clock_timestamp(),updated_at)
WHERE stream_id='platform:tool-fabric:trust'
  AND revision=6 AND head_hash=repeat('6',64);
SET CONSTRAINTS tool_fabric_receipt_requires_head IMMEDIATE;
COMMIT;
SQL
early=$!

ready=false
for _ in $(seq 1 80); do
  if ! kill -0 "$early" 2>/dev/null; then break; fi
  observed="$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_stat_activity WHERE application_name='nzila-trust-early-clock' AND state='active' AND query LIKE 'SELECT pg_sleep(%')")"
  if [[ "$observed" == "t" ]]; then ready=true; break; fi
  sleep 0.1
done
if [[ "$ready" != true ]]; then
  echo "Early transaction was not observed before later writer" >&2
  cat "$scratch/early.log" >&2
  exit 1
fi

# B commits the newer head while A is sleeping in an already-started tx.
psql -X -v ON_ERROR_STOP=1 >"$scratch/later.log" 2>&1 <<'SQL'
BEGIN;
INSERT INTO public.tool_fabric_trust_entry
  (stream_id,seq,audit_id,entry_hash,entry)
VALUES ('platform:tool-fabric:trust',6,
  '00000000-0000-4000-8000-000000000061',
  repeat('6',64),'{"seq":6}'::jsonb);
UPDATE public.tool_fabric_trust_stream
SET revision=6,head_hash=repeat('6',64),updated_at=clock_timestamp()
WHERE stream_id='platform:tool-fabric:trust'
  AND revision=5 AND head_hash=repeat('5',64);
SET CONSTRAINTS tool_fabric_receipt_requires_head IMMEDIATE;
COMMIT;
SQL

if ! wait "$early"; then
  echo "Earlier-started transaction could not commit a valid monotonic CAS" >&2
  cat "$scratch/early.log" "$scratch/later.log" >&2
  exit 1
fi
early=""

after="$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT
  s.revision=7 AND s.head_hash=repeat('7',64)
  AND (SELECT count(*) FROM public.tool_fabric_trust_entry e WHERE e.stream_id=s.stream_id)=7
  AND (SELECT count(*) FROM public.tool_fabric_trust_entry e WHERE e.stream_id=s.stream_id AND e.seq=6 AND e.entry_hash=repeat('6',64))=1
  AND (SELECT count(*) FROM public.tool_fabric_trust_entry e WHERE e.stream_id=s.stream_id AND e.seq=7 AND e.entry_hash=repeat('7',64))=1
  FROM public.tool_fabric_trust_stream s WHERE s.stream_id='platform:tool-fabric:trust'")"
if [[ "$after" != "t" ]]; then
  echo "SECURITY FAILURE: timestamp-order CAS left an inconsistent ledger" >&2
  exit 1
fi
echo "Ephemeral PostgreSQL timestamp-order CAS: older transaction, newer head, monotonic append"
