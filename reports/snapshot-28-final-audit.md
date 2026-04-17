# Snapshot 28 — Final Repo Audit

> Date: April 17, 2026  
> Authority: Principal Architect / CTO  
> Method: Physical inspection of /apps, /packages, /docs, /reports, /governance, and all truth sources  
> Status: EXECUTED

---

## 1. Repo Reality Lock

### Apps Present (17)

| App | Framework | Code Files | Product Tier | Deployment Status | Classification |
|-----|-----------|------------|--------------|-------------------|----------------|
| union-eyes | Next.js + Django | 3,028 | PRODUCTION | pilot | A — Active repo product |
| flow | Next.js | 316 | PRODUCTION | pilot | A — Active repo product |
| console | Next.js | 205 | PRODUCTION | internal | B — Internal platform component |
| web | Next.js | 60 | PRODUCTION | pilot | A — Active repo product |
| control-plane | Next.js | 154 | PILOT | internal | B — Internal platform component |
| partners | Next.js | 100 | PILOT | pilot | A — Active repo product |
| cfo | Next.js | 233 | PILOT | pilot | A — Active repo product |
| zonga | Next.js + Django | 393 | INCUBATING | internal | C — Early/immature repo asset |
| agrimo | Next.js + Django | 97 | INCUBATING | internal | C — Early/immature repo asset |
| trade | Next.js | 51 | INCUBATING | internal | C — Early/immature repo asset |
| cora | Next.js | 37 | INCUBATING | internal | C — Early/immature repo asset |
| nacp-exams | Next.js | 59 | INCUBATING | internal | C — Early/immature repo asset |
| mobility | Next.js | 36 | INCUBATING | internal | C — Early/immature repo asset |
| mobility-client-portal | Next.js | 32 | EXPERIMENTAL | internal | C — Early scaffold |
| abr | Next.js + Django | 202 | EXPERIMENTAL | internal | C — Early scaffold |
| platform-admin | Next.js | 27 | EXPERIMENTAL | internal | C — Early scaffold |
| orchestrator-api | Fastify | 26 | EXPERIMENTAL | scaffold | C — Scaffold only |

### Packages Present (130+)

Key groupings confirmed physically:
- **Platform core**: platform-auth, platform-billing, platform-revenue, platform-contracts, platform-evidence-pack, platform-governance, platform-policy-engine, platform-observability, platform-compliance-snapshots, platform-proof, evidence, db, os-core, org, audit
- **Product-specific**: zonga-* (12 packages), agri-* (10 packages), commerce-* (9 packages), mobility-* (6 packages), ue-assistant, union-claims-financial, cfo-core, cfo-intelligence
- **Infra/tooling**: otel-core, security, secrets, config, events, webhooks, analytics, observability, blob, ingestion-core, data-lifecycle
- **Thin wrappers / unclear value**: ai-control, ai-registry (very thin), chatops-slack, chatops-teams, crm-hubspot (likely thin), platform-rfp-generator, platform-rum

Products NOT in repo: `the-button`, `courtlens` — portfolio concept only, no engineering allocation.

---

## 2. Audit Findings by Dimension

### 2.1 Commercial Viability

| App | Viable Now | Rationale |
|-----|------------|-----------|
| union-eyes | ✅ YES | Active pilot, deep codebase (3,028 files), CUPE pilot docs complete, procurement pack referenced |
| flow | ✅ YES | 316 files, SMB commerce vertical, revenue-integrated, pilot deployment |
| cfo | 🟡 NEAR | 233 files, real integrations (QBO, Plaid), pilot-ready but no pilot docs |
| partners | 🟡 NEAR | 100 files, partner deals/commissions, pilot deployment |
| zonga | 🔵 FUTURE | 393 files + 12 packages, but internal only, no pilot path documented |
| agrimo | 🔵 FUTURE | 97 files + 10 agri packages, internal only |
| all others | ⬛ INTERNAL | Not commercially viable now |

### 2.2 Distraction Risk

