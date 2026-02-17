# Fintech Technical Architecture

## Overview

Nzila Corp's fintech architecture spans two primary platforms — **C3UO/DiasporaCore V2** (Node.js, community banking & remittances) and **STSA** (Django, stock trading simulation & analytics) — unified through an API gateway and shared infrastructure layer. The system manages 485 database entities across community banking, remittance processing, tontine management, and trading operations.

---

## High-Level System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client Layer                          │
│  React Web App │ React Native Mobile │ Credit Union Portal│
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                 API Gateway (Kong)                        │
│  Rate Limiting │ Auth (JWT/OAuth2) │ Request Routing      │
└────────┬───────────────────────────────┬────────────────┘
         │                               │
┌────────▼────────┐            ┌─────────▼───────────┐
│  DiasporaCore   │            │      STSA            │
│  (Node.js/C3UO) │            │   (Django/DRF)       │
│                 │            │                      │
│ - Banking API   │            │ - Trading API        │
│ - Remittance    │            │ - Portfolio Engine    │
│ - Tontine Engine│            │ - Market Data Svc    │
│ - KYC/AML       │            │ - Social Trading     │
│ - Lending       │            │ - Robo-Advisor       │
└────────┬────────┘            └─────────┬───────────┘
         │                               │
┌────────▼───────────────────────────────▼───────────────┐
│              Shared Infrastructure Layer                 │
│  PostgreSQL │ Redis │ RabbitMQ │ S3 │ Elasticsearch      │
└─────────────────────────────────────────────────────────┘
```

---

## DiasporaCore / C3UO Service Architecture

### Core Services (Node.js + Express)

| Service | Responsibility | Port |
|---------|---------------|------|
| `banking-service` | Account management, balances, multi-currency wallets | 3001 |
| `remittance-service` | Corridor management, transfer execution, status tracking | 3002 |
| `tontine-service` | Group creation, contribution scheduling, payout logic | 3003 |
| `kyc-service` | Identity verification, document processing, risk scoring | 3004 |
| `lending-service` | Micro-loan origination, repayment tracking, credit scoring | 3005 |
| `notification-service` | Push notifications, SMS (Twilio), email (SendGrid) | 3006 |
| `admin-service` | Credit union management, tenant configuration, reporting | 3007 |

### Inter-Service Communication

- **Synchronous**: REST over HTTP for request-response patterns (account lookups, balance checks)
- **Asynchronous**: RabbitMQ message queues for event-driven workflows (remittance state transitions, tontine payout triggers, AML alerts)
- **Event Schema**: JSON Schema-validated events with versioning (e.g., `remittance.initiated.v2`, `tontine.payout.completed.v1`)

---

## STSA Service Architecture

### Core Services (Django + Django REST Framework)

| Service | Responsibility | Tech |
|---------|---------------|------|
| `trading-engine` | Paper trading execution, order management, position tracking | Django, Celery |
| `market-data` | Real-time quotes, historical data, African exchange feeds | Django, WebSocket |
| `portfolio-analytics` | Risk metrics, performance attribution, asset allocation | Django, NumPy/Pandas |
| `social-trading` | Follow/copy trading, leaderboards, trade sharing | Django, Redis |
| `education` | Trading academy content, progress tracking, quizzes | Django |

### Market Data Pipeline

```
IEX Cloud / Alpha Vantage / NSE / JSE APIs
        │
        ▼
  Market Data Ingestion (Celery Beat, 15s intervals)
        │
        ▼
  Redis Cache (real-time quotes, 30s TTL)
        │
        ├──▶ WebSocket Server (Socket.IO) ──▶ Client price updates
        │
        └──▶ PostgreSQL (OHLCV historical, partitioned by date)
```

---

## Database Architecture

### PostgreSQL Schema Design (485 Entities)

**DiasporaCore Domain (320+ entities)**:
- `users`, `user_profiles`, `user_kyc_documents`, `user_risk_scores`
- `accounts`, `account_balances`, `account_transactions`, `multi_currency_wallets`
- `remittance_orders`, `remittance_corridors`, `remittance_partners`, `remittance_status_log`
- `tontine_groups`, `tontine_members`, `tontine_contributions`, `tontine_payouts`, `tontine_disputes`
- `loans`, `loan_repayments`, `credit_scores`, `credit_score_factors`
- `tenants` (credit unions), `tenant_configs`, `tenant_branding`, `tenant_fee_structures`

**STSA Domain (165+ entities)**:
- `traders`, `portfolios`, `positions`, `orders`, `order_executions`
- `watchlists`, `watchlist_items`, `price_alerts`
- `market_instruments`, `market_quotes`, `historical_prices`
- `social_follows`, `trade_ideas`, `comments`, `leaderboard_snapshots`

### Multi-Tenancy for Credit Unions

```
Strategy: Schema-per-tenant with shared infrastructure

tenant_registry (shared schema)
├── tenant_id: UUID
├── tenant_name: "Desjardins Diaspora"
├── schema_name: "tenant_desjardins"
├── config: JSONB (fee structures, branding, features)
└── status: active/suspended

