# Enterprise Hardening Architecture

> UnionEyes — Enterprise-grade platform hardening systems.

## Overview

Five interconnected systems provide production-grade reliability, auditability,
and compliance guarantees for the UnionEyes platform.

```
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway / Edge                        │
│  Rate Limiter → Request Signing → Webhook Verification         │
└───────────┬─────────────────────────────────────────────────────┘
            │
┌───────────▼─────────────────────────────────────────────────────┐
│                    Event Bus Architecture                       │
│  emit_event() → persist → Celery fan-out → handlers            │
│  SHA-256 integrity • 35+ event types • audit bridge            │
└───────────┬──────────────┬──────────────┬───────────────────────┘
            │              │              │
┌───────────▼───┐ ┌────────▼────────┐ ┌───▼───────────────────────┐
│ Integration   │ │  Observability  │ │  Evidence Pack System     │
│ Control Plane │ │  Layer          │ │                            │
│               │ │                 │ │  build → seal → verify     │
│ Registry      │ │ Structured logs │ │  SHA-256 checksums         │
│ Retry/DLQ     │ │ OTel tracing    │ │  Immutable exports         │
│ Idempotency   │ │ Prometheus mtx  │ │  5 artifact collectors     │
│ Health track  │ │ Request context │ │                            │
└───────────────┘ └─────────────────┘ └───────────────────────────┘
                                              │
                          ┌───────────────────▼───────────────────┐
                          │     Compliance Snapshot Engine        │
                          │                                       │
                          │  Periodic state → hash-chain → verify │
                          │  Daily / Monthly / Quarterly / On-demand │
                          │  Break-glass flagging                 │
                          └───────────────────────────────────────┘
```

---

## 1. Integration Control Plane

**Location:** `backend/services/integration_control_plane/`

### Purpose
Central registry and lifecycle manager for all external integrations (webhooks,
APIs, payment gateways, CRM connectors, etc.).

### Key Components

| File | Role |
|------|------|
| `models.py` | `IntegrationRegistry` (12 types, 5 statuses, health tracking) and `IntegrationIdempotencyKey` (dedup) |
| `tasks.py` | Celery tasks on 3 dedicated queues: `integration_queue`, `integration_retry_queue`, `integration_dead_letter_queue` |
| `views.py` | CRUD + `pause`, `resume`, `reset-failures`, `health_summary` actions |

### Retry Strategy
- Exponential backoff: `2^attempt` seconds (max 5 attempts)
- Automatic degradation after 5 consecutive failures
- Dead-letter queue for unrecoverable failures

### API Endpoints
```
GET/POST   /api/integrations/registry/
GET/PATCH  /api/integrations/registry/{id}/
POST       /api/integrations/registry/{id}/pause/
POST       /api/integrations/registry/{id}/resume/
POST       /api/integrations/registry/{id}/reset-failures/
GET        /api/integrations/registry/{id}/health_summary/
```

---

## 2. Event Bus Architecture

**Location:** `backend/services/events/`

### Purpose
Unified domain event system.  Every significant state change emits an event
that is persisted, integrity-hashed, and fanned out to audit logs + integrations.

### Event Categories (35+ types)
- **Case lifecycle:** `case_created`, `case_updated`, `case_closed`, `case_escalated`, `case_resolved`
- **Member:** `member_joined`, `member_left`, `member_role_changed`, `member_suspended`
- **Financial:** `payment_received`, `payment_failed`, `invoice_generated`, `refund_processed`
- **Governance:** `vote_cast`, `vote_completed`, `resolution_passed`, `election_started`
- **Integration:** `integration_connected`, `integration_disconnected`, `webhook_received`
- **Compliance:** `compliance_check_passed`, `compliance_check_failed`, `audit_triggered`, `compliance_snapshot_created`
- **Security:** `break_glass_action`, `suspicious_activity`, `access_denied`
- **System:** `system_healthcheck`, `deployment_completed`, `config_changed`

### Integrity Model
Each event stores a SHA-256 `signature_hash` of its canonical payload.
`verify_integrity()` recomputes and compares — detects any post-write tampering.

### API Endpoints
```
GET        /api/events/          (list + filter)
GET        /api/events/{id}/     (detail)
POST       /api/events/emit/     (programmatic emission)
POST       /api/events/verify-integrity/  (batch integrity check)
```

---

## 3. Observability Layer

**Location:** `backend/observability/`

### Purpose
Structured logging, distributed tracing (OpenTelemetry), and Prometheus-compatible
metrics — all unified through a single middleware.

### Components

| File | Role |
|------|------|
| `logging.py` | JSON structured formatter with PII auto-redaction, thread-local request context |
| `tracing.py` | OpenTelemetry SDK bootstrap (OTLP exporter, configurable sample rate), auto-instruments Django/psycopg2/Celery/requests/Redis |
| `metrics.py` | In-process metric store (counters, gauges, histograms), `MetricsMiddleware`, Prometheus text exporter |
| `middleware.py` | `ObservabilityMiddleware` — unified request context + X-Request-Id propagation + metrics recording |

### Metrics Endpoint
```
GET /metrics    → Prometheus text format
```

