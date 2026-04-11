# Nzila OS — STRIDE Threat Model

**Document ID:** TM-2026-001  
**Version:** 1.0  
**Classification:** CONFIDENTIAL  
**Created:** 2026-02-20  
**Next Review:** 2026-05-20 (Quarterly)  
**Owner:** Security Lead  
**Status:** ACTIVE  

---

## 1. System Overview

Nzila OS is a multi-Org SaaS platform comprising:
- **4 web applications**: Console, Partners, Web, Union Eyes
- **Supporting packages**: AI Core/SDK, ML Core/SDK, Payments (Stripe), QBO, Database, Blob Storage
- **Infrastructure**: Azure Container Apps, PostgreSQL (Flexible Server), Azure Blob Storage, Azure Key Vault
- **Authentication**: Platform Auth (Entra ID OIDC) with RBAC via Org membership model

### Trust Boundaries

| ID | Boundary | Description |
|----|----------|-------------|
| TB-01 | Public Internet ↔ CDN/WAF | Edge protection boundary |
| TB-02 | CDN ↔ Application | Authenticated user boundary |
| TB-03 | Application ↔ Database | Data access boundary |
| TB-04 | Application ↔ Azure Blob | Document/evidence storage boundary |
| TB-05 | Application ↔ Entra ID | Authentication/identity boundary |
| TB-06 | Application ↔ Stripe API | Payment processing boundary |
| TB-07 | Application ↔ QBO API | Financial data boundary |
| TB-08 | Application ↔ AI Providers | AI/ML inference boundary |
| TB-09 | Inter-app communication | Microservice trust boundary |
| TB-10 | CI/CD Pipeline | Build/deploy integrity boundary |

---

## 2. STRIDE Analysis

### S — Spoofing

| ID | Threat | Component | Mitigation | Status |
|----|--------|-----------|------------|--------|
| S-01 | User identity spoofing | Platform Auth | Entra ID OIDC with JWT verification; `authMiddleware()` on all protected routes | ✅ Mitigated |
| S-02 | API key impersonation | Stripe webhooks | `verifyWebhookSignature()` with HMAC-SHA256 | ✅ Mitigated |
| S-03 | Service-to-service spoofing | Inter-app calls | `x-request-id` + `traceparent` propagation; future: mTLS | ⚠️ Partial |
| S-04 | OAuth token replay | QBO integration | Token refresh + revocation lifecycle; short-lived access tokens | ✅ Mitigated |
| S-05 | CI/CD pipeline compromise | GitHub Actions | Branch protection rules; required reviews; signed commits | ✅ Mitigated |

### T — Tampering

| ID | Threat | Component | Mitigation | Status |
|----|--------|-----------|------------|--------|
| T-01 | Audit log manipulation | audit_events table | SHA-256 hash chain with `computeEntryHash()` | ✅ Mitigated |
| T-02 | Evidence pack modification | Evidence system | Cryptographic seal with SHA-256 digest + Merkle root + HMAC | ✅ Mitigated |
| T-03 | Share ledger tampering | Equity module | Hash-chained `share_ledger_entries` | ✅ Mitigated |
| T-04 | Database schema drift | Drizzle migrations | Schema snapshot verification in CI (`schema-snapshot.ts verify`) | ✅ Mitigated |
| T-05 | Dependency tampering | Supply chain | SBOM generation + license validation + vulnerability waiver policy | ✅ Mitigated |
| T-06 | IaC configuration drift | Bicep/Terraform | Weekly CT-08 config drift detection | ✅ Mitigated |

### R — Repudiation

| ID | Threat | Component | Mitigation | Status |
|----|--------|-----------|------------|--------|
| R-01 | Denied governance action | Governance module | Every action produces audit_event with actor ID, timestamp, hash | ✅ Mitigated |
| R-02 | Denied document upload | Blob storage | Upload creates audit_event + document row with SHA-256 | ✅ Mitigated |
| R-03 | Denied financial operation | QBO/Stripe | Payment events normalized and persisted with Stripe event ID | ✅ Mitigated |
| R-04 | Denied access change | RBAC | Entity membership changes logged with before/after JSON | ✅ Mitigated |
| R-05 | Denied AI action | AI Gateway | Action attestation documents with approval workflow | ✅ Mitigated |

### I — Information Disclosure

