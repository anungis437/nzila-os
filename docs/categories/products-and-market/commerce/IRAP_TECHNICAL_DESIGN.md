# IRAP Technical Design Document — Shop Quoter Adapter

> **Document ID:** IRAP-TD-SQ-001  
> **Version:** 1.0  
> **Date:** 2026-02-24  
> **Author:** NzilaOS Engineering  
> **Classification:** Internal — IRAP Project File  
> **Package:** `@nzila/shop-quoter`  
>
> **Note:** The `@nzila/shop-quoter` package has been superseded by `apps/flow` (full commerce vertical). This document is retained for IRAP audit trail.

---

## 1. Executive Summary

The Shop Quoter Adapter (`@nzila/shop-quoter`) bridges the legacy ShopMoiÇa
gift-box quoting application into the NzilaOS commerce engine. This document
describes the technical design in alignment with IRAP (Industrial Research
Assistance Program) reporting requirements for the Nzila commerce
modernisation project.

**Objective:** Replace a monolithic Supabase/React application with a modular,
org-scoped, evidence-backed commerce engine while preserving all historical
quoting data and business logic.

**Technological Advancement:** The project advances the state of the art in
three SR&ED-eligible areas:

1. **Declarative state machine commerce orchestration** — replacing procedural
   if/else lifecycle management with composable, guarded transition machines
2. **Evidence-first audit architecture** — tamper-evident, hash-chained audit
   trails integrated at the framework level
3. **Pure-function pricing engine** — deterministic, jurisdictionally-aware
   pricing with formal margin verification

---

## 2. System Architecture

### 2.1 Legacy System (Shop Quoter Tool V1)

| Aspect | Details |
|--------|---------|
| **Stack** | TypeScript, React (Vite), Supabase (PostgreSQL), Zoho CRM/Books/Inventory |
| **Jurisdiction** | Quebec, Canada (GST 5% + QST 9.975%) |
| **Key files** | `src/lib/margin-solver.ts` (pricing), `src/lib/advanced-quoting-engine.ts` (quoting), `src/lib/workflow-engine.ts` (lifecycle) |
| **Data stores** | Supabase PostgreSQL — `requests`, `proposals`, `proposal_items`, `clients`, `products` |
| **Integrations** | Zoho CRM v3, Zoho Books, Zoho Inventory, Calendly, Canva |
| **Issues** | Mixed DB/UI concerns, inconsistent console usage, no org isolation, no audit trail, duplicated type definitions |

### 2.2 Target Architecture (NzilaOS Commerce Engine)