### Key Metrics
- `http_requests_total` (counter, labels: method, path, status)
- `http_request_duration_seconds` (histogram)
- `integration_failures_total` (counter, labels: integration_type)
- `celery_queue_depth` (gauge, labels: queue_name)
- `active_cases` (gauge, labels: org_id)

---

## 4. Evidence Pack System

**Location:** `backend/services/evidence_pack/`

### Purpose
Immutable, sealed evidence bundles for compliance exports, legal discovery,
governance audits, and regulatory filings.

### Pack Types
`compliance_audit`, `legal_discovery`, `governance_vote`, `financial_audit`,
`member_dispute`, `regulatory_filing`, `incident_report`

### Seal Model
- Manifest = JSON summary of all artifact references
- Seal = SHA-256 of `json.dumps(manifest, sort_keys=True)`
- `verify_seal()` recomputes and compares — detects tampering

### Artifact Types
`audit_log`, `domain_event`, `case_record`, `governance_record`,
`vote_record`, `financial_record`, `communication_log`, `system_log`

### API Endpoints
```
GET        /api/governance/evidence-pack/       (list packs)
GET        /api/governance/evidence-pack/{id}/  (detail)
POST       /api/governance/evidence-pack/export/       (build + seal + return)
GET        /api/governance/evidence-pack/{id}/download/ (sealed JSON download)
GET        /api/governance/evidence-pack/{id}/verify/   (integrity check)
GET        /api/governance/evidence-pack/{id}/artifacts/ (list artifacts)
```

---

## 5. Compliance Snapshot Engine

**Location:** `backend/services/compliance_snapshot/`

### Purpose
Periodic point-in-time captures of organizational compliance state.  Hash-chained
for immutability — each snapshot links to the previous via SHA-256, forming an
append-only compliance ledger.

### Snapshot Types
`daily`, `weekly`, `monthly`, `quarterly`, `annual`, `on_demand`

### Beat Schedule
| Task | Schedule |
|------|----------|
| `compliance_snapshot.capture_daily` | Daily at 01:00 UTC |
| `compliance_snapshot.capture_monthly` | 1st of month at 01:30 UTC |
| `compliance_snapshot.capture_quarterly` | 1st of Jan/Apr/Jul/Oct at 02:00 UTC |

### Payload Collected
- Member counts (total, active)
- Case counts (total, open)
- Audit events (last 30 days)
- Integration health (active, degraded, failed)
- Domain events (last 30 days)
- Evidence packs (total, sealed)

### Chain Verification
`verify_chain(org_id)` walks all snapshots in sequence order, verifying:
1. Each snapshot's own hash matches its payload
2. Each `previous_hash` matches the preceding snapshot's `hash`

### API Endpoints
```
GET        /api/compliance/snapshots/              (list)
GET        /api/compliance/snapshots/{id}/         (detail)
POST       /api/compliance/snapshots/capture/      (on-demand capture)
GET        /api/compliance/snapshots/verify-chain/ (full chain verification)
GET        /api/compliance/snapshots/{id}/verify/  (single snapshot integrity)
```

---

## 6. Security Enhancements

### Rate Limiting (`middleware/rate_limiter.py`)
Three-tier sliding-window throttling:
- **IP-based:** 120 req/min (burst protection)
- **Organization-based:** 1,000 req/min (org fairness)
- **API-key-based:** 300 req/min (per-key limits)

Uses Redis sorted sets for accurate sliding windows (fallback to Django cache
counter).

### Request Signing (`middleware/request_signing.py`)
HMAC-SHA256 signing for sensitive mutation endpoints:
- `/api/bargaining/votes/`
- `/api/billing/payments/`
- `/api/compliance/snapshots/capture`
- `/api/governance/evidence-pack/export`

Clients send `X-Signature` and `X-Timestamp` headers.  Middleware verifies
freshness (5 min) and constant-time signature comparison.

### Webhook Verification (`middleware/webhook_verification.py`)
Inbound webhook protection:
- HMAC-SHA256 signature validation
- Timestamp freshness check
- Redis-backed nonce replay protection

### Break-Glass Logging (`middleware/break_glass.py`)
Emergency override audit trail:
1. Hash-chained audit log entry (bridges to `core.AuditLogs`)
2. Domain event emission (`break_glass_action`)
3. Compliance snapshot trigger with break-glass flag
4. Cache-based admin notification flag

---

## Configuration

All new systems are wired via:
- **`config/settings.py`** — Celery queues, task routes, beat schedule, middleware, logging
- **`config/urls.py`** — API endpoint registration
- **Environment variables:**
  - `WEBHOOK_DEFAULT_SECRET` — fallback HMAC secret for webhooks
  - `REQUEST_SIGNING_SECRET` — client request signing key
  - `OTEL_EXPORTER_OTLP_ENDPOINT` — OpenTelemetry collector URL
  - `OTEL_TRACE_SAMPLE_RATE` — sampling ratio (0.0–1.0, default 1.0)

---

## Management Commands (planned)

```bash
python manage.py verify_audit_chain --org <org_id>
python manage.py export_evidence_pack --org <org_id> --type compliance_audit
python manage.py replay_events --org <org_id> --since 2024-01-01
```
