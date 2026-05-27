# Pilot Scope Checklist

**Purpose:** Ensure every pilot engagement has a clearly defined scope before work begins.
**Owner:** Solutions Engineering / Account Executive
**Last Updated:** 2026-03-03

---

## Pre-Pilot Checklist

### 1. Customer & Org Setup

- [ ] Customer org created in Nzila OS (`Console → Orgs`)
- [ ] Org-scoped isolation verified (`Console → Isolation`)
- [ ] Primary contact and admin user provisioned (Clerk)
- [ ] Billing entity configured (Stripe customer ID)

### 2. Scope Agreement

- [ ] Pilot scope document signed (apps, modules, org count)
- [ ] Duration defined (typical: 30–90 days)
- [ ] Success criteria defined and measurable
- [ ] Data volume / transaction estimates documented
- [ ] Integration requirements listed (CRM, accounting, ERP, etc.)

### 3. Technical Readiness

- [ ] Deploy profile selected (Managed / Sovereign / Hybrid) — see [profiles.md](../deploy/profiles.md)
- [ ] Environment provisioned (Azure region, DB, blob storage)
- [ ] SLO policy reviewed — thresholds acceptable for pilot
- [ ] Perf budgets reviewed (`ops/perf-budgets.yml`) — enabled or deferred
- [ ] On-call rotation covers pilot org (see [on-call.md](../ops/on-call.md))

### 4. Security & Compliance

- [ ] Security & privacy packet delivered (see [03-security-privacy-packet.md](03-security-privacy-packet.md))
- [ ] Data residency requirements confirmed
- [ ] POPIA / GDPR compliance checklist reviewed
- [ ] Penetration test report available (if requested)
- [ ] Proof pack generated for pilot org (`Console → Proof Pack`)

### 5. Monitoring & Observability

- [ ] SLO monitoring active for pilot org
- [ ] Health digest alerts enabled for pilot org
- [ ] Console → System Health populated
- [ ] Runbooks reviewed for pilot-relevant incidents (see [runbooks](../../ops/runbooks/))

### 6. Demo & Training

- [ ] Demo script rehearsed (see [05-demo-script.md](05-demo-script.md))
- [ ] Admin training scheduled
- [ ] User onboarding materials prepared
- [ ] Support channel established (Slack / email)

---

## Exit Criteria (Go / No-Go for Pilot Launch)

| Gate | Owner | Status |
|------|-------|--------|
| Org provisioned & isolated | Platform | ☐ |
| SLOs within budget | Ops | ☐ |
| Contract tests green | Engineering | ☐ |
| Security packet delivered | CISO | ☐ |
| Demo completed with stakeholder | Solutions | ☐ |
| Runbooks accessible to on-call | Ops | ☐ |

> Run `pnpm exec tsx scripts/pilot-check.ts` to validate technical readiness.
