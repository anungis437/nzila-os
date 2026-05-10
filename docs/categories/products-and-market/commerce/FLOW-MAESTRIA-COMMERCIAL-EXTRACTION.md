# Flow -> Maestria Commercial Extraction And Product Realignment

## Executive Thesis

Flow is not just a product shell. It contains three different things mixed together:

1. reusable operational commerce logic that belongs in Flow Engine
2. ShopMoiCa-specific operator truth that should become Maestria SMC Edition
3. drift and unfinished integration work that should be removed

The correct move is not to clone Flow and rebrand it. The correct move is to separate the operating system from the tenant truth.

- Flow Engine becomes the reusable commerce workflow core for NzilaOS.
- Flow remains an internal or portfolio commerce product consuming Flow Engine.
- Maestria becomes the premium SME operating system product.
- Maestria SMC Edition becomes the first vertically opinionated commercial edition, preserving the embedded ShopMoiCa gift and promotional products intelligence.

This is the zero-redundancy path because reusable workflow, approval, payment, supplier, and event logic move once into shared engine modules, while brand, catalog, pricing policy, communication templates, and market-specific UX stay in product or edition layers.

## Non-Negotiable Findings

### 1. Flow contains real operator-grade commercial IP

The strongest reusable IP is already present in code, not only in documents.

- Payment gating and revenue protection:
  - apps/flow/lib/control/guards/payment-guard.ts
  - apps/flow/lib/services/order-payment-gating.ts
  - apps/flow/lib/services/payment-state-service.ts
  - apps/flow/domain/invariants.ts
- Quote governance and approvals:
  - apps/flow/lib/services/quote-approval-service.ts
  - apps/flow/lib/policy-enforcement.ts
  - apps/flow/lib/governed-quote.ts
- Workflow choreography:
  - apps/flow/lib/workflows/order-workflow.ts
  - apps/flow/lib/workflows/quote-state-machine.ts
  - apps/flow/lib/workflows/po-workflow.ts
  - apps/flow/lib/workflows/production-workflow.ts
- Supplier and procurement operations:
  - apps/flow/lib/supplier-service.ts
  - apps/flow/lib/po-service.ts
- Financial and invoicing flow:
  - apps/flow/lib/financial-service.ts
- Pricing and margin intelligence:
  - packages/pricing-engine/src/pricing-engine.ts
  - apps/flow/lib/profitability.ts
- Multi-tenant commerce configuration:
  - packages/platform-commerce-org/src/defaults.ts
  - packages/platform-commerce-org/src/service.ts
  - apps/flow/app/(dashboard)/settings/settings-actions.ts
- Domain event infrastructure:
  - packages/commerce-events

### 2. ShopMoiCa truth is not noise; it is the seed of a product edition

ShopMoiCa references are carrying actual market intelligence:

- Quebec tax logic and compound tax treatment in packages/pricing-engine/src/pricing-engine.ts
- deposit-before-production discipline in packages/platform-commerce-org/src/defaults.ts
- quote approval thresholds and margin floors in packages/platform-commerce-org/src/defaults.ts
- secure customer approval portal and revision loops in apps/flow/docs/pilots/SHOPMOICA-END-TO-END-WORKFLOW.md
- proof, production, QC, and fulfillment sequence in the production workflow stack
- communication lifecycle templates in packages/platform-commerce-org/src/defaults.ts
- luxury gift and seasonal prompt framing in apps/flow/lib/ai-actions.ts
- full demo and readiness artifacts in apps/flow/docs/pilots and apps/flow/docs/runbooks

This is not legacy clutter. This is the first commercial edition blueprint.

### 3. Flow also contains measurable drift

The biggest drift areas are:

- incomplete Shopify and partially aspirational integration surfaces
- docs claiming production completeness where code still contains placeholders or incomplete adapters
- gift-box and Quebec-specific copy embedded in general product marketing
- AI prompts still anchored to a luxury gift catalog instead of edition-aware prompt contracts
- locale and branding defaults pulled directly from ShopMoiCa defaults in core app surfaces

That drift should be cut or isolated, not carried forward.

