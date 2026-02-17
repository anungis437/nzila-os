# Agrotech Technical Architecture
> Deep dive into the CORA + PonduOps system architecture, infrastructure, and AI/ML pipelines under Nzila Corp.

---

## 1. System Architecture Overview

### Current State: Django Monoliths
Both CORA and PonduOps run as Django monoliths on Azure App Services. This is intentional for the early stage — monoliths reduce operational complexity while the team is small and the product is iterating rapidly.

```
┌──────────────────┐     ┌──────────────────┐
│   CORA Monolith  │     │ PonduOps Monolith │
│  Django 5.x      │     │  Django 5.x       │
│  80+ entities    │     │  70+ modules      │
│  REST API        │     │  REST + GraphQL   │
├──────────────────┤     ├──────────────────┤
│  PostgreSQL 16   │     │  PostgreSQL 16    │
│  (Azure Flex)    │     │  (Azure Flex)     │
└──────────────────┘     └──────────────────┘
```

### Target State: Microservices (2027+)
Migration follows the strangler fig pattern — extract bounded contexts as independent services behind an API gateway. Priority extraction order:

1. **Authentication service** (shared across CORA + PonduOps)
2. **Notification service** (SMS, push, email — high-volume, independent lifecycle)
3. **Supply chain matching service** (CORA core — compute-intensive, needs independent scaling)
4. **Analytics service** (read-heavy, can tolerate eventual consistency)
5. **Farm data service** (PonduOps core — offline sync complexity warrants isolation)

---

## 2. Database Architecture

### PostgreSQL Schema Strategy
Both platforms share an Azure Database for PostgreSQL Flexible Server cluster with logical database separation.

#### CORA Database (80+ entities)
Key entity groups organized by domain:
- **Actors**: `farmers`, `cooperatives`, `buyers`, `transporters`, `agents` (15 entities)
- **Products**: `commodities`, `grades`, `units`, `pricing_history`, `certifications` (12 entities)
- **Supply Chain**: `supply_listings`, `demand_requests`, `matches`, `transactions`, `shipments` (18 entities)
- **Market Intelligence**: `market_prices`, `price_sources`, `regional_indices`, `forecasts` (10 entities)
- **Geography**: `provinces`, `territories`, `markets`, `collection_points`, `grain_elevators` (8 entities)
- **Supporting**: `notifications`, `audits`, `analytics_events`, `api_keys`, `webhooks` (17+ entities)

#### PonduOps Database (70+ modules)
Module groups organized by farm lifecycle:
- **Planning**: `crop_plans`, `planting_schedules`, `input_requirements`, `weather_data` (10 modules)
- **Operations**: `field_activities`, `input_applications`, `irrigation_logs`, `pest_reports` (12 modules)
- **Harvest**: `harvest_records`, `batch_tracking`, `quality_grades`, `storage_logs` (8 modules)
- **Financial**: `transactions`, `member_contributions`, `loans`, `expense_tracking` (10 modules)
- **Cooperative**: `members`, `governance`, `meetings`, `voting`, `roles` (12 modules)
- **Reporting**: `yield_reports`, `financial_statements`, `member_dashboards` (8 modules)
- **System**: `sync_queue`, `conflict_log`, `offline_cache`, `device_registry` (10+ modules)

### Indexing Strategy
- Composite indexes on `(cooperative_id, created_at)` for tenant-scoped time-series queries
- GIN indexes on `jsonb` columns for flexible metadata fields
- Partial indexes on `status = 'active'` for hot-path queries
- `pg_trgm` extension for fuzzy name matching on farmer/commodity search

---

## 3. Offline-First Architecture

### Design Principles
Rural DRC has <15% consistent internet connectivity. The platform must function fully offline with graceful sync when connectivity returns.

### Local Storage Layer
```
┌─────────────────────────────────────┐
│          Mobile Client (PWA)        │
│  ┌─────────────────────────────┐    │
│  │   SQLite (via sql.js/WASM)  │    │
│  │   - Local farmer data       │    │
│  │   - Pending transactions    │    │
│  │   - Cached market prices    │    │
│  │   - Offline queue           │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │   Service Worker            │    │
│  │   - Asset caching           │    │
│  │   - Background sync         │    │
│  │   - Push notification queue │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
         │ (when online)
         ▼
┌─────────────────────────────────────┐
│       Sync Gateway (Django)         │
│  - Conflict resolution             │
│  - Delta sync (changed records)    │
│  - Compression (gzip payloads)     │
│  - Batch upload/download           │
└─────────────────────────────────────┘
```

### Conflict Resolution Strategy
- **Last-write-wins** for simple fields (farmer name, phone number)
- **Merge strategy** for additive records (harvest logs — server + client records both kept)
- **Manual resolution** for financial data (flagged for cooperative manager review)
- **Vector clocks** on critical entities to detect concurrent edits
- **Conflict log** table for auditing all resolved conflicts

### Sync Protocol
1. Client stores all mutations in `sync_queue` table with monotonic sequence numbers
2. On connectivity: client sends delta payload (compressed JSON, typically 5-50KB)
3. Server applies changes, detects conflicts, returns resolution + server-side deltas
4. Client applies server deltas and clears synced items from queue
5. Full resync triggered if client is >30 days stale or sequence gap detected

---

## 4. API Design

### CORA REST API
Supply chain matching and marketplace operations use REST for simplicity and cacheability.

