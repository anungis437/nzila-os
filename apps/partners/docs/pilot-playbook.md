# Partners Portal — Pilot Playbook

## Overview
Step-by-step guide for piloting the Partners Portal. Target: validate partner onboarding, contract management, and revenue tracking workflows.

## Prerequisites
- [ ] Nzila OS platform running (Docker or staging)
- [ ] Platform auth configured (email/password + optional Entra SSO) with partner roles (partner_admin, partner_manager, partner)
- [ ] PostgreSQL database seeded with demo data
- [ ] Azure Blob Storage configured for contract uploads
- [ ] Platform policy-engine enabled for partner operations

## Pilot Setup

### Step 1: Seed Demo Data
```bash
pnpm --filter @nzila/partners demo:seed
```
Creates demo partners, contracts, revenue records, and analytics.

### Step 2: Verify Health
```bash
curl http://localhost:3000/api/health
# Expect: { "status": "healthy", "service": "partners" }
```

### Step 3: Assign Roles
- **Partner Admin**: Full access — onboarding, contracts, revenue
- **Partner Manager**: Review onboarding, manage contracts
- **Partner**: View own contracts and revenue

### Step 4: Configure Policies
Verify policy enforcement is active:
- Partner onboarding requires admin approval
- Contract uploads limited to PDF/DOCX, 50MB max
- Revenue modifications above $5,000 require manager approval

## Key Workflows

1. **Partner Onboarding** — Submit partner application, validate with Zod, set PENDING status
2. **Contract Management** — Upload contracts to blob storage, validate file type/size
3. **Revenue Tracking** — View commission calculations, multi-month aggregation
4. **Tier Bonuses** — Verify gold/silver/bronze tier bonus application
5. **Evidence Export** — Export partner data with evidence pack for procurement

## Success Criteria
- [ ] Onboarding form validates all required fields
- [ ] Invalid submissions are rejected with clear error messages
- [ ] Contract upload enforces PDF/DOCX + 50MB limit
- [ ] Commission calculations are accurate (base rate + tier bonus)
- [ ] Revenue modifications above $5,000 trigger approval workflow
- [ ] Evidence pack includes SBOM and policy check results

## Rollback Plan
1. Remove demo partner data from database
2. Clear demo contracts from blob storage
3. Disable partner-specific platform-auth roles
4. Revert policy engine configuration
