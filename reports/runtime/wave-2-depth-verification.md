# Wave 2 — Depth Verification

_Last updated: 2026-05-16_

This document is the verification companion to
[wave-2-implementation-report.md](./wave-2-implementation-report.md) and
[wave-2-depth-convergence-audit.md](./wave-2-depth-convergence-audit.md). It
records (1) the protected-fence validation, (2) the substrate-preserving
invariants checklist, and (3) the mandatory CI gate run log.

---

## 1. Protected-Fence Validation

The Wave 2 substrate addition is
[`continuity-intelligence-foundations.ts`](../../packages/institutional-governance-graph/src/governance/continuity-intelligence-foundations.ts).
Each of its four derivations
(`deriveUnresolvedTransitions`, `deriveContinuityBreakpoints`,
`deriveLineageBreaks`, `deriveInstitutionalMemoryGaps`) calls
`assertNoProtectedKindsInProjections` at the input boundary before
constructing any return value.

The companion test
[`continuity-intelligence-foundations.test.ts`](../../packages/institutional-governance-graph/src/governance/continuity-intelligence-foundations.test.ts)
verifies that:

- Every derivation throws when fed a value drawn from
  `IGG_PROTECTED_DECISION_CATEGORIES`.
- Every derivation throws when fed a value drawn from
  `IGG_PROTECTED_EVENT_KINDS`.
- Happy-path projections succeed only when no protected kinds are present.

The full IGG suite, including the pre-existing protected-projections
fence tests, is green:

```
Test Files  12 passed (12)
     Tests  175 passed (175)
  Duration  1.69s
```

(162 tests prior to Wave 2 + 13 new = 175.)

The protected-fence contract therefore remains intact: no Class B,
Reserved-Matter, Veto, Hold, Override, Class-B-Veto, Golden-Share-Sunset
Progression, Reserved-Matter-Raised, `class_b_veto`, or
`reserved_matter_vote` value can reach a read surface through any Wave 2
module.

---

## 2. Substrate-Preserving Invariants

| Invariant | Status |
| --- | --- |
| No schema migrations introduced | ✅ |
| No Drizzle schema changes | ✅ |
| No route additions or rewrites | ✅ |
| No authentication or authorization change | ✅ |
| No new external dependencies | ✅ |
| No mutation paths in any new code | ✅ |
| No analytics, scoring, or surveillance infrastructure | ✅ (gate-enforced) |
| No orchestration / workflow engine | ✅ |
| No event sourcing or graph persistence | ✅ |
| No AI governance / autonomous governance posture | ✅ (gate-enforced) |
| Protected-fence enforced on all new derivations | ✅ (test-covered) |
| All existing IGG tests still pass | ✅ (162/162) |
| All Wave 2 IGG tests pass | ✅ (13/13) |
| Narrative governance expanded but not loosened | ✅ (13 new hard-fail terms) |
| Procurement-trust module untouched | ✅ |
| Footer is additive (fragments only, no client tree edits) | ✅ |

---

## 3. Mandatory Gate Run Log

All gates executed on Windows / PowerShell 7 against the Wave 2 working tree.

### 3.1 `pnpm --filter @nzila/institutional-governance-graph test`

```
RUN  v4.1.2 C:/APPS/nzila-automation/packages/institutional-governance-graph
✓  protected-projections.test.ts (15)
✓  continuity-intelligence-foundations.test.ts (13)   ← Wave 2
✓  evidence.test.ts (11)
✓  continuity.test.ts (13)
✓  topology-hydration.test.ts (2)
✓  timeline.test.ts (12)
✓  governance.test.ts (17)
✓  cross-module.test.ts (10)
✓  observability/snapshot.test.ts (9)
✓  trust.test.ts (14)
✓  ontology/canonicalization.test.ts (42)
✓  projection.test.ts (17)

Test Files  12 passed (12)
     Tests  175 passed (175)
```

### 3.2 `pnpm --filter @nzila/union-eyes narrative:audit`

```
Files scanned        : 97
Hard-fail violations : 0
Warning violations   : 232   (pre-existing, unchanged class)
Rule failures        : 0
Institutional Maturity (avg) : 87/100   (threshold ≥ 87)
```

### 3.3 `pnpm --filter @nzila/union-eyes narrative:check --ci`

```
Files scanned        : 97
Hard-fail violations : 0
Rule failures        : 0
Institutional Maturity (avg) : 87/100
```

### 3.4 `pnpm typecheck`

```
Tasks:    225 successful, 225 total
Cached:    223 cached, 225 total
  Time:    26.46s
```

(Includes `@nzila/union-eyes` and `@nzila/institutional-governance-graph`
runs — the two packages touched by Wave 2.)

### 3.5 `pnpm --filter @nzila/union-eyes lint`

```
✖ 282 problems (0 errors, 282 warnings)
```

Zero errors. All 282 warnings are pre-existing (`no-unused-vars`,
`@next/next/no-img-element`, unused eslint-disable directives), none
introduced by Wave 2.

> Full-workspace `pnpm lint` continues to fail only on the previously
> documented `@nzila/healthcare-surveys` package which is missing
> `eslint.config.*`. This pre-existing failure is unrelated to Wave 2 and
> was already recorded in the Wave 1 drift verification.

### 3.6 `pnpm test:fast`

```
Test Files  983 passed (983)
     Tests  17153 passed | 1 skipped (17154)
  Duration  85.98s
```

### 3.7 `pnpm governance:audit`

```
Release Governance Score: 7/10
Deployment Risk Score:    8/10
Workflow Sprawl Score:    6/10
Environment Drift Score:  8/10
"passed": true
Overall score: 7.2 / 10
```

Findings list is unchanged from Wave 1 (script sprawl, hidden fragility,
CI efficiency, dead assets) — none of these were introduced by Wave 2.

### 3.8 `pnpm validate:docs`

```
Files scanned: 1651
Findings:      2387
  Errors:   0
  Warnings: 1206
  Info:     1181

✅ No critical documentation errors
```

---

## 4. Verification Verdict

- **Protected-fence intact:** every Wave 2 derivation is fence-guarded and
  test-covered.
- **Substrate preserved:** no schema, routing, auth, mutation, scoring,
  orchestration, persistence, or analytics infrastructure introduced.
- **Procurement-trust posture preserved.**
- **Narrative governance hardened** with 13 additional forbidden terms;
  audit and CI gate report 0 hard-fail violations.
- **All mandatory CI gates pass** with no Wave-2-introduced regressions.

Wave 2 is verifiably additive, read-only, and governance-safe.
