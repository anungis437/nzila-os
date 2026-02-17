# SentryIQ360 — Technical Architecture

## System Overview

SentryIQ360 is a multi-carrier insurance arbitrage platform built on Django/PostgreSQL deployed on Azure. The system orchestrates real-time quote retrieval across 20+ carriers, normalizes rates for comparison, and manages the full policy lifecycle for independent insurance brokers in Canada.

**Core Stats**: 79+ database entities, multi-tenant broker isolation, sub-3-second quote aggregation target.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Client Layer                                │
│   Broker Web App (React)  │  Client Portal  │  Mobile App       │
└─────────────┬───────────────────┬──────────────────┬────────────┘
              │                   │                  │
┌─────────────▼───────────────────▼──────────────────▼────────────┐
│                    API Gateway (Azure API Management)            │
│          Rate limiting │ Auth │ Request routing │ Logging        │
└─────────────┬───────────────────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────────────────┐
│                    Django Application Layer                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐    │
│  │ Quote Engine  │ │ Submission   │ │ Policy Management    │    │
│  │ Service       │ │ Service      │ │ Service              │    │
│  └──────────────┘ └──────────────┘ └──────────────────────┘    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐    │
│  │ Commission   │ │ Analytics    │ │ User/Tenant          │    │
│  │ Tracker      │ │ Engine       │ │ Management           │    │
│  └──────────────┘ └──────────────┘ └──────────────────────┘    │
└─────────────┬───────────────────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────────────────┐
│              Carrier Integration Layer (CIL)                     │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│  │ Intact  │ │ Aviva  │ │Econom. │ │Wawanesa│ │ RSA    │ ...   │
│  │Adapter  │ │Adapter │ │Adapter │ │Adapter │ │Adapter │       │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘       │
│         CSIO XML │ REST API │ SOAP │ Legacy Scraper             │
└─────────────┬───────────────────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────────────────┐
│                    Data Layer                                    │
│  PostgreSQL (primary) │ Redis (cache) │ Azure Blob (documents)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Architecture (79+ Entities)

### Multi-Tenant Schema Design
- **Tenant model**: Each broker agency is a tenant with isolated data
- **Row-level security**: PostgreSQL RLS policies enforce tenant boundaries
- **Shared schema**: Single database, tenant_id foreign key on all transactional tables
- **Superuser layer**: Nzila admin access across tenants for support and analytics

### Core Entity Groups

| Domain | Key Entities | Count |
|--------|-------------|-------|
| Tenancy | Agency, Broker, CSR, Role, Permission | 8 |
| Client | Client, Address, Vehicle, Property, Driver, Risk Factor | 12 |
| Quoting | Quote Request, Quote Response, Carrier Quote, Rate Comparison, Coverage Option | 15 |
| Submission | Submission, Carrier Application, Document, Signature, Status History | 10 |
| Policy | Policy, Coverage, Endorsement, Premium Schedule, Renewal, Cancellation | 12 |
| Commission | Commission Schedule, Commission Payment, Override, Contingency, Statement | 8 |
| Carrier | Carrier, Carrier Product, Rate Table, Appetite Rule, API Credential | 9 |
| Analytics | Quote Metric, Conversion Metric, Portfolio Summary, Risk Score, Audit Log | 5+ |

### Data Normalization Strategy
- Carrier-specific field mappings stored in `carrier_field_map` configuration tables
- Coverage terminology normalization: e.g., "Third Party Liability" (Intact) = "Bodily Injury" (Aviva)
- Rate structure normalization: annual/monthly/semi-annual → standardized monthly rate for comparison
- CSIO code tables maintained as reference data with quarterly update cycles

---

## Carrier Integration Layer (CIL)

### Integration Methods (Priority Order)
1. **CSIO XML/EDI**: Standardized Canadian insurance data exchange — preferred for all supporting carriers
2. **Carrier REST APIs**: Modern carriers offering real-time RESTful endpoints (Intact Digital, Aviva Connect)
3. **SOAP/WSDL**: Legacy carrier web services (Wawanesa, some regional mutuals)
4. **Regulated scraping**: Last resort for carriers without APIs — browser automation with carrier consent

### Adapter Pattern
Each carrier implements a standard adapter interface:
- `get_quote(client_data) → CarrierQuote`: Retrieve rate for given risk profile
- `submit_application(app_data) → SubmissionResult`: Submit formal application
- `check_status(submission_id) → Status`: Poll submission status
- `get_policy(policy_id) → PolicyData`: Retrieve bound policy details
- `download_documents(policy_id) → [Document]`: Retrieve policy documents

