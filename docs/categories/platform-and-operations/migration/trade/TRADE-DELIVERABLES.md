# Trade App — Final Deliverables

> All 9 Epics implemented. Trade-OS is the canonical core; eExports is the Cars vertical module.

---

## 1. PR List with Acceptance Criteria

### PR 1 — EPIC 0: Canonical Domain Map & Vertical Strategy

**Files:**

- `docs/migrations/trade/canonical-domain-map.md`
- `docs/migrations/trade/cars-vertical-scope.md`

**Acceptance Criteria:**

- [x] `canonical-domain-map.md` defines core vs vertical boundaries
- [x] `cars-vertical-scope.md` documents what stays in trade-cars
- [x] No code — documentation only

---

### PR 2 — EPIC 1: Unified App Scaffold

**Files:**

- `apps/trade/package.json`
- `apps/trade/tsconfig.json`
- `packages/trade-core/package.json`, `tsconfig.json`, `eslint.config.mjs`
- `packages/trade-db/package.json`, `tsconfig.json`, `eslint.config.mjs`
- `packages/trade-cars/package.json`, `tsconfig.json`, `eslint.config.mjs`
- `packages/trade-adapters/package.json`, `tsconfig.json`, `eslint.config.mjs`
- `pnpm-workspace.yaml` (updated)

**Acceptance Criteria:**

- [x] `pnpm install` resolves all workspace packages
- [x] All 4 packages + app compile (TS strict)
- [x] ESLint flat config on all packages — 0 errors
- [x] Dependency graph: `trade-core` ← `trade-db` ← `trade-cars`; `trade-adapters` bridges legacy

---

### PR 3 — EPIC 2: Data Layer (Drizzle Schema + Repositories)

**Files:**

- `packages/db/src/schema/trade.ts` (420 lines — 14 tables, 12 pgEnums)
- `packages/trade-db/src/repositories/*.ts` (8 repository interfaces)
- `packages/trade-db/src/types.ts` (TradeDbContext, TradeReadContext)
- `packages/trade-db/src/schema/index.ts` (re-export from @nzila/db)
- `packages/trade-db/src/repositories/cross-org.test.ts`

**Acceptance Criteria:**

- [x] 14 tables: `trade_parties`, `trade_listings`, `trade_listing_media`, `trade_deals`, `trade_quotes`, `trade_financing_terms`, `trade_shipments`, `trade_documents`, `trade_commissions`, `trade_evidence_artifacts`, `trade_vehicle_listings`, `trade_vehicle_docs`
- [x] 12 pgEnums covering roles, statuses, stages, doc types
- [x] Every table scoped by `org_id` FK → `entities.id`
- [x] Cars vertical tables link via `listing_id` FK → `trade_listings.id`
- [x] Repository interfaces require `TradeDbContext({ orgId })` — no unscoped queries
- [x] 5 cross-org isolation tests pass

---

### PR 4 — EPIC 3: Core Workflows (FSM + Server Actions)

**Files:**

- `packages/trade-core/src/enums.ts` (205 lines — 16 const enums)
- `packages/trade-core/src/types/index.ts` (240 lines — branded IDs, domain types)
- `packages/trade-core/src/schemas/index.ts` (205 lines — Zod schemas)
- `packages/trade-core/src/machines/deal.ts` (123 lines — state machine definition)
- `packages/trade-core/src/machines/engine.ts` (202 lines — pure transition engine)
- `packages/trade-core/src/machines/engine.test.ts` (16 tests)
- `packages/trade-core/src/audit.ts` (89 lines — audit entry builders)
- `packages/trade-core/src/events.ts` (17 event types)
- `apps/trade/lib/resolve-org.ts` (145 lines — Clerk → TradeOrgContext)
- `apps/trade/lib/actions/*.ts` (8 server action files)

**Acceptance Criteria:**

- [x] Deal FSM: `lead → qualified → quoted → accepted → funded → shipped → delivered → closed`
- [x] Cancellation from any non-terminal stage
- [x] Role-based guards: buyer/seller/broker/agent/admin
- [x] Evidence required at: quoted→accepted, funded→shipped, delivered→closed
- [x] All mutations are `'use server'` Next.js server actions
- [x] Every action calls `resolveOrgContext()` — org-scoped by design
- [x] Every action calls `buildTransitionAuditEntry()` or `buildActionAuditEntry()`
- [x] 16 FSM engine tests pass (happy path, blocked, cross-org, roles, cancellation)

