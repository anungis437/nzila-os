#!/usr/bin/env bash
# Read Container App ingress and revisions. This script does not change
# traffic, labels, activation, or the database. Missing weights are preserved.
set -euo pipefail

APP_NAME="${1:?app name}"
RESOURCE_GROUP="${2:?resource group}"
OUTPUT_DIR="${3:?output directory}"
READ_PREFIX="${4:?read id prefix}"

mkdir -p "$OUTPUT_DIR"
OBSERVED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
READ_ID="${READ_PREFIX}-$(date -u +%Y%m%dT%H%M%SZ)-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-0}"

az containerapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" -o json > "$OUTPUT_DIR/containerapp.json"
az containerapp revision list --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" -o json > "$OUTPUT_DIR/revision-list.json"

jq -n \
  --arg readId "$READ_ID" \
  --arg observedAt "$OBSERVED_AT" \
  --slurpfile app "$OUTPUT_DIR/containerapp.json" \
  '{
    readId: $readId,
    observedAt: $observedAt,
    activeRevisionsMode: $app[0].properties.configuration.activeRevisionsMode,
    fqdn: $app[0].properties.configuration.ingress.fqdn,
    traffic: ($app[0].properties.configuration.ingress.traffic // [])
  }' > "$OUTPUT_DIR/ingress.json"

jq -n \
  --arg readId "${READ_ID}-revisions" \
  --arg observedAt "$OBSERVED_AT" \
  --slurpfile rows "$OUTPUT_DIR/revision-list.json" \
  '{
    readId: $readId,
    observedAt: $observedAt,
    revisions: (if ($rows[0] | type) == "array" then $rows[0] else ($rows[0].value // []) end)
  }' > "$OUTPUT_DIR/revisions.json"

printf '%s\n' "$READ_ID" > "$OUTPUT_DIR/read-id.txt"
