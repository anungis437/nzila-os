# Chapter 10 — Export Controls & Compliance

This chapter documents export controls, data-residency requirements, and
compliance checks for **{{PRODUCT_NAME}}**.

## Regulatory context

Depending on the jurisdictions served, the application may be subject to:

- **EAR** (Export Administration Regulations)
- **ITAR** (International Traffic in Arms Regulations)
- **GDPR** (General Data Protection Regulation)
- **POPIA** (Protection of Personal Information Act)

## Data residency

- All tenant data is stored in the region configured for the {{DB_PROVIDER}} instance.
- Cross-region replication is disabled by default. Enable it only after a legal review confirms compliance with applicable data-residency laws.

## Export control classification

| Component      | Classification | Notes                         |
| -------------- | -------------- | ----------------------------- |
| Application    | EAR99          | No controlled technology      |
| Encryption     | 5D002          | Standard TLS — mass-market exception applies |

## Compliance checks

The following automated checks run in CI:

1. **License audit** — `pnpm licenses list` ensures no disallowed licenses (e.g., AGPL) appear in production dependencies.
2. **Data-flow analysis** — Verifies that PII fields are not logged or exported without redaction.
3. **Geo-IP validation** — Staging smoke tests confirm that requests from embargoed regions are blocked at the edge.

## Data export

When a tenant requests a data export:

1. An authorized admin triggers the export via the admin dashboard.
2. The export job runs asynchronously and writes an encrypted archive to blob storage.
3. The tenant is notified with a time-limited download link.
4. The export event is recorded in the audit log (see Chapter 08).

## Audit trail

All compliance-relevant events are captured in the audit log with a
`compliance` category tag for easy filtering and reporting.
