# Wave 4 — Institutional Language, Label & Surface Convergence Audit

**Scope**: Union Eyes runtime surfaces (navigation, route headings, badges/chips, locale bundles, onboarding/admin, observability copy, procurement/trust copy).

**Posture**: additive · governance-safe · procurement-safe · runtime-stable.

**Source recon**: thorough Wave 4 language sweep (97 narrative-audited files, 6 locale bundles ~286 KB each, 14 pre-existing forbidden-vocab waves, role-experience navigation map, e2e fixtures, mobile bottom-nav icon map).

---

## Part A — Navigation & Sidebar Labels

| Surface | Audience | Current Posture | Drift Severity | Procurement Risk | Recommended Convergence | Status |
|---|---|---|---|---|---|---|
| `getRoleNavigation` member nav (`role-experience.ts:90-103`) | Member | Fully institutional ("Representation Cases", "Commitments & Deadlines", "Institutional Reports") | None | None | Hold | ✅ |
| `getRoleNavigation` staff nav (line ~95) | Staff | Strong institutional ("Workbench", "Continuity Workspace") | None | None | Hold | ✅ |
| `getRoleNavigation` executive nav (lines 107-116) | Executive | Strong ("Executive Overview", "Continuity Insights", "Continuity Operations", "Governance Visibility", "Leadership Continuity") — "Executive" labels a role audience, not surveillance posture | Mild Executive-Oversight | Low — role audience labeling, not analytics | Hold (role label, not posture) | ✅ |
| `getRoleNavigation` governance nav (lines 120-129) — **"Operational Review"** | Governance | Legacy SaaS — "Operational" + "Review" framed as operations-monitoring on a governance surface | **Hard fail** | Low (href stable) | **"Continuity Review"** — keep `/dashboard/workbench` href | ✅ Applied |
| `getRoleNavigation` admin nav (lines 134-144) — "System Status" | Admin | Mild Operational, but neutral runtime visibility framing; appears in 6 e2e fixtures + public site footer (`/en-CA/trust#system-status` anchor) | Mild Operational | **High** — public-site anchor + e2e fixtures + procurement deep-link risk | Hold (procurement-risk-gated) | Held |
| `BottomNav.tsx` icon map (lines 60-75) | All | Mirrors nav labels exactly | — | — | Auto-converged via nav rename + additive alias | ✅ Applied |

**Convergence applied to navigation**: Wave 4 added a `"Continuity Review": Briefcase` icon-map alias (additive — leaves `"Operational Review"` icon entry intact to satisfy fixture-rooted compatibility, while the live nav label now renders the institutional form).

---

## Part B — Route Headings & Page Metadata

| Surface | Current Posture | Drift Severity | Procurement Risk | Convergence | Status |
|---|---|---|---|---|---|
| `app/[locale]/dashboard/clc/page.tsx` metadata (lines 29-32) | "CLC Executive Dashboard" + "executive dashboard and national analytics" — executive-dashboard + analytics drift on a federation-coordination surface | **Hard fail** | Medium — search/SEO + procurement preview text | `"CLC Continuity Coordination | UnionEyes"` + "Canadian Labour Congress continuity coordination and federation-safe institutional visibility" | ✅ Applied |
| `clc/page.tsx` inline H1 (line 170 `defaultValue`) | Same "CLC Executive Dashboard" string | Hard fail | Low | "CLC Continuity Coordination" (paired with locale fix below) | ✅ Applied |
| Other dashboard route headings | Surveyed during recon — institutional posture dominant (chronology, provenance, continuity, governance, trust, explainability, institutional memory) | None–Mild | Low | Hold | ✅ |

---

## Part C — Chips, Badges, and Status Affordances

| Component | Posture | Convergence |
|---|---|---|
| `components/status-badge.tsx` | Neutral status semantics (resolved/pending/etc.) — no SaaS/analytics drift | Hold |
| `components/priority-badge.tsx` | Neutral priority semantics | Hold |

No edits required on chips/badges.

---

## Part D — Locale Parity (en, en-CA, fr, fr-CA, pt, it)

