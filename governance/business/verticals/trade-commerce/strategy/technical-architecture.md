# Trade & Commerce — Technical Architecture

> Architecture overview for Trade OS (337 entities), eEXPORTS (78 entities), and Shop Quoter (93 entities) — 508 total entities across 3 trade platforms.

---

## System Architecture Overview

```
┌───────────────────────────────────────────────────────────┐
│                     Client Layer                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐  │
│  │ Trade OS   │  │ eEXPORTS   │  │ Shop Quoter        │  │
│  │ Web App    │  │ Web App    │  │ Web App + POS      │  │
│  └────────────┘  └────────────┘  └────────────────────┘  │
└───────────────────────────────────────────────────────────┘
                          │
┌───────────────────────────────────────────────────────────┐
│                   API Gateway (nginx)                     │
│         Rate limiting · Auth · SSL termination            │
└───────────────────────────────────────────────────────────┘
                          │
┌───────────────────────────────────────────────────────────┐
│                  Application Layer (Django)                │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Freight      │  │ Document     │  │ Commerce       │  │
│  │ Engine       │  │ Engine       │  │ Engine         │  │
│  │ (Trade OS)   │  │ (eEXPORTS)  │  │ (Shop Quoter)  │  │
│  └──────────────┘  └──────────────┘  └────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Carrier API  │  │ Compliance   │  │ Inventory      │  │
│  │ Integrations │  │ Engine       │  │ Management     │  │
│  └──────────────┘  └──────────────┘  └────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │           Shared Services (Auth, Billing, Analytics) │ │
│  └──────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
                          │
┌───────────────────────────────────────────────────────────┐
│                      Data Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ PostgreSQL   │  │ Redis Cache  │  │ Azure Blob     │  │
│  │ (508 entities)│  │ (Rates/Track)│  │ (Documents)    │  │
│  └──────────────┘  └──────────────┘  └────────────────┘  │
└───────────────────────────────────────────────────────────┘
                          │
┌───────────────────────────────────────────────────────────┐
│                   External APIs                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────────┐  │
│  │ Carriers│ │ CBSA EDI│ │ USMCA   │ │ Payment       │  │
│  │ (15+)   │ │         │ │ Tariff  │ │ (Stripe)      │  │
│  └─────────┘ └─────────┘ └─────────┘ └───────────────┘  │
└───────────────────────────────────────────────────────────┘
```

---

## Database Schema (508 Entities)

### Trade OS (337 Entities)

| Domain | Count | Key Tables |
|--------|-------|------------|
| Shipments | ~80 | `shipment`, `shipment_leg`, `shipment_item`, `shipment_status`, `delivery_proof` |
| Carriers | ~50 | `carrier`, `carrier_service`, `rate_card`, `carrier_credential`, `carrier_zone` |
| Rates & Quoting | ~40 | `rate_quote`, `rate_comparison`, `surcharge`, `accessorial`, `fuel_adjustment` |
| Tracking | ~35 | `tracking_event`, `tracking_milestone`, `exception`, `eta_update` |
| Customs | ~45 | `customs_declaration`, `tariff_line`, `rules_of_origin`, `duty_calculation` |
| Addresses | ~25 | `address`, `warehouse`, `port`, `border_crossing`, `trade_zone` |
| Billing | ~30 | `invoice`, `payment`, `credit_note`, `carrier_settlement` |
| Analytics | ~32 | `trade_lane`, `corridor_stats`, `carrier_performance`, `cost_analysis` |

### eEXPORTS (78 Entities)

| Domain | Count | Key Tables |
|--------|-------|------------|
| Documents | ~25 | `document`, `document_template`, `document_field`, `document_version` |
| HS Codes | ~15 | `hs_code`, `hs_classification`, `tariff_rate`, `trade_agreement` |
| Compliance | ~18 | `compliance_check`, `sanction_screen`, `restricted_party`, `export_permit` |
| Certificates | ~12 | `certificate_of_origin`, `phytosanitary_cert`, `inspection_cert` |
| System | ~8 | `edi_submission`, `customs_response`, `audit_log` |

### Shop Quoter (93 Entities)

| Domain | Count | Key Tables |
|--------|-------|------------|
| Products | ~25 | `product`, `product_variant`, `category`, `sku`, `barcode` |
| Quotes | ~20 | `quote`, `quote_line`, `quote_status`, `quote_template`, `discount` |
| Inventory | ~18 | `inventory`, `stock_location`, `reorder_rule`, `stock_movement` |
| Suppliers | ~15 | `supplier`, `supplier_catalog`, `purchase_order`, `rfq` |
| POS | ~15 | `pos_terminal`, `transaction`, `payment`, `receipt`, `cash_register` |

---

## Carrier API Integration Layer

### Supported Carriers

