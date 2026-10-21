#!/usr/bin/env bash
# Read staging tenant-isolation evidence from PostgreSQL.
# Role attributes, ledger hashes, and the no-context denial count come from
# the database. An application HTTP response is not accepted by the caller.
set -euo pipefail

OUTPUT="${1:?output json}"
CANDIDATE_REVISION="${2:?candidate revision}"
RELEASE_SHA="${3:?release sha}"
FOUNDATION="${4:?UE_RLS_FOUNDATION_ENFORCED_STAGING value}"

if [ -z "${RLS_MIGRATION_ADMIN_DATABASE_URL:-}" ] || [ -z "${RLS_VERIFY_DATABASE_URL:-}" ]; then
  echo "RLS_MIGRATION_ADMIN_DATABASE_URL and RLS_VERIFY_DATABASE_URL are required" >&2
  exit 1
fi

ROLE_ROWS="$(psql "$RLS_MIGRATION_ADMIN_DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 \
  -c "SELECT COALESCE(json_agg(json_build_object('rolname', rolname, 'rolsuper', rolsuper, 'rolbypassrls', rolbypassrls)), '[]'::json) FROM pg_roles WHERE rolname IN ('union_eyes_runtime', 'union_eyes_system')")"
LEDGER_ROWS="$(psql "$RLS_MIGRATION_ADMIN_DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 \
  -c "SELECT COALESCE(json_agg(json_build_object('hash', hash)), '[]'::json) FROM drizzle.__drizzle_migrations")"

DENIAL_SQL="BEGIN; SELECT set_config('app.current_user_id', '', true); SELECT set_config('app.current_org_id', '', true); SELECT count(*) FROM grievances; ROLLBACK;"
set +e
LEAKED="$(psql "$RLS_VERIFY_DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -c "$DENIAL_SQL")"
DENIAL_STATUS=$?
set -e
if [ "$DENIAL_STATUS" -ne 0 ]; then
  echo "tenant-denial probe failed" >&2
  exit "$DENIAL_STATUS"
fi
LEAKED_NUMBER="$(printf '%s\n' "$LEAKED" | awk 'NF { value=$1 } END { print value }')"

FOUNDATION_VALUE=false
if [ "$FOUNDATION" = "true" ]; then
  FOUNDATION_VALUE=true
fi

jq -n \
  --argjson foundationValue "$FOUNDATION_VALUE" \
  --argjson roles "$ROLE_ROWS" \
  --argjson ledger "$LEDGER_ROWS" \
  --arg candidate "$CANDIDATE_REVISION" \
  --arg releaseSha "$RELEASE_SHA" \
  --arg command "$DENIAL_SQL" \
  --arg query "SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname IN ('union_eyes_runtime', 'union_eyes_system')" \
  --argjson leaked "$LEAKED_NUMBER" \
  '{
    foundation: {source:"github-environment-variable", name:"UE_RLS_FOUNDATION_ENFORCED_STAGING", value:$foundationValue},
    runtimeRoles: {source:"pg_roles", query:$query, rows:$roles},
    ledger: {source:"drizzle.__drizzle_migrations", rows:$ledger},
    tenantDenial: {source:"deployed-database", transport:"postgres", command:$command, exitCode:0, leakedRows:$leaked, candidateRevision:$candidate, releaseSha:$releaseSha, servingRevisionReached:false}
  }' > "$OUTPUT"