| Locale | Continuity / Continuité | Chronology / Chronologie | Provenance | Governance / Gouvernance | Institutional memory / Mémoire institutionnelle | Verdict |
|---|---|---|---|---|---|---|
| en | Present | Present | Present | Present | Present | Solid |
| en-CA | Present | Present | Present | Present | Present | Solid |
| fr | Present | Present | Present | Present | Present | Solid |
| fr-CA | Present | Present | Present | Present | Present | Solid |
| pt / it | Present (where mounted) | Present | Present | Present | Present | Solid |

**Locale gap detected**: `topology` / `topologie` not hydrated across locale bundles. **Deferred** — no Wave 4 surface requires topology label; lifting it now would introduce a new vocab without a runtime consumer. Mark as Wave 5 candidate.

**Locale self-violations fixed (Wave 4 closed-loop)**:
- `messages/en.json` L88, L810, L6277, L6294, L6473 — `executive dashboard` + `operational analytics` rewritten to `continuity coordination` / `operational visibility`.
- `messages/en-CA.json` L82, L804, L6214, L6231, L6410 — identical fixes mirrored.

---

## Part E — Onboarding, Pilot Configuration, Admin Posture

| Surface | Posture | Drift | Convergence |
|---|---|---|---|
| Admin "Pilot Configuration" nav | Institutional (pilot-aware, not enterprise rollout) | None | Hold |
| Admin "System Status" nav | Mild Operational (procurement-anchored) | Mild | Hold (anchor risk) |
| Admin "Security" / "Audit" / "Policies" | Institutional | None | Hold |

---

## Part F — Observability, Traceability, Visibility Surfaces

Existing wave 1–3 doctrine already enforces governance-safe visibility framing. Wave 4 reinforced this by adding `operational telemetry posture`, `alert semantics`, `organizational monitoring` to forbidden-vocab. No live surfaces currently use these terms — purely preventive.

---

## Part G — Procurement, Trust, Federation, Coexistence Copy

Recon confirmed `cba-intelligence-client.tsx` already uses *"Governance-safe continuity operations for agreement sources, ingestion, review, and institutional memory support"* — exemplar Wave 4 alignment. No edits required.

Trust pages (`/trust`, footer anchors) preserved verbatim — Wave 4 explicitly avoids renaming procurement-anchored slugs.

---

## Part H — Workflow / Editorial / Reviewer Copy

Reviewer-led semantics already present across cognition (Wave 2/3). Wave 4 added `performance management`, `management oversight`, `management posture` to forbidden-vocab as preventive guardrails. No live drift detected.

---

## Part I — Help, Empty States, Helper Text

No SaaS/marketing drift detected during recon. Hold.

---

## Part J — Drift Classification Summary

| Classification | Wave 4 Count |
|---|---|
| Fully Institutional | Vast majority of surfaces |
| Strong (continuity-aware) | Most dashboard nav, role experiences |
| Mild Operational | Admin "System Status" (procurement-anchored, held) |
| Legacy SaaS | "Operational Review" nav label — **converged** |
| Analytics | `operational: "Operational Analytics"` locale string — **converged** |
| Executive-Dashboard | CLC metadata + nav `clcDashboard` + i18n strings — **converged** |
| Enterprise Workflow | None outstanding |
| Governance-Sensitive | Trust/audit slugs — held intentionally |
| Locale Fragmented | `topology` missing — deferred to Wave 5 |
| Procurement-Risky | "System Status" anchor — held |

---

## Part K — Wave 4 Forbidden Vocabulary Block (Runtime Narrative Governance)

Wave 4 introduces a 15-term `wave4LanguageConvergence: ForbiddenTerm[]` block in `apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts`. Terms target executive-dashboard, operational-analytics, organizational-monitoring, performance-management, command-and-control, and enterprise-control compound nouns. Every term is `hard-fail`, categorized under `startup-saas` or `surveillance-ai`, with an institutional `suggestion`. Registered in the `FORBIDDEN_VOCABULARY` spread between `wave3ContinuityCognition` and `warningLevel`.

---

## Conclusion

Wave 4 leaves Union Eyes' runtime language posture aligned with the verbatim doctrinal direction: *stewardship, continuity, chronology, provenance, explainability, institutional memory, governance-safe visibility, federation-safe coordination, coexistence*. Zero schema mutation. Zero href rename. Zero procurement-anchor disturbance. Zero new governance scoring/automation/alerting. Two hard-fail nav surfaces and two locale-bundle posture strings converged. One preventive 15-term narrative-governance block landed.
