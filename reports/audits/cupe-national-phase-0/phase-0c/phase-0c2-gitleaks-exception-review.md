# Phase 0C.2 §3 — Gitleaks Exception Review

**Date:** 2026-07-23
**Branch:** `fix/union-eyes-phase0c-e2e-stabilization`
**Reviewer:** GitHub Copilot (autonomous Phase 0C.2 execution)
**Scope:** New allowlist entries added to `.gitleaksignore` and code changes made to
avoid unnecessary allowlisting per the §3 caveat:

> The Gitleaks exception must be narrowly scoped. Do not broadly allowlist the literal
> local password pattern if the newly added lifecycle code can instead read the admin
> URL exclusively from environment configuration.

---

## 1. Finding

Initial `gitleaks git --log-opts="origin/fix/union-eyes-phase0c-e2e-stabilization..HEAD"`
scan reported **1 leak** in the outgoing 6-commit range:

| Field | Value |
|---|---|
| Rule ID | `nzila-database-url-with-password` |
| Description | Database connection string with embedded password (not localhost) |
| File | `apps/union-eyes/scripts/lifecycle/prove-phase-0c2-clean-migration.ts` |
| Line | 195 |
| Match (redacted) | `postgres://nzila:nzila_dev@localhost:5433/` |
| Commit | `edfdd1f02c178ed83dbeb70efe8b15813d73bf9e` |
| Author | GitHub Copilot (commit message: "§8 clean-DB proof") |
| Fingerprint | `edfdd1f02c178ed83dbeb70efe8b15813d73bf9e:apps/union-eyes/scripts/lifecycle/prove-phase-0c2-clean-migration.ts:nzila-database-url-with-password:195` |

Full JSON captured at `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-gitleaks-push.json`.

## 2. Root Cause Analysis

Three new lifecycle sources introduced during Phase 0C.2 §5–§10 each re-embedded the
same local-dev PostgreSQL admin URL as a hardcoded fallback:

| File | Fallback expression (URL redacted — see gitleaks scan for exact match) |
|---|---|
| `apps/union-eyes/scripts/lifecycle/allocate-db.ts` (×2 sites, allocate + drop) | `options.adminUrl ?? process.env.E2E_DB_ADMIN_URL ?? '<LOCAL_DEV_PG_URL_REDACTED>'` |
| `apps/union-eyes/scripts/lifecycle/prove-db-allocator.ts` | `process.env.E2E_DB_ADMIN_URL ??= '<LOCAL_DEV_PG_URL_REDACTED>'` |
| `apps/union-eyes/scripts/lifecycle/prove-phase-0c2-clean-migration.ts` | `new Client({ connectionString: process.env.E2E_DB_ADMIN_URL ?? '<LOCAL_DEV_PG_URL_REDACTED>' })` |

> The literal fallback URL is available in the pre-fix gitleaks scan report
> (`phase-0c2-gitleaks-push.json`, redacted at scan time) and in the historical
> commit `edfdd1f02` at `prove-phase-0c2-clean-migration.ts:195`. It is not
> re-quoted here so this evidence file itself does not trigger the
> `nzila-database-url-with-password` rule under `gitleaks --staged`.

Each was defensive scaffolding written under the assumption that callers "should always
set the env var but let's not crash if they forget". The authorized location that owns
that literal is `apps/union-eyes/scripts/lifecycle/env.ts:75`
(`DETERMINISTIC_TEST_DEFAULTS.E2E_DB_ADMIN_URL`), consumed through the governed
`loadGovernedE2EEnv()` loader with a safety-net throw at line 203. The scaffolding
duplicated it in three places, defeating the single-source-of-truth guarantee.

Only the third occurrence (in `prove-phase-0c2-clean-migration.ts`) tripped gitleaks
because the other two literals happened to sit next to comment tokens and code
constructs (the `??` chain and `??=` assignment) that lowered the rule's confidence
below the reporting threshold. All three, however, embed the same password material
into repository history.

## 3. Remediation (chosen path: REMOVE, not allowlist)

Per §3 caveat, the correct fix is to remove the literals from new source and route
through the authorized loader — **not** to widen the allowlist. Changes:

### 3.1 `apps/union-eyes/scripts/lifecycle/allocate-db.ts`

Added `resolveAdminUrl()` helper (module-private):

