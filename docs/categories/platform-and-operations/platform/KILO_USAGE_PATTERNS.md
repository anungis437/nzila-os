# Kilo Usage Patterns

This repository already uses Kilo metadata under `.kilo/`.

## What Exists

- `.kilo/agent-manager.json` — tracks Kilo-managed worktrees and sessions.
- `.kilo/worktrees/` — Kilo-created working directories.
- `.kilo/.gitignore` — keeps local Kilo state out of source control.

## Team Conventions

1. Treat `.kilo/` as local runtime state, not product source code.
2. Do not commit generated worktree/session state from `.kilo/worktrees/`.
3. Keep feature work in normal git branches; Kilo worktrees are execution helpers.
4. If a Kilo worktree is abandoned, clean it up from Kilo tooling before deleting folders manually.
5. Keep branch naming consistent between git and Kilo sessions for traceability.

## Daily Workflow

1. Create or attach to a Kilo worktree.
2. Implement and validate changes in that worktree.
3. Commit to the intended git branch.
4. Push branch and open PR.
5. Close session and clean stale worktrees.

## Troubleshooting

- If Kilo metadata is stale (session points to missing path), refresh through Kilo's own commands/UI first.
- If git shows unexpected paths under `.kilo/worktrees/`, verify `.kilo/.gitignore` and repo root `.gitignore` entries.

## Related Docs

- [Contributing Guide](../../CONTRIBUTING.md)
- [Package Ownership Matrix](./PACKAGE_OWNERSHIP_MATRIX.md)
- [App Lifecycle Process](./APP_LIFECYCLE_PROCESS.md)
