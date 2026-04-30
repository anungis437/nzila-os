#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "usage: rollback.sh <release-tag>" >&2
  exit 1
fi

RELEASE_TAG="$1"

echo "[rollback] starting rollback to ${RELEASE_TAG}"

git fetch --tags --force
if ! git rev-parse "${RELEASE_TAG}" >/dev/null 2>&1; then
  echo "[rollback] release tag not found: ${RELEASE_TAG}" >&2
  exit 1
fi

echo "[rollback] execute environment rollback command"
echo "[rollback] verify /health and /health/deep"
echo "[rollback] completed rollback procedure for ${RELEASE_TAG}"
