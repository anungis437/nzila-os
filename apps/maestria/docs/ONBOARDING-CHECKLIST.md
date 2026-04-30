# Shop Moi Ça — Maestria Customer Onboarding Checklist

> **Owner:** Customer Success · **Applies to:** New Maestria tenants (Pilot & Growth tiers)

---

## Phase 0 — Pre-Kickoff (CSM, before Day 1)

- [ ] Verify pilot contract is countersigned and stored in `/artifacts/commercial/`
- [ ] Confirm billing setup in Stripe; invoice cadence agreed
- [ ] Identify primary contact + technical champion on client side
- [ ] Confirm client's Shopify store handle and plan tier (Partner / Basic / Advanced)
- [ ] Confirm Google Ads Manager Account ID (MCC) if applicable
- [ ] Confirm Zoho CRM edition (Standard / Professional / Enterprise)
- [ ] Add client to `onboarding` Slack channel; invite technical champion
- [ ] Schedule Kickoff call (45 min), Admin Setup call (60 min), Go-Live review (30 min)

---

## Phase 1 — Admin Setup (Day 1 – Day 3)

### 1.1 Tenant Provisioning
- [ ] Create org record in Maestria via `/api/maestria/users/invite` (OWNER role)
- [ ] Owner accepts invite; sets password via activation link
- [ ] CSM validates dashboard access at `/internal/dashboard`

### 1.2 User Roles
- [ ] Create accounts for all staff (roles: `owner`, `manager`, `marketing_staff`, `finance_staff`, `ops_staff`, `viewer`)
- [ ] Confirm role matrix aligns with client's team structure
- [ ] Owner completes `/internal/onboarding` wizard in-app

### 1.3 Connector Setup
- [ ] **Shopify** — Connect via OAuth at `/api/maestria/connectors/shopify`; confirm `status: connected`
- [ ] **Google Ads** — Connect via OAuth at `/api/maestria/connectors/google-ads`; confirm `status: connected`
- [ ] **Zoho CRM** — Connect via OAuth at `/api/maestria/connectors/zoho`; confirm `status: connected`
- [ ] Verify all three connectors green at `GET /api/maestria/connectors/status`

### 1.4 Initial Data Sync
- [ ] Shopify: products, orders, inventory synced (confirm item counts in dashboard)
- [ ] Google Ads: campaigns, ad sets, spend data imported
- [ ] Zoho: contacts, deals, pipelines imported
- [ ] Run `GET /api/maestria/health` → all checks pass

---

## Phase 2 — Configuration (Day 3 – Day 7)

### 2.1 Pricing & Margins
- [ ] Import supplier cost sheet via `/api/maestria/import/csv` (template: `docs/csv-import-template.csv`)
- [ ] Set default margin targets per category in pricing module
- [ ] Validate spot-check: 10 SKUs show correct landed cost + margin

### 2.2 Notifications
- [ ] Configure alert email addresses (margin alert, inventory low, campaign anomaly)
- [ ] Send test notification; confirm delivery
- [ ] Set notification thresholds (default: margin < 15%, stock < 50 units)

### 2.3 Backup & Recovery
- [ ] Confirm automated backup schedule (default: daily at 02:00 UTC)
- [ ] Run manual backup via `POST /api/maestria/backup` → `status: success`
- [ ] CSM documents recovery contact and RTO/RPO expectations with client

### 2.4 Campaigns & Ads
- [ ] Link ad campaigns to corresponding Shopify product collections
- [ ] Set campaign budget guardrails; confirm ROAS floor configured
- [ ] Validate pilot-metrics page at `/internal/pilot-metrics` renders correct KPIs

---

## Phase 3 — Go-Live Readiness (Day 7 – Day 10)

- [ ] All connector health checks green (run `/api/maestria/connectors/status`)
- [ ] Run full monitoring snapshot (`GET /api/maestria/monitoring/metrics`)
- [ ] Confirm no `critical` alerts in readiness (`GET /api/maestria/readiness`)
- [ ] Walkthrough `/internal/monitoring` with client technical champion
- [ ] Client signs off on data accuracy (orders, margin, campaign spend)
- [ ] CSM records go-live date in CRM and sets 30-day check-in reminder

---

## Phase 4 — Post-Launch (Day 10+)

- [ ] 7-day review: confirm sync cadence still healthy, no auth token expiry
- [ ] 30-day review: review pilot-metrics KPIs against agreed success criteria
- [ ] Upgrade path discussion (Growth → Scale) if thresholds met
- [ ] Document any custom workflows or edge cases in client notes

---

## Quick-Reference Links

| Resource | URL |
|---|---|
| Health | `GET /api/maestria/health` |
| Readiness | `GET /api/maestria/readiness` |
| Connector status | `GET /api/maestria/connectors/status` |
| Metrics | `GET /api/maestria/monitoring/metrics` |
| Backup | `POST /api/maestria/backup` |
| CSV Import | `POST /api/maestria/import/csv` |
| Onboarding wizard | `/internal/onboarding` |
| Pilot KPIs | `/internal/pilot-metrics` |
| Monitoring | `/internal/monitoring` |

---

*Last updated: see git log · Maintained by: Customer Success & Engineering*
