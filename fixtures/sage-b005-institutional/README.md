# SAGE B-005 institutional fixtures (fictional)

**Boundary:** `FICTIONAL_ONLY` — no real institutions, persons, or credentials.

These fixtures bootstrap an **isolated** PostgreSQL used for local / staging B-005
qualification. They are not production seed data and do not authorize C1 or GO_LIVE.

## Contents

| File | Purpose |
|---|---|
| `bootstrap.json` | Machine-readable P01 / R01 / S01 / T01 identities, orgs, mandates, holdings, conflicts |
| `bootstrap.sql` | Idempotent SQL seed for `sage_workspace`, mandates, office holdings, conflict attestations |
| `rls-roles.sql` | Least-privilege role grants (`sage_app`, `sage_internal_exec`, `sage_recipient`) |
| `test-identities.json` | Expected permission matrix for authenticated HTTP smoke |

## Journeys covered

- **P01** — Alder Civic Services procurement (CAD 40k historic / 30k current)
- **R01** — Two regulators; no automatic inheritance after fictional merger
- **S01** — Secretariat succession; predecessor expired; successor mandate required
- **T01** — Executive accountability (CAD 80k, deliverable variance, adoption)

## Apply order (isolated DB only)

1. Apply SAGE migration chain (`pnpm sage:b005:migrations apply --url …`)
2. Apply `rls-roles.sql`
3. Apply `bootstrap.sql`
4. Run authenticated smoke / adversarial SQL suites

Do **not** apply against production.