```text
┌─────────────────────────────────────────────────────────────────┐
│                        NzilaOS Commerce Engine                   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ commerce-core│  │pricing-engine│  │  commerce-state      │   │
│  │ (types/enums)│  │ (pure math)  │  │  (state machines)    │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         │                 │                      │               │
│  ┌──────▼─────────────────▼──────────────────────▼───────────┐  │
│  │              commerce-services (orchestration)             │  │
│  │  createQuote → priceQuote → completePricing → sendQuote   │  │
│  └────────────────────────┬──────────────────────────────────┘  │
│                           │                                      │
│  ┌────────────────────────▼──────────────────────────────────┐  │
│  │                    shop-quoter (adapter)                    │  │
│  │  Legacy Supabase → Zod validation → mapper → services     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌───────────┐ ┌──────────────┐  │
│  │commerce-   │ │commerce-   │ │commerce-  │ │commerce-     │  │
│  │audit       │ │events      │ │evidence   │ │governance    │  │
│  │(hash chain)│ │(event bus) │ │(seal pack)│ │(guard gates) │  │
│  └────────────┘ └────────────┘ └───────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Package Dependency Graph

| Package | Layer | Dependencies |
|---------|-------|-------------|
| `@nzila/commerce-core` | Domain | `zod` |
| `@nzila/pricing-engine` | Domain | `@nzila/commerce-core` |
| `@nzila/commerce-state` | Domain | `@nzila/commerce-core` |
| `@nzila/commerce-audit` | Domain | `@nzila/commerce-core`, `@nzila/commerce-state` |
| `@nzila/commerce-events` | Domain | `@nzila/commerce-core`, `@nzila/commerce-audit` |
| `@nzila/commerce-services` | Application | `@nzila/commerce-core`, `@nzila/commerce-state`, `@nzila/pricing-engine`, `@nzila/commerce-audit`, `@nzila/commerce-events` |
| `@nzila/commerce-governance` | Application | `@nzila/commerce-core`, `@nzila/commerce-state`, `@nzila/pricing-engine` |
| `@nzila/commerce-evidence` | Application | `@nzila/commerce-core`, `@nzila/commerce-audit`, `@nzila/os-core` |
| **`@nzila/shop-quoter`** | **Adapter** | **`@nzila/commerce-core`, `@nzila/commerce-services`, `@nzila/commerce-audit`, `@nzila/commerce-events`, `@nzila/pricing-engine`, `zod`** |

---

## 3. Technical Uncertainties Addressed (SR&ED Alignment)

### 3.1 Uncertainty: Deterministic Pricing with Jurisdictional Tax

**Problem:** The legacy `margin-solver.ts` calculated Quebec taxes correctly but
was entangled with UI components and Supabase queries. It was unclear whether
the pricing logic could be extracted into a pure function while maintaining
bit-for-bit tax accuracy under Quebec Revenue Agency rules (QST applied to
base + GST).

**Resolution:** The extracted `@nzila/pricing-engine` implements:

```typescript
// From @nzila/pricing-engine/src/pricing-engine.ts (lines 73-140)
// Key formula:
//   COGS = Σ(item.unitCost × item.quantity) + (packaging + labor + shipping) × boxCount
//   PriceBeforeTax = COGS ÷ (1 − targetMargin%)
//   GST = PriceBeforeTax × gstRate
//   QST = (PriceBeforeTax + GST) × qstRate  ← Quebec Revenue Agency rule
//   FinalPrice = PriceBeforeTax + GST + QST
```

The engine is zero-dependency, deterministic, and validates margin floors
against configurable governance policies.

### 3.2 Uncertainty: Lossless Legacy Data Migration

**Problem:** Legacy data is spread across 6+ tables with inconsistent schemas,
two incompatible `Product` type definitions, and mixed client/user identity
boundaries. It was uncertain whether all records could be migrated without
data loss while establishing proper org scoping.

**Resolution:** The `@nzila/shop-quoter` adapter:

- Validates all legacy data through Zod schemas before transformation
- Maps legacy tier strings (case-insensitive) to canonical `PricingTier` enum
- Maps legacy status strings to `QuoteStatus` with safe fallbacks
- Preserves all legacy IDs in `externalIds` and `metadata` fields
- Handles missing proposals by creating placeholder lines
- Produces per-record diagnostics including warnings and failures

### 3.3 Uncertainty: Evidence-First Commerce Lifecycle

**Problem:** The legacy system had no audit trail. Commerce lifecycle
transitions were procedural and untraceable. It was uncertain whether an
evidence-first architecture could be integrated at the commerce framework
level without unacceptable performance overhead.

**Resolution:** NzilaOS commerce engine uses:

- `@nzila/commerce-audit`: hash-chained audit entries with
  `buildTransitionAuditEntry()` and `buildActionAuditEntry()`
- `@nzila/commerce-evidence`: sealed evidence pack builder mapping to
  `@nzila/os-core` evidence lifecycle
- Every state machine transition produces an `AuditEntry` with correlation
  IDs, actor info, and transition metadata

---

## 4. Adapter Design

### 4.1 Data Flow

```text
Legacy Supabase Export (JSON)
  │
  ▼
