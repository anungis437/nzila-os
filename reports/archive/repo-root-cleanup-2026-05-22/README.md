# Repo Root Cleanup Archive (2026-05-22)

This archive contains high-confidence diagnostic artifacts moved from the repository root.

## Scope

- Root-level audit outputs
- Root-level temporary logs and output dumps
- Root-level hidden temporary/copilot/codex logs
- Root-level coverage artifact

## Buckets

- audits/ (6 files)
- logs/ (28 files)
- outputs/ (9 files)
- hidden-temp/ (14 files)
- coverage/ (1 file)

## Safety Rules Used

- Only obvious generated artifacts were moved.
- Product docs, source files, manifests, and config were not relocated.
- Moves were collision-safe (timestamp suffix if destination existed).
