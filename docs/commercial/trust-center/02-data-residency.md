# Data Residency

## Current Operating Region

Primary hosting and application runtime are configured in Azure Canada Central for the staging production-like environment.

## Evidence

- Container Apps environment: `nzila-canada-staging-env` (Canada Central).
- Resource group and ACR naming pattern aligned to Canada deployment.
- Domain endpoints resolve to the Canada-based container environment.

## Customer Commitment Language

- Operational default is Canada-based hosting.
- Customer-specific residency guarantees must be set in contract and deployment profile.

## Source

- `docs/commercial/claims-ledger.md`
- `reports/ops/snapshot.json`