---

### PR 5 — EPIC 4: Cars Vertical Module

**Files:**

- `packages/trade-cars/src/types.ts`
- `packages/trade-cars/src/schemas.ts`
- `packages/trade-cars/src/helpers/duty-calculator.ts`
- `packages/trade-cars/src/helpers/shipping-lane-estimator.ts`
- `packages/trade-cars/src/helpers/helpers.test.ts` (10 tests)
- `packages/trade-cars/src/components/VehicleListingForm.tsx`
- `packages/trade-cars/src/components/VehicleDocsChecklist.tsx`
- `packages/trade-cars/src/components/DutyEstimateCard.tsx`
- `packages/trade-adapters/src/legacy-eexports/index.ts` (157 lines)

**Acceptance Criteria:**

- [x] Vehicle types extend core listing — no core dependency leakage
- [x] Duty calculator: ZAF 25%+15%VAT, NGA 35%+7.5%VAT, KEN 25%+16%VAT, +6 more
- [x] Shipping lane estimator with known routes + fallback
- [x] Legacy eExports adapter maps Django models → core types (local interfaces only)
- [x] 3 UI components for vehicle-specific workflows
- [x] 10 tests pass (duty calculations, shipping lane estimates)
- [x] No `@nzila/trade-cars` import from any core package (boundary enforced)

---

### PR 6 — EPIC 5: Unified UI Experience

**Files:**

- `apps/trade/app/trade/layout.tsx`
- `apps/trade/app/trade/page.tsx` (Dashboard)
- `apps/trade/app/trade/parties/page.tsx`
- `apps/trade/app/trade/listings/page.tsx`
- `apps/trade/app/trade/listings/new/page.tsx`
- `apps/trade/app/trade/deals/page.tsx`
- `apps/trade/app/trade/deals/[id]/page.tsx` (Deal Room)
- `apps/trade/app/trade/shipments/page.tsx`
- `apps/trade/app/trade/commissions/page.tsx`

**Acceptance Criteria:**

- [x] 8 routes covering full deal lifecycle
- [x] Deal Room (`deals/[id]`) — tabbed view: overview, quotes, financing, shipment, documents, commission
- [x] All pages are `async` server components calling server actions
- [x] Org context resolved per page via `resolveOrgContext()`
- [x] Vehicle-specific UI injected conditionally (listing type = 'vehicle')

---

### PR 7 — EPIC 6: Integrations (Event Emitter)

**Files:**

- `apps/trade/lib/events/trade-event-emitter.ts` (169 lines)

**Acceptance Criteria:**

- [x] Event handler registry with typed payloads
- [x] `emitTradeEvent()` dispatches via `@nzila/integrations-runtime`
- [x] Integration helpers: `sendTradeEmail()`, `sendTradeSms()`, `sendTradeSlack()`, `syncTradeToHubSpot()`
- [x] No direct provider SDK imports — dispatcher pattern only

---

### PR 8 — EPIC 7: Evidence + Export

**Files:**

- `apps/trade/lib/evidence/trade-evidence-packs.ts` (250 lines)

**Acceptance Criteria:**

- [x] `buildQuoteAcceptancePack()` — for quoted→accepted transition
- [x] `buildShipmentDocsPack()` — for funded→shipped transition
- [x] `buildCommissionSettlementPack()` — for delivered→closed transition
- [x] `buildOrgTradeExport()` — full org export with Merkle root + seal
- [x] All packs use SHA-256 content hashing + `computeMerkleRoot()` + `generateSeal()`

---

### PR 9 — EPIC 8: Contract Tests

**Files:**

- `tooling/contract-tests/trade-contracts.test.ts` (71 tests — consolidated)
- `tooling/contract-tests/trade-actions.test.ts` (40 tests)
- `tooling/contract-tests/trade-fsm.test.ts` (14 tests)
- `tooling/contract-tests/trade-integrations.test.ts` (6 tests)
- `tooling/contract-tests/trade-evidence.test.ts` (6 tests)
- `tooling/contract-tests/trade-cars-boundary.test.ts` (38 tests)

**Acceptance Criteria:**