Each tenant schema contains identical table structures
with Row-Level Security (RLS) as an additional guard.
```

### Connection Pooling

- **PgBouncer**: Transaction-level pooling, 200 max connections per pool
- **Read Replicas**: 2 read replicas for analytics queries and reporting
- **Supabase**: Used for real-time subscriptions on balance updates and remittance status changes

---

## Payment Infrastructure

### Payment Processor Integrations

| Processor | Use Case | Region |
|-----------|----------|--------|
| Stripe | Card payments, KYC identity verification (Stripe Identity) | Global |
| Interac | e-Transfer funding/disbursement for Canadian users | Canada |
| Plaid | Bank account linking, balance verification | US/Canada |
| Flutterwave | Mobile money disbursement (M-Pesa, MTN MoMo, Orange Money) | Africa |
| Thunes | Cross-border remittance rails, last-mile cash pickup | Global corridors |
| Wise Business API | FX conversion backup, multi-currency holding | Global |

### Remittance Processing Pipeline

```
1. Sender initiates transfer (CAD → target currency)
   └─ Validate: KYC status, AML screening, daily limits

2. Fund collection (Interac / Stripe / ACH)
   └─ Webhook confirmation → update order status

3. FX conversion (internal rate engine or Wise API fallback)
   └─ Lock rate for 30 minutes, apply corridor-specific spread

4. Corridor routing (select optimal disbursement partner)
   └─ Flutterwave (mobile money) or Thunes (cash pickup/bank deposit)

5. Disbursement execution
   └─ Partner API call → real-time status polling

6. Delivery confirmation
   └─ Push notification to sender + recipient
   └─ Transaction logged for FINTRAC reporting
```

---

## Real-Time Infrastructure

### WebSocket Architecture

- **Socket.IO** (Node.js) for DiasporaCore: remittance status updates, tontine contribution notifications, chat
- **Django Channels** (STSA): live price feeds, order execution notifications, social trading activity
- **Redis Pub/Sub**: Backend event distribution across WebSocket server instances

### Push Notifications

- **Firebase Cloud Messaging (FCM)**: Android and web push
- **Apple Push Notification Service (APNS)**: iOS
- **Twilio SMS**: Fallback for users without smartphones, critical alerts (large transaction confirmations)
- **SendGrid**: Email notifications for statements, compliance documents, marketing

---

## Security Architecture

### Encryption

- **At Rest**: AES-256 encryption on all database volumes (AWS RDS encryption), S3 server-side encryption for documents
- **In Transit**: TLS 1.3 for all API communication, certificate pinning on mobile apps
- **Application Layer**: Sensitive fields (SSN, passport numbers) encrypted with envelope encryption using AWS KMS

### Tokenization

- **Payment Card Tokenization**: Stripe tokens replace raw card numbers — no PAN storage in our systems
- **PII Tokenization**: Format-preserving tokenization for names and addresses in non-production environments

### Fraud Detection

- **Rule-Based Engine**: Velocity checks (>5 transfers/hour), amount thresholds ($5K+), new device + large transaction combos
- **ML Models**: Gradient boosted trees trained on transaction patterns, flagging anomalies with confidence scores
- **Device Fingerprinting**: Browser/device fingerprint tracking via FingerprintJS, risk scoring on device changes
- **Behavioral Biometrics**: Typing patterns and interaction velocity analysis for session hijacking detection

---

## Compliance Engine

### Automated KYC Verification

```
Tier 1 (Basic): Email + phone verification → $500/month limit
Tier 2 (Standard): Government ID + selfie match (Stripe Identity) → $5,000/month
Tier 3 (Enhanced): Proof of address + source of funds → $25,000/month
Tier 4 (Premium): Enhanced due diligence + interview → Unlimited
```

### AML Transaction Monitoring

- **Real-time screening**: Every remittance order scanned against OFAC, UN, EU, and Canadian sanctions lists
- **PEP screening**: Politically exposed persons database check via ComplyAdvantage API
- **Suspicious Activity Detection**: Pattern analysis for structuring (smurfing), rapid movement, high-risk corridor behavior
- **STR Generation**: Automated Suspicious Transaction Report generation for FINTRAC submission

---

## Scalability & Performance

### Target Throughput

| Metric | Current | 2026 Target | 2028 Target |
|--------|---------|-------------|-------------|
| Concurrent users | 100 | 2,000 | 10,000 |
| Remittances/hour | 10 | 500 | 5,000 |
| API requests/sec | 50 | 1,000 | 10,000 |
| WebSocket connections | 200 | 5,000 | 50,000 |

### Horizontal Scaling Strategy

- **Containerization**: Docker containers orchestrated via Kubernetes (EKS)
- **Auto-scaling**: HPA based on CPU/memory utilization and custom metrics (queue depth, WebSocket connections)
- **Database Scaling**: Read replicas for analytics, connection pooling via PgBouncer, table partitioning on transaction tables by date
- **CDN**: CloudFront for static assets, edge caching for market data
- **Queue Scaling**: RabbitMQ cluster with 3 nodes, queue-specific consumers with independent scaling
