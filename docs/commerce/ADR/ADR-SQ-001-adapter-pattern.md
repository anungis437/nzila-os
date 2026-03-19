# IRAP — Shop Quoter Adapter ADR-001: Adapter Pattern Selection

> **ADR ID:** ADR-SQ-001  
> **Status:** Accepted (superseded — functionality now in `apps/flow`)  
> **Date:** 2026-02-24  
> **Decision Makers:** NzilaOS Engineering  
> **IRAP Reference:** Project milestone M5  

---

## Context

The legacy Shop Quoter Tool V1 (ShopMoiÇa) stores commerce data across
multiple Supabase tables (`requests`, `proposals`, `proposal_items`, `clients`)
with inconsistent schemas, duplicated type definitions, and direct database
coupling in business logic files.

We need to migrate this data into the NzilaOS commerce engine, which uses:

- Org-scoped entities (`orgId` on every row)
- Declarative state machines for lifecycle management
- Hash-chained audit trails for evidence generation
- Pure-function pricing with margin floor validation

### Constraints

1. Legacy data must be preserved without loss (IRAP audit requirement)
2. Migration must produce a complete audit trail
3. No direct database access from the adapter — repository ports only
4. The adapter must be testable without a real database
5. Batch operations must produce per-record diagnostics

---

## Decision

**We adopt the Hexagonal Architecture (Ports & Adapters) pattern** for the
Shop Quoter adapter.

### Package Structure

```text
packages/shop-quoter/
  src/
    types.ts       — Legacy shapes + Zod schemas (boundary types)
    mapper.ts      — Pure transformation functions (legacy → canonical)
    adapter.ts     — Adapter service with injected repository ports
    index.ts       — Barrel export
```

### Key Design Choices

1. **Types own the boundary** — Legacy data shapes are defined in `types.ts`
   with Zod schemas for runtime validation. No other package imports these.

2. **Mapper is pure** — All transformation logic in `mapper.ts` is pure
   (no I/O, no side effects). This enables exhaustive unit testing.

3. **Adapter delegates to commerce-services** — The adapter calls
   `createQuoteService(repo).createQuote()` rather than writing to the
   database directly. This ensures all governance gates, audit entries,
   and event emissions are triggered exactly as they would be for a
   native NzilaOS quote creation.

4. **Legacy IDs in `externalIds`** — Every migrated entity preserves its
   Supabase UUID in the `externalIds` map, enabling bidirectional
   lookups and lineage tracing.

---

## Code References

### Pricing Engine Extraction

The legacy `margin-solver.ts` pricing logic was extracted into
`@nzila/pricing-engine` as pure functions:

- `calculateTierPricing()` — COGS + margin markup + Quebec tax
- `calculateQuebecTaxes()` — QST = (base + GST) × qstRate
- `validateMarginFloor()` — governance check against configurable floors

Source: `packages/pricing-engine/src/pricing-engine.ts`

### Quote Service Orchestration

The adapter delegates to `@nzila/commerce-services/quote`:

- `createQuoteService(repo)` — factory accepting `QuoteRepository` port
- `createQuote(ctx, input)` — creates draft quote + lines + audit entry
- `priceQuote(ctx, quote, lines, boxCount)` — prices with tier + validates margin

Source: `packages/commerce-services/src/quote-service.ts`

### Audit Trail Integration

Every import produces audit entries via `@nzila/commerce-audit`:

- `buildActionAuditEntry()` — for CREATE actions
- `buildTransitionAuditEntry()` — for state transitions

Source: `packages/commerce-audit/src/audit.ts`

---

## Alternatives Considered

### 1. Direct DB Migration Script

Write a one-time SQL script to INSERT legacy data into NzilaOS tables.

**Rejected because:**

- No audit trail generation
- Bypasses governance gates
- Not testable without a database
- Not reusable for incremental imports

### 2. ETL Pipeline (External Tool)

Use an external ETL tool (e.g., Apache NiFi, Airbyte) for migration.

**Rejected because:**

- Introduces external dependency not aligned with monorepo strategy
- Cannot leverage NzilaOS type system for validation
- Governance gates would need separate integration

### 3. Legacy API Wrapper

Wrap the legacy Supabase API and call it from NzilaOS services.

**Rejected because:**

- Maintains runtime dependency on legacy system
- Does not address data quality issues
- Supabase schema is unstable (30+ migrations, schema conflicts)

---

## Consequences

**Positive:**

- Full audit trail for every migrated record
- Testable without database (repository ports)
- Reusable for incremental imports from Zoho CRM
- Type-safe boundary with Zod validation

**Negative:**

- Slightly more code than a direct SQL script
- Sequential batch processing (not parallel) for ordering guarantees

**Risks:**

- Legacy data quality may require iterative schema updates in `types.ts`
- Large batch imports may require chunking for memory management

---

*Part of [NzilaOS Commerce Engine](./README.md) | IRAP Project File*
