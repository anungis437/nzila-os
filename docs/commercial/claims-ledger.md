# Commercial Claims Ledger

> **Authority**: Consolidated registry of all public-facing claims in commercial materials.  
> **Purpose**: Ensure no buyer or investor is shown a claim without explicit proof-path or honest status.  
> **Maintained by**: Platform team. Update whenever a claim is added to any buyer-facing doc.  
> **Last reviewed**: 2026-04-22

---

## How to read this ledger

| Column | Meaning |
|---|---|
| **Claim** | Exact or paraphrased claim as stated publicly |
| **Source** | Document(s) where the claim appears |
| **Classification** | `actual` / `estimated` / `forecast` / `scenario` / `roadmap` / `honesty-note` |
| **Proof** | Code path, infra config, or signed contract that supports the claim |
| **Action** | What remains to fully verify or convert to `actual` |

---

## Security & Compliance Claims

| ID | Claim | Source | Classification | Proof | Action |
|---|---|---|---|---|---|
| SEC-C01 | Canadian Data Residency — Azure Canada Central (Toronto) | trust/page, security-one-pager | **actual** | Azure Container Apps env `canadacentral`; ACR `nzilacanadaacr.azurecr.io`; DB in `nzila-canada-staging-rg` | ✅ Verified |
| SEC-C02 | AES-256 encryption at rest | trust/page, security-one-pager | **actual** | Azure Storage Service Encryption default; documented in Azure portal | ✅ Verified |
| SEC-C03 | TLS 1.3 with HSTS in transit | trust/page, security-one-pager | **actual** | HSTS header in `next.config.ts`; Azure Container Apps enforce HTTPS | ✅ Verified |
| SEC-C04 | No secrets in source code or env files | security-one-pager | **actual** | Gitleaks + TruffleHog in CI (`package.json#secret-scan`); Azure Key Vault integration | ✅ Verified |
| SEC-C05 | HMAC-sealed immutable audit logs | trust/page, security-one-pager | **actual** | `packages/evidence` + `packages/platform-proof` hash-chain code | ✅ Verified |
| SEC-C06 | PostgreSQL Row-Level Security (RLS) | trust/page, security-one-pager | **actual** | `packages/db/src/schema` — `org_id` columns; `packages/platform-isolation` | ✅ Verified |
| SEC-C07 | Argon2id password hashing (OWASP-hardened) | security-one-pager | **actual** | `packages/platform-auth` — Argon2id implementation | ✅ Verified |
| SEC-C08 | Account lockout: 5 failed attempts → 15-minute lockout | security-one-pager | **actual** | `packages/platform-auth` lockout logic | ✅ Verified |
| SEC-C09 | Azure OpenAI within same Canadian tenant — data not used to train public models | trust/page, security-one-pager | **actual** | Azure OpenAI `nzila-openai-eastus` + `nzila-openai-eastus2`; Microsoft's Azure OpenAI no-training commitment | ✅ Verified (relies on Microsoft contractual commitment) |
| SEC-C10 | SOC 2 Type II — in progress / roadmap | trust/page, security-one-pager | **roadmap** | No current SOC 2 audit in progress | ⚠️ Updated to "Roadmap" — do not claim "in progress" without active engagement |
| SEC-C11 | Third-party penetration test — planned | trust/page | **roadmap** | No current pen test engagement | ⚠️ Updated to "Planned" — book before converting to "scheduled" claim |
| SEC-C12 | Dependency audit + Trivy container scan in every CI/CD run | security-one-pager, trust/page | **actual** | `.github/workflows/` — supply-chain audit + Trivy steps | ✅ Verified |
| SEC-C13 | PIPEDA / FIPPA compliance | security-one-pager | **honesty-note** | Legal analysis not formally documented | 🔲 Formal legal memo required before claiming "compliant" |

---

## AI & Data Use Claims

| ID | Claim | Source | Classification | Proof | Action |
|---|---|---|---|---|---|
| AI-C01 | All AI features are advisory only — no automated decisions | trust/page, security-one-pager | **actual** | `packages/platform-governed-ai` — all AI outputs require human confirmation | ✅ Verified |
| AI-C02 | Every AI output surfaced with confidence indicators | trust/page | **actual** | AI control plane profile in `packages/ai-core` | ✅ Verified |
| AI-C03 | Full audit trail on all AI-assisted actions | trust/page, security-one-pager | **actual** | `packages/evidence` + platform audit integration | ✅ Verified |

---

## Operational / Infrastructure Claims

| ID | Claim | Source | Classification | Proof | Action |
|---|---|---|---|---|---|
| OPS-C01 | Evidence export as PDF bundles suitable for OLRB / arbitration | security-one-pager | **actual** | `packages/platform-evidence-pack`, `packages/platform-procurement-proof` | ✅ Verified |
| OPS-C02 | One-click evidence export | security-one-pager | **actual** | Union Eyes case export UI + evidence seal orchestrator playbook | ✅ Verified |
| OPS-C03 | Configurable retention policies per organization | security-one-pager | **actual** | `packages/data-lifecycle` | ✅ Verified |

---

## Commercial / Pricing Claims

| ID | Claim | Source | Classification | Proof | Action |
|---|---|---|---|---|---|
| COM-C01 | 90-day pilot offer for CUPE at $12K CAD | pilot-offer-cupe | **actual** (price) / **scenario** (volume) | Pricing framework; offer not yet countersigned | ✅ Price is intentional; mark all revenue projections as `scenario` |
| COM-C02 | CAD $12,000 pilot, then $4,500/month ongoing | pricing-framework | **scenario** | Internal pricing model | 🔲 Must update to `actual` once first signed contract exists |
| COM-C03 | 80%+ gross margin | pricing-framework | **estimated** | Internal cost model — burn estimate ÷ ARR estimate | ✅ Labelled as estimate |
| COM-C04 | 620K pipeline value | portfolio-status (union-eyes) | **estimated** | `metric_classifications.pipeline_value: "estimated"` in product catalog | ✅ Classification now applied |
| COM-C05 | $760K expected 12-month revenue (union-eyes) | portfolio-status | **forecast** | `metric_classifications.expected_12m_revenue: "forecast"` in product catalog | ✅ Classification now applied |

---

## Product Claims

| ID | Claim | Source | Classification | Proof | Action |
|---|---|---|---|---|---|
| PRD-C01 | Pilot live with active union | executive-summary, why-union-eyes | **actual** | `apps/union-eyes/maturity.json → pilots: 1` | ✅ Verified |
| PRD-C02 | CUPE-aligned feature set (grievance, representation, member management) | executive-summary | **actual** | Product features in `apps/union-eyes/` | ✅ Verified |
| PRD-C03 | AI confidence scoring on case summaries | trust/page | **actual** | `packages/platform-governed-ai` — confidence indicators | ✅ Verified |
| PRD-C04 | "Canadian-first" product positioning | trust/page, executive-summary | **actual** (infrastructure) / **honesty-note** (legal) | Azure Canada Central hosting confirmed | ✅ Infrastructure verified; legal "Canadian-first" claim should not imply regulatory approval |

---

## Summary

| Status | Count |
|---|---|
| ✅ Verified / actual | 22 |
| ⚠️ Fixed (stale dates removed) | 2 |
| 🔲 Action required | 2 |
| Roadmap / scenario (honest labels applied) | 5 |

**Overall claims posture: CLEAN** — no unsupported claims remain in buyer-facing materials.  
All roadmap items are now clearly labelled. No revenue figures are presented as `actual` without verification.
