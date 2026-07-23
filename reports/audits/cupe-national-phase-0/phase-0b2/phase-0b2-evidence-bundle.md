# Phase 0B.2 §18 — Evidence Bundle

Branch: `fix/union-eyes-phase0b-clean` @ 4d6f63511 (working tree; not yet committed)
Worktree: `C:\APPS\nzila-automation-phase0b-clean`
Evidence root: `reports/audits/cupe-national-phase-0/phase-0b2/`

## Evidence documents (this phase)

| § | Document                                                                              | Purpose                                                       |
|---|---------------------------------------------------------------------------------------|---------------------------------------------------------------|
| 2 | `phase-0b2-architecture-approval.md`                                                  | Option D governed-hybrid architecture decision                |
| 3 | `phase-0b2-branch-discipline.md`                                                      | Clean-branch provenance & worktree isolation                  |
| 4 | (in §5 doc)                                                                           | Ownership classification of 125 tables                        |
| 5 | `phase-0b2-ownership-manifest.md`                                                     | Manifest schema, enum values, validator design                |
| 6 | `phase-0b2-foundational-slice.md`                                                     | 13-table foundational slice (orgs + KPI)                      |
| 7 | `phase-0b2-django-schema-strategy.md`                                                 | `db_table='union_eyes.<n>'` + `managed=False` adoption pattern|
| 14| `phase-0b2-clean-db-composition.md`                                                   | Clean-DB replay proof (0000..0039 + Django + healers)         |
| 15| `phase-0b2-existing-db-upgrade.md`                                                    | Idempotency + data preservation + contract enforcement        |
| 13| `phase-0b2-code-reconstruction.md`                                                    | Path-extraction of platform-tenant.ts DB adapter              |
| 16| `phase-0b2-test-evidence.md`                                                          | Unit test PASS matrix (resolver + DB adapter + validator)     |
| 17| `phase-0b2-validation.md`                                                             | Gate matrix (typecheck/docs/governance/test:fast) + side-fix  |
| 18| `phase-0b2-evidence-bundle.md`                                                        | This document                                                 |
| 20| `phase-0b2-closure.md`                                                                | Written in §20                                                |
| 21| `phase-0b2-final-report.md`                                                           | Written in §21                                                |

Logs subdirectory: `reports/audits/cupe-national-phase-0/phase-0b2/logs/` — transcripts from
composition/upgrade drivers.

## Source artefacts (this phase)

### Database migrations
| File                                                                                             | Owner    | Section |
|--------------------------------------------------------------------------------------------------|----------|---------|
| `packages/db/drizzle/0038_organization_cross_schema_contract.sql`                                | Drizzle  | §10     |
| `packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql`                                    | Drizzle  | §12     |
| `apps/union-eyes/backend/auth_core/migrations/0003_move_organizations_to_union_eyes.py`          | Django   | §8      |
| `apps/union-eyes/backend/auth_core/migrations/0004_adopt_platform_organization_members.py`       | Django   | §9      |
| `apps/union-eyes/backend/billing/migrations/0002_adopt_platform_stripe_webhook_events.py`        | Django   | §9      |

### Django ORM contract updates
| File                                                | Change                                                                             |
|-----------------------------------------------------|------------------------------------------------------------------------------------|
| `apps/union-eyes/backend/auth_core/models.py`       | `db_table='union_eyes"."organizations'`; `organization_members` state-adopted      |
| `apps/union-eyes/backend/billing/models.py`         | `stripe_webhook_events` state-adopted with `managed=False`                         |

### Application/type layer
| File                                                                       | Section |
|----------------------------------------------------------------------------|---------|
| `packages/platform-org-resolver/` (whole package: src + tests + configs)   | §11     |
| `packages/ue-cognition/src/schema.ts` (schema + text-id migration)         | §12     |
| `apps/union-eyes/lib/organizations/platform-tenant.ts` (DB adapter)        | §13     |
| `apps/union-eyes/lib/__tests__/platform-tenant.test.ts` (adapter tests)    | §13/§16 |