```
POST   /api/v1/supply/listings          — Create supply listing
GET    /api/v1/supply/listings/:id      — Get listing details
POST   /api/v1/demand/requests          — Create demand request
GET    /api/v1/matches/:listing_id      — Get AI-generated matches
POST   /api/v1/transactions             — Initiate transaction
GET    /api/v1/market/prices?commodity= — Current market prices
GET    /api/v1/analytics/cooperative/:id — Cooperative analytics
```

### PonduOps GraphQL API
Farm data queries use GraphQL to allow flexible querying across deeply nested cooperative → farm → crop → harvest hierarchies.

```graphql
query CooperativeDashboard($coopId: ID!) {
  cooperative(id: $coopId) {
    members { id, name, totalArea, activeCrops }
    financials { balance, pendingLoans, monthlyContributions }
    harvests(season: "2025A") { crop, totalYield, avgQuality }
    performance { yieldIndex, inputEfficiency, marketEngagement }
  }
}
```

### Authentication & Rate Limiting
- JWT tokens with 24-hour expiry, refresh tokens stored in `httpOnly` cookies
- API key authentication for enterprise integrations and third-party access
- Rate limiting: 100 req/min (free tier), 1000 req/min (cooperative), 10,000 req/min (enterprise)
- Cooperative-scoped tenant isolation — all queries automatically filtered by `cooperative_id`

---

## 5. Infrastructure (Azure Cloud)

### Deployment Architecture
| Component | Azure Service | Configuration |
|---|---|---|
| CORA API | Azure App Service (Linux) | B2 plan, auto-scale 1-4 instances |
| PonduOps API | Azure App Service (Linux) | B2 plan, auto-scale 1-4 instances |
| Database | Azure Database for PostgreSQL Flexible | GP_Standard_D2s_v3, 128GB storage |
| Cache | Azure Cache for Redis | Basic C1, session + query cache |
| Storage | Azure Blob Storage | Farmer photos, documents, satellite imagery |
| CDN | Azure Front Door | Edge caching for static assets, rural area optimization |
| Monitoring | Azure Application Insights | APM, custom metrics, availability tests |
| CI/CD | GitHub Actions → Azure | Staging + production deployment slots |

### Edge Computing Considerations
- **Azure IoT Edge** for grain elevator deployments: local processing of weight/grading data
- **CDN push strategy**: Pre-cache market price data at edge nodes closest to DRC (South Africa PoP)
- **SMS gateway**: Azure Communication Services for SMS fallback in zero-connectivity zones

---

## 6. AI/ML Pipeline

### Supply Chain Matching Algorithm (CORA Core)
```
Input Features:
  - Commodity type + grade
  - Quantity available / requested
  - Geographic distance (farmer → buyer)
  - Historical reliability score (farmer + buyer)
  - Price spread (listing price vs market price)
  - Cooperative reputation index

Algorithm: Weighted scoring model (initially) → gradient-boosted ranking model (v2)
Output: Ranked match list with confidence scores (0-100)
Training Data: Historical transactions, cooperative feedback, market outcomes
```

### Crop Yield Prediction (PonduOps)
- **Inputs**: Historical yield data, soil type, rainfall, temperature, input usage, planting date
- **Model**: XGBoost regression, retrained monthly on cooperative-aggregated data
- **Accuracy target**: ±15% yield prediction at planting time, ±8% at mid-season
- **Deployment**: Azure ML managed endpoint, batch predictions weekly per cooperative

### Market Price Forecasting (CORA)
- **Inputs**: Historical prices from 50+ DRC markets, seasonal patterns, trade flows, weather
- **Model**: LSTM time-series model for 7-day and 30-day price forecasts
- **Update frequency**: Daily retraining on new price data
- **Serving**: Cached predictions in Redis, updated daily, served via REST API

---

## 7. Data Flow: Farmer → Market Pipeline

```
1. FARMER registers via PonduOps (cooperative-mediated)
   └→ Profile stored locally (SQLite) + synced to PostgreSQL

2. FARMER creates crop plan in PonduOps
   └→ Input requirements generated → cooperative bulk order (PonduOps)
   └→ Expected harvest data → supply forecast (synced to CORA)

3. FARMER logs harvest in PonduOps
   └→ Batch tagged (QR code), quality graded
   └→ Auto-creates CORA supply listing

4. CORA MATCHING ENGINE runs
   └→ Matches supply listing to buyer demand requests
   └→ Ranked matches sent to farmer + cooperative manager

5. TRANSACTION confirmed on CORA
   └→ Logistics arranged, payment initiated (mobile money)
   └→ Transaction recorded in both CORA + PonduOps financial modules

6. ANALYTICS updated
   └→ Cooperative performance dashboard refreshed
   └→ Market price index updated with realized transaction price
```

---

## 8. Scalability Design

### Current Scale Targets
- **700+ cooperatives** with 50-500 members each (35K-350K farmers)
- **Concurrent users**: 5,000 peak (cooperative managers during market hours)
- **Database size**: ~50GB per platform within 3 years
- **API throughput**: 500 req/sec peak across both platforms

### Scaling Strategies
- **Read replicas**: PostgreSQL read replicas for analytics and reporting queries
- **Connection pooling**: PgBouncer for Django's per-request connection model
- **Caching layers**: Redis for market prices (60s TTL), cooperative dashboards (5min TTL), user sessions
- **Async processing**: Celery + Redis for background tasks (sync processing, ML batch jobs, report generation)
- **Horizontal scaling**: Azure App Service auto-scaling based on CPU >70% and response time >2s
- **Database partitioning**: Range partitioning on `created_at` for time-series tables (harvest logs, transactions, price history)
