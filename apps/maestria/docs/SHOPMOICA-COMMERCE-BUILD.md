# Shop Moi Ca Maestria Commerce Build

## Build intent

This file locks the production build plan for Shop Moi Ca inside Maestria. The product is split into two revenue-critical lanes:

1. Lane A, the internal operations engine for staff and owners
2. Lane B, the client growth experience engine for buyers, reorders, and seasonal demand

All workflows consume Flow Engine. Maestria owns the premium client-facing and operator-facing surfaces. No business logic is duplicated.

## Full sitemap

### Lane A

1. /internal/executive-dashboard
2. /internal/quote-pipeline
3. /internal/custom-order-management
4. /internal/production-tracker
5. /internal/inventory-center
6. /internal/supplier-po-center
7. /internal/shipping-center
8. /internal/finance-surface
9. /internal/crm-internal-view

### Lane B

1. /client/smart-quote-request-portal
2. /client/guided-gift-builder
3. /client/corporate-client-portal
4. /client/order-tracking-experience
5. /client/loyalty-vip-system
6. /client/seasonal-campaign-engine
7. /demo/shopmoica

## MVP first launch set

1. Executive Dashboard
2. Quote Pipeline
3. Custom Order Management
4. Production Tracker
5. Finance Surface
6. Smart Quote Request Portal
7. Corporate Client Portal
8. Order Tracking Experience
9. Seasonal Campaign Engine

## Data models required

1. QuoteWorkspace
2. CatalogSku
3. BundleAssemblyRequirement
4. InventoryReservation
5. SupplierProfile
6. VendorRiskAlert
7. ShippingOperation
8. DeliveryCalendarEntry
9. OrderProfitabilityRecord
10. CustomerProfile
11. QuoteRequestBrief
12. CorporateCampaignRecord
13. SeasonalCampaign
14. BilingualStatusTemplate

## Repo implementation sequence

1. Finish Flow Engine extraction for payments, workflows, approvals, and supplier core
2. Build Maestria internal operating shell and premium navigation
3. Build Maestria client growth lane and seasonal campaign layer
4. Add bilingual content system and performance hardening
5. Launch Shop Moi Ca pilot with revenue instrumentation

## 30 / 60 / 90 rollout

### 30 days

- Operator shell live
- Executive dashboard live
- Quote pipeline live
- Order and production control live
- Smart quote request portal live

### 60 days

- Corporate portal live
- Inventory and supplier center live
- Seasonal campaign engine live
- Mobile polish and FR copy system live
- Shipping center live

### 90 days

- Guided gift builder live
- Loyalty and concierge layer live
- CRM internal memory live
- Pilot evidence pack live

## Revenue impact model

1. Faster quote turnaround increases win rate
2. Deposit and margin controls prevent bad revenue
3. Corporate reorder portal increases account expansion
4. Seasonal engine creates predictable campaign pipeline
5. Founder dashboard reduces coordination drag and speeds intervention

## Instant wow

1. Premium founder dashboard
2. Luxury-grade quote and approval experience
3. Corporate buyer self-service portal
4. Elegant order tracking

## Long-term stickiness

1. Campaign history and reorder memory
2. Supplier and production evidence
3. Saved preferences and VIP profiles
4. Seasonal performance history
5. Team workflow habit formation

## 10 out of 10 roadmap

The roadmap is only valid if Maestria stays as the premium surface layer, Flow Engine remains the workflow core, and Shop Moi Ca specific intelligence is preserved as the flagship edition rather than dissolved into generic SaaS copy.

## Current build status

### Live now

