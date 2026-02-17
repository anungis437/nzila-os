# Trade & Commerce — Product Roadmap

> Quarterly feature roadmap for Trade OS, eEXPORTS, and Shop Quoter platforms (2025–2028).

---

## Phase 1: Core Platform Hardening (Q1–Q4 2025)

### Q1 2025 — Trade OS: Multi-Carrier v2
- [ ] Multi-carrier rate shopping: 15 carriers (truck, air, ocean, rail)
- [ ] Real-time rate API integration: Canada Post, UPS, FedEx, Purolator
- [ ] Shipment creation wizard with USMCA flag for cross-border
- [ ] Basic tracking dashboard: status, ETA, exceptions
- **KPI**: 50 active shippers, 500 shipments/month

### Q2 2025 — eEXPORTS: Documentation Engine
- [ ] Automated commercial invoice generation from shipment data
- [ ] Certificate of origin generator (USMCA/CUSMA)
- [ ] HS code lookup with search + autocomplete (10,000+ codes)
- [ ] PDF/XML export for customs broker submission
- **KPI**: 80 active exporters, 400 documents/month

### Q3 2025 — Shop Quoter: POS + Quoting
- [ ] Point-of-sale interface with barcode scanning
- [ ] Multi-vendor quote builder: compare supplier pricing
- [ ] Inventory management: stock levels, reorder alerts, SKU management
- [ ] Customer quote history and follow-up tracking
- **KPI**: 120 active retailers, 2,000 quotes/month

### Q4 2025 — Platform Integration v1
- [ ] Trade OS ↔ eEXPORTS data bridge: shipment → auto-generate export docs
- [ ] Unified customer profile across all 3 platforms
- [ ] Single sign-on (SSO) for multi-platform users
- [ ] Cross-platform analytics dashboard: trade volume, document completion, retail metrics
- **KPI**: 150 combined subscribers, $300K ARR

---

## Phase 2: Intelligence & Compliance (Q1–Q4 2026)

### Q1 2026 — AI HS Code Classification
- [ ] AI-powered HS code classification from product descriptions (Azure OpenAI)
- [ ] USMCA rules of origin calculator: determine tariff eligibility
- [ ] Trade agreement optimizer: compare USMCA vs CETA vs CPTPP rates
- [ ] Duty/tax estimation before shipment booking

### Q2 2026 — Predictive Logistics
- [ ] Predictive transit time models: historical data + weather + port congestion
- [ ] Container tracking: ocean shipment tracking via carrier APIs + AIS data
- [ ] Carbon emissions calculator per shipment (GHG Protocol)
- [ ] Carrier performance scoring: on-time %, damage rate, claims resolution

### Q3 2026 — Shop Quoter Marketplace
- [ ] Multi-vendor marketplace: suppliers list products, retailers browse/order
- [ ] Supplier quoting portal: RFQ (Request for Quote) workflow
- [ ] Shopify/WooCommerce integration: sync products, orders, inventory
- [ ] Bulk ordering with volume discounts

### Q4 2026 — Customs Broker EDI
- [ ] CBSA EDI integration: electronic B3 declarations, D7 adjustments
- [ ] Customs broker portal: manage client shipments, compliance status
- [ ] Automated sanctions screening: SEMA (Canada), OFAC (US)
- [ ] Trade compliance dashboard: flag high-risk shipments, missing documents
- **KPI**: 500 subscribers, $900K ARR

---

## Phase 3: Scale & Expansion (Q1–Q4 2027)

### Q1 2027 — Africa Trade Corridor
- [ ] Africa-specific carrier integrations (shipping lines, air cargo)
- [ ] African port handling: Matadi (DRC), Mombasa (Kenya), Lagos (Nigeria)
- [ ] CFIA food export requirements for agricultural products
- [ ] Multi-currency invoicing: CAD, USD, EUR, CFA, KES

### Q2 2027 — Trade Finance Integration
- [ ] EDC financing integration: export credit insurance, working capital
- [ ] BDC trade loans: application support within platform
- [ ] Letter of credit management: issuance, tracking, documentation
- [ ] Trade receivables financing: factoring integration

### Q3 2027 — Advanced Analytics
- [ ] Trade pattern analytics: corridor analysis, seasonal trends, cost optimization
- [ ] Inventory demand forecasting (Shop Quoter): ML-based reorder predictions
- [ ] Supplier performance analytics: lead times, quality scores, price trends
- [ ] Custom reporting engine: drag-and-drop report builder

### Q4 2027 — API Platform
- [ ] Public REST API: shipment booking, tracking, document generation
- [ ] Webhook notifications: shipment status changes, customs clearance
- [ ] Developer portal: documentation, SDKs (Python, JavaScript, PHP)
- [ ] Partner API: customs brokers, freight forwarders, accounting platforms
- **KPI**: 800 subscribers, $1.5M ARR

---

## Phase 4: International & Convergence (2028+)

### Q1–Q2 2028 — US Market Entry
- [ ] US customs integration (CBP ACE system)
- [ ] US carrier integration expansion (USPS, Old Dominion, XPO)
- [ ] USMCA bilateral: Canadian shippers selling to US + US shippers to Canada
- [ ] FDA/USDA compliance for food/agricultural imports

### Q3–Q4 2028 — Platform Convergence
- [ ] Unified Trade Hub: single platform combining Trade OS + eEXPORTS + Shop Quoter
- [ ] End-to-end workflow: source (Shop Quoter) → document (eEXPORTS) → ship (Trade OS)
- [ ] White-label offering for trade associations and customs broker networks
- [ ] Multi-tenant: regional trade organizations run their own branded instance

---

## Technical Debt & Infrastructure

### Ongoing
- [ ] Django 5.x upgrade cycle: quarterly security patches, annual major upgrades
- [ ] Database optimization: query performance, index management, partition strategy
- [ ] Carrier API maintenance: handle rate changes, API version deprecations
- [ ] Security: annual penetration testing, dependency scanning, SOC 2 prep

### 2025 Priorities
- [ ] Consolidate 3 separate codebases into shared Django project with apps
- [ ] Implement feature flags for gradual rollout
- [ ] Establish CI/CD pipeline with automated testing (80%+ coverage target)
- [ ] Standardize API design across all 3 platforms (OpenAPI 3.0 spec)

---

## Success Metrics

| Metric | 2025 | 2026 | 2027 | 2028 |
|--------|------|------|------|------|
| Combined Subscribers | 150 | 500 | 800 | 1,500 |
| ARR | $300K | $900K | $1.5M | $3M |
| Shipments Processed/mo | 500 | 3,000 | 10,000 | 30,000 |
| Documents Generated/mo | 400 | 2,000 | 8,000 | 20,000 |
| Trade Corridors Supported | 2 | 5 | 10 | 20 |
| Carrier Integrations | 15 | 25 | 40 | 60 |
