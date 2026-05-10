# Commerce ADR Index

Architecture Decision Records for the Nzila Commerce Engine.

| # | Title | Status | Date |
|---|-------|--------|------|
| 001 | Order entity is the fulcrum between quote and invoice | Accepted | 2026-02-24 |

---

## ADR-001: Order Entity as the Fulcrum

**Status:** Accepted

**Context:** The legacy shop quoter has no Order entity — quote acceptance directly
creates an invoice, producing orphaned states when creation fails and providing
no record of "what was agreed upon."

**Decision:** The Commerce Engine introduces an explicit Order entity that:

- Locks the accepted quote snapshot (pricing, lines, tax)
- Gates payment verification before fulfilment
- Serves as the source of truth for invoicing
- Anchors returns, refunds, and disputes

**Consequences:**

- Quote acceptance emits `QuoteAccepted` event; a saga creates the Order
- Invoice is generated from Order, not from Quote directly
- All fulfilment references Order, never Quote
