---
title: Command Catalog
description: High-value operational commands grouped by workflow for faster execution and lower script fatigue.
category: Technical
order: 6
date: 2026-04-16
---

## Purpose

This catalog reduces script fatigue by grouping high-value commands into predictable workflows.

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

## Source of Truth

This public summary mirrors the maintained catalog in `docs/platform/COMMAND_CATALOG.md`.
