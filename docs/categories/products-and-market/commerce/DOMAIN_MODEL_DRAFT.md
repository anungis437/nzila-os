# DOMAIN MODEL DRAFT — Nzila Commerce Engine

> **Source:** Shop Quoter Tool V1 (Legacy)
> **Target:** NzilaOS Commerce Engine (org-scoped)
> **Date:** 2026-02-24

---

## Domain Entities

### 1. Quote (Request → Proposal lifecycle)

**Purpose:** Represents a client's request for gift box pricing and the generated proposals (budget/standard/premium tiers).

**Current Storage Pattern:**

- `requests` table — client intake (box count, budget, theme)
- `proposals` table — generated tier options with AI recommendations
- `proposal_items` table — line items per proposal
- `quotes` table — legacy wrapper with JSONB `proposals` column
- `quote_documents` table — PDF/Canva exports

**Current Coupling Points:**

- `AdvancedQuotingEngine` directly queries `supabase.from('quotes')` and `supabase.from('products')`
- `AIQuotingService` writes to `supabase.from('proposals')` during generation
- `WorkflowEngineService.acceptProposal()` reads proposals with nested joins
- `RequestService` creates requests and syncs to Zoho CRM as leads

**Refactor Recommendation:**

- Merge `requests` + `quotes` into a unified `commerce.quotes` entity with versioning
- Proposals become `commerce.quote_versions` (version 1, 2, 3...) with tier variants
- Add `org_id` FK; enforce via RLS
- Separate quote generation (command) from quote retrieval (query) — CQRS pattern
- Quote numbers generated via `nanoid` or DB sequence, never `Math.random()`

---

### 2. QuoteLine (Proposal Item)

**Purpose:** Individual product line within a proposal tier.

**Current Storage Pattern:**

- `proposal_items` table (id, proposal_id, product_id, quantity, unit_cost, total_cost, display_order, is_featured, choice_group_id)
- Also stored as JSONB in legacy `quotes.proposals` column

**Current Coupling Points:**

- `WorkflowEngineService` reads `proposal_items` via join on `proposals`
- `MarginSolverService.calculateTierPricing()` takes `items: Array<{productId, quantity, unitCost}>` as pure input
- Two different `ProposalItem` types exist (`types/index.ts` vs `types/quoting.ts`)

**Refactor Recommendation:**

- Single `commerce.quote_lines` entity with normalized FK to `commerce.products`
- Snapshot `unit_cost` at quote time (already done, maintain pattern)
- Choice groups become a separate `commerce.choice_groups` + `commerce.choice_options` relationship
- Unify type definition into single `QuoteLine` interface

---

### 3. Customer (Client)

**Purpose:** Business/contact receiving quotes and placing orders.

**Current Storage Pattern:**

- `clients` table (id, company_name, contact_name, email, phone, address, notes, created_by)
- `zoho_leads` table (synced from Zoho CRM)
- `zoho_contacts` table (synced from Zoho CRM)
- `mandate_communications` table (client portal interactions)

**Current Coupling Points:**

- `InventoryService` queries `clients` for supplier-like operations
- `RequestService` creates clients on-the-fly during request intake
- `ZohoDataIntegrationService` syncs `clients` ↔ Zoho leads/contacts
- `AuthContext` auto-registers unknown users (client/user boundary blurred)
- TS type `Client.name` vs DB column `company_name` mismatch

**Refactor Recommendation:**

- Rename to `commerce.customers` for clarity
- Add `org_id` FK
- Separate `contacts` (people) from `customers` (companies): one-to-many
- Zoho sync becomes event-driven via integration bus, not direct DB coupling
- Customer creation only through explicit service method, never auto-registration

---

### 4. InventoryItem (Product / SKU)

**Purpose:** Physical products available for inclusion in gift boxes.

**Current Storage Pattern:**

- `products` table (defined twice: migrations 001 and 004 with different schemas)
- `inventory_items` table (quantity, min_stock_level, location per product)
- `stock_movements` table (movement tracking)

**Current Coupling Points:**

- `AdvancedQuotingEngine` queries `products` for bundle generation
- `InventoryService` manages CRUD + stock movements
- `WorkflowEngineService.reserveInventoryCapacity()` directly updates stock (SQL injection risk)
- `ZohoWebhookService` upserts products from Zoho webhooks
- Two `Product` type definitions with incompatible shapes

**Refactor Recommendation:**

- Single `commerce.products` entity with unified schema
- Separate `commerce.inventory_levels` (warehouse-aware stock tracking)
- `commerce.stock_movements` with audit trail
- Inventory reservation via DB transaction, not string interpolation
- Products are org-scoped (`org_id` FK)

---

### 5. Tax (Quebec GST + QST)

**Purpose:** Tax calculation for Quebec jurisdiction (GST 5% + QST 9.975%).