┌────────────────────────────────────────┐
│  Zod Validation (types.ts)             │
│  legacyRequestSchema.safeParse()       │
│  legacyProposalSchema.safeParse()      │
│  legacyClientSchema.safeParse()        │
└──────────────┬─────────────────────────┘
               │ validated
               ▼
┌────────────────────────────────────────┐
│  Pure Mapping (mapper.ts)              │
│  mapLegacyTier()                       │
│  mapLegacyStatus()                     │
│  mapLegacyClient()                     │
│  mapProposalItems()                    │
│  mapRequestToQuoteInput()              │
└──────────────┬─────────────────────────┘
               │ canonical types
               ▼
┌────────────────────────────────────────┐
│  Adapter Service (adapter.ts)          │
│  importRequest()                       │
│  importBatch()                         │
│  validateLegacyData()                  │
└──────────────┬─────────────────────────┘
               │ delegates to
               ▼
┌────────────────────────────────────────┐
│  Commerce Services                     │
│  createQuoteService(repo).createQuote()│
│  + AuditEntry generation               │
└────────────────────────────────────────┘
```

### 4.2 Port/Adapter Pattern

The adapter follows hexagonal architecture:

- **Ports:** `QuoteRepository` (from `@nzila/commerce-services`),
  `CustomerRepository` (defined in adapter)
- **Adapter:** `createShopQuoterAdapter()` — injected with repositories
- **No direct DB access** — all persistence through injected ports

### 4.3 Org Isolation

All operations are scoped via `OrgContext.orgId`:

- Migration context uses `config.defaultEntityId`
- Actor is `system:migration` with admin permissions
- Every audit entry references the org entity ID

---

## 5. Testing Strategy

| Test Type | Location | Coverage |
|-----------|----------|----------|
| **Mapper unit tests** | `mapper.test.ts` | Tier mapping, status mapping, client transformation, proposal item ordering, quote input construction |
| **Adapter integration tests** | `adapter.test.ts` | Full import flow with stub repositories, validation, batch import, idempotent customer reuse |
| **Contract tests** | `tooling/contract-tests/` | Invariant enforcement (no console in runtime, evidence trail completeness) |

---

## 6. Risk Register

| Risk | Mitigation | Status |
|------|-----------|--------|
| Legacy data contains invalid records | Zod validation with per-record error reporting | Mitigated |
| Duplicate imports create orphan records | Idempotent customer repo + legacy ID tracking | Mitigated |
| Tax calculation drift from legacy | Pricing engine extracted directly from `margin-solver.ts`; regression tests verify bit-for-bit parity | Mitigated |
| Org isolation bypass | OrgContext required on all repository methods; contract tests enforce | Mitigated |
| Missing audit trail for migration | Every import produces `AuditEntry` records via commerce-audit builders | Mitigated |

---

## 7. IRAP Milestone Alignment

| Milestone | Deliverable | Status |
|-----------|-------------|--------|
| M1 — Legacy audit | `docs/commerce/LEGACY_REVIEW.md` | Complete |
| M2 — Domain model | `docs/commerce/DOMAIN_MODEL_DRAFT.md` | Complete |
| M3 — Core engine | `@nzila/commerce-core`, `@nzila/pricing-engine`, `@nzila/commerce-state` | Complete |
| M4 — Governance layer | `@nzila/commerce-governance`, `@nzila/commerce-evidence` | Complete |
| M5 — Adapter package | `@nzila/shop-quoter` | **This document** |
| M6 — Integration tests | `@nzila/commerce-integration-tests` | In progress |
| M7 — Production migration | Migration runbook + evidence pack | Planned |

---

*Prepared for IRAP project file. See also:*

- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [Commerce Engine README](../../docs/commerce/README.md)
- [Legacy Review](../../docs/commerce/LEGACY_REVIEW.md)
- [Domain Model Draft](../../docs/commerce/DOMAIN_MODEL_DRAFT.md)
