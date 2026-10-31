#!/usr/bin/env bash
# P0 #1037: EPHEMERAL PostgreSQL 16 contract, not production crash/PITR proof.
# Terminate a backend after INSERT but before COMMIT, then retry the same ID.
set -euo pipefail
app="tf_contract_abort_$$"
log="$(mktemp)"
writer=""
cleanup() {
  if [ -n "$writer" ] && kill -0 "$writer" 2>/dev/null; then
    kill "$writer" 2>/dev/null || true
    wait "$writer" 2>/dev/null || true
  fi
  rm -f "$log"
}
trap cleanup EXIT

# Previous contract step committed revision 4.
PGAPPNAME="$app" psql -X -v ON_ERROR_STOP=1 >"$log" 2>&1 <<'SQL' &
BEGIN;
INSERT INTO public.tool_fabric_trust_entry
  (stream_id,seq,audit_id,entry_hash,entry)
VALUES ('platform:tool-fabric:trust',5,
  '00000000-0000-4000-8000-000000000051',
  repeat('5',64),'{"seq":5}'::jsonb);
SELECT pg_sleep(45);
UPDATE public.tool_fabric_trust_stream
SET revision=5,head_hash=repeat('5',64),updated_at=now()
WHERE stream_id='platform:tool-fabric:trust'
  AND revision=4 AND head_hash=repeat('4',64);
COMMIT;
SQL
writer=$!
backend=""
for _ in $(seq 1 100); do
  backend="$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT pid FROM pg_catalog.pg_stat_activity WHERE application_name='$app' AND state='active' AND query LIKE 'SELECT pg_sleep(%' AND pid <> pg_backend_pid()")"
  if [[ "$backend" =~ ^[1-9][0-9]*$ ]]; then break; fi
  if ! kill -0 "$writer" 2>/dev/null; then cat "$log" >&2; exit 1; fi
  sleep 0.2
done
if ! [[ "$backend" =~ ^[1-9][0-9]*$ ]]; then
  echo "SECURITY FAILURE: uncommitted writer backend was not observed" >&2
  exit 1
fi
terminated="$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend($backend)")"
if [ "$terminated" != "t" ]; then
  echo "SECURITY FAILURE: writer termination was not confirmed" >&2
  exit 1
fi
if wait "$writer"; then
  writer=""
  echo "SECURITY FAILURE: terminated writer exited successfully" >&2
  exit 1
fi
writer=""
gone=false
for _ in $(seq 1 50); do
  count="$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_catalog.pg_stat_activity WHERE pid=$backend")"
  if [ "$count" = "0" ]; then gone=true; break; fi
  sleep 0.2
done
if [ "$gone" != true ]; then
  echo "SECURITY FAILURE: terminated backend remained active" >&2
  exit 1
fi
before="$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT
  s.revision=4 AND s.head_hash=repeat('4',64)
  AND (SELECT count(*) FROM public.tool_fabric_trust_entry e WHERE e.stream_id=s.stream_id)=4
  AND NOT EXISTS (SELECT 1 FROM public.tool_fabric_trust_entry e
    WHERE e.stream_id=s.stream_id AND
      (e.seq=5 OR e.audit_id='00000000-0000-4000-8000-000000000051'::uuid))
  FROM public.tool_fabric_trust_stream s
  WHERE s.stream_id='platform:tool-fabric:trust'")"
if [ "$before" != "t" ]; then
  echo "SECURITY FAILURE: terminated transaction left a partial durable write" >&2
  exit 1
fi

# Retry the same audit_id on a fresh connection, forcing deferred checks.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
INSERT INTO public.tool_fabric_trust_entry
  (stream_id,seq,audit_id,entry_hash,entry)
VALUES ('platform:tool-fabric:trust',5,
  '00000000-0000-4000-8000-000000000051',
  repeat('5',64),'{"seq":5}'::jsonb);
UPDATE public.tool_fabric_trust_stream
SET revision=5,head_hash=repeat('5',64),updated_at=now()
WHERE stream_id='platform:tool-fabric:trust'
  AND revision=4 AND head_hash=repeat('4',64);
SET CONSTRAINTS tool_fabric_receipt_requires_head IMMEDIATE;
COMMIT;
SQL
after="$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT
  s.revision=5 AND s.head_hash=repeat('5',64)
  AND (SELECT count(*) FROM public.tool_fabric_trust_entry e WHERE e.stream_id=s.stream_id)=5
  AND (SELECT count(*) FROM public.tool_fabric_trust_entry e
    WHERE e.stream_id=s.stream_id AND e.seq=5
      AND e.audit_id='00000000-0000-4000-8000-000000000051'::uuid
      AND e.entry_hash=repeat('5',64))=1
  FROM public.tool_fabric_trust_stream s
  WHERE s.stream_id='platform:tool-fabric:trust'")"
if [ "$after" != "t" ]; then
  echo "SECURITY FAILURE: retry did not commit exactly one receipt" >&2
  exit 1
fi
echo "PASS: backend termination aborted in-flight receipt; fresh-session retry committed once (ephemeral only)"
