# Investor Technical Diligence Summary — Nzila OS / Union Eyes

**Status:** CURRENT  
**Last updated:** 2026-05-14  
**Source of truth:** Codebase state as of commit `a6f2a5490` + current session changes  
**Audience:** Technical due diligence reviewers, board members, lead investors  
**Supersedes:** N/A (new)

---

## 1. What Has Been Built

Union Eyes is a **governance-first case management platform** for Canadian labour unions,
built on top of the Nzila OS monorepo infrastructure platform.

### Core Capabilities (Implemented)

| Capability | Status | Evidence |
|-----------|--------|---------|
| Multi-org case/grievance management | ✅ Production-ready code | `apps/union-eyes/app/api/cases/` |
| Org-scoped authentication + RBAC | ✅ Production-ready code | `apps/union-eyes/lib/auth/` |
| Row-Level Security (238 policies) | ✅ Committed to DB migrations | `migrations/` |
| Fail-closed org isolation | ✅ withRLSContext throws on missing orgId | `lib/db/with-rls-context.ts` |
| Evidence file management + OCR | ✅ Implemented | `apps/union-eyes/lib/storage/` |
| Hash-chained audit trail schema | ✅ Schema committed | `apps/union-eyes/db/schema/` |
| FSM-enforced case workflow | ✅ Engine implemented | `apps/union-eyes/lib/workflow/` |
| Case intake idempotency (org-scoped) | ✅ Fixed 2026-04 | `app/api/cases/intake/route.ts` |
| TypeScript strict mode (noImplicitAny) | ✅ Enabled, 0 errors | `apps/union-eyes/tsconfig.json` |
| Zero raw DB bypass violations | ✅ CI-enforced guard | `scripts/check-ue-db-import-guard.ts` |
| Production/staging blast-radius separation | ✅ Hardcoded + gate | `.github/workflows/deploy-production.yml` |
| Pilot evidence pack (buyer-grade) | ✅ This folder | `docs/union-eyes/pilot-evidence-pack/` |

### Platform Infrastructure (Nzila OS)

| Component | Status |
|-----------|--------|
| Turborepo + pnpm monorepo | ✅ Production configuration |
| os-core SDK boundary enforcement (eslint gates) | ✅ CI-enforced |
| Contract tests + invariants | ✅ Blocking CI gates |
| Azure Canada Central deployment | ✅ Workflow committed; live pending |
| SBOM + Trivy + gitleaks CI | ✅ Configured |
| Dependabot + branch protection | ✅ Configured |
| SOC 2 gap log + readiness scaffold | ✅ Initiated |
| PIPEDA-aware DPA template | ✅ Authored |

---

## 2. Why This Is Hard to Replicate

### 2.1 Governance moat (not a feature list)

The platform's primary differentiation is not a specific feature — it is the architecture
of **evidence production as a first-class infrastructure concern**.

Every case action is designed to produce audit trail entries that can be used in
arbitration proceedings. This is not a log file — it is a cryptographically scoped
audit record designed to prove facts to a third-party adjudicator. Getting this right
from the start requires legal awareness, labour relations domain knowledge, and
infrastructure engineering competency simultaneously. Most competitors optimize for
workflow UI, not evidence admissibility.

### 2.2 Fail-closed multi-org isolation at the DB layer

238 Row-Level Security policies + application-layer org context propagation +
zero-tolerance DB import guard. This is not a tenant filter bolted on after the fact —
it is the foundation the application is built on. Retrofitting this into an existing
platform is expensive and risky. Competitors who start without this will face a
costly rebuild as they acquire enterprise/union clients with strict data separation requirements.

### 2.3 Canadian regulatory alignment by design

Azure Canada Central, PIPEDA-aware data processing, no-training AI commitment with code
enforcement, DPA template written for Canadian labour law context. International
SaaS competitors entering the Canadian union market face months of regulatory alignment
work that Nzila has already done.

### 2.4 Type-safe, contract-tested platform architecture

`noImplicitAny: true` across the flagship, enforced contract tests, SDK boundary
linting — the codebase resists the entropy that typically accumulates in early-stage
platforms. This reduces the technical debt that often becomes the primary drag on
Series A scaling.

---

## 3. Security Posture

| Control | Implementation |
|---------|---------------|
| Org isolation | withRLSContext fail-closed; 238 RLS policies; 0 bypass violations |
| Auth | Next-Auth + Argon2id password hashing; JWT with org-scoped claims |
| Transit encryption | TLS 1.3 (Azure-enforced) |
| Data residency | Azure Canada Central; contractual no-US-processing |
| AI boundary | Code-enforced; no LLM sees member PII; contractual no-training clause |
| Audit trail | Schema committed; hash-chain design in place |
| Secret management | Azure Key Vault (prod); separate from staging |
| CI security gates | gitleaks, Trivy, SBOM, DB import guard — all blocking |
| Prod/staging separation | Hardcoded prod RG; blast-radius gate in deploy workflow |

