# SaaS Enablement Architecture

> **Package**: `@nzila/platform-commerce-org`
> **Status**: Phase 13 — All phases complete

## Overview

Shop Quoter was migrated from a single-client ShopMoiCa-specific application
to an **org-native, multi-org commerce configuration platform**. Every
previously-hardcoded value is now resolved at runtime from per-org database
records, with compile-time type safety enforced through Zod schemas and strict
TypeScript.

## Architectural Principles

| Principle | Implementation |
|-----------|---------------|
| **Org isolation** | Every query/mutation includes `orgId`; composite `(orgId, configType)` keys enforce uniqueness |
| **Backward compatibility** | `getOrg*()` functions fall back to `SHOPMOICA_*` defaults when no DB row exists |
| **Zero runtime console** | All diagnostics routed through `@nzila/os-core/telemetry` structured logger |
| **Auditable mutations** | Every `upsert*()` returns an `OrgConfigChangeEvent`; events are emitted to `PlatformEventBus` |
| **Policy-gated** | Sensitive field changes (deposit rules, margin floors, approval thresholds) emit `org_config_sensitive_change` events |
| **Zod-validated** | All inputs pass through Zod schemas before reaching the database |

## Package Layout

```
packages/platform-commerce-org/
  src/
    types.ts          — TypeScript interface definitions
    schemas.ts        — Zod validation schemas (8 schemas)
    defaults.ts       — ShopMoiCa + PromoNorth default configs
    service.ts        — DB CRUD: 7 get + 7 upsert + getOrgCommerceConfig
    audit.ts          — Change event builder, event type map, sensitivity analysis
    pricing.ts        — Tax calculation, margin evaluation, currency formatting
    payments.ts       — Deposit calculation, due dates, production gating
    suppliers.ts      — Supplier ranking (4 strategies)
    catalog.ts        — Markup (3 strategies), SKU mapping, category resolution
    branding.ts       — Logo initials, copyright, footer text
    workflows.ts      — Ref generation (quote/invoice/PO), expiry, approval rules
    utils.ts          — Template rendering, config diffing
    index.ts          — Barrel export
    __tests__/
      org-commerce.test.ts — 69 unit tests
```

## Database Tables (7)

| Table | Key | Purpose |
|-------|-----|---------|
| `commerceOrgSettings` | `orgId` | Currency, locale, prefixes, tax config, validity |
| `commerceOrgQuotePolicies` | `orgId` | Margin floors, approval thresholds, discount limits |
| `commerceOrgPaymentPolicies` | `orgId` | Deposit rules, payment terms, lead times |
| `commerceOrgSupplierPolicies` | `orgId` | Supplier selection strategy + weights |
| `commerceOrgCatalogPolicies` | `orgId` | Markup strategy, category mappings, SKU mapping |
| `commerceOrgBrandingConfigs` | `orgId` | Display name, colours, address, footer text |
| `commerceOrgCommunicationTemplates` | `orgId` | Email templates for quote, invoice, payment |

## Resolution Flow

```
Clerk auth()  →  resolveOrgContext()  →  OrgContext { orgId, actorId, role }
                                              │
                                   getOrgCommerceConfig(orgId)
                                              │
                           ┌──────────────────┴──────────────────┐
                           │         7 × getOrg*() calls         │
                           │    DB row?  →  use it                │
                           │    No row?  →  SHOPMOICA_* default   │
                           └──────────────────┬──────────────────┘
                                              │
                                     OrgCommerceConfig
                                              │
                           ┌──────────────────┴──────────────────┐
                           │   Pricing, Payments, Suppliers,     │
                           │   Catalog, Branding, Workflows      │
                           └─────────────────────────────────────┘
```

## Mutation Flow

```
Settings form  →  Server action  →  upsertOrg*(orgId, input, actorId)
                                        │
                                    Zod validation
                                        │
                                    DB upsert (INSERT … ON CONFLICT UPDATE)
                                        │
                                    buildConfigChangeEvent()
                                        │
                                    emitConfigChange()
                                        │
                              ┌─────────┴─────────┐
                              │   PlatformEventBus │
                              │   (typed event)    │
                              └─────────┬─────────┘
                                        │
                              getSensitiveFields(changedFields)
                                        │
                              sensitive? → emit org_config_sensitive_change
```

## Governance Events

Six fields are classified as **governance-sensitive**:

| Field | Reason |
|-------|--------|
| `depositRequired` | Affects production gating |
| `defaultDepositPercent` | Affects cash flow controls |
| `minMarginPercent` | Affects profitability controls |
| `allowManualPriceOverride` | Bypasses pricing controls |
| `supplierSelectionStrategy` | Affects procurement governance |
| `approvalThreshold` | Affects financial governance |

When any of these fields change, a secondary `org_config_sensitive_change`
event is emitted with the sensitivity details, enabling downstream policy
evaluation and audit trail.

## Demo Seed

`lib/demoSeed.ts` creates two fully-configured demonstration orgs:

| Org | ID | Currency | Locale | Deposit | Strategy |
|-----|----|----------|--------|---------|----------|
| ShopMoiCa Demo Corp | `11111111-…-111…` | CAD | en-CA | 30% | BALANCED |
| PromoNorth Inc. | `22222222-…-222…` | USD | en-US | 50% | LOWEST_COST |

Each org receives:

- Full 7-table config insertion via `seedOrgConfig()`
- Demo customers (5 + 3)
- Demo quotes with lines (7 + 3)
- Timeline events (ShopMoiCa only)
