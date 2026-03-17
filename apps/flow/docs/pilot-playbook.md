# Shop Quoter — Pilot Playbook

## Overview
This playbook outlines the steps for running a Shop Quoter pilot deployment.

## Prerequisites
- Nzila OS platform deployed
- PostgreSQL database provisioned
- Azure Blob Storage configured
- Clerk authentication configured

## Pilot Setup
1. Run demo seed: `pnpm demo:seed`
2. Verify health: `GET /api/health`
3. Confirm metrics: `GET /api/metrics`
4. Validate evidence: `GET /api/evidence/export`

## Key Workflows to Demonstrate
1. **Quote Creation** — Create a new quote with line items
2. **Price Calculation** — Quebec tax calculations (GST/QST)
3. **Quote Lifecycle** — Draft → Pricing → Sent → Accepted
4. **Policy Enforcement** — Price overrides require approval above $10,000
5. **Export** — Export quotes as JSON/CSV with audit trail

## Success Criteria
- All health checks pass
- Quote lifecycle transitions are audited
- Policy engine blocks unauthorized price overrides
- Evidence packs are generated for all operations

## Rollback Plan
- Revert demo seed data
- Reset quote state machine to initial state
