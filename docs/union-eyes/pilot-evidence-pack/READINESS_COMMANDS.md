# Union Eyes Pilot Readiness — Canonical Gate Commands

**Status:** CURRENT  
**Last updated:** 2026-05-14  
**Source of truth:** `package.json` scripts, `.github/workflows/`, `scripts/`  
**Supersedes:** N/A (new — authoritative reference)  
**Live-evidence dependencies:** Sections marked `[AZURE]` require live credentials

---

## Quick Run: All Local Gates

```bash
pnpm readiness:union-eyes
```

See the script definition below. Runs all local-verifiable checks without requiring Azure credentials.

---

## Gate Catalogue

### 1. TypeScript — noImplicitAny

| Field | Value |
|-------|-------|
| **Command** | `pnpm typecheck --filter @nzila/union-eyes` |
| **Purpose** | Confirms zero type errors under `noImplicitAny: true` |
| **Expected output** | Exit 0; no TypeScript errors |
| **Failure interpretation** | Type regression — must fix before merge |
| **Owner** | Union Eyes engineers |
| **Frequency** | Every PR, every CI run |
| **Blocking** | ✅ YES — hard CI block |

```bash
pnpm typecheck --filter "@nzila/union-eyes"
```

---

### 2. Raw DB Import Guard

| Field | Value |
|-------|-------|
| **Command** | `pnpm exec tsx scripts/check-ue-db-import-guard.ts` |
| **Purpose** | Confirms zero files import the raw `db` object outside approved paths |
| **Expected output** | `✓ 0 violations found` with exit 0 |
| **Failure interpretation** | A file bypassed the RLS context wrappers — security regression |
| **Owner** | Platform security |
| **Frequency** | Every PR, every CI run |
| **Blocking** | ✅ YES — hard CI block |

```bash
pnpm exec tsx scripts/check-ue-db-import-guard.ts
```

---

### 3. Lint

| Field | Value |
|-------|-------|
| **Command** | `pnpm lint --filter "@nzila/union-eyes"` |
| **Purpose** | ESLint + import boundary enforcement (eslint-plugin-boundaries) |
| **Expected output** | Exit 0; no lint errors |
| **Failure interpretation** | SDK boundary violation or code-style regression |
| **Owner** | Union Eyes engineers |
| **Frequency** | Every PR |
| **Blocking** | ✅ YES |

```bash
pnpm lint --filter "@nzila/union-eyes"
```

---

### 4. RLS / Org-Isolation Tests

| Field | Value |
|-------|-------|
| **Command** | `pnpm test:fast --filter "@nzila/union-eyes"` |
| **Purpose** | Includes cross-org regression tests (`cross-org-isolation.test.ts`), idempotency tests, workflow engine tests |
| **Expected output** | All tests pass |
| **Failure interpretation** | Org isolation regression — P0 severity |
| **Owner** | Union Eyes engineers + platform security |
| **Frequency** | Every PR |
| **Blocking** | ✅ YES |

```bash
pnpm test:fast --filter "@nzila/union-eyes"
```

Key test files:
- `apps/union-eyes/__tests__/cross-org-isolation.test.ts`
- `apps/union-eyes/__tests__/workflow-engine.test.ts`
- `apps/union-eyes/__tests__/case-intake-idempotency.test.ts`

---

### 5. Governance Audit

| Field | Value |
|-------|-------|
| **Command** | `pnpm exec tsx packages/platform-validation/src/doc-consistency.ts && tsx scripts/build-ownership-registry.ts && pnpm exec tsx scripts/docs/build-docs-index.ts && pnpm exec tsx scripts/release/generate-governance-audit.ts && pnpm exec tsx scripts/release/audit-secrets.ts && pnpm exec tsx scripts/repo/build-excellence-audit.ts && pnpm exec tsx scripts/check-ue-db-import-guard.ts && pnpm exec tsx scripts/financial-service-health.ts` |
| **Purpose** | Validates docs, ownership, index freshness, release secrets, repo health, and DB import guard |
| **Expected output** | Exit 0; all governance checks pass |
| **Failure interpretation** | Governance drift — typically stale docs, missing ownership, or broken links |
| **Owner** | Engineering Lead |
| **Frequency** | Weekly + pre-release |
| **Blocking** | ✅ YES for releases; advisory for PRs |

```bash
pnpm exec tsx packages/platform-validation/src/doc-consistency.ts && tsx scripts/build-ownership-registry.ts && pnpm exec tsx scripts/docs/build-docs-index.ts && pnpm exec tsx scripts/release/generate-governance-audit.ts && pnpm exec tsx scripts/release/audit-secrets.ts && pnpm exec tsx scripts/repo/build-excellence-audit.ts && pnpm exec tsx scripts/check-ue-db-import-guard.ts && pnpm exec tsx scripts/financial-service-health.ts
```

---

### 6. Docs Validation

| Field | Value |
|-------|-------|
| **Command** | `pnpm exec tsx packages/platform-validation/src/doc-consistency.ts` |
| **Purpose** | Checks cross-document consistency, no broken internal refs, doc schema compliance |
| **Expected output** | Exit 0 |
| **Failure interpretation** | Documentation drift — update referenced docs |
| **Owner** | Engineering Lead |
| **Frequency** | Pre-release, post-major-doc-updates |
| **Blocking** | ✅ YES for releases |

