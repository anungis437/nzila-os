# Union Eyes — Security Buyer Pack

**Version:** 2.0 (2026-05-14 — post-hardening)  
**Status:** CURRENT  
**Last updated:** 2026-05-14  
**Source of truth:** `apps/union-eyes/lib/db/with-rls-context.ts`, `scripts/check-ue-db-import-guard.ts`, `reports/runtime/platform-runtime-truth-latest.json`  
**Supersedes:** Any version referencing EXC-001 open, DEGRADED status, or fail-open org isolation  
**Audience:** Enterprise buyers, CISO review, union IT/Privacy Directors  
**Live-evidence dependencies:** Azure resource group separation, Key Vault isolation — pending (see LIVE_EVIDENCE_CAPTURE_RUNBOOK.md)

---

## TL;DR for the CISO

Union Eyes is a **Canadian-data-residency, privacy-by-design, org-isolated** SaaS platform for union case management. The key controls are now code-enforced (not just policy-documented):

- Org isolation is **fail-closed** — missing context throws, not warns
- DB access is **zero-tolerance** — no raw db imports in the guarded surface
- TypeScript is **strict** — `noImplicitAny: true`, 0 typecheck errors
- Prod/staging are **separate** — blast-radius gate hard-blocks cross-contamination
- All data is in **Azure Canada Central** — no US or EU residency

---

## 1. Org Isolation

**Control:** Every database operation in Union Eyes executes inside `withRLSContext(orgId, ...)`.

**Enforcement:**

```typescript
// Fail-CLOSED — throws on missing org context
export async function withRLSContext<T>(
  orgId: string,
  fn: (tx: RLSTx) => Promise<T>
): Promise<T> {
  if (!orgId) {
    throw new Error("Organization context is required for RLS-protected operations.");
  }
  // ... sets PostgreSQL RLS session variable
}
```

**CI guard:** `pnpm governance:check-db-imports` — 0 violations (ALLOWLIST = `[]`)

**PostgreSQL RLS:** 238 row-level security policies enforce org boundary at the database level. Even if application-layer isolation were bypassed, the DB would block cross-org reads.

**Cross-org regression tests:** Maintained in `apps/union-eyes/tests/api/rbac.spec.ts`.

---

## 2. Prod/Staging Separation

**EXC-001 status: RESOLVED** (2026-05-14)

Previously: production and staging shared a resource group (risk of blast-radius contamination).

Now:
- Production deploys to: `nzila-canada-prod-rg`
- Staging deploys to: `nzila-canada-staging-rg`
- CI gate hard-blocks any deploy if `PROD_RG == STAGING_RG`
- `platform-runtime-truth-latest.json` reports `sharedBlastRadius: false`

**Buyer note:** Any document referencing "shared resource group" or EXC-001 as open is outdated. The authoritative source is `reports/runtime/platform-runtime-truth-latest.json`.

---

## 3. Data Residency (Canadian)

| Requirement | Implementation |
|---|---|
| Canadian data residency | All 14 container apps in Azure Canada Central (`canadacentral`) |
| No US/EU data routing | 0 `eastus` / `eastus2` / EU region violations detected |
| Allowed regions | `canadacentral`, `canadaeast` only |
| DPA commitment | Template at `docs/compliance/dpa-template.md`; PIPEDA-aware |
| Storage | Azure Blob Storage (Canada Central) |
| Key Vault | `nzila-ue-prod-kv` (production); separate from staging |

---

## 4. Access Control

| Control | Implementation |
|---|---|
| Authentication | NextAuth.js with Argon2id password hashing |
| MFA | Supported via NextAuth provider configuration |
| RBAC | Per-org roles: `steward`, `executive_director`, `it_privacy`, `member`, `system_admin` |
| Least-privilege defaults | New user has no org access until explicitly assigned |
| Session management | JWT with configurable expiry; server-side revocation |
| Audit trail | All case mutations are hash-chained and append-only |

---

## 5. Audit and Evidence

| Capability | Detail |
|---|---|
| Audit schema | `db/schema/governance-schema.ts` — append-only, org-scoped |
| Hash chaining | `lib/audited-case-mutations.ts`; `0002_audit_hash_chain.py` |
| Seal/verify | `lib/evidence-export.ts`; HMAC-sealed evidence packages |
| Tamper detection | Lifecycle tested: append → seal → verify → tamper-detect (6/6) |
| Evidence export | PDF manifest + seal hash; route `/api/cases/[caseId]/export` |
| Admissibility design | Evidence packages designed for union arbitration admissibility |
| Correlation IDs | All routes + Django backend propagate `X-Governance-Correlation` |

---

## 6. File Security

| Control | Implementation |
|---|---|
| Malware scanning | ClamAV integration (`lib/security/clamav.ts`); scans on upload |
| Scoped signed URLs | Org-scoped, time-limited; `lib/blob-client.ts` |
| Storage isolation | Org-prefixed blob paths; RLS equivalent for storage |
| Contract test | `union-eyes-malware-scan-enforcement` enforced in CI |

---

## 7. Encryption and Transport

| Layer | Control |
|---|---|
| Data in transit | TLS 1.3 enforced via Azure Front Door / Container Apps ingress |
| Data at rest | Azure Managed Disk encryption + Key Vault–managed keys |
| Passwords | Argon2id (memory-hard; industry best practice for credentials) |
| Audit HMAC | SHA-256 keyed HMAC for evidence seal integrity |
| Secrets management | Azure Key Vault; no secrets in source code (gitleaks gate in CI) |

---

## 8. AI Boundary

| Commitment | Enforcement |
|---|---|
| No training on customer data | AI boundary enforced by eslint gates + contract test |
| No shadow AI/ML | `platform-ai-contract-coverage` CI gate |
| ML models | Deployed in `os-core` control plane; Union Eyes calls via SDK only |
| No direct DB access from AI layer | eslint import boundary + governance:check-db-imports guard |

---

## 9. What Is Not Yet Complete (Honest)

| Item | Status | Timeline |
|---|---|---|
| SOC 2 Type I audit | Readiness scaffold complete; external audit not yet engaged | Post-pilot |
| Penetration test | Not yet conducted | Scheduled post-controlled pilot |
| Finance core persistence | In-memory by design | Post-pilot |
| Tier 2 app instrumentation | Partial | Ongoing |

These items are acknowledged in `docs/compliance/soc2/gap-log.md`. They are acceptable for a controlled 1-org pilot under documented compensating controls.

---

## 10. Compensating Controls (Pilot Period)

During the controlled pilot, the following compensating controls apply in lieu of pending items:

| Pending control | Compensating control |
|---|---|
| External pen-test | Network isolation (VNet + private endpoints) + fail-closed RLS + zero raw-db imports + strict TS + ClamAV |
| SOC 2 Type I | Internal control mapping (CC1–CC9 + A/C/P) documented; evidence inventory maintained |

These compensating controls are acceptable for a single-org controlled pilot but **not** for broad enterprise production.

---

## Version History

| Version | Date | Change |
|---|---|---|
| 2.0 | 2026-05-20 | Post-hardening update: EXC-001 resolved, fail-closed RLS, zero DB violations, noImplicitAny, ClamAV |
| 1.x | pre-2026-05 | **Superseded** — contained DEGRADED status, EXC-001 open, fail-open RLS warning |

**If any version of this document or related trust materials still references EXC-001 as open, DEGRADED status, or fail-open behavior, those references are incorrect. Contact platform engineering for the current version.**