| App/Area | Risk | Reason |
|----------|------|--------|
| orchestrator-api | HIGH | Scaffold only (26 files), no clear product story |
| platform-admin | MEDIUM | 27 files, experimental, unclear external value |
| mobility-client-portal | MEDIUM | 32 files, experimental, no pilot path |
| cora | LOW | Small (37 files) but part of agri vertical |
| nacp-exams | LOW | Niche use case, internal-only, small codebase |

### 2.3 Package Leverage Assessment

| Package | Leverage | Adoption | Verdict |
|---------|----------|----------|---------|
| platform-auth | HIGH | All 17 apps | HARDEN |
| platform-revenue | HIGH | Revenue apps | HARDEN |
| platform-contracts | HIGH | All apps (CI gate) | HARDEN |
| evidence / platform-evidence-pack | HIGH | Audit trail apps | HARDEN |
| db / org | HIGH | Most apps | HARDEN |
| platform-governance | HIGH | Contract tests + CI | HARDEN |
| platform-observability / otel-core | HIGH | Platform-wide | HARDEN |
| platform-billing | HIGH | Revenue apps | HARDEN |
| platform-policy-engine | HIGH | RBAC everywhere | HARDEN |
| platform-compliance-snapshots | MEDIUM | Governance tooling | KEEP LIGHT |
| data-lifecycle | MEDIUM | Retention/audit | KEEP LIGHT |
| platform-pilot-metrics | MEDIUM | Pilot monitoring | KEEP LIGHT |
| ai-sdk / ml-sdk | MEDIUM | AI-enabled apps | KEEP LIGHT |
| chatops-slack / chatops-teams | LOW | Unknown adoption | DOWNGRADE |
| ai-control / ai-registry | LOW | Thin wrappers | DOWNGRADE |
| platform-rfp-generator | LOW | Docs tooling only | DOWNGRADE |
| platform-rum | LOW | Thin wrapper | DOWNGRADE |
| crm-hubspot / integrations-hubspot | LOW | Unclear adoption | DOWNGRADE |

### 2.4 Truth Source Contradictions

| Surface | Issue | Severity |
|---------|-------|----------|
| ~~docs/platform/what-is-nzila.md~~ | ~~"30 GA gates" (actual: 23)~~ | ~~P0~~ — **FIXED** |
| ~~docs/platform/what-is-nzila.md~~ | ~~"380+ contract tests" (actual: 1,900+)~~ | ~~P0~~ — **FIXED** |
| ~~docs/platform/what-is-nzila.md~~ | ~~"production-deployed revenue verticals" for pilot apps~~ | ~~P0~~ — **FIXED** |
| reports/scorecard.md | Generated 2026-03-10, pre-dates April truth updates | P1 |
| reports/claim-verification.md | Generated 2026-03-10, outdated | P2 |
| reports/unsafe-claims.md | Generated 2026-03-10, not refreshed | P2 |

### 2.5 Illegal Claims Scan

Surfaces scanned: README.md, ARCHITECTURE.md, docs/platform/what-is-nzila.md, docs/personas/01-buyer.md, docs/governance/procurement-pack.md, docs/platform/portfolio-matrix.md