1. Executive Dashboard with orders at risk, vendor delay impact, deposit exposure, shipping queue volume, and inventory shortage warnings
2. Quote Pipeline with bilingual service statuses, approval checkpoints, margin guardrails, and deposit visibility
3. Custom Order Management with packaging specs, personalization notes, reservation visibility, SLA timers, and payment-gate release signals
4. Production Tracker with the real Shop Moi Ca production sequence from quote approved through completed delivery
5. Inventory Center with catalog truth, bundle component availability, substitutions, top sellers, dead stock, and seasonal readiness
6. Supplier / PO Center with vendor directory, MOQ, cost history, quality notes, seasonal readiness, and late-risk alerts
7. Shipping Center with local delivery queue, carrier shipments, pickup orders, multi-address corporate drops, and delivery calendar control
8. Finance Surface with product cost, packaging cost, labor, shipping, discount impact, gross margin dollars, and stoplight margin flags
9. CRM Internal View with VIP memory, repeat-order reminders, and bilingual service preferences
10. Smart Quote Request Portal with delivery complexity, branding, and language mode captured in intake
11. Corporate Client Portal with recipient counts, address complexity, branded inserts, invoice terms, and reorder actions
12. Order Tracking Experience with bilingual reassurance templates and shipping-grounded customer updates
13. Seasonal Campaign Engine with operational load framing tied to inventory and shipping reality
14. Dedicated /demo/shopmoica route with credible founder demo scenarios across vendor delay, rush delivery, corporate reorders, and margin leakage
15. Typed Shop Moi Ca pilot dataset powering the vertical-specific surfaces

### Still scaffolded

1. Guided Gift Builder
2. Loyalty / VIP System
3. Concierge Requests

### Shared pilot models now implemented

1. QuoteWorkspace
2. CatalogSku
3. BundleAssemblyRequirement
4. InventoryReservation
5. CustomOrderRecord
6. ProductionJob
7. SupplierProfile
8. VendorRiskAlert
9. ShippingOperation
10. DeliveryCalendarEntry
11. OrderProfitabilityRecord
12. CustomerProfile
13. QuoteRequestBrief
14. CorporateCampaignRecord
15. SeasonalCampaign
16. BilingualStatusTemplate

### Flow Engine alignment now active

1. Payment gating summaries use `@nzila/flow-engine`
2. Shared engine module metadata is displayed in live Maestria surfaces
3. Workflow/status/payment behavior remains on shared engine boundaries while Shop Moi Ca language stays in the Maestria edition layer
4. Shipping, vendor risk, and reservation-heavy operator surfaces still respect shared orchestration boundaries instead of creating duplicate workflow logic

## First-customer readiness pass (Shop Moi Ca)

### Backend persistence now live

1. Durable SQLite persistence via `apps/maestria/lib/maestria-persistence.ts`
2. Quotes, comments, tasks, and proposals are persisted as operational records
3. Contact and trial submissions now persist records and produce operational events

### Connector flows now auth-ready

1. Shopify, Google Ads, Zoho connector account state is persisted
2. OAuth-ready start flow endpoint: `POST /api/maestria/connectors/{system}` with `{ "action": "start_auth" }`
3. Callback endpoint for token handoff simulation: `GET /api/maestria/connectors/{system}/callback?state=...&code=...`
4. Operational connector snapshot now merges health stub + connected account state

### Notification delivery layer now active

1. Delivery API: `POST /api/maestria/notifications`
2. Delivery ledger API: `GET /api/maestria/notifications`
3. Supports `email`, `in_app`, and `webhook` channels with persisted status

### KPI analytics warehouse now active

1. Event ingest API: `POST /api/maestria/analytics/events`
2. KPI warehouse summary API: `GET /api/maestria/analytics/kpis`
3. Contact/trial and record mutations emit KPI events for ops + growth tracking

### Proposal PDF and pricing configurator now active

1. Pricing configurator API: `POST /api/maestria/pricing/quote`
2. Proposal PDF API: `GET /api/maestria/proposals/{id}/pdf`
3. Pricing quote creation also persists quote records for auditability

### Screenshot asset generation path

1. Screenshot queue API: `POST /api/maestria/assets/screenshots`
2. Manifest generator script: `pnpm --filter @nzila/maestria assets:screenshots`
3. Queue records target file paths for CI/browser capture and sales packs

### Onboarding tightening and reliability

1. First-customer readiness endpoint: `GET /api/maestria/onboarding/readiness`
2. Readiness score combines persistence, connector state, notifications, and analytics ingestion
3. APIs include stricter payload validation and explicit error codes for safer client integration
