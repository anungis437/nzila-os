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
# `az acr login --expose-token` labels the returned ACR refresh token as
# `accessToken`. A refresh token cannot authenticate registry API requests
# directly; exchange it for a repository-scoped pull token first.
REFRESH_TOKEN="$(az acr login --name "$ACR_NAME" --expose-token --query accessToken -o tsv)"
TOKEN="$(curl -fsS -X POST "https://${ACR_NAME}.azurecr.io/oauth2/token" \
  --data-urlencode 'grant_type=refresh_token' \
  --data-urlencode "service=${ACR_NAME}.azurecr.io" \
  --data-urlencode "scope=repository:${REPOSITORY}:pull" \
  --data-urlencode "refresh_token=${REFRESH_TOKEN}" | jq -er '.access_token')"
# Docker on current runner images pushes an OCI image index (the image plus a
# BuildKit attestation manifest), and a digest-pinned upstream mirror keeps the
# upstream index. Accept single manifests and indexes. For an index, the
# attested digest stays the index digest that will be deployed; the labels are
# read from its single linux/amd64 image manifest (the platform Container Apps
# runs). Zero or several candidates fail closed.
MANIFEST_ACCEPT="application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json"
fetch_manifest() {
  curl -fsS \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Accept: ${MANIFEST_ACCEPT}" \
    "https://${ACR_NAME}.azurecr.io/v2/${REPOSITORY}/manifests/$1"
}
fetch_manifest "$DIGEST" > "$WORKDIR/manifest.json"
PLATFORM_DIGEST="$(bash "$(dirname "${BASH_SOURCE[0]}")/union-eyes-select-image-manifest.sh" "$WORKDIR/manifest.json")"
if [ -n "$PLATFORM_DIGEST" ]; then
  fetch_manifest "$PLATFORM_DIGEST" > "$WORKDIR/platform-manifest.json"
  mv "$WORKDIR/platform-manifest.json" "$WORKDIR/manifest.json"
fi
CONFIG_DIGEST="$(jq -er '.config.digest' "$WORKDIR/manifest.json")"
curl -fsSL \
  -H "Authorization: Bearer ${TOKEN}" \
  "https://${ACR_NAME}.azurecr.io/v2/${REPOSITORY}/blobs/${CONFIG_DIGEST}" > "$WORKDIR/config.json"

jq -n \
  --slurpfile show "$WORKDIR/show.json" \
  --slurpfile config "$WORKDIR/config.json" \
  --arg platformDigest "$PLATFORM_DIGEST" \
  '{
    source: "acr",
    digest: $show[0].digest,
    platformManifestDigest: (if $platformDigest == "" then null else $platformDigest end),
    tags: ($show[0].tags // []),
    labels: ($config[0].config.Labels // $config[0].Labels // null)
  }' > "$OUTPUT"