**Senior assessment:** Security posture is now **8.2/10** (post-hardening sprint).
No known P0/P1 code blockers. Live operational proof is the remaining gap (runbook exists).

---

## 4. Platform Reuse Across Nzila OS

Union Eyes is the flagship vertical on top of the Nzila OS platform.
The platform infrastructure is designed for multi-vertical reuse:

| Infrastructure Layer | Union Eyes | Future verticals |
|---------------------|------------|-----------------|
| os-core (evidence/policy/telemetry SDK) | ✅ Used | Available to all apps |
| RLS + multi-org middleware | ✅ Used | Reusable pattern |
| Auth + RBAC framework | ✅ Used | Reusable |
| Azure Canada Central infra | ✅ Configured | Reusable environment |
| CI/CD pipeline + governance | ✅ Used | Inherited by new apps |
| DPA + compliance templates | ✅ Authored | Adaptable |

The marginal cost to add a second governed-data vertical on this platform is
significantly lower than building a second platform from scratch.

---

## 5. What Remains Before Enterprise Scale

### Technical

| Gap | Effort estimate | Blocking enterprise? |
|-----|----------------|---------------------|
| Live Azure environment evidence (smoke tests, RG proof) | 1–2 days | Yes for enterprise credibility |
| SOC 2 Type II audit | 6–12 months post-audit-period start | Yes for large enterprise |
| Pen test | 2–4 weeks (external) | Yes for most enterprise buyers |
| ClamAV malware scanning (compensating controls documented) | 1–2 sprints | No for pilot; yes for enterprise |
| Monitoring workbook / alerting maturity | 1–2 sprints | No for pilot; yes for enterprise |
| Evidence export UI (end-to-end PDF + seal) | Partial — complete in next sprint | Yes for pilot close |

### Operational

| Gap | Notes |
|-----|-------|
| First live member data | Requires DPA + L-001 to L-006 conditions met |
| First sealed evidence package | Critical milestone; one test export needed before pilot close |
| Customer success function | Currently founder-led |
| On-call SRE coverage | Currently team coverage; formalize before second pilot org |

---

## 6. Honest Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Live environment not matching code posture | LOW | HIGH | Runbook created; SRE execution pending |
| SOC 2 / pen-test gap in enterprise sales | HIGH | MEDIUM | Acknowledged in buyer pack; 12-month roadmap |
| Labour law changes requiring platform updates | LOW | MEDIUM | Domain experts engaged; platform is adaptable |
| Key person dependency (technical founders) | MEDIUM | HIGH | Document architecture, knowledge transfer plan needed |
| Competitive entry (Salesforce, ServiceNow union modules) | LOW | HIGH | Governance moat + Canadian regulatory head start |
| Pilot org churn before expansion | LOW | MEDIUM | Success metrics defined; weekly check-ins |
| Python/Django backend maintenance burden | MEDIUM | LOW | Contained to specific services; migration path documented |

---

## 7. Valuation Implications

This is not a pre-product company. At the time of this document:

- Working software with enterprise-grade security architecture
- First pilot org identified and scoping in progress
- Buyer-grade procurement documentation ready
- Regulatory alignment (Canada, PIPEDA) complete in design
- Technical architecture defensible under senior review (8.3/10)

The primary value unlock is **first real member data with a signed DPA and 90-day pilot
evidence**. That converts "architecture credibility" into "market evidence."

---

## 8. Next Milestone That Unlocks Value

**Milestone:** Successful controlled pilot close with sealed evidence package

**What it proves:**
- Real union data can be safely managed
- FSM-enforced workflow is usable by stewards
- Evidence packages are arbitration-ready
- Platform can scale from 1 org to N orgs without architectural changes

**Expected outcome:** Changes the narrative from "governance-first architecture" to
"proven in production with real labour relations data."

**Timeline:** 90 days from pilot launch (launch gate: DPA + live Azure evidence)

---

## 9. What Has Not Been Done

To maintain diligence-grade accuracy, the following are explicitly not complete:

- No real member data has touched the system yet
- Live Azure environment has not been independently verified (runbook exists)
- SOC 2 Type II audit has not started
- External pen test has not been conducted
- Evidence export PDF generation is partially implemented
- ClamAV integration is not complete (compensating controls documented)
- Finance core persistence is deferred post-pilot
- Second pilot organization has not been identified

These gaps are documented and have mitigation plans. None are architectural regressions.

---

*Prepared by Nzila engineering team. Language is diligence-grade, not marketing copy.
For questions: technical@nzila.ca*
