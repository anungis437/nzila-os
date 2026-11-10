# Change Records

This directory contains version-controlled change records for the Nzila OS platform.

Each file represents a single change record in JSON format, named by its change ID
(e.g., `CHG-2026-0001.json`).

## Change Lifecycle

1. **PROPOSED** — Change is drafted
2. **UNDER_REVIEW** — Approvals in progress
3. **APPROVED** — All required approvals obtained
4. **SCHEDULED** — Window confirmed
5. **IMPLEMENTING** — Deployment in progress
6. **COMPLETED / FAILED / ROLLED_BACK** — Terminal state
7. **CLOSED** — PIR completed (if required)

## Creating a Change Record

Use the seed script for demo records:

```bash
pnpm change:seed-demo
```

## Validation

CI/CD pipelines validate change records before deployment:

```bash
pnpm change:validate --env=STAGING --service=web
```

## Internal staging during solo-founder operation

For an internal synthetic-data staging change, the accountable Nzila founder may approve the bounded deployment directly. `anungis` and `anungis437` belong to one person: two accounts must not be counted as two independent human reviewers. A fictitious change board, security department or employee is not required for this operational decision.

The authorization must identify its exact non-production scope, candidate, technical gates and provenance. OIDC, image digest attestations, Azure what-if drift, tenant isolation, rollback, real runtime qualification and production boundaries remain mandatory. Client, employee, contractual or legal requirements may justify later segregation. The current targeted exception is `CHG-2026-0114` with its founder authorization record.
