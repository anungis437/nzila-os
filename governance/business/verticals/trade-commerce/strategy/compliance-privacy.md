# Trade & Commerce — Compliance & Privacy Strategy

> Regulatory compliance framework for Trade OS, eEXPORTS, and Shop Quoter — covering customs, trade regulations, data privacy, and payment security.

---

## Customs & Trade Compliance

### Canada Border Services Agency (CBSA)
- **B3 Declarations**: Automated generation of customs accounting documents
- **D7 Adjustments**: Correction workflow for post-release amendments
- **AMPS Penalties**: Compliance scoring to avoid Administrative Monetary Penalty System fines ($150–$25,000)
- **CERS**: Customs Electronic Reporting System integration (EDI/API)
- **Release Prior to Payment (RPP)**: Support for bonded importers

### US Customs & Border Protection (CBP)
- **ACE Integration**: Automated Commercial Environment filing via ACE Portal API
- **ISF (10+2)**: Importer Security Filing compliance for ocean shipments
- **Section 321**: De minimis exemption handling ($800 threshold)
- **Harmonized Tariff Schedule (HTS)**: US tariff classification engine

### USMCA/CUSMA Compliance
```
Rules of Origin Engine:
┌────────────────────────────────────────┐
│ Product: Auto Parts (HS 8708.29)       │
│                                         │
│ Regional Value Content:                 │
│   Transaction Value: 72% (min 75%) ❌  │
│   Net Cost: 68% (min 70%) ❌           │
│                                         │
│ ⚠️  Does NOT qualify for USMCA         │
│    preferential tariff                  │
│                                         │
│ Options:                                │
│ • Increase NA content by 3-7%           │
│ • Apply MFN rate (6.5%)                 │
│ • Check tariff shift rule               │
│                                         │
│ [Certificate of Origin] [Duty Estimate] │
└────────────────────────────────────────┘
```
- Certificate of Origin generation: auto-populated from BOM data
- Tariff shift analysis: chapter/heading/subheading change rules
- Accumulation rules: US, Canada, Mexico content aggregation
- De minimis calculation: 10% non-originating material tolerance

### CETA (Canada-EU)
- EUR.1 Movement Certificate generation
- REX (Registered Exporter) system integration for shipments >€6,000
- Tariff phase-in tracking: annual preferential rate updates through 2030

---

## Food & Agricultural Export Compliance

### CFIA Requirements (eEXPORTS)
- **Phytosanitary certificates**: automated requests to CFIA for plant products
- **Meat/dairy export permits**: facility registration, health certificates
- **Organic certification**: verified organic claims with CFIA Organic Regime
- **Fish inspection**: CFIA fish export certificate workflow
- **Allergen declarations**: bilingual (EN/FR) labeling compliance

### International Standards
- Codex Alimentarius: food safety standards for 180+ countries
- SPS Agreement: WTO Sanitary and Phytosanitary measures
- Country-specific: USDA (US), EFSA (EU), NAFDAC (Nigeria), KEBS (Kenya)

---

## Controlled Goods & Sanctions

### Export Controls
- **Export Controls Act (ECA)**: Canadian controlled goods list screening
- **ITAR** (US): International Traffic in Arms Regulations — deny-list screening
- **EAR** (US): Export Administration Regulations — dual-use goods classification
- **CGPR**: Controlled Goods Program Registration verification
- **Nuclear triggers list**: screening for IAEA-controlled materials

### Sanctions Screening
```
Real-Time Screening Engine:
┌─────────────────────────────────────────┐
│ Screening: "Acme Trading Ltd, Dubai"     │
│                                           │
│ ✅ SEMA (Canada) — No match              │
│ ✅ OFAC/SDN (US) — No match              │
│ ✅ EU Consolidated — No match             │
│ ⚠️  World-Check — Potential match (62%)  │
│    "Acme Trading LLC" — PEP connection   │
│                                           │
│ Action: Manual review required            │
│ [Approve] [Reject] [Escalate to CTO]     │
│ Audit log: Screening #SR-2025-0342       │
└─────────────────────────────────────────┘
```
- **SEMA**: Special Economic Measures Act (Canada) — country/entity lists
- **OFAC/SDN**: Office of Foreign Assets Control — Specially Designated Nationals
- **EU Consolidated**: European sanctions list
- **UN Security Council**: Consolidated sanctions list
- Batch screening: upload CSV of counterparties for bulk screening
- Ongoing monitoring: daily re-screening of approved counterparties

---

## Data Privacy & Protection

### PIPEDA Compliance (Federal)
- Personal information: consent for collection, use, disclosure
- Breach notification: mandatory reporting to Privacy Commissioner within 72 hours
- Right of access: customer data export within 30 days of request
- Cross-border transfers: adequate protection for data sent to US partners
- Privacy Impact Assessments (PIA): before launching new features

### Quebec — Law 25
- Privacy officer designation (mandatory sep 2023)
- De-identification standards for analytics data
- Consent management: granular, explicit, revocable
- Privacy by default: minimal data collection on initial setup

