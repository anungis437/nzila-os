# Wave 1 — Drift Verification

**Wave:** 1 of 6
**Scope:** Verify Wave 1 vocabulary hard-fails are removed, all gates green,
and no new drift was introduced.

---

## 1. Hard-Fail Vocabulary Removal — Direct Confirmation

| Hard-fail phrase | Pre-Wave-1 location(s) | Post-Wave-1 status |
|---|---|---|
| `Executive financial command center` | `components/financial/FinancialOverview.tsx:375` | **Removed** (now `institutional finance visibility surface`) |
| `Continuity Command Center` | `components/public/site-navigation.tsx:39` | **Removed** (now `Institutional Continuity`) |
| `Governance Intelligence Hub` | `components/public/site-navigation.tsx:44` | **Removed** (now `Governance Transparency Hub`) |
| `Explainable Organizational Intelligence` (UI display) | `components/marketing/insight-article-view.tsx:101` | **Removed** (now `Explainable Governance Reasoning`) |
| `Volunteer Leaderboard` (UI label) | `components/cope/CanvassingInterface.tsx:401, 406` | **Removed** (now `Volunteer Recognition`) |

Residual `Explainable Organizational Intelligence` occurrences (intentionally
retained):

- `apps/union-eyes/lib/insights-parser.ts` — kept as a legacy alias key so
  unmigrated article frontmatter continues to parse. Mapped to the same
  `explainable-intelligence` slug to preserve procurement deep links. This
  file is **outside** the marketing narrative scope (`/(marketing)/**`) and is
  not counted by the narrative audit gate.

Article frontmatter occurrences in
`scripts/articles/union_eyes_insights_markdown_library_phase_1.md` (5) and
`scripts/articles/institutional-intelligence-defined.md` (1) — all rewritten to
`Explainable Governance Reasoning`. Verified by:

```
rg -n "Explainable Organizational Intelligence" apps/union-eyes/scripts/articles
# → 0 matches
```

---

## 2. Validation Gates — Run Log

All gates executed locally on Windows / PowerShell 7.

### 2.1 Narrative audit (marketing scope)
```
pnpm --filter @nzila/union-eyes narrative:audit
```
```
Files scanned        : 97
Hard-fail violations : 0
Warning violations   : 231
Rule failures        : 0
Institutional Maturity (avg) : 87/100
```
✅ Threshold met (≥ 87, 0 hard-fail).

### 2.2 Narrative CI variant
```
pnpm --filter @nzila/union-eyes narrative:check --ci
```
```
Files scanned        : 97
Hard-fail violations : 0
Warning violations   : 231
Rule failures        : 0
Institutional Maturity (avg) : 87/100
```
✅ Threshold met.

### 2.3 Typecheck (workspace)
```
pnpm typecheck
# Tasks: 225 successful, 225 total | 224 cached
```
✅ All 225 turbo typecheck tasks succeeded.

### 2.4 Lint (union-eyes scoped)
```
pnpm --filter @nzila/union-eyes lint
# 282 problems (0 errors, 282 warnings)
```
✅ 0 errors. Warnings are pre-existing (`@typescript-eslint/no-explicit-any`
in unrelated test files; unused-disable directives in narrative-audit.ts) and
not introduced by Wave 1.

### 2.5 Unit tests (fast)
```
pnpm test:fast
# Test Files  983 passed (983)
# Tests       17153 passed | 1 skipped (17154)
```
✅ All 983 test files / 17,153 tests passed.

### 2.6 Docs validation
```
pnpm validate:docs
# Files scanned: 1651
# Errors:   0
# Warnings: 1206
# Info:     1181
```
✅ 0 critical documentation errors.

### 2.7 Governance audit
```
pnpm governance:audit
```
Runs cleanly. Surfaces the standing roadmap blockers (MTTR feed integration,
deploy-success backfill, root-script density, deploy-* workflow consolidation).
None of these are introduced or worsened by Wave 1.

---

## 3. Pre-existing Failures (NOT introduced by Wave 1)

| Package | Failure | Provenance | Triage |
|---|---|---|---|
| `@nzila/healthcare-surveys` | `pnpm lint` fails — ESLint 9 requires `eslint.config.{js,mjs,cjs}` and the package ships none | In-progress scaffolding from prior uncommitted branch (`packages/healthcare-surveys`) — exists in the pre-Wave-1 tree | Out of Wave 1 scope. Recommend Wave 2 (or a focused infrastructure ticket) to add a minimal `eslint.config.mjs` extending the workspace root config. |

---

## 4. Substrate-Preserving Invariants — Confirmed

| Invariant | Confirmation |
|---|---|
| No IGG (Institutional Governance Graph) substrate edits | `packages/institutional-governance-graph/**` untouched in this wave. |
| No Class-B / Reserved-Matter protected-fence edits | `packages/institutional-governance-graph/src/governance/protected.ts` untouched; `redactProtected()` semantics unchanged. |
| No schema mutations | No files under `apps/union-eyes/db/schema/**` modified. |
| No URL renames | All routes (`/dashboard/institutional-observability`, `/dashboard/cognition`, `/dashboard/longitudinal-cognition`, `/dashboard/movement-insights`, `/dashboard/cross-union-analytics`, `/dashboard/sector-analytics`, `/dashboard/rewards/leaderboard`, `/institutional-continuity`, `/platform/governance-intelligence`) preserved. |
| Leaderboard route preserved as permanent redirect | URL `/dashboard/rewards/leaderboard` continues to respond (308) and redirects to `/dashboard/rewards/recognition`; locale and auth expectations preserved. |
| No new analytics / surveillance / scoring / autonomous-governance posture | All "cognition" surfaces now explicitly framed as human-reviewed, review-required, assistive reasoning. "Observability" reframed as "visibility" — explicitly non-monitoring. |
| Procurement demo continuity preserved | No bookmarks broken; no new auth gates; demo path coherent per `onboarding-admin-procurement-readiness.md`. |

---

## 5. Conclusion

Wave 1 is complete:

- All five marketing-scope hard-fail vocabulary leaks are removed.
- Four assistive-reasoning / observability / trends surfaces are reframed
  without URL or behavior drift.
- All required validation gates are green.
- No protected substrate, schema, fence, or URL was touched.
- The single failing gate (`@nzila/healthcare-surveys` lint) is a pre-existing
  scaffolding gap unrelated to this wave.

Wave 2 (per `prioritized-remediation-sequencing.md`) can proceed.
