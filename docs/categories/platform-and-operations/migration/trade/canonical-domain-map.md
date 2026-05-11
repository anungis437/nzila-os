# Trade — Canonical Domain Map

> **Status:** Active  
> **Owner:** Platform team  
> **Last updated:** 2026-02-27

## Purpose

This document defines the **canonical domain model** for the unified Trade platform
within NzilaOS. It supersedes both legacy Trade-OS (Django) and eExports (Django)
applications. Trade-OS provides the preferred structural basis; eExports contributes
cars-vertical depth that is encapsulated behind a vertical boundary.

---

## Core Domain (Generic — Commodity-Neutral)

All core domain entities are **org-scoped** (`org_id` FK to `entities`), use
**audited mutations** (hash-chained), and produce **evidence packs** at terminal
states.

### 1. Party

Represents an actor in a trade relationship.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `org_id` | UUID | FK → entities (org scope) |
| `role` | enum | `seller`, `buyer`, `broker`, `agent` |
| `name` | text | Display name |
| `contact_email` | text | Primary contact |
| `contact_phone` | text | Optional |
| `company_name` | text | Legal entity name |
| `country` | varchar(3) | ISO 3166-1 alpha-3 |
| `metadata` | jsonb | Extensible attributes |
| `status` | enum | `active`, `suspended`, `archived` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 2. Listing

A commodity-neutral item offered for trade.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `org_id` | UUID | FK → entities |
| `party_id` | UUID | FK → trade_parties (seller) |
| `listing_type` | enum | `generic`, `vehicle` (extensible) |
| `title` | text | Human-readable title |
| `description` | text | Markdown-capable |
| `currency` | varchar(3) | ISO 4217 |
| `asking_price` | numeric(18,2) | |
| `quantity` | integer | Available units |
| `status` | enum | `draft`, `active`, `reserved`, `sold`, `archived` |
| `metadata` | jsonb | Vertical-neutral extensions |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 3. Listing Media

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `org_id` | UUID | FK → entities |
| `listing_id` | UUID | FK → trade_listings |
| `media_type` | enum | `image`, `video`, `document` |
| `storage_key` | text | Blob storage path |
| `sort_order` | integer | Display ordering |
| `created_at` | timestamptz | |

### 4. Deal

The central transaction entity — a pipeline-tracked negotiation between parties.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `org_id` | UUID | FK → entities |
| `ref_number` | varchar | `TRD-{ORG}-{SEQ}` |
| `seller_party_id` | UUID | FK → trade_parties |
| `buyer_party_id` | UUID | FK → trade_parties |
| `listing_id` | UUID | FK → trade_listings (nullable) |
| `stage` | enum | FSM-managed (see Deal FSM) |
| `total_value` | numeric(18,2) | |
| `currency` | varchar(3) | |
| `notes` | text | |
| `metadata` | jsonb | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 5. Quote

Terms offered within a deal, subject to acceptance workflow.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `org_id` | UUID | FK → entities |
| `deal_id` | UUID | FK → trade_deals |
| `terms` | jsonb | Structured terms object |
| `unit_price` | numeric(18,2) | |
| `quantity` | integer | |
| `total` | numeric(18,2) | Calculated |
| `currency` | varchar(3) | |
| `valid_until` | timestamptz | Expiry |
| `status` | enum | `draft`, `sent`, `accepted`, `declined`, `expired`, `revised` |
| `accepted_at` | timestamptz | Nullable |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 6. Financing Terms

Financing or payment schedule attached to a deal.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `org_id` | UUID | FK → entities |
| `deal_id` | UUID | FK → trade_deals |
| `terms` | jsonb | Payment schedule, interest, etc. |
| `provider` | text | Financing entity name |
| `status` | enum | `proposed`, `accepted`, `active`, `completed`, `cancelled` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 7. Shipment

