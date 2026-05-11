# Agri Stack — Data Model

## Entity Relationship Overview

```
Organization (org)
  │
  ├── Producers ──────────▶ Harvests ──────────▶ Lot Contributions
  │                                                     │
  ├── Cooperatives                                      ▼
  │                                                   Lots
  ├── Crops                                             │
  │                                              ┌──────┴──────┐
  ├── Warehouses                                 ▼              ▼
  │                                     Quality Inspections   Certifications
  │                                              │
  │                                              ▼
  │                                           Batches
  │                                              │
  │                                     ┌────────┴────────┐
  │                                     ▼                  ▼
  │                              Batch Allocations    Shipments
  │                                                        │
  │                                                   Milestones
  │
  ├── Payment Plans ──────▶ Payments
  │
  └── Traceability Links (lot → batch → shipment)
```

## Canonical Tables (all org-scoped)

### agri_producers

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| org_id | uuid | FK → entities.id |
| name | text | Producer name |
| contact_phone | text | nullable |
| contact_email | text | nullable |
| location | jsonb | `{ lat, lng, region, district }` |
| cooperative_id | uuid | nullable, FK → agri_producers.id |
| status | enum | active, inactive, suspended |
| metadata | jsonb | arbitrary org-specific fields |
| created_at | timestamp | |
| updated_at | timestamp | |

### agri_crops

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| org_id | uuid | FK → entities.id |
| name | text | e.g., "Arabica Coffee" |
| crop_type | text | e.g., "coffee", "cocoa", "cashew" |
| unit_of_measure | text | e.g., "kg", "lb", "bag_60kg" |
| baseline_yield_per_hectare | numeric | nullable, for intelligence |
| metadata | jsonb | |
| created_at | timestamp | |

### agri_harvests

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| org_id | uuid | FK → entities.id |
| producer_id | uuid | FK → agri_producers.id |
| crop_id | uuid | FK → agri_crops.id |
| season | text | e.g., "2025B" |
| harvest_date | date | |
| quantity | numeric | in crop's unit of measure |
| geo_point | jsonb | `{ lat, lng }` |
| notes | text | nullable |
| created_at | timestamp | |

### agri_lots

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| org_id | uuid | FK → entities.id |
| ref | text | unique lot reference |
| crop_id | uuid | FK → agri_crops.id |
| season | text | |
| total_weight | numeric | computed from contributions |
| status | enum | pending, inspected, graded, certified, rejected |
| created_at | timestamp | |
| updated_at | timestamp | |

### agri_lot_contributions

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| org_id | uuid | FK → entities.id |
| lot_id | uuid | FK → agri_lots.id |
| harvest_id | uuid | FK → agri_harvests.id |
| weight | numeric | producer contribution to lot |
| created_at | timestamp | |

### agri_quality_inspections

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| org_id | uuid | FK → entities.id |
| lot_id | uuid | FK → agri_lots.id |
| inspector_id | text | actor who performed inspection |
| grade | text | nullable, assigned after grading |
| score | numeric | nullable, 0-100 |
| defects | jsonb | `{ moisture, foreign_matter, ... }` |
| notes | text | nullable |
| inspected_at | timestamp | |
| created_at | timestamp | |

### agri_batches

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| org_id | uuid | FK → entities.id |
| ref | text | batch reference |
| warehouse_id | uuid | FK → agri_warehouses.id |
| crop_id | uuid | FK → agri_crops.id |
| total_weight | numeric | |
| available_weight | numeric | tracks allocation |
| status | enum | available, allocated, depleted |
| created_at | timestamp | |
| updated_at | timestamp | |

### agri_warehouses

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| org_id | uuid | FK → entities.id |
| name | text | |
| location | jsonb | `{ lat, lng, address }` |
| capacity | numeric | nullable |
| status | enum | active, inactive |
| created_at | timestamp | |

### agri_batch_allocations

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| org_id | uuid | FK → entities.id |
| batch_id | uuid | FK → agri_batches.id |
| lot_id | uuid | FK → agri_lots.id |
| weight | numeric | weight contributed from lot |
| created_at | timestamp | |

### agri_shipments

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| org_id | uuid | FK → entities.id |
| ref | text | shipment reference |
| batch_id | uuid | FK → agri_batches.id |
| destination | jsonb | `{ port, country, buyer }` |
| allocated_weight | numeric | |
| status | enum | planned, packed, dispatched, arrived, closed |
| planned_departure | date | nullable |
| planned_arrival | date | nullable |
| created_at | timestamp | |
| updated_at | timestamp | |

### agri_shipment_milestones

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| org_id | uuid | FK → entities.id |
| shipment_id | uuid | FK → agri_shipments.id |
| milestone | text | e.g., "customs_cleared", "loaded", "departed" |
| occurred_at | timestamp | |
| actor_id | text | |
| notes | text | nullable |
| created_at | timestamp | |

### agri_payment_plans

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| org_id | uuid | FK → entities.id |
| lot_id | uuid | FK → agri_lots.id |
| total_amount | numeric | total payout for the lot |
| currency | text | e.g., "USD", "CDF" |
| status | enum | draft, approved, executing, completed |
| created_at | timestamp | |
| updated_at | timestamp | |

### agri_payments

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| org_id | uuid | FK → entities.id |
| plan_id | uuid | FK → agri_payment_plans.id |
| producer_id | uuid | FK → agri_producers.id |
| amount | numeric | |
| method | text | e.g., "mobile_money", "bank_transfer", "cash" |
| reference | text | nullable, external payment ref |
| status | enum | pending, executed, failed, reversed |
| executed_at | timestamp | nullable |
| created_at | timestamp | |

### agri_certifications

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| org_id | uuid | FK → entities.id |
| lot_id | uuid | FK → agri_lots.id |
| certification_type | text | e.g., "organic", "fairtrade", "rainforest_alliance" |
| certificate_ref | text | nullable |
| content_hash | text | SHA-256 hash of artifact |
| storage_key | text | nullable, blob storage key |
| issued_at | timestamp | |
| expires_at | timestamp | nullable |
| metadata | jsonb | |
| created_at | timestamp | |

### agri_traceability_links

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| org_id | uuid | FK → entities.id |
| source_type | text | "lot", "batch", "shipment" |
| source_id | uuid | |
| target_type | text | "batch", "shipment", "payment" |
| target_id | uuid | |
| link_metadata | jsonb | |
| created_at | timestamp | |

## Intelligence Tables (Cora-writable)

### agri_forecasts

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| org_id | uuid | FK → entities.id |
| crop_id | uuid | FK |
| season | text | |
| forecast_type | text | "yield", "price", "demand" |
| value | numeric | |
| confidence | numeric | 0-1 |
| model_version | text | |
| computed_at | timestamp | |
| created_at | timestamp | |

### agri_price_signals

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| org_id | uuid | FK → entities.id |
| crop_type | text | |
| market | text | |
| price | numeric | |
| currency | text | |
| source | text | |
| observed_at | timestamp | |
| created_at | timestamp | |

### agri_risk_scores

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| org_id | uuid | FK → entities.id |
| scope | text | "cooperative", "region", "crop" |
| scope_id | text | |
| risk_type | text | "climate", "market", "operational" |
| score | numeric | 0-100 |
| factors | jsonb | |
| computed_at | timestamp | |
| created_at | timestamp | |

## Indexes

All tables include:

- `(org_id)` — primary isolation index
- `(org_id, created_at)` — time-ordered queries
- `(org_id, status)` — status filtering (where applicable)
- `(org_id, crop_type)` or `(org_id, crop_id)` — crop filtering
- `(org_id, season)` — season filtering
