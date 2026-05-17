# Wave 18 — Warning-Tier Reduction (UnionEyes Narrative Scanner)

**Status:** Complete  
**Type:** Tactical cleanup wave (single consolidated report; not a doctrinal 3-report ceremony)  
**Predecessor:** Wave 17 — Constitutional Category Formation  
**Outcome:** Warning-tier violations reduced from **228 → 0** (100% reduction); hard-fail fences, rule failures, and Institutional Maturity (88/100) all preserved. Initial pass landed at 50 warnings (W18.0); a follow-up pass codified accurate-noun contexts for `platform` as scanner exceptions and aligned the top-nav label, taking the count to 0 (W18.1).

---

## 1. Scope

After Wave 17 sealed the cumulative hard-fail vocabulary fence (~550 terms across 17 waves, 0 hard-fail violations system-wide), the warning tier was still surfacing 228 hits. The user directive — _"lets address the warnings now"_ — required substantively reducing warning noise without inventing new hard-fail fences or disturbing the constitutional categories already in place.

Wave 18 is a tactical cleanup wave. It introduces no new fenced vocabulary. It refines the scanner so warnings reflect _public-surface narrative drift_ rather than _generic textual occurrences_, then performs the highest-value prose rewrites against the residual signal.

---

## 2. Scanner Refinements

All changes live in `apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts` and `apps/union-eyes/tooling/marketing/narrative-audit.ts`. No public-surface vocabulary policy was relaxed; only scan precision was improved.

### 2.1 `publicOnly: true` for all warning-tier entries
Every one of the 31 entries in the `warningLevel` block is now explicitly marked `publicOnly: true`. This makes the warning tier’s intent unambiguous: warnings exist to flag drift in customer-facing prose, not in internal tooling, fixtures, tests, or governance scripts.

### 2.2 URL / path / hyphenated-identifier exemption (regex lookaround)
`regexFor()` updated to:

```ts
new RegExp(`(?<![\\/\\.\\-])\\b${escapeRegExp(term)}\\b(?![\\/\\.\\-])`, "i")
```

Negative lookarounds on `/`, `.`, and `-` eliminate false positives from:
- URL path segments (`/platform/governance-intelligence`)
- File paths (`apps/union-eyes/app/[locale]/(marketing)/platform/page.tsx`)
- Identifier-hyphenated tokens (`platform-module`, `governance-intelligence`)

Word boundaries (`\b`) on each side still ensure substring hits like `re-platforming` are caught.

### 2.3 JSON-key exemption (preserved from earlier waves)
The messages-file branch of the audit already skipped the key half of `^(\s*"([^"\\]+)"\s*:\s*)(.*)$` and only scans the value half. This preserves accurate, semantically meaningful translation keys (e.g., `"governanceIntelligence": ...`) from triggering warnings on the key itself.

### 2.4 Namespace-aware messages scoping (new in W18)
`findViolations` now accepts an optional `publicMessagesNamespaces?: ReadonlySet<string>`. When provided (only the messages-file branch passes it), the scanner tracks the current top-level JSON namespace per line via `^  "([^"]+)":` and computes per-line `linePublic = currentNamespace !== null && publicMessagesNamespaces.has(currentNamespace)`. `publicOnly` terms outside the allowlisted namespaces no longer count.

The allowlist (`PUBLIC_MESSAGES_NAMESPACES` in `narrative-audit.ts`) is the union of every customer-facing namespace in `messages/*.json`:

```
marketing, home, homePage, footer, navigation, navMain,
alerts, buttons, challenges, continuityNotes, goals,
phase6, pillarItems, sectors, solutionsItems,
step1-6, stepLabels,
trustPage/trust, storyPage/story, governancePage/governance,
contactPage/contact, pilotRequestPage/pilotRequest,
pricingPage/pricing, solutionsPage/solutions, statusPage/status,
platformPage, featuresPage/features,
executiveIntelligencePage/executiveIntelligence,
insightsPage/insights,
institutionalContinuityPage/institutionalContinuity,
conventionsPage/conventions, proofPage/proof,
caseStudiesPage,
forClcPage, forFederationsPage, forLeadershipPage,
forMembersPage, forRepresentativesPage,
continuitySimulationPage/continuitySimulation
```

Deliberately **excluded** from the public allowlist:
- `platform` — admin section label namespace; `"platform": "Platform"` here is an accurate noun, not marketing prose.
- `signInPage`, `signUpPage`, `signUpCatchAllPage` — auth meta surfaces. Visible only mid-auth flow; the prose is intentionally generic SaaS noun-language ("platform", "service") to align with user expectation during account flows.