| Mode | Carriers | Integration Type |
|------|----------|-----------------|
| Parcel | Canada Post, UPS, FedEx, Purolator, DHL | REST API (real-time rates) |
| LTL Truck | Day & Ross, Manitoulin, Vitran, ABF | REST/SOAP API |
| FTL Truck | Load board APIs, carrier direct | REST API + EDI 204/214 |
| Ocean | Maersk, MSC, CMA CGM, Hapag-Lloyd | REST API + EDI 301/315 |
| Air | Air Canada Cargo, WestJet Cargo | REST API + Cargo-XML |
| Rail | CN, CP | EDI 404/417 |

### Rate Aggregation Pipeline
```
User: Origin + Destination + Weight/Dims + Service Level
    → Parallel API calls to eligible carriers (async, 3s timeout)
    → Rate normalization (CAD, same surcharge categories)
    → Transit time estimation (historical + carrier API)
    → Carbon emissions calculation (distance × mode × emission factor)
    → Sorted results: price, transit time, carrier score
    → Response: < 5 seconds for 15 carriers
```

### Carrier Credential Management
- Encrypted credential storage per user (AES-256)
- Carrier-specific auth: API keys, OAuth2, Basic Auth
- Rate negotiation support: user's negotiated rates override published rates
- Fallback: if carrier API is down, show cached last-known rates with disclaimer

---

## Compliance Engine

### USMCA Rules of Origin Calculator
- Product HS code → applicable USMCA rule → regional value content (RVC) calculation
- Two methods: Transaction Value (TV) and Net Cost (NC)
- Tariff shift rules: change in HS chapter/heading/subheading across USMCA countries
- De minimis calculations: tolerance thresholds for non-originating materials
- Certificate of origin auto-generation for qualifying goods

### Sanctions Screening
- Real-time screening against: SEMA (Canada), OFAC SDN (US), EU consolidated list
- Party name matching: fuzzy match algorithm (Levenshtein + soundex)
- Flag and hold shipments with potential matches for manual review
- Audit trail: every screening result logged with timestamp and disposition

### HS Code AI Classification
- Azure OpenAI: product description → suggested HS code (6-digit) + confidence score
- Training data: 50,000+ classified products from CBSA rulings
- Human review workflow for low-confidence classifications (< 80%)
- HS code history: track classification changes, tariff rate updates

---

## Document Generation Engine (eEXPORTS)

### Supported Documents
| Document | Format | Regulatory Body |
|----------|--------|-----------------|
| Commercial Invoice | PDF/XML | CBSA |
| Canada Customs Invoice (CCI) | PDF | CBSA |
| Certificate of Origin (USMCA) | PDF | Global Affairs |
| Bill of Lading (B/L) | PDF | Carrier |
| Phytosanitary Certificate | PDF | CFIA |
| Dangerous Goods Declaration | PDF | Transport Canada |
| Packing List | PDF | Commercial |

### Generation Pipeline
```
Shipment Data (Trade OS) → Document Template Selection
    → Field mapping (shipper, consignee, goods, HS codes)
    → Compliance validation (required fields, correct codes)
    → PDF/XML rendering (WeasyPrint / lxml)
    → Digital signature (optional, for EDI submissions)
    → Storage (Azure Blob) + delivery (email/download/EDI)
```

---

## Infrastructure (Azure)

### Compute
- **Web/API**: Azure App Service (B2 → P2v3, auto-scaling on carrier API load)
- **Background Jobs**: Azure Functions (rate cache refresh, sanctions list updates, tracking polling)
- **Celery Workers**: Async carrier API calls, document generation, EDI processing

### Storage
- **PostgreSQL**: Azure Database for PostgreSQL Flexible (GP_Gen5_4), 508 entities
- **Redis**: Azure Cache for Redis — carrier rate caching (15-min TTL), tracking cache
- **Blob Storage**: Generated documents (PDFs), archived EDI messages, carrier responses
- **Queue**: Azure Service Bus — async job queue for carrier calls, doc generation

### Performance Targets
| Operation | Target Latency | Notes |
|-----------|---------------|-------|
| Multi-carrier rate query | < 5s (15 carriers) | Parallel async calls with timeout |
| Document generation | < 3s | Template rendering + PDF |
| HS code classification | < 2s | Azure OpenAI API call |
| Sanctions screening | < 1s | Local cache + API fallback |
| POS transaction | < 500ms | Local-first with sync |

---

## Security

### Data Protection
- Encryption at rest: AES-256 (Azure managed keys)
- Encryption in transit: TLS 1.3
- PCI-DSS: Shop Quoter payment data via Stripe (no card data stored locally)
- Carrier credentials: encrypted with user-specific keys, never logged

### Multi-Tenancy
- Row-level security: each company sees only their data
- API key scoping: per-company, per-platform, per-endpoint
- Audit logging: all shipment, document, and financial operations logged
