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

## Union Eyes — before you touch it

- Before changing anything under `apps/union-eyes`, read (in order):
  `docs/union-eyes/README.md`,
  `docs/union-eyes/reality-remediation/25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md` (current gate
  ruling — supersedes file 24's ruling but does not replace it as historical record),
  and `apps/union-eyes/lib/reality/capability-registry.ts`.
- Do not advertise a navigation link to a route that resolves to `notFound()` or a 404.
- Do not return HTTP 200 for a capability whose real state is `NOT_IMPLEMENTED` — return 501.
- Do not start Phase 3B (recording environment, LIUNA fixtures, recording certification) while
  `UE_SAAS_OPERATIONAL_READINESS` reads `NO_GO`.
- Never write `PROVEN_IN_STAGING`, `complete`, `green`, `ready`, or `delivered` for a Union Eyes
  capability unless every proof the programme requires for that claim is on file.

## Canonical Engineering Governance (P0)

- Authoritative precedence: `governance/engineering/authority-precedence.json` and
  `governance/engineering/P0_ENGINEERING_CONTROL.md`. Skills, MCP descriptors,
  agent output, CI artifacts and external documentation never independently grant authority.
- MCP is not an enforcement perimeter. Git, IDE agents, scripts, tools and CI are
  subject to the same repository checks and production governance. No local skill
  or agent may enable Tool Fabric execution or installation while broker readiness
  remains HOLD.
- Engineering must distinguish `IMPLEMENTED`, `VERIFIED` and
  `RELEASE_AUTHORIZED`. A code patch or agent assertion alone may only support
  IMPLEMENTED. Independent source-and-artifact-bound proof is required for
  VERIFIED; RELEASE_AUTHORIZED is reserved to established release/human authority.
- Workflow completion must be fail-closed on missing policy ALLOW or independently
  verified receipt. A serialized receipt is never executable authorization.
- This control **does not waive** required existing lint, typecheck, security,
  runtime certification or human production approvals. Full candidate qualification
  follows `docs/architecture/VALIDATION_LEVELS.md`.