```bash
pnpm exec tsx packages/platform-validation/src/doc-consistency.ts
```

---

### 7. Secret Scan (CI only)

| Field | Value |
|-------|-------|
| **Command** | `pnpm exec tsx scripts/release/audit-secrets.ts` (or CI: gitleaks via `.github/workflows/`) |
| **Purpose** | Detects accidentally committed secrets or tokens |
| **Expected output** | 0 secrets found |
| **Failure interpretation** | Potential secret leak — immediate remediation required |
| **Owner** | Platform security |
| **Frequency** | Every commit (CI) |
| **Blocking** | ✅ YES |

---

### 8. Runtime Truth JSON Parse Check

| Field | Value |
|-------|-------|
| **Command** | `node -e "JSON.parse(require('fs').readFileSync('reports/runtime/platform-runtime-truth-latest.json','utf8'))"` |
| **Purpose** | Confirms authoritative runtime truth JSON is valid and parseable |
| **Expected output** | Exit 0 (no output) |
| **Failure interpretation** | Runtime truth file is malformed — must fix before any evidence claims |
| **Owner** | Platform engineering |
| **Frequency** | Pre-release |
| **Blocking** | ✅ YES |

```bash
node -e "JSON.parse(require('fs').readFileSync('reports/runtime/platform-runtime-truth-latest.json','utf8'))" && echo "✓ runtime truth valid"
```

---

### 9. RUNTIME_EVIDENCE_PACK posture check

| Field | Value |
|-------|-------|
| **Command** | `grep -c "HEALTHY\|PENDING\|CONDITIONAL" docs/union-eyes/pilot-evidence-pack/RUNTIME_EVIDENCE_PACK.md` |
| **Purpose** | Quick scan to confirm three-layer posture language is present |
| **Expected output** | Count > 0 |
| **Failure interpretation** | Posture language removed — review before sharing |
| **Owner** | Platform security |
| **Frequency** | Pre-release |
| **Blocking** | Advisory |

---

### 10. Brand Leakage Check

| Field | Value |
|-------|-------|
| **Command** | `pnpm exec tsx scripts/check-brand-leakage.ts` |
| **Purpose** | Ensures no internal brand identifiers leak into pilot-facing materials |
| **Expected output** | Exit 0; no leakage |
| **Failure interpretation** | Internal brand exposed — remediate before sharing with pilot org |
| **Owner** | Product |
| **Frequency** | Pre-release |
| **Blocking** | Advisory for docs; blocking for customer-facing builds |

---

### 11. Live Azure Evidence [AZURE]

| Field | Value |
|-------|-------|
| **Command** | See `LIVE_EVIDENCE_CAPTURE_RUNBOOK.md` |
| **Purpose** | Confirms prod/staging resource separation, health endpoints, KV isolation, DB backups |
| **Expected output** | Completed `reports/runtime/live-captures/YYYY-MM-DD/evidence-manifest.json` |
| **Failure interpretation** | Live operational proof incomplete — do not admit real member data |
| **Owner** | SRE / DevOps |
| **Frequency** | Pre-pilot-launch, then monthly |
| **Blocking** | ✅ YES for real member data admission |

---

## `pnpm readiness:union-eyes` — Composite Script

The `readiness:union-eyes` script in `package.json` runs the subset of checks that
do NOT require Azure credentials or network access:

```json
"readiness:union-eyes": "pnpm typecheck --filter @nzila/union-eyes && pnpm exec tsx scripts/check-ue-db-import-guard.ts && pnpm test:fast --filter @nzila/union-eyes && node -e \"JSON.parse(require('fs').readFileSync('reports/runtime/platform-runtime-truth-latest.json','utf8'))\" && echo '✓ Union Eyes readiness gates: PASS'"
```

**What it checks:**
1. TypeScript clean (`noImplicitAny: true`)
2. Zero raw DB import violations
3. All Union Eyes tests (including RLS + idempotency + workflow)
4. Runtime truth JSON parseable

**What it does NOT check (requires Azure or CI):**
- Live health/readiness endpoints
- Azure resource group separation
- Key Vault separation
- Secret scan (runs in CI via gitleaks)
- Full governance audit (run `pnpm exec tsx packages/platform-validation/src/doc-consistency.ts && tsx scripts/build-ownership-registry.ts && pnpm exec tsx scripts/docs/build-docs-index.ts && pnpm exec tsx scripts/release/generate-governance-audit.ts && pnpm exec tsx scripts/release/audit-secrets.ts && pnpm exec tsx scripts/repo/build-excellence-audit.ts && pnpm exec tsx scripts/check-ue-db-import-guard.ts && pnpm exec tsx scripts/financial-service-health.ts` separately)

---

## Failure Response Matrix

| Gate | Fail Action | Escalation |
|------|-------------|------------|
| TypeScript | Fix type error before merge | Engineering Lead |
| DB import guard | Revert or fix import immediately | Platform security |
| RLS tests | P0 — stop PR, fix org isolation | Security Lead + Engineering Lead |
| Governance audit | Identify specific check, fix within 24h | Engineering Lead |
| Secret scan | Rotate secret immediately, force-push not allowed — use history rewrite | Security Lead |
| Runtime truth parse | Fix JSON before any evidence distribution | Platform engineering |
| Live evidence | Document gap, do not admit real member data | SRE + Product |

---

*All commands verified against `package.json` as of 2026-05-14.*
