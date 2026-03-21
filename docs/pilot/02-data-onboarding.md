# Data Onboarding Guide

**Purpose:** Step-by-step guide for onboarding customer data into a Nzila OS pilot.
**Owner:** Solutions Engineering
**Last Updated:** 2026-03-03

---

## 1. Pre-Onboarding Assessment

### Data Inventory

| Question | Answer |
|----------|--------|
| What data types will be imported? | (customers, transactions, products, etc.) |
| What is the volume? | (row count, file size) |
| What format is the source data? | (CSV, JSON, API, DB export) |
| What is the data quality? | (clean / needs transformation) |
| Are there PII fields? | (names, emails, ID numbers) |
| Data residency requirements? | (region, country) |

### PII Handling

All PII must be:

- Encrypted in transit (TLS 1.2+)
- Encrypted at rest (Azure Blob + AES-256)
- Org-scoped (never visible to other orgs)
- Subject to data lifecycle policy (`packages/data-lifecycle`)

---

## 2. Import Methods

### Method A: Bulk CSV Import

Best for: Initial data load, historical data.

1. Customer prepares CSV files per entity type.
2. Files uploaded to secure staging area (Azure Blob, pilot org container).
3. Import job validates schema, maps fields, and inserts.
4. Audit event: `data.import.completed` with row counts and hash.

```
Required columns per entity:
- Customers: name, email, phone, org_external_id
- Transactions: date, amount, currency, customer_ref
- Products: sku, name, category, price
```

### Method B: API Integration

Best for: Ongoing sync, real-time data.

1. Configure integration credentials in `Console → Integrations`.
2. Select provider adapter (Stripe, QuickBooks, HubSpot, etc.).
3. Map fields using integration mapping config.
4. Enable sync schedule (real-time or batch).

### Method C: Database Migration

Best for: Moving from legacy system.

1. Export source database schema and data.
2. Transform using migration scripts.
3. Import via bulk insert with transaction safety.
4. Verify record counts and integrity hashes.

---

## 3. Validation Steps

After import:

- [ ] Record counts match source
- [ ] Sample records verified manually (10 random)
- [ ] No cross-org data leakage (isolation check)
- [ ] PII fields encrypted correctly
- [ ] Audit trail shows import events
- [ ] Hash chain integrity verified

---

## 4. Rollback Plan

If data import fails or produces bad data:

1. Identify affected records via audit trail.
2. Execute rollback (delete imported batch by import job ID).
3. Audit event: `data.import.rolled_back`.
4. Fix source data or mapping.
5. Re-import.

---

## 5. Post-Onboarding Verification

| Check | Tool | Expected |
|-------|------|----------|
| Data visible in app | Console / App | Customer sees their data |
| No foreign data | Isolation audit | Only pilot org data |
| Integrations syncing | Console → Integrations | Health: OK |
| SLOs within budget | Console → Performance | No regressions |

---

## Related Documents

- [Scope Checklist](01-scope-checklist.md)
- [Security & Privacy Packet](03-security-privacy-packet.md)
- [Monitoring & SLOs](04-monitoring-and-slos.md)
