# Flow — Staging Data Seeding Guide

## Overview

Instructions for populating the Flow staging database with realistic seed data
for testing, demos, and QA validation.

## Prerequisites

- Database access to the staging PostgreSQL instance.
- Staging environment variables configured (`DATABASE_URL`).
- Node.js and pnpm available locally, or access to the staging container.

## Seed Data

### Customers

| Name | Email | Company | Type |
|------|-------|---------|------|
| Marie Dupont | marie@example.com | Boutique Marie | Retail |
| Jean Kabila | jean@example.com | Kabila Enterprises | Wholesale |
| Amara Diallo | amara@example.com | Diallo Import/Export | Distribution |

### Products

| SKU | Name | Category | Unit Price |
|-----|------|----------|------------|
| PROD-001 | Wax Print Fabric (1m) | Textiles | 25.00 |
| PROD-002 | Embroidered Dashiki | Apparel | 85.00 |
| PROD-003 | Handwoven Basket | Crafts | 45.00 |
| PROD-004 | Shea Butter (500g) | Cosmetics | 18.00 |
| PROD-005 | Ankara Tote Bag | Accessories | 35.00 |

### Sample Orders

- **Order 1**: Marie Dupont — 3× PROD-001 + 1× PROD-002 → `confirmed`
- **Order 2**: Jean Kabila — 10× PROD-004 + 5× PROD-003 → `fulfilled`
- **Order 3**: Amara Diallo — 2× PROD-005 → `created` (pending payment)

### Vendors

| Name | Specialty | Location |
|------|-----------|----------|
| Atelier Bamako | Textiles | Bamako, Mali |
| Kinshasa Crafts Co. | Handmade goods | Kinshasa, DRC |
| Dakar Design Studio | Apparel | Dakar, Senegal |

## Running the Seed Script

> **Preferred (since April 2026)**: use the unified
> [`@nzila/staging-seed`](../../../tooling/staging-seed/README.md) framework:
>
> ```bash
> # From the repository root — runs the registered Flow seeder against staging
> pnpm seed:staging --app=flow --profile=demo-standard
> ```
>
> The framework writes synthetic Flow data into `staging_seed_artifacts`
> (JSONB) and reports counts via the shared seed reporter.

The legacy `pnpm flow:seed-staging` / `pnpm flow:reset-staging` commands and
the SQL fallback below are kept only for ad-hoc command-bus exercise (they
dispatch through the Flow command-bus rather than the seed framework).

```bash
# Legacy: command-bus exerciser (kept for command-bus debugging)
pnpm --filter @nzila/flow seed:staging

# Or manually with a SQL file
psql "$DATABASE_URL" < apps/flow/seeds/staging.sql
```

## Verification

After seeding, verify the data:

```sql
SELECT count(*) FROM customers;   -- Expected: 3
SELECT count(*) FROM products;    -- Expected: 5
SELECT count(*) FROM orders;      -- Expected: 3
SELECT count(*) FROM vendors;     -- Expected: 3
```

Check the application UI:
1. Log in to Flow on staging.
2. Navigate to Customers — confirm 3 entries.
3. Navigate to Products — confirm 5 entries.
4. Navigate to Orders — confirm 3 entries in expected states.

## Resetting Staging Data

```bash
# Preferred: framework reset (clears staging_seed_artifacts + re-runs seeder)
pnpm reset:staging --app=flow

# Legacy command-bus path (kept for ad-hoc command-bus debugging)
pnpm --filter @nzila/flow reset:staging
```

Or manually:

```sql
TRUNCATE production_jobs, order_line_items, orders,
         quote_line_items, quotes, customers, products, vendors
CASCADE;
```

Then re-run the seed script.

## Related Docs

- [SHOPMOICA-DEMO-FLOW.md](SHOPMOICA-DEMO-FLOW.md) — Demo walkthrough
- [RUNBOOK.md](RUNBOOK.md) — Operational procedures