Physical movement tracking with milestone-based progression.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `org_id` | UUID | FK → entities |
| `deal_id` | UUID | FK → trade_deals |
| `origin_country` | varchar(3) | |
| `destination_country` | varchar(3) | |
| `lane` | text | Shipping lane identifier |
| `carrier` | text | |
| `tracking_number` | text | |
| `status` | enum | `pending`, `booked`, `in_transit`, `customs`, `delivered`, `cancelled` |
| `milestones` | jsonb | Array of milestone objects |
| `estimated_departure` | timestamptz | |
| `estimated_arrival` | timestamptz | |
| `actual_departure` | timestamptz | |
| `actual_arrival` | timestamptz | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 8. Document

Auditable document attached to a deal or shipment.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `org_id` | UUID | FK → entities |
| `deal_id` | UUID | FK → trade_deals |
| `doc_type` | enum | `bill_of_sale`, `invoice`, `packing_list`, `certificate_of_origin`, `customs_declaration`, `inspection_report`, `export_certificate`, `insurance`, `other` |
| `title` | text | |
| `storage_key` | text | Blob storage path |
| `content_hash` | text | SHA-256 of content |
| `uploaded_by` | UUID | Actor ID |
| `created_at` | timestamptz | |

### 9. Commission

Broker/referral fee policy and settlement.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `org_id` | UUID | FK → entities |
| `deal_id` | UUID | FK → trade_deals |
| `party_id` | UUID | FK → trade_parties (broker) |
| `policy` | jsonb | Rate, tiers, conditions |
| `calculated_amount` | numeric(18,2) | |
| `currency` | varchar(3) | |
| `status` | enum | `pending`, `previewed`, `finalized`, `paid`, `cancelled` |
| `finalized_at` | timestamptz | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

## Deal FSM (Finite State Machine)

```
lead → qualified → quoted → accepted → funded → shipped → delivered → closed
```

### Transition Rules

| From | To | Allowed Roles | Evidence Required |
|---|---|---|---|
| lead | qualified | admin, seller, broker | No |
| qualified | quoted | admin, seller | No |
| quoted | accepted | admin, buyer | **Yes** — quote acceptance pack |
| accepted | funded | admin, seller | No |
| funded | shipped | admin, seller | **Yes** — shipment docs pack |
| shipped | delivered | admin, seller, buyer | No |
| delivered | closed | admin | **Yes** — commission settlement pack |

### Terminal States

- `closed` — fully completed
- (any stage can be `cancelled` — separate status, not part of main FSM)

### Evidence Packs (Terminal Stages)

| Pack | Triggered At | Contents |
|---|---|---|
| `quote_acceptance_pack` | `quoted → accepted` | Quote hash + parties + timestamp |
| `shipment_docs_pack` | `funded → shipped` | Hash chain of required documents |
| `commission_settlement_pack` | `delivered → closed` | Policy + calculation + final amount |

---

## Audit Trail

Every mutation produces an `AuditEntry` following the `@nzila/commerce-audit` pattern:

- `entityType`: `trade_deal`, `trade_quote`, `trade_listing`, etc.
- `action`: `created`, `updated`, `transitioned`, `deleted`
- Hash-chained for integrity verification via `@nzila/os-core`

---

## Integration Events

Published via `@nzila/integrations-runtime` dispatcher:

| Event | Trigger |
|---|---|
| `trade.deal.created` | New deal |
| `trade.quote.sent` | Quote sent to buyer |
| `trade.quote.accepted` | Quote accepted |
| `trade.shipment.milestone` | Shipment milestone updated |
| `trade.document.uploaded` | New document attached |
| `trade.commission.finalized` | Commission finalized |

---

## Package Topology

```
packages/trade-core      → types, enums, schemas, FSM definitions (pure TS)
packages/trade-db         → Drizzle schema, repositories (org-scoped)
packages/trade-adapters   → legacy import adapters, external integrations
packages/trade-cars       → vehicle vertical types, UI components, helpers

apps/trade                → Next.js app (consumes all trade packages)
```

### Import Rules

- `trade-core` may NOT import from any other trade package
- `trade-db` may import from `trade-core` only
- `trade-adapters` may import from `trade-core` and `trade-db`
- `trade-cars` may import from `trade-core` only (no DB dependency)
- `apps/trade` may import from ALL trade packages
- **Core packages may NOT import from `trade-cars`** (vertical boundary)
