# Nzila Commerce Engine

> Org-first commerce engine for NzilaOS — quoting, orders, invoicing, fulfilment.

## Overview

The Commerce Engine brings structured **quote → order → fulfilment → invoice** lifecycles
into NzilaOS with full org isolation, declarative state machines, event-driven sagas,
and evidence-backed audit trails.

## Specifications

| Document | Purpose |
|----------|---------|
| [STATE_MACHINE_GAP.md](spec/STATE_MACHINE_GAP.md) | Gap analysis of legacy lifecycle vs target state machines |
| [ORG_SCOPE_PLAN.md](spec/ORG_SCOPE_PLAN.md) | Org-isolation requirements for every entity and integration |
| [GLOSSARY.md](spec/GLOSSARY.md) | Canonical term definitions for the Commerce domain |

## Architecture Decision Records

| ADR | Decision |
|-----|----------|
| *(forthcoming)* | |

See [ADR/](ADR/) for the full list.

## Packages

| Package | Layer | Purpose |
|---------|-------|---------|
| `@nzila/commerce-core` | Domain | Types, DTOs, enums, zod schemas — zero dependencies |
| `@nzila/pricing-engine` | Domain | Pure deterministic pricing, tax, discounting |
| `@nzila/commerce-state` | Domain | Declarative state machines + guarded transitions |
| `@nzila/commerce-db` | Data | Org-scoped repositories (Drizzle, extends `@nzila/db`) |

## Key Principles

1. **Org is the root aggregate** — `org_id` scopes every row, every query, every event.
2. **Declarative state machines** — transitions are data, not procedural if/else chains.
3. **Event-driven sagas** — quote acceptance emits an event; a saga creates the order.
4. **Evidence at every gate** — lifecycle milestones produce sealed evidence artefacts.
5. **No console in runtime** — structured logger only; contract tests enforce it.

## Legacy Reference

The legacy `shop_quoter_tool_v1-main` was audited in Phase 1–5 (see `spec/` docs).
Its pricing logic was extracted into a pure-function engine; the rest is reference-only.

---

*Part of [NzilaOS](../../README.md)*
