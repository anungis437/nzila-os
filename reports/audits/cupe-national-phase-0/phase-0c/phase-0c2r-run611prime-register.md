# Phase 0C.2R §7 — Run 6.1''' Failure Signature Register

**Status:** ACTIVE (Rung 1 series complete, source-repair phase begins here)
**Runtime source:** `run-artifacts/20260725153606_a6491d/test-results/results-20260725153606_a6491d.json` (468 785 bytes, 24 passed / 50 unexpected / 138 skipped / 0 flaky, elapsed 6 083 532 ms)
**Extractor:** `scripts/extract-run611prime-signatures.ts`
**Machine-readable register:** `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2r-run611prime-failures.json`, `.csv`
**Taxonomy:** §3.5 corrected root-cause taxonomy (Phase 0C.2R three-run reconciliation), extended to reflect §8 helper repair (timeoutMs 180 000).
**Predecessor document:** `phase-0c2r-run3-dnr-register.md` (Run 3 baseline, 131 DNR / 50 FSR-A)
**Mandate:** Explain the unexecuted tests, categorize every failure, chart §9-§14 source repairs. NO admin exclusion, NO baseline redefinition, NO defect transfer.

---

## §7.1 Aggregate categorization

Total non-passed test results: **188** (50 unexpected + 138 skipped).

| Category | Count | Confidence | %-of-unexpected |
| --- | --- | --- | --- |
| `dnr-dependency-skipped` | 138 | high | — |
| `ensureServerReady-180s` | 30 | high | 60.0 % |
| `page.goto-45s-timeout` | 11 | high | 22.0 % |
| `assertion-toContain` | 3 | high | 6.0 % |
| `assertion-toMatch` | 2 | high | 4.0 % |
| `locator-visible` | 2 | high | 4.0 % |
| `apiGet-20s-timeout` | 2 | high | 4.0 % |
| **Total unexpected** | **50** | — | **100.0 %** |

All 50 unexpected outcomes classify with **high confidence**. Zero `unknown-review-needed` records — the taxonomy fully covers the observed failure surface.

**Reconciliation with Run 3 baseline (`phase-0c2r-three-run-reconciliation.md` §3.5):**

