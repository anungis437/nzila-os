#!/usr/bin/env bash
# Open or close one runner-scoped PostgreSQL firewall rule and record the result.
# close exits non-zero when deletion fails. It does not hide that failure.
set -euo pipefail

ACTION="${1:?open or close}"
SERVER="${2:?server}"
RESOURCE_GROUP="${3:?resource group}"
RULE="${4:?rule name}"
IP="${5:-}"
EVIDENCE="${6:?evidence file}"

mkdir -p "$(dirname "$EVIDENCE")"

if [ "$ACTION" = "open" ]; then
  if [ -z "$IP" ]; then
    echo "runner IP is required to open a firewall rule" >&2
    exit 1
  fi
  az postgres flexible-server firewall-rule create \
    --server-name "$SERVER" \
    --resource-group "$RESOURCE_GROUP" \
    --name "$RULE" \
    --start-ip-address "$IP" \
    --end-ip-address "$IP" >/dev/null
  jq -n \
    --arg rule "$RULE" --arg server "$SERVER" --arg resourceGroup "$RESOURCE_GROUP" \
    '{action:"open", rule:$rule, server:$server, resourceGroup:$resourceGroup, created:true}' \
    > "$EVIDENCE"
  exit 0
fi

if [ "$ACTION" != "close" ]; then
  echo "action must be open or close" >&2
  exit 2
fi

set +e
az postgres flexible-server firewall-rule delete \
  --server-name "$SERVER" \
  --resource-group "$RESOURCE_GROUP" \
  --name "$RULE" \
  --yes >/dev/null
status=$?
set -e
jq -n \
  --arg rule "$RULE" --arg server "$SERVER" --arg resourceGroup "$RESOURCE_GROUP" \
  --argjson exitCode "$status" \
  '{action:"close", rule:$rule, server:$server, resourceGroup:$resourceGroup, deleted:($exitCode == 0), exitCode:$exitCode}' \
  > "$EVIDENCE"
exit "$status"