**Current Storage Pattern:**

- `pricing_templates` table stores `gst_rate` and `qst_rate` per template
- Hardcoded in `MarginSolverService.calculateQuebecTaxes()` (correct: 0.05, 0.09975)
- Hardcoded in `purchase-order-service.ts` (incorrect: 0.15)
- Hardcoded in SQL RPC `convert_quote_to_invoice()` (incorrect: 0.10)

**Current Coupling Points:**

- `MarginSolverService` has correct Quebec tax logic (QST calculated on base + GST)
- `utils.ts` has generic `calculateTax(amount, taxRate)` with no Quebec awareness
- Three different tax rates across the codebase

**Refactor Recommendation:**

- Create `commerce.tax_jurisdictions` table (region, gst_rate, qst_rate, hst_rate, effective_date)
- Single `TaxService` with jurisdiction-aware calculation
- All tax computation flows through the service — no hardcoded rates
- Support future expansion (Ontario HST, Alberta GST-only, etc.)
- Tax rates are org-scoped (different orgs may operate in different provinces)

---

### 6. Discount (Volume + Seasonal + Competitive)

**Purpose:** Price adjustments based on volume tiers, seasonal factors, and competitive positioning.

**Current Storage Pattern:**

- Hardcoded in `MarginSolverService.getVolumeDiscount()`: 250+ boxes = 10%, 500+ boxes = 15%
- Hardcoded in `AdvancedQuotingEngine.calculateDynamicPricing()`: volume, seasonal, competitive, urgency adjustments
- No DB table for discount rules

**Current Coupling Points:**

- Volume discount logic embedded in `MarginSolverService` (private method)
- Dynamic pricing adjustments embedded in `AdvancedQuotingEngine` (private method)
- No UI for managing discount rules

**Refactor Recommendation:**

- Create `commerce.discount_rules` table (type, threshold, percentage, valid_from, valid_to, org_id)
- `DiscountService` resolves applicable discounts given order context
- Rules engine evaluates conditions (volume, date, client tier, etc.)
- Audit trail for discount application on each quote

---

### 7. PartialInvoice (Invoice with partial payments)

**Purpose:** Financial document generated when a quote is accepted; supports partial payment tracking.

**Current Storage Pattern:**

- `invoices` table (status: draft/sent/paid/partial/overdue/cancelled)
- `payments` table (not in initial schema, referenced in types)
- Created via `WorkflowEngineService.createInvoice()` or RPC `convert_quote_to_invoice()`

**Current Coupling Points:**

- `WorkflowEngineService` creates invoices with manual rollback
- SQL RPC `convert_quote_to_invoice()` uses 10% tax rate (incorrect)
- Invoice status `'partial'` added in migration 007 but no payment tracking table in core schema
- `mandate-service.ts` has separate `mandate_invoices` table

**Refactor Recommendation:**

- `commerce.invoices` with org_id, linked to `commerce.orders` (not quotes directly)
- `commerce.payments` for payment tracking (amount, method, date, reference)
- Invoice generation only after order confirmation (not at quote acceptance)
- Correct tax calculation via `TaxService`
- DB transaction for invoice creation + inventory reservation

---

### 8. PricingFunction (Pricing Template + Margin Solver)

**Purpose:** Configurable pricing parameters that drive margin calculations per tier.

**Current Storage Pattern:**

- `pricing_templates` table (margin targets, floor margins, cost components, tax rates per template)
- `MarginSolverService` uses template as pure input

**Current Coupling Points:**

- `MarginSolverService.calculateTierPricing()` receives `PricingTemplate` as parameter (clean)
- `AdvancedQuotingEngine` retrieves templates from DB then passes to margin solver
- Template values hardcoded in test fixtures

**Refactor Recommendation:**

