# Repo Root Cleanup Archive (2026-05-22)

This archive contains high-confidence diagnostic artifacts moved from the repository root.

## Scope

- Root-level audit outputs
- Root-level temporary logs and output dumps
- Root-level hidden temporary/copilot/codex logs
- Root-level coverage artifact
- Root-level temporary output directories (second conservative pass)

## Buckets

- audits/ (6 files)
- logs/ (28 files)
- outputs/ (9 files)
- hidden-temp/ (14 files)
- coverage/ (1 file)

## Directory Relocation (Second Pass)

The following root directories were relocated to `directories/` because they are generated output with no tracked files:

- coverage_html/
- demo-output/
- logs/
- test-results/
- tmp-art/
- tmp-e2e-report/
- tmp-gov-report/

## Safety Rules Used

- Only obvious generated artifacts were moved.
- Product docs, source files, manifests, and config were not relocated.
- Moves were collision-safe (timestamp suffix if destination existed).