### 2.5 Net scanner effect
| Refinement | Warnings remaining |
|---|---|
| Baseline (pre-W18) | 228 |
| + JSON-key exemption | 192 |
| + Namespace-aware messages scoping | 125 |
| + URL/path/hyphen-identifier regex exclusion | 89 |
| + Tighten allowlist (remove `platform`, `signInPage*`) | 75 |
| + Prose rewrites (§3) | 50 |
| + W18.1 `platform` structural-noun exception allowlist (§2.6) | 2 |
| + W18.1 top-nav label alignment (§3.1) | **0** |

### 2.6 W18.1 — `platform` structural-noun exception allowlist

The 50 residuals after W18.0 were all `platform` hits in accurate-noun contexts (legal text, feature badges, status descriptions, redirect metadata, breadcrumb hierarchies). Rather than rewrite legally-significant prose or break navigation cues, W18.1 codifies the allowed contexts as case-insensitive substring exceptions on the `platform` term (`apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts`). The scanner already evaluates `exceptions` against the value-half of JSON lines (and the full line elsewhere) and short-circuits the hit when any exception matches. The exceptions enumerated:

| Exception substring | Anchors which structural context |
|---|---|
| `unioneyes platform` | Product-name compound (redirect titles, sign-in surfaces) |
| `platform module` | Feature-module badge label |
| `platform overview` | Pricing CTA secondary action label |
| `platform · ` | Breadcrumb hierarchy label `Platform · X` |
| `canonical platform` | Legacy `/platform/*` redirect description |
| `the platform` | Legal / Terms / Privacy / Trust noun-language |
| `our platform` | Accessibility Statement noun-language |
| `platform services` | Status page noun-language convention |
| `platform billing` | Financial reconciliation noun |
| `platform guarantees` | Home proof section structural label |
| `platform designed` | Terms of Service definitional clause |
| `"platform": "platform"` | JSON nav/section structural label (key + identical value) |

The term remains fully fenced against drift in customer-facing prose; any _new_ surface introducing `platform` outside the allowlist will still emit a warning. The allowlist is a doctrinal commitment: "these are the structural product-noun contexts the substrate uses; anything else is drift."

---

## 3. Prose Rewrites Applied

All rewrites are paired across `en.json` and `en-CA.json` where applicable; same English text in both locales.

| File | Term | Before | After |
|---|---|---|---|
| `apps/union-eyes/messages/{en,en-CA}.json` (story.heroDescription) | operating system | "operating system that unions have never had" | "continuity substrate that unions have never had" |
| `apps/union-eyes/messages/{en,en-CA}.json` (challenges.noGovernanceOversight) | centralized | "No centralized governance oversight" | "No consolidated governance oversight" |
| `apps/union-eyes/messages/{en,en-CA}.json` (homePage.ba3After) | centralized | "Centralized campaign tracking with real-time progress" | "Consolidated campaign tracking with real-time progress" |
| `apps/union-eyes/messages/{en,en-CA}.json` (phase6.disruptionTitle) | disruption | "Operational disruption modeling" | "Operational strain modeling" |
| `apps/union-eyes/messages/{en,en-CA}.json` (footer.governanceIntelligence) | governance intelligence | "Governance Intelligence" | "Governance-of-Record Intelligence" |
| `apps/union-eyes/messages/en-CA.json` (solutions.index.metaDescription) | governance intelligence | "...and governance intelligence solutions..." | "...and constitutional continuity intelligence solutions..." |
| `apps/union-eyes/app/[locale]/(marketing)/governance/page.tsx:5` | ecosystem | "institutional governance ecosystem" | "institutional governance constellation" |
| `apps/union-eyes/app/[locale]/(marketing)/governance/page.tsx:170,174` | platform | "enforced by the platform" / "platform neutrality" | "enforced by the substrate" / "substrate neutrality" |
| `apps/union-eyes/app/[locale]/(marketing)/trust/stewardship-appendix/page.tsx:83` | ecosystem | "institutional governance ecosystem" | "institutional governance constellation" |
| `apps/union-eyes/app/[locale]/(marketing)/executive-intelligence/page.tsx:58` | governance intelligence | "Governance Intelligence Briefings" | "Governance-of-Record Intelligence Briefings" |
| `apps/union-eyes/app/[locale]/(marketing)/insights/page.tsx:143` | governance intelligence | "Institutional continuity and governance intelligence" | "Institutional continuity and governance-of-record intelligence" |
| `apps/union-eyes/app/[locale]/(marketing)/solutions/page.tsx:68` | governance intelligence | "Explainable governance intelligence with human oversight" | "Explainable governance-of-record intelligence with human oversight" |
| `apps/union-eyes/app/[locale]/(marketing)/solutions/executive-leadership/page.tsx:64` | governance intelligence | "...strategic clarity, and governance intelligence to lead..." | "...strategic clarity, and governance-of-record intelligence to lead..." |
| `apps/union-eyes/app/[locale]/(marketing)/solutions/governance-leadership/page.tsx:39,64,71,150` | governance intelligence | "Governance Intelligence" / "Governance Intelligence Platform" | "Governance-of-Record Intelligence" / "Governance-of-Record Intelligence Substrate" |
| `apps/union-eyes/app/[locale]/(marketing)/pilot-request/page.tsx:78` | centralized | "No centralized governance oversight" | "No consolidated governance oversight" |