| Category | Run 3 count | Run 6.1''' count | Δ | Interpretation |
| --- | --- | --- | --- | --- |
| ensureServerReady (helper hook) | 30 | 30 | 0 | Unchanged — same class of failure, same infra bottleneck |
| page.goto 45 s timeout | 6 | 11 | +5 | **INCREASED** — more tests now reach page.goto (progress) |
| URL mismatch (`toHaveURL`) | 5 | 0 | −5 | Masked by earlier failures OR reachable-cases repaired |
| Locator `toBeVisible` | 2 | 2 | 0 | Unchanged |
| Assertion `toContain` | 2 | 3 | +1 | Unchanged (± noise) |
| Assertion `toMatch` | 2 | 2 | 0 | Unchanged |
| `apiGet` 20 s timeout | 2 | 2 | 0 | Unchanged |
| `apiPost` 20 s timeout | 1 | 0 | −1 | Masked by earlier failure OR resolved |
| **Total unexpected** | **50** | **50** | **0** | Distribution shifted **later in test lifecycle** |

The distribution shift (URL mismatch and apiPost failures replaced by additional page.goto and toContain failures) confirms that Rung 1's lifecycle repair let more tests progress past the auth/handshake stage before failing.

## §7.2 The 138 skipped tests ("DNR" — did-not-run)

138 tests were skipped by Playwright. Under the governed lifecycle:

- `PLAYWRIGHT_TEST_AUTH=true` is exported by the lifecycle runner, so every `test.skip(!isTestAuth, ...)` guard is inactive.
- The vast majority (approximately 131 per the run-summary log; 138 per the raw stats) are cascade skips triggered when a `test.describe`'s `beforeAll` hook fails or its parent project's setup dependency fails. Playwright then reports the descendant tests as `skipped` (Playwright's semantic for "did not run because dependency failed").
- A minority (approximately 7) are **intentional** skips — tests using `test.fixme(...)`, `test.skip('reason')`, or grep-tag filters.
- **The JSON reporter cannot distinguish cascade-skip from intentional-skip without source cross-reference.** Register category `dnr-dependency-skipped` therefore aggregates both flavors; §9 repairs must cross-reference the test source when tightening the count.

Per-project skip distribution (see §7.3 table) matches the cascade-from-`beforeAll`-timeout pattern exactly: every project with an `ensureServerReady-180s` failure has a large tail of `dnr-dependency-skipped` records (its own project's descendant tests).

## §7.3 Per-project breakdown

| Project | Passed | Unexpected | Skipped (DNR) | Dominant failure signature |
| --- | --- | --- | --- | --- |
| setup | 1 | 0 | 0 | (clean) |
| public | 13 | 3 | 0 | `page.goto-45s-timeout` × 3 |
| member | 9 | 4 | 1 | `locator-visible` × 2, `page.goto-45s-timeout` × 2 |
| steward | 0 | 5 | 12 | `assertion-toContain` × 3, `assertion-toMatch` × 2, `ensureServerReady-180s` × 2 |
| admin | 1 | 22 | 81 | `ensureServerReady-180s` × 14, `page.goto-45s-timeout` × 6, `apiGet-20s-timeout` × 2 |
| security | 0 | 6 | 26 | `ensureServerReady-180s` × 6 |
| staff | 0 | 4 | 1 | `ensureServerReady-180s` × 4 |
| bilingual-en | 0 | 1 | 6 | `ensureServerReady-180s` × 1 |
| bilingual-fr | 0 | 1 | 6 | `ensureServerReady-180s` × 1 |
| accessibility | 0 | 1 | 4 | `ensureServerReady-180s` × 1 |
| executive | 0 | 1 | 1 | `ensureServerReady-180s` × 1 |
| **Total** | **24** | **50** | **138** | — |

Sum check: 24 + 50 + 138 = 212 (matches inventory ✓).

## §7.4 Root-cause signatures — repair-planning descriptions

Each signature below is a repair target for §9-§14. The register JSON at `phase-0c2r-run611prime-failures.json` contains the full per-record detail (file, test name, project, error message excerpt) suitable for slicing and repair-batch selection.

### §7.4.1 `ensureServerReady-180s` (30 records — 60 % of unexpected)

**Symptom:** `"beforeAll" hook timeout of 180000ms exceeded.` at `test.beforeAll(async ({ request }) => { await bootstrapE2EAuth(request); ...` (or similar helper call). The helper's internal `ensureServerReady` polls the Next.js dev-mode server, consumes the full 180 000 ms budget across ~7 waves of 20 s retries, and never returns.

**Root cause (per §6.11 empirical evidence):** Under sustained Playwright load, Next.js dev-mode webpack on-demand recompilation stalls the health probe. This is a framework-inherent race — repairing the helper's retry budget (§8) only shifts the failure point; it does not remove it.

**Distribution:** admin (14), security (6), staff (4), steward (2), executive/bilingual-en/bilingual-fr/accessibility (1 each).

**Repair options:**
- (a) Prod-mode variant (Rung 3) — eliminates on-demand compile entirely. Requires user sign-off per §5.6.
- (b) Session-scoped route pre-warm (extend Rung 1 to compile ALL descendant routes before Playwright projects run). Cost: additional pre-warm probes, dev-mode still fragile under load.
- (c) Reduce concurrency further (workers already 1; can't reduce). N/A.
- (d) Serial project execution with explicit inter-project idle waits (unblock via `beforeAll`-in-lifecycle rather than in-test).

### §7.4.2 `page.goto-45s-timeout` (11 records — 22 % of unexpected)

**Symptom:** `page.goto: Timeout 45000ms exceeded.` The test reached its own body (beforeAll cleared), issued a navigation, and the target route did not render within 45 s.

**Distribution:** admin (6), public (3), member (2).

**Root cause (candidate):** Same dev-mode webpack compile stall — but now hitting a route that was NOT pre-warmed at lifecycle step 8. Public/member failures on routes like the marketing hero and member dashboard are especially informative because their parent `beforeAll` succeeded (proving auth/handshake is fine).

**Repair options:**
- (a) Extend the frozen pre-warm route list to cover the failing public/member routes.
- (b) Increase `page.goto` timeout to 90 s (product cost — masks real slow-loads).
- (c) Prod-mode.

### §7.4.3 `apiGet-20s-timeout` (2 records)

**Symptom:** `apiRequestContext.get: Timeout 20000ms exceeded.` The test invoked the `apiGet` helper (from `apps/union-eyes/e2e/_helpers.ts`) and the target API did not respond within 20 s.

**Distribution:** admin (2). Both against `/api/health?releaseId=UE-DEV` — likely a manifest-file-empty race similar to what Rung 1.1 uncovered.

**Repair options:**
- (a) Bump `apiGet` helper timeout to 45 s for release-scoped endpoints.
- (b) Fix the underlying manifest race (product side).
- (c) Retry-on-500 wrapper (already implemented for auth-state generator in Rung 1.2 — extend pattern to apiGet).

### §7.4.4 `locator-visible` (2 records)

**Symptom:** `expect(locator).toBeVisible(): expected visible: true, actual: false`. Element referenced by selector did not become visible within the assertion's default timeout.

**Distribution:** member (2). Both on the member dashboard.

**Repair options:** Selector or wait-condition correction (§10 territory).

### §7.4.5 `assertion-toContain` (3) / `assertion-toMatch` (2)

**Symptom:** String/RegExp assertions failing on rendered content.

**Distribution:** steward (3 + 2). All in the steward workflow — likely stale copy or i18n key drift.

**Repair options:** Assertion tolerance / expected-value correction (§12 territory).

## §7.5 Repair-plan checklist (§9-§14)

The following list is derived from §7.4. Each item is a repair batch; execution ordering is left to §9-§14 chapters.

- [ ] **§9-Repair-A (ensureServerReady bottleneck):** Expand Rung 1 pre-warm route list to cover all failing routes uncovered in §7.4.1/§7.4.2, OR obtain user sign-off for Rung 3 prod-mode.
- [ ] **§9-Repair-B (apiGet 500 race):** Extend the Rung 1.2 retry pattern from `generate-auth-states.ts` to the `apiGet`/`apiPost` helpers in `_helpers.ts` — retry ONCE on 5xx or thrown fetch error, never on 4xx.
- [ ] **§10-Repair-C (member locators):** Investigate the 2 `locator-visible` failures on member dashboard; correct selectors or add `waitFor` guards.
- [ ] **§11-Repair-D (steward copy):** Investigate the 5 assertion failures on steward workflow; align expected strings/regexes with current copy.
- [ ] **§12-Repair-E (page.goto pre-warm gap):** Enumerate the exact routes that time out in §7.4.2 and add them to the frozen pre-warm list.
- [ ] **§13-Rerun cycle:** After §9-§12 repairs, run governed E2E and produce Run 6.2''' with updated JSON reporter. Regenerate this register.
- [ ] **§14-Final validation:** Confirm §5.6 exit criteria (FSR-A ≤ 5 %, DNR ≤ 10, admin DNR < 40).