### Tooling & manifests
| File                                                              | Section  |
|-------------------------------------------------------------------|----------|
| `scripts/audit/build-phase0b2-ownership-manifest.py`              | §4       |
| `packages/db/schema-ownership-manifest.json` (125 tables)         | §5       |
| `tooling/checks/schema-ownership-validate.ts`                     | §5       |
| `tooling/checks/phase0b2-compose.ps1`                             | §14      |
| `tooling/checks/phase0b2-upgrade.ps1`                             | §15      |

### Test infrastructure
| File                                                    | Change                                             |
|---------------------------------------------------------|----------------------------------------------------|
| `vitest.config.ts` (root)                               | Added `platform-org-resolver` to `projects` array  |
| `packages/platform-org-resolver/vitest.config.ts`       | `defineProject`, name `'platform-org-resolver'`    |
| `pnpm-lock.yaml`                                        | vitest bump for resolver package                   |

### Unrelated side-fix (disclosed in §17)
| File                                    | Change                                                       |
|-----------------------------------------|--------------------------------------------------------------|
| `packages/cupe-vocabulary/package.json` | Exports rewrote from `./dist/*.js` → `./src/*.ts` (no build)  |

### Regenerated audit artefacts (governance:audit + validate:docs output)
- `docs/documentation-index.md`
- `docs/ops/ownership-registry.md`
- `docs/ops/release-governance/release-governance-audit.md`
- `reports/doc-consistency.{json,md}`
- `reports/documentation-index.json`
- `reports/ownership-registry.json`
- `reports/release-governance-audit.json`
- `reports/release-secret-audit.json`
- `reports/repo-excellence-audit.{json,md}`

### Ledger amendment
- `reports/audits/cupe-national-phase-ledger.md` — Phase 0B.2 closure line added in §20.

## Prior-work commits already present on this branch (informational)

- `4d6f63511` Phase 0A.1: closure docs + phase ledger amendment (GREEN)
- `163196bd3` Phase 0A.1: empty-DB replay evidence + tracking-table witness
- `7d69b32c2` Phase 0A.1: heal historical migration lineage (0034/0035/0036/0037 healers)
- `58bcd6a9d` phase-0a(audit): close PH0-OPEN-001 AMBER, register PH0-FIX-003/004
- `a910229d2` phase-0a(evidence): capture runner proof logs
- `19cf5f4a6` phase-0a(runner): two-phase lifecycle + reconciliation + partial-failure allowlist
- `3cf990bc8` phase-0a(db): checked-in bootstrap baseline
- `7b60f7d2c` chore(cupe-national): Phase 0 governed platform migration runner + lineage-gap diagnosis
- `2349d497b` chore(cupe-national): Phase 0 baseline stabilization

Additionally, the worktree carries pre-staged **Phase 0B.1** evidence prepared before this section began.
Those files (under `reports/audits/cupe-national-phase-0/phase-0b1/`, `phase-0b-validation-summary.md`, and
`scripts/audit/build-phase0b1-collision-inventory.py`) will land as the first commit in §19 alongside the
Phase 0B.2 commits, since they are part of the same PR context on this branch.

## What is NOT in this bundle

- No route wiring / no `apps/union-eyes/app/**` route changes — deferred to Phase 0C.
- No `git cherry-pick` from historical branches — code reconstruction was path-extraction only (§13).
- No deployment, no CUPE scenario graduation, no Phase 0C/0D/1 planning.
- No force-push, no branch reset, no rewriting pushed history.

## Cross-references

- Architecture ledger:   `reports/audits/cupe-national-phase-ledger.md`
- Phase 0B.1 evidence:   `reports/audits/cupe-national-phase-0/phase-0b1/`
- Phase 0A closure:      `reports/audits/cupe-national-phase-0/` (top level)
- Session progress:      internal `/memories/session/phase-0b2-progress.md`
