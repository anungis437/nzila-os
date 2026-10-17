# Agri Stack — Overview

> **Product boundary:** See [ADR-AGRI-001](ADR/ADR-AGRI-001-cora-agrimo-product-boundary.md).
> This document distinguishes product ownership from the current implementation.

## What Is the Agri Stack?

The NzilaOS Agri Stack contains two first-class agricultural products using
shared platform control-plane services and shared agricultural primitives
where the semantics are common.

It consists of **two distinct applications** backed by **shared infrastructure packages**:

| App        | Name   | Purpose                                                                                              |
| ---------- | ------ | ---------------------------------------------------------------------------------------------------- |
| **Agrimo** | Agrimo | Cooperative, offline-first agricultural operations for emerging-market contexts, principally the DRC |
| **Cora**   | Cora   | Food-economy intelligence and coordination for Canada and data-rich agricultural environments        |

**Cora v3 identity:** Agricultural Institutional Infrastructure; core
capability: institutional composability. The food-economy description is a
capability horizon, not evidence or recipient decision authority. See the
[binding v3 alignment](ADR/ADR-AGRI-002-cora-food-economy-ceiling.md) and
[stress-test framework](CORA_STRESS_TEST_FRAMEWORK.md). Production activation,
commercial pilot commitment and material route expansion remain blocked
pending stress-test decisions; separately authorized foundational work is
not stopped.

## Product Relationship

Cora owns its food-economy intelligence and coordination domain; Agrimo owns
its operational agricultural execution domain. Neither is a companion,
subordinate module, replacement, or deployment profile of the other. Their
products may interoperate through governed contracts. NzilaOS remains the
control plane for identity, org/tenant scope, authorization, policy, evidence,
provenance, consent, workflow, methodology, integrations, commerce primitives,
and observability.

Shared agricultural primitives are owned in shared packages only when
semantics are genuinely common. A shared `Farm`, producer, season, or
production concept does not imply shared product behavior.

## Current Implementation

The applications are separately deployable and do not import from one
another. The Phase 0B audit found no live Cora app-source call to an
agricultural repository or intelligence query: the dashboard pages are
placeholders, and current APIs are platform/auth/health routes. Shared
agricultural dependencies do not establish a live data path. See
[CORA_IMPLEMENTATION_SEAM_AUDIT.md](CORA_IMPLEMENTATION_SEAM_AUDIT.md).

### Current operational data flow

```
Agrimo operational workflows ──▶ agri-events / shared data
                                           │
                                           ▼
                                authorized integrations
```

This is an architectural relationship, not evidence of a live Cora
agricultural query path. Future Cora-owned workflows must use Cora-owned
domains and governed shared services; they must not write Agrimo operational
records. See [ADR-AGRI-002](ADR/ADR-AGRI-002-cora-food-economy-ceiling.md).

### Org Isolation

The inspected agricultural tables carry `org_id`, and repository queries
include organization predicates. This is not proof that every table has
deployed RLS or correct database grants; the Phase 0B audit did not establish
that state. Verify database roles/RLS for the target environment before
relying on them as an isolation boundary. Application authorization and
same-org checks remain required.

### Evidence-First

All material actions (lot certification, shipment finalization, payment execution) produce **sealed evidence packs** with hash chains, Merkle roots, timestamps, and actor attribution. These packs are immutable and verifiable.

### No Direct SDK Calls

All external integrations (email, SMS, Slack, Teams, HubSpot) are routed through `@nzila/integrations-runtime` dispatcher. Direct SDK imports are blocked by contract tests.

## Shared Packages

