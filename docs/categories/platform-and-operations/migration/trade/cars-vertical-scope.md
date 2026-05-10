# Trade — Cars Vertical Scope

> **Status:** Active  
> **Owner:** Platform team  
> **Last updated:** 2026-02-27

## Purpose

This document defines the **boundary** between the generic Trade core domain and
the **Cars vertical** (vehicle specialization). The Cars vertical encapsulates all
vehicle-specific logic, types, and UI that originated from the legacy eExports
application.

---

## Guiding Principle

> Cars vertical must not leak into core types.  
> Core Listing remains commodity-neutral.

The generic `trade_listings` table handles all commodity types. Vehicle-specific
fields are stored in a **separate extension table** (`trade_vehicle_listings`)
linked by `listing_id` FK. This pattern allows future verticals (e.g., machinery,
agricultural products) without polluting the core schema.

---

## Cars Vertical Domain Objects

### 1. VehicleListing (extends Listing)

Stored in `trade_vehicle_listings`, linked 1:1 to a `trade_listings` row where
`listing_type = 'vehicle'`.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `org_id` | UUID | FK → entities (org scope) |
| `listing_id` | UUID | FK → trade_listings |
| `vin` | varchar(17) | Vehicle Identification Number |
| `year` | integer | Model year |
| `make` | text | Manufacturer |
| `model` | text | Model name |
| `trim` | text | Trim level (nullable) |
| `mileage` | integer | Odometer reading |
| `condition` | enum | `new`, `used`, `certified_pre_owned`, `salvage` |
| `exterior_color` | text | |
| `interior_color` | text | |
| `engine_type` | text | e.g., "2.0L Turbo I4" |
| `transmission` | enum | `automatic`, `manual`, `cvt` |
| `drivetrain` | enum | `fwd`, `rwd`, `awd`, `4wd` |
| `fuel_type` | enum | `gasoline`, `diesel`, `electric`, `hybrid`, `plugin_hybrid` |
| `metadata` | jsonb | Additional specs (features, options, etc.) |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 2. VehicleDocs

Vehicle-specific documents (supplements generic `trade_documents`).

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `org_id` | UUID | FK → entities |
| `listing_id` | UUID | FK → trade_listings |
| `doc_type` | enum | `bill_of_sale`, `export_certificate`, `inspection_report`, `title`, `carfax`, `emissions_test`, `safety_inspection`, `customs_form` |
| `storage_key` | text | Blob storage path |
| `content_hash` | text | SHA-256 |
| `uploaded_by` | UUID | |
| `created_at` | timestamptz | |

---

## Cars Vertical UI Components

All car-specific UI lives in `packages/trade-cars`. These components are consumed
only by `apps/trade` — never by core packages.

### Listing Creation

- **VehicleListingForm** — VIN, make/model/year, mileage, condition selector
- **VINDecoder** — optional integration hook for VIN lookup
- **VehicleMediaUploader** — enforces min image count, optional video
- **VehicleSpecsPanel** — displays decoded vehicle specifications

### Documents

- **VehicleDocsChecklist** — per-lane document requirements
  - Canada → US: Title, Bill of Sale, Export Certificate, EPA form, DOT form
  - Japan → Canada: Deregistration, Export Certificate, Inspection Report
  - Generic: Customs Declaration, Insurance, Packing List

### Pricing Helpers

- **DutyCalculator** — duty + tax estimation by corridor
- **ShippingLaneEstimator** — cost by shipping lane
- **LandedCostPreview** — total landed cost including duty, shipping, inspection

### Valuation (Future)

- **CarfaxAdapter** — optional Carfax history report (future integration)
- **MarketValueEstimator** — comparable vehicle pricing (future)

---

## Vertical Boundary Rules

### Package Import Constraints

```
✅ apps/trade          → can import trade-cars
✅ packages/trade-cars → can import trade-core (types/enums only)
❌ packages/trade-core → must NOT import trade-cars
❌ packages/trade-db   → must NOT import trade-cars
❌ packages/trade-adapters → must NOT import trade-cars (adapters are data-level)
```

### Schema Constraints

- `trade_vehicle_listings` has FK to `trade_listings` — it cannot exist without
  a parent listing
- `trade_vehicle_docs` has FK to `trade_listings` — linked at listing level
- Neither table is required for non-vehicle listings
- Core queries NEVER join to vehicle tables unless explicitly in cars-vertical code

### Type Constraints

- `trade-core` defines `ListingType = 'generic' | 'vehicle'` — but knows nothing
  about vehicle fields
- `trade-cars` defines `VehicleListing`, `VehicleCondition`, `VehicleTransmission`,
  etc. — these types never appear in core
- The listing type selector in the UI (`Generic | Vehicle`) is the only join point

### Contract Test Enforcement

```
TRADE_CARS_BOUNDARY_005:
  - packages/trade-core may NOT import from @nzila/trade-cars
  - packages/trade-db may NOT import from @nzila/trade-cars
  - packages/trade-adapters may NOT import from @nzila/trade-cars
  - Only apps/trade may import both core and cars packages
```

---

## Migration from eExports

The legacy eExports application is the source of cars-vertical depth. Migration
strategy:

1. **Extract canonical vehicle fields** from eExports `Vehicle` model →
   `trade_vehicle_listings` schema
2. **Extract document types** from eExports `Document` model →
   `trade_vehicle_docs` schema
3. **Import adapter** (`LegacyEExportsCarsAdapter`) reads eExports data and
   normalizes into canonical tables
4. **No runtime dependency** on eExports — adapter is import-only

### Fields Migrated from eExports

| eExports Field | Canonical Field | Notes |
|---|---|---|
| `Vehicle.vin` | `trade_vehicle_listings.vin` | Direct map |
| `Vehicle.year` | `trade_vehicle_listings.year` | Direct map |
| `Vehicle.make` | `trade_vehicle_listings.make` | Direct map |
| `Vehicle.model` | `trade_vehicle_listings.model` | Direct map |
| `Vehicle.trim` | `trade_vehicle_listings.trim` | Direct map |
| `Vehicle.mileage` | `trade_vehicle_listings.mileage` | Direct map |
| `Vehicle.condition` | `trade_vehicle_listings.condition` | Enum normalized |
| `Vehicle.price` | `trade_listings.asking_price` | Goes to core listing |
| `Vehicle.images` | `trade_listing_media` | Goes to core media |
| `Deal.*` | `trade_deals` | Mapped via adapter |
| `Commission.*` | `trade_commissions` | Mapped via adapter |
| `Shipment.*` | `trade_shipments` | Mapped via adapter |

### Fields NOT Migrated

- eExports marketing/SEO features → out of scope
- eExports review/rating system → out of scope
- eExports chat system → replaced by NzilaOS comms
- eExports payment processing → replaced by `@nzila/payments-stripe`