- [x] **TRADE_SERVER_ACTIONS_ORG_REQUIRED_001** — all server actions call `resolveOrgContext()`
- [x] **TRADE_FSM_ENFORCED_002** — all deal-stage mutations call `attemptDealTransition()`
- [x] **TRADE_INTEGRATIONS_DISPATCHER_ONLY_003** — no direct provider SDK imports
- [x] **TRADE_EVIDENCE_REQUIRED_FOR_TERMINAL_STATES_004** — evidence packs for terminal transitions
- [x] **TRADE_CARS_BOUNDARY_005** — no `@nzila/trade-cars` import from core packages
- [x] 175 total tests, all passing

---

### PR 10 — EPIC 9: Migration + Cutover

**Files:**

- `scripts/migrations/trade/import-tradeos-core.ts` (451 lines)
- `scripts/migrations/trade/import-eexports-vehicles.ts`
- `scripts/migrations/trade/reconciliation-report.ts`
- `scripts/migrations/trade/README.md`

**Acceptance Criteria:**

- [x] Trade-OS import: 7 migration runners (parties, listings, deals, quotes, financing, shipments, documents, commissions)
- [x] eExports import: vehicle listings + vehicle docs + vehicle deals
- [x] Django model → Drizzle type mappings with stage/role/status conversion
- [x] Reconciliation report: 13 checks (row counts, null entity_ids, FK integrity, VIN uniqueness, stage validity)
- [x] All scripts idempotent (upsert / ON CONFLICT patterns)
- [x] README documents run order and rollback

---

## 2. New Schemas / Migrations List

### Database Schema: `packages/db/src/schema/trade.ts`

| # | Table | Purpose | Key Columns | FK |
|---|-------|---------|-------------|-----|
| 1 | `trade_parties` | Trade counterparties | org_id, name, role, status, contact_json | entities.id |
| 2 | `trade_listings` | Items for trade | org_id, party_id, type (generic/vehicle), title, description, price, currency, status | entities.id, trade_parties.id |
| 3 | `trade_listing_media` | Photos/docs per listing | listing_id, media_type, url, storage_key | trade_listings.id |
| 4 | `trade_deals` | A negotiation + lifecycle | org_id, listing_id, buyer_id, seller_id, stage (FSM-controlled), currency | entities.id, trade_listings.id, trade_parties.id |
| 5 | `trade_quotes` | Price proposals | deal_id, quoted_by_id, amount, currency, status, valid_until | trade_deals.id, trade_parties.id |
| 6 | `trade_financing_terms` | Financing arrangements | deal_id, terms (JSONB), status, provider | trade_deals.id |
| 7 | `trade_shipments` | Physical logistics | deal_id, origin/destination_country, lane, carrier, tracking, status, milestones (JSONB) | trade_deals.id |
| 8 | `trade_documents` | Trade paperwork | deal_id, doc_type, title, storage_key, content_hash, verified_at/by | trade_deals.id |
| 9 | `trade_commissions` | Broker/agent fees | deal_id, party_id, policy (JSONB), calculated_amount, currency, status | trade_deals.id, trade_parties.id |
| 10 | `trade_evidence_artifacts` | Tamper-evident seals | org_id, deal_id, evidence_type, artifact_json, merkle_root, sealed_at | entities.id, trade_deals.id |
| 11 | `trade_vehicle_listings` | 🚗 Cars vertical | listing_id, make, model, year, VIN, mileage, condition, transmission, drivetrain, fuel_type, color, specs (JSONB) | trade_listings.id |
| 12 | `trade_vehicle_docs` | 🚗 Vehicle-specific docs | vehicle_listing_id, doc_type, storage_key, content_hash, verified_at/by | trade_vehicle_listings.id |

### Enums (12 pgEnums)

| Enum | Values |
|------|--------|
| `trade_party_role` | seller, buyer, broker, agent |
| `trade_party_status` | active, suspended, archived |
| `trade_listing_type` | generic, vehicle |
| `trade_listing_status` | draft, active, reserved, sold, cancelled |
| `trade_media_type` | image, video, document |
| `trade_deal_stage` | lead, qualified, quoted, accepted, funded, shipped, delivered, closed, cancelled |
| `trade_quote_status` | draft, submitted, accepted, rejected, expired |
| `trade_financing_status` | pending, approved, rejected, disbursed, settled |
| `trade_shipment_status` | pending, in_transit, customs, delivered, failed |
| `trade_doc_type` | bill_of_sale, invoice, packing_list, certificate_of_origin, customs_declaration, inspection_report, export_certificate, insurance, other |
| `trade_commission_status` | pending, calculated, approved, paid |
| `trade_evidence_type` | quote_acceptance, shipment_docs, commission_settlement, org_export |