### International (for export partners)
- GDPR: EU partner data handling — Article 28 processor agreements
- Nigerian NDPR: data localization awareness for West African corridors
- Kenyan DPA: consent requirements for East African trade partners

---

## Payment & Financial Compliance

### PCI-DSS (Shop Quoter)
- **Level**: SAQ A-EP (Stripe Elements handles card data — no direct card storage)
- **Scope**: API calls to Stripe, tokenized card references only
- **Requirements**:
  - TLS 1.2+ for all payment API calls
  - No card numbers in logs, databases, or error messages
  - Quarterly ASV vulnerability scans (Qualys/Trustwave)
  - Annual self-assessment questionnaire
  - Stripe Connect for marketplace transactions (if applicable)

### Anti-Money Laundering (AML)
- FINTRAC reporting: suspicious transaction reports (STRs) for payments >$10,000
- KYC verification: business verification for new suppliers/buyers on platform
- Record retention: 5 years for financial transaction records

### Tax Compliance
- HST/GST: Canadian harmonized sales tax calculation per province
- US Sales Tax: Stripe Tax integration for state-level compliance
- Duty/tariff estimation: landed cost calculator with duty + tax + fees

---

## Trade Data Retention

### CBSA Requirements
- **6-year retention**: All customs records (commercial invoices, certificates of origin, B3s)
- **Format**: Machine-readable (PDF + structured JSON), accessible within 72 hours of CBSA request
- **Location**: Canadian data center (Azure Canada Central — Toronto)

### Retention Schedule
| Data Type | Retention | Storage Tier | Regulation |
|---|---|---|---|
| Customs declarations | 6 years | Standard → Cool (2yr) | CBSA Customs Act |
| Commercial invoices | 6 years | Standard → Cool (2yr) | CBSA + CRA |
| Certificates of origin | 6 years | Standard → Cool (2yr) | USMCA Art. 5.6 |
| Shipment tracking | 3 years | Standard → Archive (1yr) | Business need |
| POS transactions | 7 years | Standard → Cool (3yr) | CRA Income Tax Act |
| Customer PII | Active + 2 years | Standard (encrypted) | PIPEDA |
| Sanctions screening logs | 5 years | Standard → Cool (2yr) | SEMA/OFAC |
| AML/KYC records | 5 years | Standard → Cool (2yr) | FINTRAC PCMLTFA |

---

## Security Architecture

### Encryption
- **At rest**: Azure Storage Service Encryption (AES-256) for all trade documents
- **In transit**: TLS 1.3 for all API calls, mutual TLS for carrier EDI connections
- **Field-level**: AES-256 encryption for HS codes, customs broker license numbers, pricing data
- **Key management**: Azure Key Vault, customer-managed keys for enterprise tier

### Access Control
- RBAC: role-based access (admin, operations, compliance, read-only)
- Custom roles: carrier-specific data access, client isolation for customs brokers
- MFA: mandatory for customs filing actions and compliance approvals
- IP whitelisting: available for enterprise accounts

### Audit Trail
- Immutable audit log for all customs filings, document changes, screening decisions
- Who changed what, when, from where (IP + device fingerprint)
- Exportable for CBSA/CRA audits (CSV/JSON formats)
- 7-year retention on audit logs

---

## Compliance Monitoring & Reporting

### Automated Alerts
- Tariff rate changes: daily monitoring of CBSA/CBP tariff updates
- Sanctions list updates: same-day ingestion of SEMA/OFAC list changes
- License expiry: customs broker, importer, exporter license renewal reminders
- Compliance score: per-company scoring based on filing accuracy, completions, exceptions

### Regulatory Reporting
- **Monthly**: Trade compliance summary (filings, exceptions, penalties)
- **Quarterly**: Sanctions screening audit report, PCI-DSS scan results
- **Annual**: Privacy impact assessment review, FINTRAC compliance report
- **Ad hoc**: CBSA audit response package (generate within 24 hours)

---

## Compliance Roadmap

### 2025 — Foundation
- CBSA B3 filing automation + CERS integration
- Sanctions screening engine (SEMA + OFAC)
- PIPEDA compliance framework + breach notification workflow
- PCI-DSS SAQ A-EP certification for Shop Quoter

### 2026 — Expansion
- USMCA rules of origin engine with AI classification
- ACE integration for US customs filing
- CETA EUR.1 certificate automation
- FINTRAC AML reporting integration

### 2027 — Advanced
- Real-time tariff change monitoring (ML-based impact analysis)
- Cross-border data flow governance (GDPR, NDPR, Kenya DPA)
- Automated CBSA audit response system
- AI-powered HS code classification (target 98%+ accuracy)

### 2028 — Global
- Multi-jurisdiction compliance: AfCFTA (Africa), RCEP (Asia-Pacific)
- Blockchain-based certificate of origin verification
- Predictive compliance: flag potential violations before filing
- Pan-Canadian export compliance certification program
