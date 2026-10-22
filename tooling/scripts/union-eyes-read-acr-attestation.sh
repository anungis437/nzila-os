#!/usr/bin/env bash
# Read an ACR image digest and the OCI config labels that ACR stored.
# The expected source SHA is not written into the label field.
set -euo pipefail

ACR_NAME="${1:?acr name}"
REPOSITORY="${2:?repository}"
DIGEST="${3:?digest}"
OUTPUT="${4:?output json}"

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

az acr repository show --name "$ACR_NAME" --image "${REPOSITORY}@${DIGEST}" -o json > "$WORKDIR/show.json"
TOKEN="$(az acr login --name "$ACR_NAME" --expose-token --query accessToken -o tsv)"
curl -fsS \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Accept: application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json" \
  "https://${ACR_NAME}.azurecr.io/v2/${REPOSITORY}/manifests/${DIGEST}" > "$WORKDIR/manifest.json"
CONFIG_DIGEST="$(jq -r '.config.digest' "$WORKDIR/manifest.json")"
curl -fsS \
  -H "Authorization: Bearer ${TOKEN}" \
  "https://${ACR_NAME}.azurecr.io/v2/${REPOSITORY}/blobs/${CONFIG_DIGEST}" > "$WORKDIR/config.json"

jq -n \
  --slurpfile show "$WORKDIR/show.json" \
  --slurpfile config "$WORKDIR/config.json" \
  '{
    source: "acr",
    digest: $show[0].digest,
    tags: ($show[0].tags // []),
    labels: ($config[0].config.Labels // $config[0].Labels // null)
  }' > "$OUTPUT"
