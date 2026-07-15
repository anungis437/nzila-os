# 11 — Security and Privacy Proof

## Gate G10 status: PASS_WITH_CONDITIONS

Privacy and data-minimization controls are strongly proven. The gate is
**PASS_WITH_CONDITIONS** (not PASS) because a current production dependency-vulnerability
scan could not be produced with `pnpm audit` and the live production integrations were not
tested. See condition **C-8**.

## Commands

| Command | Result |
|---|---|
| `pnpm verify:migrations` | PASS (16 migrations) |
| `pnpm contract-tests` | PASS |
| `pnpm audit --prod` | **Could not execute** — npm's quick-audit endpoint is retired (HTTP 410). |

## Dependency vulnerabilities (condition C-8)

`pnpm audit --prod` cannot run because the npm audit endpoint is retired. The tracked
security posture is the **Dependabot** advisory set on the default branch — reported at
merge time as **18 advisories: 1 high, 12 moderate, 5 low**, none introduced by SAGE
Phase 8B. This item is **NOT_PROVEN via `pnpm audit`**; it must be closed with a current
Dependabot / bulk-advisory scan result cited and findings cleared or accepted.

## Privacy / data-minimization (PROVEN)

| Property | Evidence | Result |
|---|---|---|
| No raw storage references in evidence/audit | mappers persist `storage_reference_hash` only (SHA-256); privacy test | PASS |
| No package bytes in audit | audit payloads are safe metadata only | PASS |
| No recipient addresses / tokens in logs | structured logs carry `tenant_id`/`actor_id`/`request_id` only | PASS (code) |
| No unsupported exactly-once delivery claim | source scan: honest "at-least-once" only | PASS |
| No unsafe raw package deletion | verified-absence + tombstone guard; no raw `DELETE` of package rows | PASS |
| Cross-tenant identifier isolation | official-PG RLS proof (doc 05) | PASS |

## Fail-closed security controls (PROVEN)

| Control | Evidence | Result |
|---|---|---|
| Encryption keys versioned; unknown key ref fails closed | key-ring + unknown-key-throws tests | PASS |
| Rate limiter fails closed | distributed limiter fail-closed test | PASS |
| Internal service secrets use constant-time comparison | `timingSafeEqual` internal-route tests | PASS |
| Destruction evidence stores safe metadata only | append-only evidence, hash-only | PASS |
| Browser token persistence avoided | recipient claim clears fragment token, `replaceState` | PASS (code) |

## Verdict

Privacy/data-minimization and fail-closed controls: **PROVEN**. Dependency-vulnerability
scan via `pnpm audit`: **NOT_PROVEN** (endpoint retired). Live production integration
security: **NOT_PROVEN**. Gate **G10 = PASS_WITH_CONDITIONS** (condition C-8 + live
integration testing).