- `commerce.pricing_templates` with `org_id` scope
- Templates are versioned (create new version, don't mutate)
- Margin floor enforcement at service level with approval workflow for overrides
- Audit log entry required for any margin below floor
- This is the cleanest part of the legacy system — minimal refactoring needed

---

### 9. ZohoSync (Integration Job)

**Purpose:** Bi-directional synchronization between local DB and Zoho CRM/Books/Inventory.

**Current Storage Pattern:**

- `zoho_sync_configurations` table (entity type, direction, field mappings)
- `zoho_sync_records` table (per-record sync state, last synced)
- `zoho_conflict_records` table (conflict resolution)
- `zoho_api_tokens` table (OAuth tokens)
- `zoho_sync_stats` table (aggregates)
- Tokens also stored in localStorage (security risk)

**Current Coupling Points:**

- `ZohoService` — CRM API calls via backend proxy
- `ZohoSyncService` — creates its own Supabase client with service role key
- `ZohoAuthService` — OAuth token CRUD with base64 "encryption"
- `ZohoCRMIntegrationService` — field mapping + conflict resolution
- `ZohoDataIntegrationService` — client data sync
- `ZohoWebhookService` — inbound webhook processing
- `ZohoValidationFramework` — data validation across tables
- **3 overlapping sync implementations**

**Refactor Recommendation:**

- Single `integrations.sync_jobs` table (provider, direction, entity, status, org_id)
- `integrations.sync_records` (per-record tracking)
- `integrations.oauth_tokens` (encrypted at rest, not base64)
- Zoho integration becomes a pluggable adapter behind `IntegrationPort` interface
- Event-driven sync (outbox pattern) instead of direct API calls from services
- Single sync engine, not 3 overlapping implementations

---

### 10. Order (Missing Entity — Currently Implicit)

**Purpose:** Confirmed customer order after quote acceptance. Currently this concept is **missing** from the legacy system — quote acceptance directly creates an invoice.

**Current Storage Pattern:**

- No `orders` table exists
- `WorkflowEngineService.acceptProposal()` creates invoice directly from proposal
- `production_orders` / `production_tasks` reference invoices, not orders

**Current Coupling Points:**

- Quote → Invoice (skips Order)
- Invoice → Production Order (should be Order → Production → Invoice)

**Refactor Recommendation:**

- Create `commerce.orders` (org_id, customer_id, quote_version_id, status, total, shipping_address)
- `commerce.order_lines` (product_id, quantity, unit_price, total)
- Order is the pivot between quoting and fulfillment
- Invoice generated from order, not from quote
- Order status drives production workflow

---

### 11. Mandate (Project/Engagement — Legacy Concept)

**Purpose:** Represents a client engagement/project that encompasses multiple quotes, orders, and deliverables. Quebec business concept.

**Current Storage Pattern:**

- `mandates` table (client_id, type, status, budget, dates)
- `mandate_workflow_instances` (stage tracking)
- `mandate_deliverables` (deliverable tracking)
- `mandate_communications` (client interactions)
- `mandate_invoices` (financial tracking per mandate)

**Current Coupling Points:**

- `MandateService` (CRUD with 14+ console.error calls)
- `MandateWorkflowEngine` (1133 lines, complex stage management)
- `MandateIntelligenceService` (historical analysis for quoting)
- Multiple mandate-specific dashboards in UI

**Refactor Recommendation:**

- Map mandate concept to `commerce.projects` or `commerce.engagements`
- Projects contain multiple orders, each with their own lifecycle
- Project-level budgeting and margin tracking
- Org-scoped with role-based access

---

## Entity Relationship Diagram (Target)

```
Organization (org_id)
├── Customer
│   ├── Contact (one-to-many)
│   └── Quote
│       ├── QuoteVersion (versioned proposals)
│       │   └── QuoteLine (product + quantity + cost snapshot)
│       └── Order (on acceptance)
│           ├── OrderLine
│           ├── Invoice
│           │   └── Payment
│           └── Fulfillment
│               ├── ProductionTask
│               └── Delivery
├── Product
│   ├── InventoryLevel (per warehouse)
│   └── StockMovement
├── Supplier
│   └── PurchaseOrder
├── PricingTemplate (versioned)
├── TaxJurisdiction
├── DiscountRule
└── SyncJob (Zoho integration)
```

---

## Entity Count Summary

| Entity | Legacy Tables | Target Tables | Migration Complexity |
|--------|--------------|---------------|---------------------|
| Quote/Request | 5 (`requests`, `quotes`, `proposals`, `proposal_items`, `quote_documents`) | 3 (`quotes`, `quote_versions`, `quote_lines`) | MEDIUM |
| Customer | 3 (`clients`, `zoho_leads`, `zoho_contacts`) | 2 (`customers`, `contacts`) | LOW |
| Product/Inventory | 3 (`products`, `inventory_items`, `stock_movements`) | 3 (`products`, `inventory_levels`, `stock_movements`) | LOW |
| Order | 0 (missing) | 2 (`orders`, `order_lines`) | NEW |
| Invoice/Payment | 2 (`invoices`, payments implied) | 2 (`invoices`, `payments`) | MEDIUM |
| Production | 2 (`production_orders`, `production_tasks`) | 2 (`production_tasks`, `deliveries`) | MEDIUM |
| Pricing | 1 (`pricing_templates`) | 3 (`pricing_templates`, `tax_jurisdictions`, `discount_rules`) | LOW |
| Mandate/Project | 5 (`mandates`, `mandate_*`) | 1 (`projects`) | HIGH |
| Zoho Integration | 8 (`zoho_*`) | 3 (`sync_jobs`, `sync_records`, `oauth_tokens`) | HIGH |
| **Total** | **~29** | **~21** | — |
