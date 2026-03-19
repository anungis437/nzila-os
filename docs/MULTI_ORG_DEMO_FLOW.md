# Multi-Org Demo Flow

> Demonstrates how to run Flow with two fully-configured demo orgs.

## Quick Start

```bash
pnpm --filter @nzila/flow demo:seed
```

This runs `lib/demoSeed.ts` which seeds **both** demonstration orgs into the
database with full configuration, customers, and example quotes.

## Seeded Organisations

### ShopMoiCa Demo Corp

| Attribute | Value |
|-----------|-------|
| Org ID | `11111111-1111-1111-1111-111111111111` |
| Currency | CAD |
| Locale | en-CA |
| Tax | GST 5% + QST 9.975% (compounding) |
| Quote Prefix | SQ |
| Deposit | 30%, required before production |
| Supplier Strategy | BALANCED (quality 0.3, lead 0.3, cost 0.4) |
| Markup | FIXED_PERCENT 40% |
| Brand Colour | `#ef4444` (red) |
| Users | admin@shopmoica.demo, sales@shopmoica.demo, finance@shopmoica.demo, viewer@shopmoica.demo |
| Customers | 5 (Acme, Maple, Pinnacle, Echo, Atlas) |
| Quotes | 7 (DRAFT through CLOSED with full lifecycle) |

### PromoNorth Inc.

| Attribute | Value |
|-----------|-------|
| Org ID | `22222222-2222-2222-2222-222222222222` |
| Currency | USD |
| Locale | en-US |
| Tax | NY Sales Tax 8.875% |
| Quote Prefix | PN |
| Deposit | 50%, required before production |
| Supplier Strategy | LOWEST_COST (cost weight 0.6) |
| Markup | TIERED (budget 1.25×, standard 1.5×, premium 2.0×) |
| Brand Colour | `#0ea5e9` (blue) |
| Users | admin@promonorth.com, sales@promonorth.com |
| Customers | 3 (Acme Corp, GlobalTech, NYC Design Co) |
| Quotes | 3 (DRAFT, SENT_TO_CLIENT, ACCEPTED) |

## What Gets Seeded

1. **Org config** — All 7 configuration tables (`commerceOrgSettings`, `commerceOrgQuotePolicies`, etc.) receive rows for both orgs via `seedOrgConfig()`.

2. **Customers** — Inserted into `commerceCustomers` with `orgId` isolation.

3. **Quotes + lines** — Each quote includes line items with correct tax calculation per org jurisdiction.

4. **Timeline events** — ShopMoiCa quotes include lifecycle timeline events (status transitions, comments).

## Switching Orgs in Development

The active org is determined by Clerk's `auth().orgId`. To test a specific org:

1. In Clerk Dashboard, create two test organizations matching the seeded org IDs.
2. Switch organizations in the Clerk-managed org switcher to change context.
3. All data reads, settings, and operations will resolve via the active org's config.

## Verifying the Seed

After seeding, queries against each org return isolated, correctly-configured data:

```sql
-- Verify ShopMoiCa config
SELECT * FROM commerce_org_settings WHERE org_id = '11111111-1111-1111-1111-111111111111';

-- Verify PromoNorth config
SELECT * FROM commerce_org_settings WHERE org_id = '22222222-2222-2222-2222-222222222222';

-- Count quotes per org
SELECT org_id, count(*) FROM commerce_quotes GROUP BY org_id;
```