| ID | Threat | Component | Mitigation | Status |
|----|--------|-----------|------------|--------|
| I-01 | Cross-tenant data leak | All apps | Entity-scoped queries enforced; `api-authz-coverage.test.ts` validates all mutating routes | ✅ Mitigated |
| I-02 | Secrets in version control | Repository | TruffleHog + Gitleaks dual scanning (on push + PR) | ✅ Mitigated |
| I-03 | PII in logs | Telemetry | Three-tier redaction (`redaction.ts`): internal/partner/public | ✅ Mitigated |
| I-04 | Evidence over-exposure | Evidence system | Classification-based access (INTERNAL/CONFIDENTIAL/RESTRICTED) | ✅ Mitigated |
| I-05 | AI prompt injection | AI Gateway | Data class enforcement + redaction pipeline + capability profiles | ✅ Mitigated |
| I-06 | Secrets in environment | Runtime | Zod-validated env; Key Vault integration; env contract tests | ✅ Mitigated |

### D — Denial of Service

| ID | Threat | Component | Mitigation | Status |
|----|--------|-----------|------------|--------|
| D-01 | API rate limiting bypass | All apps | Platform auth rate limiting + Next.js middleware | ⚠️ Partial |
| D-02 | AI cost explosion | AI Gateway | Per-app/profile budget enforcement (ok/warning/blocked) | ✅ Mitigated |
| D-03 | Database connection exhaustion | PostgreSQL | Connection pooling; ALT-050 alert rule | ✅ Mitigated |
| D-04 | Blob storage abuse | Azure Blob | Entity-scoped upload with size limits | ✅ Mitigated |
| D-05 | Webhook flood | Stripe integration | Signature verification + idempotency | ✅ Mitigated |

### E — Elevation of Privilege

| ID | Threat | Component | Mitigation | Status |
|----|--------|-----------|------------|--------|
| E-01 | RBAC bypass | Policy engine | `@nzila/os-core/policy` with `requirePermission()`; contract test coverage | ✅ Mitigated |
| E-02 | Partner cross-entity access | Partners app | Partner entitlement table with explicit entity grants | ✅ Mitigated |
| E-03 | Admin role escalation | Platform RBAC | No self-role-grant; owner-only promotion; audit trail | ✅ Mitigated |
| E-04 | Direct DB table bypass (AI/ML) | AI/ML SDKs | ESLint `no-shadow-ai` + `no-shadow-ml` rules; INV-01/INV-02 contract tests | ✅ Mitigated |
| E-05 | CI privilege escalation | GitHub Actions | Minimal `permissions` blocks; no `write-all` | ✅ Mitigated |

---

## 3. Risk Matrix

| Risk Level | Count | IDs |
|------------|-------|-----|
| ✅ Fully Mitigated | 28 | S-01, S-02, S-04, S-05, T-01–T-06, R-01–R-05, I-01–I-06, D-01, D-02–D-05, E-01–E-05 |
| ⚠️ Partially Mitigated | 1 | S-03 (mTLS pending) |
| ❌ Unmitigated | 0 | — |

---

## 4. Residual Risks & Acceptance

### S-03: Service-to-service spoofing
- **Current state:** Request ID propagation provides correlation but not authentication
- **Planned mitigation:** mTLS between Container Apps (Azure-native)
- **Risk acceptance:** Low probability in Azure VNet; mitigated by environment isolation
- **Target date:** Q3 2026

### D-01: API rate limiting
- **Current state:** IP-based rate limiting in all Next.js middleware + org-scoped rate limiting with per-route-group buckets (auth, mutations, exports, integrations, general)
- **Mitigations:** `checkRateLimit` (IP-based) + `checkOrgRateLimit` (org + route group) in console and partners middleware; 429 response with standard `RateLimit-*` headers
- **Status:** ✅ Mitigated
- **Implemented:** 2026-03-04

---

## 5. Review History

| Date | Reviewer | Changes |
|------|----------|---------|
| 2026-02-20 | Security Lead | Initial STRIDE analysis created |

---

## 6. Evidence Artifacts

This threat model is stored as an evidence artifact under:
- **Control family:** `sdlc`
- **Retention class:** `PERMANENT`
- **Container:** `evidence`
- **Path:** `{orgId}/sdlc/{year}/threat-model/TM-{year}-{seq}/threat-model.md`

Re-export after each quarterly review via:
```bash
npx tsx packages/os-core/src/evidence/generate-evidence-index.ts \
  --pack-request threat-model-pack.json
```
