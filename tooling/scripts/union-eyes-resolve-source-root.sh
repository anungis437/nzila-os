#!/usr/bin/env bash
# Resolve the tree whose SQL, journal, and executor bytes are hashed.
# A different application SHA is fetched into a detached worktree. The
# workflow checkout that contains this script is left in place.
set -euo pipefail

WORKFLOW_SHA="${1:?workflow sha}"
APP_SHA="${2:?application source sha}"
OUT="${3:?output env file}"
SOURCE_ROOT="${GITHUB_WORKSPACE:?workspace is required}"

if [ "$APP_SHA" != "$WORKFLOW_SHA" ]; then
  git fetch --depth 1 origin "$APP_SHA"
  SOURCE_ROOT="${RUNNER_TEMP:-/tmp}/application-source-${APP_SHA}"
  if [ ! -d "$SOURCE_ROOT/.git" ]; then
    git worktree add --detach "$SOURCE_ROOT" "$APP_SHA"
  fi
fi

printf 'WORKFLOW_SHA=%s\nAPPLICATION_SOURCE_SHA=%s\nSOURCE_ROOT=%s\n' \
  "$WORKFLOW_SHA" "$APP_SHA" "$SOURCE_ROOT" > "$OUT"