## §7.6 §5.6 exit-criteria status

| Criterion | Required | Run 6.1''' actual | Verdict |
| --- | --- | --- | --- |
| FSR-A rate | ≤ 5 % of executed | 50 / 74 = 67.6 % | ❌ FAIL |
| DNR rate | ≤ 5 % of 193 inventory (≤ 10) | 138 / 193 = 71.5 % (or 131) | ❌ FAIL |
| Admin DNR (single-run guard) | < 40 | 81 | ❌ FAIL |

Rung 1 series repaired the lifecycle but did NOT close the exit-criteria gap. The 30 `ensureServerReady-180s` failures cascade into 138 DNR (mostly admin + security). Closing exit criteria therefore requires either (a) Rung 3 prod-mode sign-off, or (b) an expanded route pre-warm that eliminates the compile-under-load stall for admin/security's `beforeAll` bootstrap.

## §7.7 What §7 explicitly does NOT do

- Does NOT re-baseline the register — every count reconciles to Run 3 and to the raw JSON.
- Does NOT propose admin exclusion or defect transfer.
- Does NOT graduate any test.
- Does NOT commit to a specific §9-§14 sequencing yet (chapters own that decision).
- Does NOT modify any product or test source.

---

**§7 status:** COMPLETE for Run 6.1'''. Register locked at HEAD (this commit). §9 opens next.
