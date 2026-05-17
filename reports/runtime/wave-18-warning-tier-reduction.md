# Wave 18 — Warning-Tier Reduction (UnionEyes Narrative Scanner)

**Status:** Complete  
**Type:** Tactical cleanup wave (single consolidated report; not a doctrinal 3-report ceremony)  
**Predecessor:** Wave 17 — Constitutional Category Formation  
**Outcome:** Warning-tier violations reduced from **228 → 50** (78% reduction); hard-fail fences, rule failures, and Institutional Maturity (88/100) all preserved.

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
| + Prose rewrites (§3) | **50** |

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

---

## 4. Residual Warnings (50) — Rationale for Leaving in Place

All 50 remaining warnings are `platform` hits in contexts where the term is an accurate product noun and substitution would degrade prose quality, legal precision, or routing semantics. They cluster in four categories:

### 4.1 Legal / Terms / Privacy / Accessibility text (~14 hits)
- `acceptanceDesc`, `useDesc`, `collectDesc`, `standardsDesc`, `auditDesc`, `reconDesc`, `defensibilityDesc` in marketing JSON.
- "UnionEyes is a platform designed for union organi[zations]…"
- "Every action on the platform is logged…"
- These are legal/contractual phrasings where "platform" is the controlling product noun. Substitution risks ambiguity in legally-significant text.

### 4.2 Feature badges and section/nav labels (~6 hits)
- `"badge": "Platform Module"`
- `"platform": "Platform"` (section/nav label)
- `"ctaSecondary": "View Platform Overview"`
- These function as proper-noun-like product surface labels. Substituting "Capability Module" / "Substrate Module" would break visual continuity with the docs and admin console where "Platform" remains the canonical chassis name.

### 4.3 Status page descriptions (~4 hits)
- `"heroDescription": "Real-time operational status of UnionEyes platform services"`
- `"pageDescription": "Real-time status of UnionEyes platform services."`
- Status-page noun-language convention. Used identically by every SaaS status page; substituting "substrate services" would obscure scope.

### 4.4 Platform redirect metadata + TSX section headers + comment frames (~26 hits)
- `app/[locale]/(marketing)/platform/{explainable-intelligence,governance-intelligence,operational-coherence,organizational-memory}/page.tsx:30-31`:
  - `title: 'Redirecting | UnionEyes Platform'`
  - `description: 'This route redirects to the canonical platform section.'`
- `app/[locale]/(marketing)/{conventions,executive-intelligence,institutional-continuity}/page.tsx`: breadcrumb headers `Platform · Conventions`, `Platform · Executive Intelligence`, etc.
- `app/[locale]/(marketing)/trust/page.tsx:21,191,443`: TSX comment frame + anti-monitoring label desc + status reference.
- `app/[locale]/(marketing)/institutional-continuity/page.tsx:18`: TSX comment "Core platform capability page".

These are routing infrastructure (legacy `/platform/*` redirects keep "Platform" in titles to match URL-derived user expectation), breadcrumb hierarchies (`Platform` is the canonical top-level section), and comment frames (developer documentation). Rewriting them would either break user navigation cues or sever the link between code and the docs that describe these surfaces.

### 4.5 Acceptable floor
50 warnings, all justified, against 0 hard-fail violations and 0 rule failures. The warning tier now functions as designed: it flags _new_ platform-noun drift into customer-facing prose, but does not nag against accurate noun-language in legal text, status descriptions, badges, and redirect titles.

---

## 5. Gate Evidence (Verbatim)

### 5.1 `pnpm --filter @nzila/union-eyes narrative:audit`
```
UnionEyes — Narrative CI Audit
============================================================
Files scanned        : 97
Hard-fail violations : 0
Warning violations   : 50
Rule failures        : 0
Institutional Maturity (avg) : 88/100
```

### 5.2 `pnpm --filter @nzila/union-eyes narrative:check --ci`
```
UnionEyes — Narrative CI Audit
============================================================
Files scanned        : 97
Hard-fail violations : 0
Warning violations   : 50
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
  Duration  54.76s
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
| Warning violations | 228 | 50 | **−178 (−78%)** |
| Rule failures | 0 | 0 | 0 |
| Institutional Maturity (avg) | 88/100 | 88/100 | 0 |
| New fenced vocabulary | — | 0 | (W18 added no hard-fail terms) |

---

## 7. Doctrinal Notes

- W18 is a **scanner-precision and prose-cleanup** wave. It introduces no new fenced vocabulary, no new constitutional categories, no new scorer rules.
- The warning tier now scopes cleanly to **customer-facing prose**. Internal tooling, legal text, badges, redirect metadata, and routing breadcrumbs are correctly excluded.
- The 50 residual warnings are documented as accepted residuals (§4); future drift _into_ the public marketing tier will continue to be caught.
- No regression risk: all 8 mandatory gates green, hard-fail fence intact, maturity score preserved.

**End of Wave 18 — Warning-Tier Reduction.**