| Package                    | Scope       | Description                                                                          |
| -------------------------- | ----------- | ------------------------------------------------------------------------------------ |
| `@nzila/agri-core`         | Domain      | Canonical types, enums, Zod schemas, FSMs                                            |
| `@nzila/agri-db`           | Data        | Drizzle schema and org-scoped repositories; deployed RLS/grants require verification |
| `@nzila/agri-events`       | Events      | Domain event types, outbox, event bus                                                |
| `@nzila/agri-intelligence` | Analytics   | Yield models, loss rates, payout simulation                                          |
| `@nzila/agri-traceability` | Trust       | Evidence packs, proof chains, org exports                                            |
| `@nzila/agri-adapters`     | Integration | Adapter interfaces for external systems                                              |

## Deployment Strategy

Agrimo and Cora are **separately deployable** — each can be deployed as a standalone Next.js app. The shared packages are workspace dependencies resolved at build time. This enables:

- **Managed**: Products may use shared infrastructure subject to tenant isolation
- **Sovereign**: Product deployments may be org-managed where supported
- **Hybrid**: Independent deployment choices, subject to governed data sharing

## Current Import Boundaries

```
apps/agrimo ──imports──▶ agri-core, agri-db, agri-events, agri-traceability, agri-adapters
apps/cora  ──imports──▶ agri-core, agri-db (read-only), agri-intelligence, agri-traceability

❌ apps/agrimo CANNOT import from apps/cora
❌ apps/cora CANNOT import from apps/agrimo
❌ Shared packages CANNOT import from apps/*
❌ agri-intelligence CANNOT write to Agrimo operational tables
```

The current read-only boundary is enforced in code and remains active.
Changing it requires a separate authorization, tenancy, and contract review;
this doctrine update does not authorize writes.

The [Cora Evidence Foundation](CORA_EVIDENCE_FOUNDATION.md) defines draft
contracts and an additive Cora-owned schema seam, but is not wired to the app
or a persistence adapter. No Cora write permission is granted, the current
read-only boundary remains in force, and its migration has not been applied.

The [organic evidence foundation](CORA_ORGANIC_INSTITUTIONAL_GRAPH.md) defines
jurisdiction-aware institutional roles, public-source rights distinctions,
evidence freshness/conflict, and Passport/Change Watch contracts. It is a
local design contract only: no source registry is active, no live public
source is connected, and no production freshness interval or status mapping
has been approved. See the [C1 public certification evidence case](CORA_C1_AUTHORITY_CASE_ORGANIC_PUBLIC_CERTIFICATION_001.md)
for the bounded publication-authority finding and unresolved access/reuse
rights. The [Cora Institutional Control-Point Map](CORA_INSTITUTIONAL_CONTROL_POINT_MAP.md)
keeps regulatory, certification, public-trust, sector, ecosystem, and research
roles distinct; CCFI is non-blocking for Organic Alpha and no trust-research
runtime collection is enabled.

The [Cora data sovereignty and continuity architecture](CORA_DATA_SOVEREIGNTY_AND_CONTINUITY_ARCHITECTURE.md)
defines the design-only connector boundary and links the `JD001` reference
architecture, capability/rights matrix, portable continuity capsule, and
Deere-independent rehydration test. It does not establish Deere API
capabilities or rights, authorize source access, or change the existing
read-only and evidence-source boundaries.

The [JD001 public capability evidence ledger](CORA_JD001_PUBLIC_CAPABILITY_EVIDENCE_LEDGER.md),
[authorization model](CORA_JD001_AUTHORIZATION_MODEL.md),
[continuity feasibility matrix](CORA_JD001_CONTINUITY_FEASIBILITY_MATRIX.md),
[implementation planning gates](CORA_JD001_IMPLEMENTATION_PLANNING_GATES.md), and
[discovery gaps](CORA_JD001_DISCOVERY_GAPS.md) record the public-evidence
qualification. They are design documentation only and authorize no Deere
access, source activation, or real-data use.

The [JD001 Deere human-discovery pack](CORA_JD001_DEERE_HUMAN_DISCOVERY_CONTRACT.md)
contains prepared, unsent discovery materials only; it authorizes no Deere
contact, application registration, source access, or implementation.