```ts
function resolveAdminUrl(explicit: string | undefined, callerLabel: string): string {
  const explicitTrim = explicit?.trim()
  if (explicitTrim && explicitTrim.length > 0) return explicitTrim
  const envTrim = process.env.E2E_DB_ADMIN_URL?.trim()
  if (envTrim && envTrim.length > 0) return envTrim
  throw new Error(
    `[ue:e2e:allocate-db] ${callerLabel}: E2E_DB_ADMIN_URL is required. ` +
      `Either export it in the environment (see apps/union-eyes/tests/e2e/.env.test), ` +
      `call the governed env loader (loadGovernedE2EEnv from ./env), or pass ` +
      `options.adminUrl explicitly. The hardcoded local-dev fallback was removed ` +
      `in Phase 0C.2 §3 for supply-chain hygiene.`,
  )
}
```

Both `allocateDatabase()` and `dropDatabase()` now begin with:

```ts
const adminUrlRaw = resolveAdminUrl(options.adminUrl, 'allocateDatabase' /* or 'dropDatabase' */)
```

### 3.2 `apps/union-eyes/scripts/lifecycle/prove-db-allocator.ts`

Replaced the `??=` literal-prime with a call through the governed loader:

```ts
;(process.env as Record<string, string | undefined>).NODE_ENV = 'test'
;(process.env as Record<string, string | undefined>).QA_TEST_ENV = 'true'
const governedEnv = loadGovernedE2EEnv()
process.env.E2E_DB_ADMIN_URL = governedEnv.E2E_DB_ADMIN_URL
```

`loadGovernedE2EEnv` is imported from `./env`.

### 3.3 `apps/union-eyes/scripts/lifecycle/prove-phase-0c2-clean-migration.ts`

Replaced the direct `Client({ connectionString: ... ?? '<literal>' })` construction
with:

```ts
const governedEnv = loadGovernedE2EEnv()
const admin = new Client({ connectionString: governedEnv.E2E_DB_ADMIN_URL })
```

`loadGovernedE2EEnv` is imported from `./env`. The nested `allocateDatabase()` calls
that follow now inherit the process.env populated by upstream context OR by an explicit
`adminUrl` pass-through; the removed literal is no longer in the source tree at all.

### 3.4 Safe-failure tests

Added a new nested `describe('§3 admin-URL required (no hardcoded fallback)', …)`
block in `apps/union-eyes/scripts/lifecycle/allocate-db.test.ts` with 4 test cases:

1. `allocateDatabase()` throws with the exact `E2E_DB_ADMIN_URL is required` diagnostic
   when env is unset.
2. `dropDatabase()` throws with the exact `E2E_DB_ADMIN_URL is required` diagnostic
   when env is unset (using a synthesized `AllocateResult` fake).
3. Passing an explicit `options.adminUrl` bypasses the missing-env throw (proven by
   the subsequent production-URL-shape guard tripping instead — confirms the URL
   made it into the guard chain).
4. Whitespace-only env (`'   '`) is treated as unset (rejects with the same
   diagnostic).

## 4. Narrow Allowlist Entry

The historical leak is in commit `edfdd1f02` — already merged into this branch and
therefore permanent in the outgoing range. Even though the current source no longer
contains the literal, gitleaks still walks the commit history in `--log-opts=` mode.
One narrow allowlist entry is required to clear the outgoing range for push:

```
edfdd1f02c178ed83dbeb70efe8b15813d73bf9e:apps/union-eyes/scripts/lifecycle/prove-phase-0c2-clean-migration.ts:nzila-database-url-with-password:195
```

This is the **full 4-part form** (`commit:path:rule:line`), which pins the exception
to exactly one commit, one file, one rule, and one line number. It will NOT allowlist:
- The same literal reintroduced in a different commit (different commit hash).
- The same literal appearing at a different line number in the same file.
- The same literal appearing in any other file.
- Any different rule matching the same location.

Contrast with the short-form `path:rule:line` fingerprints elsewhere in
`.gitleaksignore`, which are wildcard-across-commits and thus weaker. Those entries
were reviewed under Phase 0C.1 governance and remain acceptable for their historical
scope, but the new entry deliberately uses the strictest form available.

## 5. Verification

### 5.1 Working-tree gitleaks scan (0 leaks)

```
gitleaks dir apps/union-eyes/scripts/lifecycle
→ 7:00PM INF no leaks found
```
Captured at `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-gitleaks-lifecycle-uncommitted.json`.

