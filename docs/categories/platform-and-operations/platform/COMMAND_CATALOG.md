# Command Catalog

## Purpose

This catalog reduces script fatigue by grouping high-value commands into predictable operator workflows.

## Fast Paths

| Goal | Command |
|---|---|
| Validate typical PR quality quickly | `pnpm check:core` |
| Run full governance gate stack | `pnpm check:governance` |
| Generate governance-ready artifacts | `pnpm check:release-readiness` |
| Generate strategic quarterly telemetry report | `pnpm strategic:quarterly` |
| Print grouped command help in terminal | `pnpm help:commands` |

## Grouped Workflows

### Core Engineering

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:changed`
- `pnpm check:core`

### Governance and Compliance

- `pnpm validate:governance`
- `pnpm validate:governance:gate`
- `pnpm validate:evidence:lifecycle`
- `pnpm check:governance`

### Release and Risk Control

- `pnpm verify:security`
- `pnpm coverage:dashboard`
- `pnpm strategic:quarterly`
- `pnpm check:release-readiness`

## Notes

- This file is documentation only; script definitions remain in `package.json`.
- Add new scripts to one of the groups above to keep discoverability high.
