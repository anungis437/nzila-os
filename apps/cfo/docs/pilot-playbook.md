# CFO Dashboard — Pilot Playbook

## Overview
Step-by-step guide for piloting the CFO Dashboard with a finance team. Target: validate financial reporting, budget tracking, and export workflows.

## Prerequisites
- [ ] Nzila OS platform running (Docker or staging)
- [ ] Platform auth configured (email/password + optional Entra SSO) with CFO-specific roles (cfo, finance_manager, analyst)
- [ ] PostgreSQL database seeded with demo data
- [ ] Platform policy-engine enabled for financial operations

## Pilot Setup

### Step 1: Seed Demo Data
```bash
pnpm --filter @nzila/cfo demo:seed
```
This creates demo organizations, users, financial entries, budgets, and analytics.

### Step 2: Verify Health
```bash
curl http://localhost:3000/api/health
# Expect: { "status": "healthy", "service": "cfo" }
```

### Step 3: Assign Roles
- **CFO**: Full access including ledger adjustments and budget changes
- **Finance Manager**: Report generation, budget monitoring
- **Analyst**: Read-only dashboard and export access

### Step 4: Configure Policies
Verify policy enforcement is active:
- Ledger adjustments require dual approval
- Budget changes above $50,000 require CFO sign-off
- All financial exports are logged in evidence packs

## Key Workflows

1. **Financial Reporting** — Generate revenue/expense/net income reports by period
2. **Budget Tracking** — Monitor utilization, detect overruns, project annual spend
3. **Ledger Adjustments** — Submit adjustment with dual-approval policy enforcement
4. **Financial Export** — Export financial data with evidence pack and SBOM
5. **Audit Trail** — Review all financial operations via evidence/export endpoint

## Success Criteria
- [ ] Dashboard loads with accurate financial summaries
- [ ] Reports match seeded financial entries
- [ ] Budget overrun alerts trigger correctly
- [ ] Ledger adjustment requires dual approval
- [ ] Exports include valid evidence pack with policy check results
- [ ] Metrics endpoint returns request_count, error_rate, latency_ms

## Rollback Plan
1. Remove demo data via database rollback
2. Disable CFO-specific platform-auth roles
3. Revert policy engine configuration
