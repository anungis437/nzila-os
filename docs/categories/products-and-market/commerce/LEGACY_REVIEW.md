# LEGACY REVIEW — Shop Quoter Tool V1

> **Audit Date:** 2026-02-24
> **Target:** `C:\APPS\legacy\shop_quoter_tool_v1-main`
> **Auditor:** NzilaOS Migration Engine
> **Product Name:** ShopMoiÇa (Shop Quoter Tool)
> **Stack:** TypeScript, React (Vite), Supabase (PostgreSQL), Zoho CRM/Books/Inventory
> **Jurisdiction:** Quebec, Canada (GST 5% + QST 9.975%)

---

## 1. PROJECT STRUCTURE OVERVIEW

```
shop_quoter_tool_v1-main/
├── src/
│   ├── api/                    # API route definitions (Zoho)
│   ├── components/             # React UI (35+ components)
│   │   ├── analytics/          # Dashboard analytics
│   │   ├── charts/             # Recharts wrappers
│   │   ├── forms/              # IntakeForm
│   │   ├── integrations/       # Calendly, Canva auth
│   │   ├── ui/                 # Shadcn/ui primitives
│   │   ├── zoho/               # Zoho UI components
│   │   └── __tests__/          # Component tests
│   ├── config/                 # Bundle optimization
│   ├── contexts/               # AuthContext, LanguageContext
│   ├── hooks/                  # Error reporting, lazy loading, perf
│   ├── lib/                    # Business logic (30+ service files)
│   │   └── __tests__/          # Unit tests (3 files)
│   ├── pages/                  # Route pages (30+ pages)
│   ├── services/               # Calendly, Canva services
│   ├── test/                   # Test utilities
│   ├── types/                  # Type definitions
│   └── utils/                  # Bundle utils, lazy loading
├── supabase/
│   └── migrations/             # 30+ SQL migrations
├── scripts/                    # Import/maintenance scripts (70+ files)
├── historical/                 # CSV, Excel, PDF data
├── docs/                       # Legacy documentation
├── tests/                      # E2E, integration, load tests
└── coverage/                   # Istanbul coverage reports
```

### Layer Identification

| Layer | Location | File Count |
|-------|----------|-----------|
| **UI** | `src/components/`, `src/pages/` | 65+ |
| **Business Logic (Pricing)** | `src/lib/margin-solver.ts`, `src/lib/advanced-quoting-engine.ts`, `src/lib/ai-quoting-service.ts`, `src/lib/bundle-service.ts` | 4 |
| **DB Access (Supabase)** | `src/lib/supabase.ts`, `src/lib/supabase-adapter.ts`, `src/lib/real-data-service.ts`, `src/lib/request-service.ts`, `src/lib/inventory-service.ts`, `src/lib/purchase-order-service.ts` | 6 |
| **Integration (Zoho)** | `src/lib/zoho-*.ts` (8 files), `src/api/zoho-routes.ts` | 9 |
| **Workflow/State** | `src/lib/workflow-engine.ts`, `src/lib/workflow-automation-engine.ts`, `src/lib/mandate-*.ts` (6 files) | 8 |
| **Auth** | `src/contexts/AuthContext.tsx`, `src/lib/mock-auth.ts` | 2 |
| **Observability** | `src/lib/structured-logger.ts`, `src/lib/sentry-config.ts` | 2 |
| **Console Usage** | 26 of 31 core source files | 26 |
| **Env Handling** | `import.meta.env.VITE_*` (client) mixed with `process.env.*` (server) | Inconsistent |

---

## 2. INVENTORY REPORT

### Files Containing Pricing Logic

| File | Key Functions | Notes |
|------|--------------|-------|
| `src/lib/margin-solver.ts` | `calculateTierPricing()`, `calculateAllTiers()`, `calculateBreakEven()`, `optimizeForTargetTotal()`, `calculateQuebecTaxes()` | **Cleanest** — pure calculations, no DB |
| `src/lib/advanced-quoting-engine.ts` | `generateIntelligentQuote()`, `calculateDynamicPricing()`, `generateOptimizedProposals()` | Mixed — contains `supabase.from('quotes')` |
| `src/lib/ai-quoting-service.ts` | AI-powered tier selection with budget constraints | Contains `supabase.from('proposals')` |
| `src/lib/bundle-service.ts` | Bundle creation with hardcoded 40% markup | Contains `supabase.from('product_catalog')` |
| `src/lib/purchase-order-service.ts` | PO creation with hardcoded 15% tax | Contains heavy Supabase access |
| `src/lib/utils.ts` | `calculateTax(amount, taxRate)` | Generic, no Quebec awareness |

### Files Performing DB Writes

