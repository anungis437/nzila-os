# DEMO_SANDBOX_P0

Synthetic external-specialist sandbox for NZ-007. Disposition is **DEMO_CONFIGURED**. `AUTH_START_WORKAID=NO`. `WORKAID_STARTED=NO`. No counterpart credentials. No Fleet send. No practice-system connector.

## Load personas (EC-007-06)

Four roles, emails on `@persona.demo.invalid` only:

| Role | Email | Password env var (value not in git) |
|---|---|---|
| External specialist | patel.rowan@persona.demo.invalid | `DEMO_SANDBOX_EXTERNAL_SPECIALIST_PASSWORD` |
| Institutional admin | morgan.ellis@persona.demo.invalid | `DEMO_SANDBOX_INSTITUTIONAL_ADMIN_PASSWORD` |
| Union viewer | casey.nguyen@persona.demo.invalid | `DEMO_SANDBOX_UNION_VIEWER_PASSWORD` |
| Member | jordan.blake@persona.demo.invalid | `DEMO_SANDBOX_MEMBER_PASSWORD` |

Put password values in a local demo vault or shell env. Do not email them. The loader prints variable names only and is idempotent (fixed ids):

```bash
pnpm exec tsx apps/union-eyes-demo/scripts/load-sandbox-personas.ts
```

The journey page does not require those passwords. Open:

`/en-CA/dashboard/external-specialist`

in the union-eyes-demo app (`pnpm --filter @nzila/union-eyes-demo dev`).

## What the seed contains (EC-007-01)

Existing grant shapes only (`representation_authorities`, `external_matter_access_grants`, `external_document_access_grants`). One matter, one read grant, one document grant, and a second document with no grant so it stays hidden. Generic labels: External specialist, Matter, Document grant.

Set `DEMO_SANDBOX_REQUIRE_HANDOFF_ACK=0` to let an offered package count as active in the specialist queue. The default requires `ACCEPTED_VIEW` first (EC-007-02).

## Tests

```bash
pnpm --filter @nzila/union-eyes exec vitest run lib/demo-sandbox/__tests__/nz007-p0-grants.test.ts app/api/external/__tests__/external-routes.test.ts
pnpm --filter @nzila/union-eyes-demo exec vitest run lib/demo/sandbox/__tests__/sandbox-p0.test.ts
```

## Acceptance coverage

| Contract | Covered |
|---|---|
| EC-007-06 | Four persona seeds, demo domain, load guide, no password values, no counterpart issuance |
| EC-007-01 | Allow/deny on existing evaluators and `/api/external` document route; specialist steps entry → matter → allowed docs → blocked → next action; hidden title omitted; disposition `DEMO_CONFIGURED` |
| EC-007-05 | Banner text; partnership-agreed / Clio-integrated / PROVEN WSIB rewritten; projection stays free of those phrases |
| EC-007-02 | OFFERED, ACCEPTED_VIEW, RETURNED, AWAITING_EXTERNAL, REJECTED, CLARIFY; package tied to the representation grant; queue waits for acknowledgement unless configured otherwise; access ≠ responsibility copy |

EC-007-03 and EC-007-04 are not in this slice. `AWAITING_EXTERNAL` is a handoff label only.
