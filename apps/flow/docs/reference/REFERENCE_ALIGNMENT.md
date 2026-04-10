# Flow vs Union-Eyes — Reference Alignment

> Comparison of Flow (commerce) and Union-Eyes (union) against the Nzila OS platform standard.

## Platform Contract Compliance

| Contract | Flow | Union-Eyes |
|----------|------|------------|
| Health endpoint (`/api/health`) | ✅ Full dependency checks (db, storage, shopify, zoho, canva) | ✅ Full dependency checks (db, storage) |
| Metrics endpoint (`/api/metrics`) | ✅ Commerce KPIs (order_count, conversion_rate, avg_value, cycle_time) | ✅ Union KPIs (resolution_count, election_count) |
| Governance telemetry (`/api/governance/telemetry`) | ✅ policy_denied, anomaly, audit_volume, payment_gate_blocks | ✅ policy_denied, anomaly, audit_volume |
| Evidence export (`/api/evidence/export`) | ✅ Compliance evidence packs | ✅ Compliance evidence packs |
| Operational summary (`/api/ops/summary`) | ✅ active_orders, blocked, backlog, vendor_delays | ✅ active_cases, pending_elections |
| Demo seed | ✅ 2 orgs, 10 quotes, 6 orders, 5 POs, 3 production jobs | ✅ Multi-org with representation data |

## Workflow Architecture

| Aspect | Flow | Union-Eyes |
|--------|------|------------|
| State machines | 4 (order, quote, PO, production) | 3 (resolution, election, representation) |
| Transition validation | `InvalidTransitionError` with from/to | Same pattern |
| Event system | 30+ event types, in-process bus | Platform event bus |
| Payment gating | ✅ Order-level deposit/payment gates | N/A |
| Audit trail | Immutable AuditEvent entity | Immutable audit records |

## Integration Layer

| Aspect | Flow | Union-Eyes |
|--------|------|------------|
| External APIs | Shopify, Zoho, Canva (3 adapters) | Platform auth (email/password + Entra SSO) |
| Adapter pattern | Stateless, internal DB = source of truth | Stateless |
| Sync strategy | Bi-directional with conflict detection (Zoho) | N/A |

## Testing

| Test Type | Flow | Union-Eyes |
|-----------|------|------------|
| Unit tests | Vitest | Vitest |
| E2E tests | 6 scenarios (Playwright) | 6 scenarios (Playwright) |
| Contract tests | Platform contract compliance | Platform contract compliance |

## Registry Entry

Both apps are registered at `PRODUCTION` tier in `platform/registry/apps.json` with all capability flags set to `true`.

## Gaps (Flow)

- [ ] Canva integration is stubbed (not yet wired to Canva Connect API)
- [ ] Order DB tables not yet created in Drizzle schema
- [ ] Demo seed order data is in-memory only (pending DB table creation)

## Gaps (Union-Eyes)

- [ ] Entra SSO (optional) requires `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID` env vars for dev
- [ ] No external vendor/payment integration (not applicable for union domain)