| File | Tables Written | Method |
|------|---------------|--------|
| `src/lib/request-service.ts` | `requests`, `request_activities` | `.insert()`, `.update()` |
| `src/lib/inventory-service.ts` | `products`, `stock_movements`, `suppliers` | `.insert()`, `.update()`, `.delete()` |
| `src/lib/purchase-order-service.ts` | `purchase_orders` | `.insert()`, `.update()` |
| `src/lib/workflow-engine.ts` | `proposals`, `invoices`, `production_tasks`, `products` | `.insert()`, `.update()` |
| `src/lib/mandate-service.ts` | `mandates`, `mandate_workflow_instances`, `mandate_deliverables`, `mandate_communications`, `mandate_invoices` | `.insert()`, `.update()`, `.delete()` |
| `src/lib/zoho-crm-integration.ts` | `zoho_sync_configurations`, `zoho_sync_records`, `quotes` | `.insert()`, `.upsert()` |
| `src/lib/zoho-sync.ts` | Multiple sync tables | Service-role Supabase client |
| `src/lib/zoho-webhook.ts` | `requests`, `clients`, `products`, `invoices`, `zoho_sync_log` | Service-role Supabase client |

### Files Performing External API Calls

| File | API | Purpose |
|------|-----|---------|
| `src/lib/zoho-service.ts` | Zoho CRM v3 | Lead/contact/deal CRUD |
| `src/lib/zoho-sync.ts` | Zoho Inventory, CRM v2, Books v3 | Bi-directional sync |
| `src/lib/zoho-auth.ts` | Zoho OAuth | Token management |
| `src/lib/zoho-crm-integration.ts` | Zoho CRM v3 | Conflict resolution, field mapping |
| `src/lib/supabase-adapter.ts` | AI API (`VITE_AI_API_URL`) | Product recommendations |
| `src/lib/structured-logger.ts` | Remote logging endpoint | Log shipping |
| `src/lib/sentry-config.ts` | Sentry | Error tracking |
| `src/lib/request-service.ts` | Zoho (via ZohoService) | CRM sync on request create |

### Supabase Migrations (30+ files)

Key migrations:

| Migration | Tables/Functions |
|-----------|-----------------|
| `001_initial_schema.sql` | `users`, `clients`, `suppliers`, `products`, `quotes`, `invoices`, `production_orders`, `inventory_items`, `purchase_orders`, `whatsapp_messages` |
| `003_rpc_functions.sql` | `generate_product_recommendations()`, `calculate_weekly_capacity()`, `convert_quote_to_invoice()`, `check_low_stock_items()` |
| `004_intelligent_quoting_system.sql` | `weekly_capacity`, `requests`, enhanced `products`, `proposals`, `proposal_items`, `choice_groups`, `choice_options`, `production_tasks`, `pricing_templates`, `quote_documents`, `audit_log` |
| `007_add_partial_invoice_status.sql` | Adds `'partial'` to invoice status |
| `008_zoho_crm_integration.sql` | `zoho_sync_configurations`, `zoho_sync_records`, `zoho_conflict_records`, `zoho_lead_opportunities`, `zoho_webhooks`, `zoho_webhook_logs`, `zoho_api_tokens`, `zoho_sync_stats` |
| `017_workflow_rpc_functions.sql` | `create_client_request()`, `generate_ai_proposals()`, `accept_proposal()`, `assign_production_week()` |
| `018_workflow_automation_system.sql` | `workflow_definitions`, `workflow_instances`, `workflow_executions`, `workflow_approvals`, `notification_templates`, `notifications` |

### RPC Functions

- `create_client_request()`
- `generate_ai_proposals()`
- `accept_proposal()`
- `assign_production_week()`
- `convert_quote_to_invoice()`
- `calculate_weekly_capacity()`
- `check_low_stock_items()`
- `generate_product_recommendations()`
- `record_payment()`
- `update_production_stage()`

### Direct Console Usage

**26 of 31 source files** use raw `console.error`, `console.warn`, or `console.log`. Only 5 files are clean: `margin-solver.ts`, `types/quoting.ts`, `zoho-service.ts`, `zoho-data-import-service.ts`, `zoho-routes.ts`.

Notable: `structured-logger.ts` and `sentry-config.ts` exist but are **not adopted** by any service file.

---

## 3. GOVERNANCE VIOLATIONS

### HIGH Severity

| # | Violation | Location | Impact |
|---|-----------|----------|--------|
| H1 | **No org_id / multi-tenancy** | All tables, all queries | All data globally visible; impossible to onboard multiple organizations |
| H2 | **Hardcoded credentials in source** | `supabase.ts` (anon key fallback), `mock-auth.ts` (demo passwords) | Security breach vector |
| H3 | **OAuth tokens in localStorage** | `zoho-service.ts` | XSS → token theft |
| H4 | **Base64 "encryption" for tokens** | `zoho-auth.ts` | Not encryption; plaintext equivalent |
| H5 | **SQL injection risk** | `workflow-engine.ts` → `reserveInventoryCapacity()` | String interpolation in SQL update |
| H6 | **RLS policies missing** | Migrations 008, 018 (17 tables) | `ENABLE ROW LEVEL SECURITY` without any policies = locked tables |
| H7 | **SECURITY DEFINER on all RPCs** | Migration 003, 017 | Bypasses all RLS — any authenticated user can call |
| H8 | **Tax rate inconsistency (3 variants)** | margin-solver (14.975%), purchase-order-service (15%), SQL RPC (10%) | Financial compliance failure |
| H9 | **Pricing logic coupled to DB** | `advanced-quoting-engine.ts`, `ai-quoting-service.ts`, `bundle-service.ts` | Cannot unit test without Supabase |
| H10 | **Mock auth fallback in production** | `AuthContext.tsx` | Falls back to mock auth if Supabase unavailable |