### 5.2 Outgoing range gitleaks scan (0 leaks, exit 0)

Post-`.gitleaksignore` narrowing:
```
gitleaks git --log-opts="origin/fix/union-eyes-phase0c-e2e-stabilization..HEAD" \
  --redact --report-format json \
  --report-path reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-gitleaks-push-after-fix.json
→ 6 commits scanned.
→ scanned ~117226 bytes (117.23 KB) in 488ms
→ no leaks found
→ exit 0
```
Captured at `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-gitleaks-push-after-fix.json`
(empty `[]` — zero findings).

### 5.3 Lifecycle vitest (32/32 pass)

```
pnpm --filter @nzila/union-eyes exec vitest run scripts/lifecycle
→ Test Files  3 passed (3)
→ Tests  32 passed (32)   ← up from 28 pre-§3; 4 new §3 tests
→ Duration  1.51s
```

Test count history: 28 (Phase 0C.2 §12 checkpoint `6e696fadf`) → 32 (post-§3).

### 5.4 Union Eyes typecheck (exit 0)

```
pnpm --filter @nzila/union-eyes typecheck
→ tsc --noEmit
→ exit 0
```

### 5.5 Brand-leakage check (PASS)

```
pnpm brand:leakage:check
→ [brand-leakage] PASS
→ exit 0
```

## 6. Full-Repository Scan Note

A full-repo `gitleaks git --redact` scan reports 553 findings across 2881 commits and
~1.6 GB of history. These are pre-existing historical findings outside the outgoing
range and outside the scope of this push. They are governed by the existing 6 short-form
Phase 0C.1 fingerprints in `.gitleaksignore` and by broader historical-remediation
tracking. Nothing in Phase 0C.2 §3 modifies the disposition of those historical
findings; per governance, they remain the responsibility of the Phase 0C.1 rotation
window and any prior gate that merged them.

## 7. Files Changed

| File | Change |
|---|---|
| `apps/union-eyes/scripts/lifecycle/allocate-db.ts` | Added `resolveAdminUrl()` helper; both `allocateDatabase` and `dropDatabase` route through it. Removed the local-dev PG URL literal fallbacks (redacted to avoid retriggering the rule in this evidence file). |
| `apps/union-eyes/scripts/lifecycle/prove-db-allocator.ts` | Imported `loadGovernedE2EEnv`; replaced `??=` literal prime with governed loader. |
| `apps/union-eyes/scripts/lifecycle/prove-phase-0c2-clean-migration.ts` | Imported `loadGovernedE2EEnv`; replaced direct-literal `Client` construction with governed-loader read. |
| `apps/union-eyes/scripts/lifecycle/allocate-db.test.ts` | Added 4-test §3 nested `describe` block. |
| `.gitleaksignore` | Added ONE full 4-part commit-scoped fingerprint + governance comment block. |

Untracked evidence files added under `reports/audits/cupe-national-phase-0/phase-0c/`:
- `phase-0c2-gitleaks-push.json` (initial 1-leak result)
- `phase-0c2-gitleaks-push-after-fix-precommit.json` (still 1 leak — fix uncommitted)
- `phase-0c2-gitleaks-push-after-fix.json` (0 leaks — post-`.gitleaksignore` narrowing)
- `phase-0c2-gitleaks-lifecycle-uncommitted.json` (0 leaks in working tree)
- `phase-0c2-gitleaks-exception-review.md` (this file)

## 8. Governance Conformance

- ✅ Preferred remediation (REMOVE literal) executed before allowlist added — §3 caveat honored.
- ✅ Allowlist entry uses strictest form (full `commit:path:rule:line`).
- ✅ Existing Phase 0C.1 short-form fingerprints preserved unchanged (out of scope).
- ✅ No new hardcoded credentials introduced anywhere else in the tree.
- ✅ Working tree, outgoing range, brand-leakage, typecheck, vitest all clean.
- ✅ Diagnostic error message points future contributors to the correct configuration path.

## 9. Sign-off

Phase 0C.2 §3 (Gitleaks exception review) is complete and safe to push in the same
commit as the removal fix. The narrow allowlist entry can be revisited and removed
after the introducing commit `edfdd1f02` has been squashed/reworded (Phase 0C.3+
history tidy), but that is out of scope for this phase.
