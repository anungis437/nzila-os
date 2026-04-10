# Flow — Platform Contracts

> Flow implements four `@nzila/platform-contracts` interfaces, making it
> visible to the Nzila OS control plane alongside Union-Eyes.

---

## Contract Summary

| Contract | Adapter File | Endpoint |
|----------|-------------|----------|
| `HealthContract` | `lib/platform-adapters/health-adapter.ts` | `/api/health` |
| `MetricsContract` | `lib/platform-adapters/metrics-adapter.ts` | `/api/metrics` |
| `EvidenceContract` | `lib/platform-adapters/evidence-adapter.ts` | `/api/evidence` |
| `GovernanceContract` | `lib/platform-adapters/governance-adapter.ts` | `/api/governance` |

---

## 1. Health Adapter

Reports operational readiness of Flow's dependencies.

```json
{
  "status": "healthy",
  "app": "flow",
  "version": "1.0.0",
  "dependencies": {
    "database": { "status": "healthy", "latencyMs": 12 },
    "auth": { "status": "healthy" },
    "blob_storage": { "status": "healthy" }
  },
  "uptime": 86400
}
```

**Checks performed:**
- Database: SELECT 1 query with latency measurement
- Auth: Auth service reachability
- Blob storage: Azure Storage account connectivity

---

## 2. Metrics Adapter

Exposes commerce KPIs for platform dashboards and alerting.

```json
{
  "app": "flow",
  "timestamp": "2025-12-01T00:00:00Z",
  "metrics": {
    "quotes_total": 142,
    "quotes_accepted": 87,
    "quotes_conversion_rate": 0.613,
    "orders_total": 87,
    "orders_in_production": 12,
    "orders_delivered": 63,
    "revenue_total": 1250000,
    "revenue_currency": "CAD",
    "payments_outstanding": 42000,
    "shipments_in_transit": 5,
    "avg_fulfillment_days": 14.2
  }
}
```

**Data sources:** Aggregation queries on `commerce_orders`, `flow_payments`,
`flow_production_jobs`, `flow_shipments` tables.

---

## 3. Evidence Adapter

Exports audit-grade evidence packs for compliance and governance reviews.

```json
{
  "app": "flow",
  "export_type": "domain_events",
  "date_range": { "from": "2025-11-01", "to": "2025-12-01" },
  "records": [
    {
      "event_type": "quote_created",
      "entity_type": "quote",
      "entity_id": "uuid",
      "actor_id": "user_xxx",
      "org_id": "org_xxx",
      "timestamp": "2025-11-15T10:30:00Z",
      "payload": { "...": "..." }
    }
  ],
  "total_records": 1247,
  "integrity_hash": "sha256:..."
}
```

**Key features:**
- Exports from `flow_domain_events` table
- Date-range filtering
- SHA-256 integrity hash over the full export
- Org-scoped — never leaks cross-org data

---

## 4. Governance Adapter

Reports policy compliance counters and anomaly signals.

```json
{
  "app": "flow",
  "timestamp": "2025-12-01T00:00:00Z",
  "policies": {
    "payment_gate_enforced": true,
    "workflow_guard_enforced": true,
    "org_isolation_enforced": true,
    "audit_events_persisted": true
  },
  "counters": {
    "commands_processed": 3421,
    "commands_rejected": 87,
    "payment_gates_blocked": 12,
    "invalid_transitions_blocked": 34,
    "invariant_violations": 41
  },
  "anomalies": []
}
```

**Anomaly detection:**
- High rejection rate (> 20% of commands rejected)
- Payment gate bypass attempts
- Repeated invalid transition attempts from the same actor

---

## Platform Visibility

The control plane aggregates these contracts across all Nzila OS apps:

```
Control Plane
  ├── Union-Eyes  → health / metrics / evidence / governance
  ├── Flow        → health / metrics / evidence / governance
  └── (future)    → ...
```

Each app self-reports through the same contract shapes, enabling
cross-app dashboards, unified alerting, and compliance audits.