## Output 1: Full Flow Audit Findings

### Audit Scorecard

| Domain | Reality | Commercial Value | Decision |
| --- | --- | --- | --- |
| Payment gating | Strong, reusable, policy-driven | Very high | Extract now |
| Quote approval | Strong, generic B2B pattern | High | Extract now |
| Order and PO workflows | Strong but app-coupled | High | Extract in phases |
| Pricing engine | Already well extracted | High | Keep shared, make jurisdiction configurable later |
| Profitability analytics | Valuable but partially opinionated | High | Keep in Flow, refactor before extraction |
| Supplier management | Strong reusable service with adapter spillover | Medium-high | Extract core, keep adapters app-side |
| Production planning | Sophisticated but edition-specific in places | High | Split core from SMC-specific proof/QC loops |
| Financial service | Valuable but tightly app-integrated | Medium-high | Extract later |
| AI quoting | Useful but prompt-coupled to gift business | Medium | Rebuild as edition-aware capability |
| Integrations | Mixed; some incomplete | Low-medium | Delete or rewrite |

### Hard Truth

The hidden strength of Flow is not its marketing layer. It is the operator-grade control model underneath:

- quotes do not simply move forward; they cross approval and revision gates
- production does not start on optimism; it starts on payment clearance and readiness checks
- cash collection, procurement, production, and shipment are treated as one system
- settings already hint at a real multi-tenant product shape

That is the product asset to preserve.

## Output 2: Recovered Hidden Commercial IP

### Recovered IP Stack

