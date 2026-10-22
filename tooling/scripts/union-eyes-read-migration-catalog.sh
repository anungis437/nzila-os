#!/usr/bin/env bash
# Read migration-role attributes and the scoped migration ledger.
# SELECT only. Missing role attributes are left missing; they are not
# defaulted to false.
set -euo pipefail

OUTPUT_DIR="${1:?output directory}"
mkdir -p "$OUTPUT_DIR"

if [ -z "${RLS_MIGRATION_ADMIN_DATABASE_URL:-}" ]; then
  echo "RLS_MIGRATION_ADMIN_DATABASE_URL is required" >&2
  exit 1
fi

ROLE_JSON="$(psql "$RLS_MIGRATION_ADMIN_DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 \
  -c "SELECT json_build_object('rolname', rolname, 'rolsuper', rolsuper, 'rolbypassrls', rolbypassrls, 'rolcanlogin', rolcanlogin) FROM pg_roles WHERE rolname = current_user")"
jq -n \
  --argjson row "$ROLE_JSON" \
  '{
    source: "pg_roles",
    query: "SELECT rolname, rolsuper, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname = current_user",
    currentUser: $row.rolname,
    rows: [$row]
  }' > "$OUTPUT_DIR/role-catalog.json"

LEDGER_JSON="$(psql "$RLS_MIGRATION_ADMIN_DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 \
  -c "SELECT COALESCE(json_agg(json_build_object('hash', hash)), '[]'::json) FROM drizzle.__drizzle_migrations")"
jq -n --argjson rows "$LEDGER_JSON" '{source:"drizzle.__drizzle_migrations", rows:$rows}' > "$OUTPUT_DIR/ledger.json"