### CSIO XML Standards Compliance
- CSIO XML v3.x for personal lines data exchange
- eDocs integration for automated policy document download
- My Proof of Insurance digital pink card support
- CSIO broker identity verification standards

### Quote Aggregation Engine
- **Parallel execution**: Celery task workers fire carrier API calls concurrently
- **Timeout handling**: 10-second per-carrier timeout, results returned as they arrive
- **Fallback logic**: If real-time API fails, check cached rates (< 24h old)
- **Rate normalization**: All returned quotes normalized to common schema for side-by-side comparison
- **Confidence scoring**: Each quote tagged with freshness score (real-time > cached > estimated)

---

## AI/ML Pipeline

### Risk Scoring Models
- **Input features**: Client demographics, vehicle/property details, claims history, credit-based insurance score proxy, geographic risk factors
- **Model**: Gradient boosted trees (XGBoost) trained on anonymized Canadian P&C loss data
- **Output**: Risk score (1-100), carrier match score, predicted premium range
- **Retraining**: Quarterly on new claims and placement data

### Claims Prediction
- Historical loss triangles analysis by line of business and geography
- Weather event correlation: integrate Environment Canada data for property risk
- Client behavior signals: policy change frequency, payment patterns
- Output: 12-month claim probability per client, used for renewal pricing optimization

### Fraud Detection
- Anomaly detection on application data: inconsistent addresses, VIN mismatches, suspicious claims patterns
- Network analysis: identify connected applications across agencies
- Real-time flagging during quote process — alerts broker before submission

### Premium Optimization
- Recommend deductible/coverage combinations that balance client cost and broker commission
- Multi-carrier optimization: find best placement across carriers for multi-line bundles
- Retention predictor: identify clients likely to shop at renewal and recommend proactive re-quoting

---

## Infrastructure & Deployment

### Azure Cloud Architecture
- **Region**: Canada Central (primary), Canada East (DR/failover)
- **Compute**: Azure App Service for Django application (Standard S2 tier, auto-scaling 2-8 instances)
- **Database**: Azure Database for PostgreSQL Flexible Server (General Purpose, 4 vCores, 16GB RAM)
- **Cache**: Azure Cache for Redis (Standard C1) — quote caching, session management
- **Storage**: Azure Blob Storage — policy documents, carrier rate files, exports
- **Queue**: Azure Service Bus — carrier API job orchestration, async processing
- **CDN**: Azure Front Door — client portal static assets, geographic routing

### High Availability
- App Service deployment slots: blue/green deployments with zero downtime
- PostgreSQL high availability: zone-redundant with automatic failover
- Redis replication: read replica for analytics queries
- Health probes: carrier API health monitoring with automatic circuit breakers

### Data Caching Strategy
- **Quote cache**: Redis cache of carrier quotes with 24-hour TTL per client risk profile
- **Rate table cache**: Carrier rate tables cached with carrier-specified refresh intervals
- **Session cache**: Broker sessions cached in Redis for horizontal scaling
- **Static data**: Coverage codes, CSIO tables, provincial rules cached at application startup

---

## Security Architecture

### SOC 2 Compliance Path
- **Trust Service Criteria**: Security, Availability, Confidentiality, Processing Integrity
- **Target**: SOC 2 Type I by Q4 2026, Type II by Q4 2027
- **Continuous monitoring**: Azure Security Center, automated compliance scanning

### Data Protection
- **Encryption at rest**: Azure TDE for PostgreSQL, Storage Service Encryption for blobs
- **Encryption in transit**: TLS 1.3 for all API communications, mTLS for carrier connections
- **Key management**: Azure Key Vault for carrier API credentials, encryption keys, certificates
- **PII handling**: Client personal data encrypted at field level in database, tokenized for analytics

### Broker Data Isolation
- PostgreSQL row-level security: tenant_id enforced at database layer
- API middleware: tenant context validated on every request
- Cross-tenant query prevention: ORM-level tenant filtering, no raw SQL without audit
- Data export controls: brokers can only export their own agency data

### Authentication & Authorization
- Azure AD B2C for broker identity management
- MFA mandatory for agency principals and admin roles
- JWT tokens with short expiry (15 min access, 7-day refresh)
- RBAC: Broker, CSR, Agency Admin, Nzila Support, Nzila Admin roles

---

*Nzila Corp — SentryIQ360 Technical Architecture v1.0 — Confidential*