| IP Asset | Where It Lives | Why It Matters |
| --- | --- | --- |
| Deposit-before-production discipline | packages/platform-commerce-org/src/defaults.ts, apps/flow/lib/control/guards/payment-guard.ts | Protects cash and working capital in B2B operations |
| Margin-floor and discount governance | apps/flow/lib/profitability.ts, apps/flow/lib/policy-enforcement.ts | Prevents bad deals from entering the system |
| Share-link approval portal | apps/flow/lib/services/share-link-service.ts, workflow docs | Lets buyers approve without forcing user accounts |
| Revision loop operations | apps/flow/lib/services/quote-approval-service.ts | Makes B2B quoting collaborative rather than linear |
| Order to PO to production to shipment choreography | apps/flow/lib/workflows/*.ts | This is the operational spine of the product |
| Tenant-native commerce configuration | packages/platform-commerce-org | Enables editioning without forking code |
| Evidence-first audit trail | packages/commerce-events and Flow command handlers | Critical for enterprise trust, finance, and dispute resolution |
| Quebec tax and Canadian commerce readiness | packages/pricing-engine/src/pricing-engine.ts | Gives immediate credibility in the first market |
| Supplier lead-time and procurement controls | apps/flow/lib/supplier-service.ts | Turns quoting into deliverable operations |

### Hidden Commercial Lesson

Flow already knows how a real promotional products operator thinks:

- do not quote below safe margins
- do not produce before deposit when capital risk is material
- do not lose the approval thread
- do not separate procurement from profitability
- do not separate production status from customer communication

That is not just software behavior. That is product-market knowledge.

## Output 3: Exact Files And Modules To Move Into Flow Engine

### Immediate Extraction Slice

These are the first engine-grade modules because they are already close to pure business logic.

| Source | Target | Decision |
| --- | --- | --- |
| apps/flow/lib/control/guards/payment-guard.ts | packages/flow-engine/src/payment-gating/guard.ts | Move |
| apps/flow/lib/services/order-payment-gating.ts | packages/flow-engine/src/payment-gating/service.ts | Move |
| apps/flow/lib/services/payment-state-service.ts | packages/flow-engine/src/payment-gating/state.ts | Move |
| apps/flow/domain/invariants.ts | packages/flow-engine/src/payment-gating/invariants.ts and shared workflow invariants | Split and move reusable parts |
| apps/flow/lib/services/quote-approval-service.ts | packages/flow-engine/src/approvals/engine.ts | Move logic |
| apps/flow/lib/policy-enforcement.ts | packages/flow-engine/src/approvals/policy.ts | Move |
| apps/flow/lib/governed-quote.ts | packages/flow-engine/src/quoting/governance.ts | Move reusable policy evaluation |
| apps/flow/lib/workflows/order-workflow.ts | packages/flow-engine/src/workflows/order.ts | Move |
| apps/flow/lib/workflows/quote-state-machine.ts | packages/flow-engine/src/workflows/quote.ts | Move and remove SMC wording |
| apps/flow/lib/workflows/po-workflow.ts | packages/flow-engine/src/workflows/purchase-order.ts | Move |
| apps/flow/lib/workflows/production-workflow.ts | packages/flow-engine/src/workflows/production.ts | Move generic transitions only |
| apps/flow/lib/supplier-service.ts | packages/flow-engine/src/suppliers/service.ts | Split core from Zoho adapter |

### Second Extraction Slice

| Source | Target | Decision |
| --- | --- | --- |
| apps/flow/lib/financial-service.ts | packages/flow-engine/src/financial/service.ts | Extract once payment model is stabilized |
| apps/flow/lib/production-service.ts | packages/flow-engine/src/production/service.ts | Extract allocation core only |
| apps/flow/lib/profitability.ts | packages/flow-engine/src/quoting/profitability.ts | Extract after margin policy is config-driven |

### Keep Shared Where They Already Belong

- packages/pricing-engine
- packages/platform-commerce-org
- packages/commerce-events

These are already on the right side of the boundary.

## Output 4: Exact Files And Surfaces To Rebuild In Maestria

Maestria should not inherit Flow UI wholesale. It should be rebuilt around operator workflows and edition-aware packaging.

### Rebuild As Maestria Core Product Surfaces

| Current Flow Surface | Maestria Surface | Why Rebuild |
| --- | --- | --- |
| apps/flow/app/(dashboard)/quotes | apps/maestria/app/[locale]/quotes | Maestria needs a more general quote workspace and edition-aware templates |
| apps/flow/app/(dashboard)/orders | apps/maestria/app/[locale]/orders | Must present operational pipeline rather than Flow-specific product framing |
| apps/flow/app/(dashboard)/production | apps/maestria/app/[locale]/production | Needs generalized workbench with edition-specific steps injected |
| apps/flow/app/(dashboard)/purchase-orders | apps/maestria/app/[locale]/procurement | Better framing for supplier and procurement ops |
| apps/flow/app/(dashboard)/payments | apps/maestria/app/[locale]/payments | Cash control needs first-class visibility |
| apps/flow/app/(dashboard)/invoices | apps/maestria/app/[locale]/invoices | Finance surface should align with operator workflows |
| apps/flow/app/(dashboard)/suppliers | apps/maestria/app/[locale]/suppliers | Shared supplier governance, not Flow-only semantics |
| apps/flow/app/(dashboard)/settings | apps/maestria/app/[locale]/settings | Needs explicit product/edition separation |
| apps/flow/app/(dashboard)/analytics | apps/maestria/app/[locale]/analytics | Must show margin, throughput, approval latency, deposit lag |

### Keep Out Of Maestria Core

- direct gift-box-specific marketing copy
- ShopMoiCa brand wording
- Quebec-only assumptions in generic UI copy
- luxury gift prompts hardcoded into AI workflows

Those belong in the SMC edition layer.

## Output 5: Exact Maestria SMC Edition Feature Map

Maestria SMC Edition is not a demo. It is the first serious vertical edition.

### SMC Edition Package

| Capability | Source Truth | Keep As SMC Edition? |
| --- | --- | --- |
| Quebec GST/QST defaults | packages/platform-commerce-org/src/defaults.ts, packages/pricing-engine/src/pricing-engine.ts | Yes |
| CAD, Quebec locale, invoice and quote prefixes | packages/platform-commerce-org/src/defaults.ts | Yes |
| Deposit required before production | packages/platform-commerce-org/src/defaults.ts | Yes |
| Gift and promotional products workflow templates | apps/flow/docs/pilots/SHOPMOICA-END-TO-END-WORKFLOW.md | Yes |
| Seasonal and corporate order assumptions | apps/flow/lib/ai-actions.ts, demo seed docs | Yes |
| Share-link client approval flow | apps/flow/lib/services/share-link-service.ts | Yes |
| Proof approval and quality-check gates | production workflow stack | Yes |
| Communication templates for quote, deposit, production, shipping | packages/platform-commerce-org/src/defaults.ts | Yes |
| Luxury gift and curated catalog AI prompts | apps/flow/lib/ai-actions.ts | Yes, but rewrite as edition config |

### SMC Edition Positioning

Maestria SMC Edition should be sold as:

"The operating system for promotional products and curated gift businesses that need quoting accuracy, deposit discipline, supplier control, and production visibility."

### Future Edition Family

- Maestria SMC Edition: promotional products and curated gifting
- Maestria Events Edition: event merchandise and activation logistics
- Maestria Corporate Merch Edition: high-volume branded merchandise programs
- Maestria Print And Packaging Edition: proof-heavy production and fulfillment workflows

## Output 6: Maestria UI Sitemap

### Product-Level Sitemap

1. Home
2. Pipeline
3. Quotes
4. Orders
5. Procurement
6. Production
7. Payments
8. Invoices
9. Suppliers
10. Clients
11. Analytics
12. Settings

### Proposed Screen Intent

| Screen | Purpose |
| --- | --- |
| Home | Executive view of revenue at risk, approvals, deposits due, production bottlenecks |
| Pipeline | Unified lifecycle board across quote, order, procurement, production, shipment |
| Quotes | Build, price, approve, revise, and send quotes |
| Orders | Accepted business with financial and operational readiness state |
| Procurement | Supplier selection, PO creation, lead times, vendor exposure |
| Production | Proof approvals, scheduling, allocation, QC, readiness |
| Payments | Deposit collection, outstanding balances, blocked actions |
| Invoices | Issue, reconcile, age, and close invoices |
| Suppliers | Supplier performance, terms, lead-time risk |
| Clients | Account history, quote acceptance, margin profile |
| Analytics | Margin leakage, approval lag, production throughput, payment risk |
| Settings | Core tenant settings, edition defaults, workflows, branding, AI policies |

### SMC Edition Navigation Additions

1. Catalog Themes
2. Seasonal Campaigns
3. Proof Desk
4. Corporate Programs

These should be edition modules, not universal defaults.

## Output 7: Pricing Model

Pricing has to reflect operational value, not generic SaaS vanity metrics.

### Recommended Pricing

| Plan | Customer | Monthly Price | What It Unlocks |
| --- | --- | --- | --- |
| Foundation | owner-led SME with low workflow complexity | 1499 CAD | quotes, approvals, payments, invoices, suppliers, baseline analytics |
| Growth | established operator with multiple team roles | 3499 CAD | full pipeline, procurement, production, SMC edition templates, approval policies, advanced analytics |
| Operator+ | multi-team operator or fast-scaling merch business | 6999 CAD | automation rules, AI assist, role governance, multi-location workflows, priority support |

### One-Time Revenue

| Offer | Price |
| --- | --- |
| SMC Edition onboarding | 5000 to 12000 CAD |
| workflow migration and data setup | 8000 to 25000 CAD |
| procurement and finance integration package | 12000 to 30000 CAD |
| executive operating cadence package | 5000 CAD |

### Expansion Revenue

- additional edition modules
- premium AI guidance and proposal automation
- supplier scorecard and procurement intelligence pack
- board and investor reporting pack

This is not a seat-based commodity product. It is an operational control system tied to gross margin, lead time, deposit capture, and fulfillment reliability.

## Output 8: 90-Day Roadmap

### Days 1-30

- finish the commercial extraction blueprint and lock the boundaries
- move payment gating into Flow Engine
- move quote approval policy logic into Flow Engine
- strip ShopMoiCa wording from shared workflow modules
- define edition config contract for SMC
- remove incomplete Shopify drift and orphaned Canva references

### Days 31-60

- extract order, quote, and PO workflow state machines into Flow Engine
- split supplier core from vendor-specific adapters
- build Maestria authenticated shell beyond the current marketing scaffold
- create Maestria pipeline, quotes, payments, and settings surfaces
- move SMC defaults from hardcoded app behavior to edition config objects

### Days 61-90

- launch Maestria SMC Edition pilot environment
- port proof desk and production workbench patterns into Maestria edition screens
- wire analytics for margin leakage, blocked orders, approval latency, and payment lag
- convert AI prompts to edition-aware prompt profiles
- retire Flow-only product copy that still claims engine status or gift-box specificity in universal surfaces

## Output 9: Repo Implementation Sequence

### Phase A: Clean Separation

1. delete incomplete Shopify adapter usage and related dead paths
2. remove brand and market wording from reusable workflow modules
3. make `@nzila/platform-commerce-org` the only source of tenant and edition defaults

### Phase B: Engine Extraction

1. create `packages/flow-engine/src/payment-gating/*`
2. port payment guard, payment gating service, and payment state logic
3. create `packages/flow-engine/src/workflows/*` from Flow state machines
4. port quote approval and policy evaluation into `packages/flow-engine/src/approvals/*`
5. create `packages/flow-engine/src/suppliers/*` for supplier core services

### Phase C: Maestria Build

1. expand apps/maestria from current shell into authenticated product
2. build pipeline, quotes, payments, settings, procurement, and production screens
3. consume shared Flow Engine modules only through package boundaries
4. add edition resolver for `smc`

### Phase D: SMC Edition

1. create edition configuration package or contract rooted in `packages/platform-commerce-org`
2. port ShopMoiCa defaults, communications, and workflow templates into edition config
3. rewrite AI prompts as edition-aware prompt packs
4. add SMC-specific navigation modules and proof workflow surfaces

### Phase E: Commercial Readiness

1. publish operator metrics dashboards
2. produce SMC pilot runbook and onboarding pack
3. build case-study style evidence from pilot operations

## Output 10: Why This Is A $1M+ Product Path

This becomes a $1M+ path if Nzila sells the outcome, not the interface.

### Why It Can Win

1. It is anchored in real operating pain: quotes, deposits, procurement, proofing, production, shipping, and cash collection are one system.
2. It already contains market-tested rules instead of generic workflow abstractions.
3. It can launch with a sharp initial wedge: promotional products and curated gifting.
4. It supports land-and-expand revenue through editioning, onboarding, integrations, and operational intelligence packs.
5. It has defensibility through embedded workflow truth, financial controls, and auditability, not just UX polish.

### What Creates The Revenue Path

- 10 customers at an average of 3500 CAD MRR is 420000 CAD ARR
- 10 implementation projects at an average of 15000 CAD is 150000 CAD
- 10 premium add-on packs at an average of 8000 CAD annually is 80000 CAD
- 10 customers expanding into higher plans or additional editions closes the gap quickly

The path is credible because the product is solving gross-margin protection and operational throughput, not generic team collaboration.

## Keep / Extract / Rebuild / Delete Summary

### Keep Shared

- packages/pricing-engine
- packages/platform-commerce-org
- packages/commerce-events

### Extract To Flow Engine

- payment gating stack
- approval and quote governance stack
- reusable workflow state machines
- supplier core logic
- later: financial and production core services

### Rebuild In Maestria

- universal operator UI and control surfaces
- pipeline dashboard
- quote, payment, procurement, and production workbenches
- analytics and settings experience

### Preserve As SMC Edition

- Quebec defaults
- promotional products and curated gifting workflows
- proof desk and QC patterns
- seasonal and corporate-order AI guidance
- communication templates and buyer portal behaviors

### Delete

- incomplete Shopify adapter paths
- orphaned Canva references
- generic surfaces that still hardcode ShopMoiCa where an edition contract should exist

## Immediate Next Build Slice

The first implementation slice after this document should be:

1. extract payment gating into Flow Engine
2. create the edition contract for SMC defaults and prompts
3. remove the incomplete Shopify drift

That sequence hardens the shared core, preserves the tenant truth, and keeps the next Maestria build steps clean.