| Claim Type | Location | Authorized | Status |
|------------|----------|------------|--------|
| "production-deployed" for Flow/CFO | what-is-nzila.md | NO | **FIXED** |
| "30 GA gates" | what-is-nzila.md | NO | **FIXED** |
| "380+ contract tests" | what-is-nzila.md | NO | **FIXED** |
| "pilot-ready" for union-eyes | docs/union-eyes/* | YES (catalog: can_claim_pilot_ready=true) | ✅ CLEAN |
| "audit-hardened" for union-eyes | docs/governance/procurement-pack.md | YES (catalog: can_claim_audit_hardened=true) | ✅ CLEAN |
| "tamper-evident audit trails" | README.md, ARCHITECTURE.md | YES (evidence package exists) | ✅ CLEAN |
| Product tier "PRODUCTION" | Portfolio matrix | YES (authorized tier, not deployment) | ✅ CLEAN |

### 2.6 Dead Links / Dead Docs

Investigation found all internal links in docs/README.md reference files that physically exist. No dead-link P0s detected. Minor stale reference notes:
- `docs/plans/studio-maturity-10-of-10.md` — aspirational plan doc, clearly labeled, low risk
- `docs/archive/` — clearly labeled archive, low risk
- `docs/backlog/` — clearly labeled backlog, low risk

### 2.7 Placeholder / Demo Residue

| Location | Type | Risk |
|----------|------|------|
| docs/platform/proof/demo-script.md | Demo script | LOW — clearly labeled |
| docs/tutorials/MULTI_ORG_DEMO_FLOW.md | Tutorial demo | LOW — clearly labeled |
| docs/decision-layer/demos/ | Demo content | LOW — clearly labeled |

No lorem ipsum or fake dashboard references found in top-level surfaces.

### 2.8 Build / Lint / Type Health

| Gate | Status | Notes |
|------|--------|-------|
| GA check | ✅ PASS 23/23 | Run 2026-04-17 |
| validate:product-catalog | ✅ PASS 17/17 | Run 2026-04-17 |
| validate:truth-authority | ✅ PASS | Run 2026-04-17 |
| Contract tests | 1,973 tests (last confirmed run) | Coverage by CI |

### 2.9 CI Gate Quality

- GA gate: 23 mandatory checks, fail-closed — STRONG
- Contract tests: 1,973 tests across auth, revenue, control-plane, platform invariants — STRONG
- Product catalog validator: cross-source contradiction checks — ADDED 2026-04-17
- Truth authority validator: dual-axis consistency — ADDED previously
- Dep audit gate: high-severity threshold via supply-chain-policy.ts — EXISTS
- Snyk dep scan: 9/149 projects have known issues (Python/scaffold dirs) — ACCEPTABLE

### 2.10 Security Posture

- Argon2id + PG sessions (no JWTs for session state) — STRONG
- Azure Key Vault for secrets — CONFIRMED
- Gitleaks + TruffleHog secret scanning in CI — CONFIRMED
- Trivy container scanning (CRITICAL threshold) — CONFIRMED
- CycloneDX SBOM + Ed25519 build attestation — CONFIRMED
- pnpm overrides for security patches — ACTIVE

### 2.11 Revenue Readiness Blockers

| Product | Blocker | Priority |
|---------|---------|----------|
| union-eyes | No self-contained revenue product brief in docs | P1 |
| flow | No self-contained revenue product brief; no ICP document | P1 |
| cfo | No pilot path documented; integration status unclear | P2 |
| zonga | Internal only, no pilot timeline or business case | P3 |

### 2.12 Sales Narrative Blockers

| Issue | Impact | Priority |
|-------|--------|----------|
| No single "Revenue Products" landing page | Buyers can't quickly find what's for sale | P1 |
| Union Eyes and Flow docs are deep in docs/union-eyes/ | No quick executive-readable entry | P1 |
| Investor brief doesn't exist as standalone doc | Investor narrative hidden in reports | P1 |
| product-catalog lacks value_prop field | Cannot generate authoritative value propositions | P1 |

### 2.13 Investor Clarity Blockers

| Issue | Priority |
|-------|---------|
| No standalone investor brief | P1 |
| Multi-product story not told concisely | P1 |
| Platform economics / shared leverage not quantified | P2 |
| Revenue runway not modeled (appropriately) | P3 |

### 2.14 Governance Blind Spots

| Gap | Priority |
|-----|---------|
| product-catalog lacks `id`, `value_prop`, `evidence_status`, `docs_entrypoint`, `commercial_priority`, `code_presence` fields | P1 |
| No automated scan for illegal claims on docs/ changes | P2 |
| Scorecard stale (March 2026) | P1 |
| Some packages (chatops-*, ai-control, platform-rfp-generator) have no clear ownership documentation | P2 |

---

## 3. Priority Classification Summary

### P0 — Immediate Blockers (Fixed in this pass)
- ~~Illegal claim: "production-deployed" for pilot apps in what-is-nzila.md~~ ✅ FIXED
- ~~Wrong GA gate count (30 vs 23) in what-is-nzila.md~~ ✅ FIXED
- ~~Wrong contract test count (380+ vs 1,900+) in what-is-nzila.md~~ ✅ FIXED

### P1 — Must Fix Now
- [ ] Product catalog missing Phase 3 fields (value_prop, id, evidence_status, etc.)
- [ ] No standalone revenue product brief for Union Eyes
- [ ] No standalone revenue product brief for Flow  
- [ ] No investor brief document
- [ ] Scorecard dated March 2026 — needs refresh with current reality
- [ ] No docs entrypoint for "Revenue Products" audience

### P2 — Valuable Next
- [ ] Claim verification tooling: add automated CI scan for docs changes
- [ ] Package ownership audit (chatops-*, ai-control, platform-rfp-generator)
- [ ] CFO pilot path documentation
- [ ] Zonga commercial hypothesis document

### P3 — Later
- [ ] Orchestrator-api product story or archive decision
- [ ] Revenue runway modeling
- [ ] NACP Exams strategic classification
- [ ] Legacy package audit and cleanup

---

## 4. Commercial Classification (Sell / Build / Hold / Cut)

| Product | Classification | Rationale |
|---------|---------------|-----------|
| **union-eyes** | **SELL NOW** | Deep codebase, active pilot, full docs, procurement-grade evidence system, clear ICP (unions/labour orgs) |
| **flow** | **SELL NOW** | Real SMB commerce vertical, pilot-deployed, revenue-integrated, natural ICP (SMB operators) |
| **cfo** | **BUILD NEXT** | Strong codebase (233 files), real integrations, needs pilot docs and sales narrative |
| **partners** | **BUILD NEXT** | Pilot-deployed, partner deal flow story, needs positioning |
| **zonga** | **HOLD** | Largest INCUBATING codebase (393 files + 12 packages), Africa-first music vertical, needs investment decision |
| **agrimo** | **HOLD** | Agri vertical with real packages, but internal-only, needs domain partner |
| **control-plane** | **INTERNAL ONLY** | Governance hub — internal platform tool, not sold externally |
| **console** | **INTERNAL ONLY** | Ops tool — internal, not sold externally |
| **web** | **INTERNAL ONLY** | Marketing site — lead gen, not a product |
| **trade** | **HOLD** | Cross-border trade vertical, needs domain validation |
| **cora** | **HOLD** | Agri intelligence, belongs to agrimo cluster |
| **nacp-exams** | **HOLD** | Niche, no active pilot |
| **mobility** | **HOLD** | Investment migration, real use case, needs partner |
| **mobility-client-portal** | **HOLD** | Companion to mobility, not standalone |
| **abr** | **HOLD** | Agricultural compliance, internal, needs assessment |
| **platform-admin** | **CUT/ARCHIVE** | 27 files, experimental, no commercial story, maintenance burden |
| **orchestrator-api** | **CUT/ARCHIVE** | 26 files, scaffold only, no defined product story |

---

## 5. Appendix — Repo Snapshot Facts

| Metric | Value |
|--------|-------|
| Total apps | 17 |
| Total packages | 130+ |
| Total docs | 180+ markdown files |
| GA gates | 23 (all PASS) |
| Contract tests | 1,973 |
| Validators | 3 (validate-truth-authority, validate-product-catalog, ga-check) |
| Largest app | union-eyes (3,028 source files) |
| Deepest vertical | Zonga (12 domain packages) |
| Auth system | @nzila/platform-auth (Argon2id + Entra SSO) |
| Deployment target | Azure Container Apps (Canada Central) |
| Active pilots | union-eyes (CUPE), flow (staging), partners (staging) |