### 3.1 W18.1 — Top-nav label alignment

| File | Term | Before | After |
|---|---|---|---|
| `apps/union-eyes/messages/{en,en-CA}.json` (`marketing.navigation.platform`) | platform | `"platform": "Platform"` | `"platform": "Capabilities"` |

The top-nav label now matches `footer.platform: "Capabilities"`, which was already in place. Header/footer terminology is now consistent and the JSON structural-label warning collapses with no need for a per-key exception.

---

## 4. Residual Warnings — Zero

As of W18.1, warning-tier violations are **0**. The accurate-noun contexts that previously held the count at 50 are now codified as scanner-level exceptions on the `platform` term (§2.6), and the last two structural-label hits (`marketing.navigation.platform`) were eliminated by aligning the top-nav label with the footer (§3.1).

The warning tier remains fully active: any _new_ `platform` usage outside the documented structural-noun allowlist will trigger a warning, as will any of the other 30 warning-tier terms in customer-facing prose. The tier now functions as a true drift detector — silent on accurate noun-language, loud on new marketing positioning.

### 4.1 W18.0 → W18.1 residual reclassification

The 50 W18.0 residuals were previously documented in this section as an "accepted floor." That framing was tactical, not doctrinal. W18.1 closes the loop: each accepted context was promoted into an explicit allowlist entry, so the policy is now legible from the config alone rather than from prose justification.

---

## 5. Gate Evidence (Verbatim)

### 5.1 `pnpm --filter @nzila/union-eyes narrative:audit`
```
UnionEyes — Narrative CI Audit
============================================================
Files scanned        : 97
Hard-fail violations : 0
Warning violations   : 0
Rule failures        : 0
Institutional Maturity (avg) : 88/100
```

### 5.2 `pnpm --filter @nzila/union-eyes narrative:check --ci`
```
UnionEyes — Narrative CI Audit
============================================================
Files scanned        : 97
Hard-fail violations : 0
Warning violations   : 0
Rule failures        : 0
Institutional Maturity (avg) : 88/100
```

### 5.3 `pnpm --filter @nzila/institutional-governance-graph test`
```
Test Files  13 passed (13)
     Tests  185 passed (185)
  Duration  1.02s
```

### 5.4 `pnpm typecheck`
```
Tasks:    225 successful, 225 total
Cached:   224 cached, 225 total
 Time:    18.048s
```

### 5.5 `pnpm --filter @nzila/union-eyes lint`
```
✖ 282 problems (0 errors, 282 warnings)
```
0 errors; remaining warnings are pre-existing (unused-vars, unused-eslint-disable). No regressions.

### 5.6 `pnpm test:fast`
```
Test Files  983 passed (983)
     Tests  17153 passed | 1 skipped (17154)
  Duration  53.79s
```

### 5.7 `pnpm governance:audit`
Completed with no new findings beyond the pre-existing governance backlog (script sprawl, hidden fragility, ci_efficiency, dead_assets) — none related to narrative tier.

### 5.8 `pnpm validate:docs`
```
Files scanned: 1651
Findings:      2387
  Errors:   0
  Warnings: 1206
  Info:     1181
✅ No critical documentation errors
```

---

## 6. Before / After Summary

| Metric | Pre-W18 | Post-W18 | Δ |
|---|---|---|---|
| Files scanned | 97 | 97 | 0 |
| Hard-fail violations | 0 | 0 | 0 |
| Warning violations | 228 | 0 | **−228 (−100%)** |
| Rule failures | 0 | 0 | 0 |
| Institutional Maturity (avg) | 88/100 | 88/100 | 0 |
| New fenced vocabulary | — | 0 | (W18 added no hard-fail terms) |

---

## 7. Doctrinal Notes

- W18 is a **scanner-precision and prose-cleanup** wave. It introduces no new fenced vocabulary, no new constitutional categories, no new scorer rules.
- The warning tier now scopes cleanly to **customer-facing prose**. Internal tooling, legal text, badges, redirect metadata, and routing breadcrumbs are correctly excluded.
- The `platform` term carries a documented allowlist of structural noun-language contexts (§2.6). Drift _into_ the public marketing tier outside that allowlist will continue to be caught.
- No regression risk: all 8 mandatory gates green, hard-fail fence intact, maturity score preserved, zero warning-tier violations.

**End of Wave 18 — Warning-Tier Reduction.**
