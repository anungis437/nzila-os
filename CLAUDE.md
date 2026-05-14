# Nzila OS - gstack Usage Policy (Pilot)

This repository uses gstack in optional pilot mode.

## Scope

- gstack is supported for planning, implementation reviews, QA, and security review.
- gstack is not required for merge eligibility during pilot mode.
- Human maintainers remain responsible for architecture, risk acceptance, and production decisions.

## Allowed Commands During Pilot

- `/office-hours`
- `/autoplan`
- `/plan-ceo-review`
- `/plan-eng-review`
- `/plan-design-review`
- `/plan-devex-review`
- `/review`
- `/devex-review`
- `/design-review`
- `/qa-only`
- `/investigate`
- `/cso`
- `/retro`

## Restricted Commands During Pilot

Use of these commands is restricted unless a maintainer explicitly requests them in the active PR or issue:

- `/ship`
- `/land-and-deploy`
- `/canary`
- `/setup-deploy`
- `/setup-gbrain`
- `/sync-gbrain`
- `/gstack-upgrade`

## Safety Rules

- Never bypass branch protections or governance gates.
- Never force-push to protected branches.
- Never use destructive git or database operations without explicit human approval.
- Keep edits scoped to the requested change.
- Run existing repository checks before requesting review.

## Required Validation Before PR Review

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:fast`
- `pnpm validate:docs`
- `pnpm governance:audit`

## Pilot Exit Criteria

gstack moves from optional to required only if maintainers confirm:

- PR cycle time improves without quality regression.
- Required checks remain stable or improve.
- Post-merge rollback or hotfix frequency does not increase.
- Documentation and governance drift do not increase.