### MEDIUM Severity

| # | Violation | Location | Impact |
|---|-----------|----------|--------|
| M1 | **No structured audit logging** | All service files | Structured logger exists but unused |
| M2 | **`Math.random()` for IDs** | `utils.ts`, SQL RPCs | Collision risk for quote/invoice/PO numbers |
| M3 | **Duplicate type definitions** | `types/index.ts` vs `types/quoting.ts` | `Product`, `ProposalItem` defined twice with different shapes |
| M4 | **3 separate Supabase clients** | `zoho-sync.ts`, `zoho-auth.ts`, `zoho-webhook.ts` | Connection pool exhaustion; inconsistent auth context |
| M5 | **Singleton pattern everywhere** | 15+ files | No dependency injection; untestable |
| M6 | **Hardcoded 40% markup** | `bundle-service.ts` | Not configurable per org/tier |
| M7 | **Duplicate sync logic** | `zoho-sync.ts`, `zoho-crm-integration.ts`, `zoho-data-integration-service.ts` | 3 files doing overlapping work |
| M8 | **`process.env` vs `import.meta.env`** | Mixed across lib files | Server/client code split violation |
| M9 | **No state machine enforcement** | `workflow-engine.ts`, `mandate-service.ts` | Status transitions not validated |
| M10 | **Manual rollback instead of DB transactions** | `workflow-engine.ts` | Partial failure leaves inconsistent state |

### LOW Severity

| # | Violation | Location | Impact |
|---|-----------|----------|--------|
| L1 | **`console.*` in 26/31 files** | All service files | No structured log correlation |
| L2 | **Fake data generation** | `real-data-service.ts`, `purchase-order-service.ts` | `Math.random()` for emails/phones/addresses |
| L3 | **Non-functional stubs** | `zoho-data-import-service.ts` | Returns zeros/empty arrays |
| L4 | **TODO stubs throwing errors** | `mandate-service.ts` → `startWorkflow()`, `updateWorkflowStage()` | "Not implemented" at runtime |
| L5 | **Imports non-existent services** | `mandate-workflow-automation.ts` → `NotificationService`, `MandateInventoryService` | Build may fail or tree-shake |
| L6 | **`.backup` and `.bak` files in source** | `src/App.tsx.backup`, `src/lib/zoho-*.bak` | Should be in `.gitignore` |
| L7 | **70+ import/migration scripts** | `scripts/` | One-off scripts cluttering project |
| L8 | **Coverage reports committed** | `coverage/` | Should be in `.gitignore` |

---

## 4. SUMMARY METRICS

| Metric | Value |
|--------|-------|
| Total source files (TS/TSX) | ~100+ |
| Total lines of business logic | ~11,500+ |
| Files with pricing logic | 6 |
| Files with direct DB access | 22 |
| Files with external API calls | 8 |
| Files with `console.*` | 26/31 core |
| Files with org_id awareness | **0** |
| Singleton instances | 15+ |
| Separate Supabase clients | 4 |
| DB tables | ~40+ |
| RPC functions | 10+ |
| Tax rate variants | 3 (inconsistent) |
| Supabase migrations | 30+ |
| Import/migration scripts | 70+ |
| Domain entities (types) | ~25 |

---

## 5. MIGRATION READINESS ASSESSMENT

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Pricing Logic Quality** | 7/10 | `margin-solver.ts` is clean and well-tested; other pricing files need DB decoupling |
| **Type System** | 5/10 | Good coverage but duplicate definitions and inconsistent naming |
| **DB Schema** | 4/10 | No org_id, missing RLS policies, SECURITY DEFINER RPCs |
| **Integration Layer** | 3/10 | 3 overlapping Zoho sync services, tokens in localStorage |
| **State Management** | 3/10 | No enforced state machine; manual rollbacks |
| **Auth/Security** | 2/10 | Mock auth in production path, hardcoded keys, base64 "encryption" |
| **Observability** | 2/10 | Logger exists but unused; raw console everywhere |
| **Multi-tenancy** | 0/10 | Zero org scoping |

**Overall Legacy Score: 3.3/10** — Requires significant restructuring for NzilaOS Commerce Engine integration.