### Migration to generate

```bash
pnpm drizzle-kit generate --schema=packages/db/src/schema/trade.ts --out=packages/db/drizzle/migrations
```

---

## 3. End-to-End "Deal Room" Demo Script

This script walks through the complete happy path from org setup to commission settlement.

### Prerequisites

```bash
# 1. Run trade schema migration
pnpm drizzle-kit push --schema=packages/db/src/schema/trade.ts

# 2. Seed legacy data (optional)
npx tsx scripts/migrations/trade/import-tradeos-core.ts
npx tsx scripts/migrations/trade/import-eexports-vehicles.ts
npx tsx scripts/migrations/trade/reconciliation-report.ts

# 3. Start the app
pnpm --filter @nzila/trade dev
```

### Step-by-Step Demo Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. AUTHENTICATE                                                 │
│    Sign in via Clerk → org context auto-resolved                │
│    resolveOrgContext() → { orgId, orgId, userId, roles }     │
└──────────────────────────────▼──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│ 2. CREATE PARTIES                                               │
│    POST /trade/parties                                          │
│    → createParty({ name: "ABC Motors", role: "seller" })        │
│    → createParty({ name: "Importer Ltd", role: "buyer" })       │
│    Audit: buildActionAuditEntry("create_party", ...)            │
└──────────────────────────────▼──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│ 3. CREATE VEHICLE LISTING                                       │
│    POST /trade/listings/new                                     │
│    → createListing({                                            │
│        type: "vehicle",                                         │
│        title: "2022 Toyota Land Cruiser",                       │
│        askingPrice: "45000.00", currency: "USD"                 │
│      })                                                         │
│    → createVehicleListing({                                     │
│        make: "Toyota", model: "Land Cruiser", year: 2022,       │
│        vin: "JTDKN3DU0N...", condition: "used",                 │
│        mileage: 35000                                           │
│      })                                                         │
│    Audit: buildActionAuditEntry("create_listing", ...)          │
└──────────────────────────────▼──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│ 4. CREATE DEAL (stage: LEAD)                                    │
│    → createDeal({                                               │
│        listingId, buyerId, sellerId,                            │
│        currency: "USD"                                          │
│      })                                                         │
│    FSM: deal.stage = "lead"                                     │
└──────────────────────────────▼──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│ 5. QUALIFY → stage: QUALIFIED                                   │
│    → transitionDeal(dealId, "qualify")                           │
│    FSM: attemptDealTransition("lead", "qualify", ctx)           │
│    Guard: role ∈ [seller, broker, admin]                        │
└──────────────────────────────▼──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│ 6. SUBMIT QUOTE → stage: QUOTED                                 │
│    → createQuote({                                              │
│        dealId, quotedById: sellerId,                            │
│        amount: "42000.00", currency: "USD"                      │
│      })                                                         │
│    → transitionDeal(dealId, "submit_quote")                     │
│    FSM: attemptDealTransition("qualified", "submit_quote", ctx) │
└──────────────────────────────▼──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│ 7. ACCEPT QUOTE → stage: ACCEPTED  ⚡ EVIDENCE REQUIRED         │
│    → transitionDeal(dealId, "accept_quote")                     │
│    → buildQuoteAcceptancePack(deal, quote)                      │
│      ├── SHA-256 hash of deal + quote snapshots                 │
│      ├── computeMerkleRoot([...hashes])                         │
│      └── generateSeal(merkleRoot)                               │
│    → Store evidence artifact in trade_evidence_artifacts        │
└──────────────────────────────▼──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│ 8. ARRANGE FINANCING → stage: FUNDED                            │
│    → createFinancing({                                          │
│        dealId, terms: { ... }, provider: "DFC"                  │
│      })                                                         │
│    → transitionDeal(dealId, "fund")                             │
└──────────────────────────────▼──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│ 9. SHIP → stage: SHIPPED  ⚡ EVIDENCE REQUIRED                  │
│    → createShipment({                                           │
│        dealId, originCountry: "ZAF",                            │
│        destinationCountry: "NGA",                               │
│        carrier: "Maersk", trackingNumber: "MAEU1234567"         │
│      })                                                         │
│    → uploadDocument(dealId, { docType: "bill_of_sale", ... })   │
│    → uploadDocument(dealId, { docType: "customs_declaration" }) │
│    → transitionDeal(dealId, "ship")                             │
│    → buildShipmentDocsPack(deal, shipment, documents)           │
│      ├── SHA-256 of shipment + each document                    │
│      ├── computeMerkleRoot([...hashes])                         │
│      └── generateSeal(merkleRoot)                               │
└──────────────────────────────▼──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│ 10. DELIVER → stage: DELIVERED                                  │
│     → updateShipmentMilestone(shipmentId, "delivered")           │
│     → transitionDeal(dealId, "deliver")                         │
└──────────────────────────────▼──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│ 11. CLOSE DEAL → stage: CLOSED  ⚡ EVIDENCE REQUIRED            │
│     → createCommission({                                        │
│         dealId, partyId: brokerId,                              │
│         policy: { rate: 0.03 }, currency: "USD"                 │
│       })                                                        │
│     → finalizeCommission(commissionId, "1260.00")               │
│     → transitionDeal(dealId, "close")                           │
│     → buildCommissionSettlementPack(deal, commission)           │
│       ├── SHA-256 of deal + commission snapshots                │
│       ├── computeMerkleRoot([...hashes])                        │
│       └── generateSeal(merkleRoot)                              │
│                                                                 │
│     emitTradeEvent("deal.closed", { dealId, orgId })            │
│       → sendTradeEmail(...)                                     │
│       → sendTradeSlack(...)                                     │
│       → syncTradeToHubSpot(...)                                 │
└──────────────────────────────▼──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│ 12. EXPORT ORG DATA                                             │
│     → buildOrgTradeExport(orgId)                             │
│       ├── Fetch all deals, parties, listings for org             │
│       ├── SHA-256 each record                                   │
│       ├── computeMerkleRoot([...allHashes])                     │
│       └── generateSeal(merkleRoot) + timestamp                  │
│     Result: tamper-evident full org export                      │
└─────────────────────────────────────────────────────────────────┘
```

### Deal Stage FSM Diagram

```
  ┌──────┐ qualify  ┌───────────┐ submit_quote ┌────────┐ accept_quote ┌──────────┐
  │ LEAD ├─────────►│ QUALIFIED ├─────────────►│ QUOTED ├─────────────►│ ACCEPTED │
  └──┬───┘          └─────┬─────┘              └───┬────┘              └────┬─────┘
     │                    │                        │                       │
     │ cancel             │ cancel                 │ cancel                │ fund
     ▼                    ▼                        ▼                       ▼
  ┌──────────┐       ┌──────────┐             ┌──────────┐          ┌────────┐
  │CANCELLED │       │CANCELLED │             │CANCELLED │          │ FUNDED │
  └──────────┘       └──────────┘             └──────────┘          └───┬────┘
                                                                       │ ship
                                                                       ▼
                                                                  ┌─────────┐
                                                                  │ SHIPPED │
                                                                  └───┬─────┘
                                                                      │ deliver
                                                                      ▼
                                                                 ┌───────────┐
                                                                 │ DELIVERED │
                                                                 └─────┬─────┘
                                                                       │ close
                                                                       ▼
                                                                   ┌────────┐
                                                                   │ CLOSED │
                                                                   └────────┘
```

### Verification Commands

```bash
# Unit tests
pnpm --filter @nzila/trade-core test       # 16 tests ✅
pnpm --filter @nzila/trade-cars test       # 10 tests ✅
pnpm --filter @nzila/trade-db test         #  5 tests ✅

# Contract tests
npx vitest run tooling/contract-tests/trade-contracts.test.ts   # 71 tests ✅
npx vitest run tooling/contract-tests/trade-actions.test.ts     # 40 tests ✅
npx vitest run tooling/contract-tests/trade-fsm.test.ts         # 14 tests ✅
npx vitest run tooling/contract-tests/trade-integrations.test.ts #  6 tests ✅
npx vitest run tooling/contract-tests/trade-evidence.test.ts    #  6 tests ✅
npx vitest run tooling/contract-tests/trade-cars-boundary.test.ts # 38 tests ✅

# Lint (0 errors)
pnpm --filter @nzila/trade-core lint
pnpm --filter @nzila/trade-db lint
pnpm --filter @nzila/trade-cars lint
pnpm --filter @nzila/trade-adapters lint
```
