# CUPE4373 Demo Instance Validation — Presenter Readiness Report

**Date:** 2026-06-01  
**Target:** `https://demo.unioneyes.app`  
**Repo SHA validated locally:** `7784569eef2e02ad6286b1a87a4ddfd122624070` (governance redirect + Sentry-on-demo fix)  
**Author:** Automated validation pass (`smoke-cupe4373-demo-walkthrough.mjs`)

---

## 1. Executive verdict

**Ready with caveats.**

- Public marketing layer is fully implemented, locale-routed, and clean. Anonymous visitors land on a real homepage and can browse 8+ marketing surfaces without ever being forced into the dashboard.
- Steward persona authenticates on the live host. All 13 CUPE4373 dashboard surfaces respond `200`.
- Three dashboard surfaces still serve **stale build output** containing the term `7 West` (inbox, communications) and `Grand River` (case detail `UE-4373-026`). **Source has been sanitized and pushed** (commit `7784569ee`); the live host is waiting on a GitOps Deploy that was `in_progress` at the time of this report.
- Three dashboard surfaces render thin HTML bodies on the live build (`governance` 495 B, `members` 806 B, `reports` 1.4 KB). The new governance work and the redirect fix that made it usable are in the same un-deployed SHA. Once deploy completes these surfaces fill out.
- No demo surface returns a 404. No demo surface returns a redirect loop. No public surface exposes private dashboard data.

**You can present today, with the demo path adjustments in §9.** Re-run `node apps/union-eyes/scripts/smoke-cupe4373-demo-walkthrough.mjs --base https://demo.unioneyes.app` immediately before the demo: if it returns `Walkthrough OK`, all caveats are gone.

---

## 2. Public layer verdict

**Fully implemented and demo-safe.**

| Check | Result |
| --- | --- |
| `/` returns 307 → `/en-CA` (not `/dashboard`) | ✅ |
| `/en-CA` renders public marketing homepage (4.1 KB, hero, CTAs, nav) | ✅ |
| Public nav links (`Solutions`, `Pillars`, `Whitepapers`, `Insights`, `Proof`, `Pricing`, `Contact`) all 200 | ✅ |
| Public homepage exposes `Sign In` + `Request a review` CTAs | ✅ |
| No public surface contains forbidden contamination terms | ✅ |
| Authenticated user gets `getRoleLandingPath()` redirect; anonymous user does not | ✅ (sources read, asserted in hygiene test) |
| Public-facing copy is generic (UnionEyes branding, no CUPE4373 client claims) | ✅ |

Public routes validated live (all `200`, all clean):  
`/en-CA`, `/en-CA/platform`, `/en-CA/solutions`, `/en-CA/trust`, `/en-CA/pricing`, `/en-CA/story`, `/en-CA/whitepapers`, `/en-CA/contact`, `/en-CA/organizational-continuity-risk`.

---

## 3. Demo route map

| # | Demo segment | Expected route | Actual route | Component / file | Status | Notes | Talking point |
|---|---|---|---|---|---|---|---|
| 1 | Public homepage | `/`, `/en-CA` | `/en-CA` | [app/[locale]/page.tsx](../app/[locale]/page.tsx) | **Ready** | 200, hero + CTAs render. | "This is what any visitor sees — readiness assessment + value pillars." |
| 2 | Product overview | `/en-CA/platform` | same | `app/[locale]/(marketing)/platform/page.tsx` | **Ready** | 200, 2.9 KB. | "Continuity OS: governance, memory, intelligence layers." |
| 3 | Persona picker / one-click login | `/en-CA/login`, `/en-CA/sign-in` | both 200 | [components/auth/cupe4373-persona-picker.tsx](../components/auth/cupe4373-persona-picker.tsx), [components/auth/login-form.tsx](../components/auth/login-form.tsx) | **Ready** | Steward/officer/member tiles render; `/api/auth/login` works. | "Three personas — chief steward, officer, member — one click in." |
| 4 | Chief steward dashboard | `/en-CA/dashboard` | same | [components/demo/cupe4373-operations-dashboard.tsx](../components/demo/cupe4373-operations-dashboard.tsx) | **Ready** | 200, 3.6 KB, full nav + cards. | "Steward Operations Center — daily work in one pane." |
| 5 | Cases (list) | `/en-CA/dashboard/cases` | same | [components/demo/cupe4373-cases-console.tsx](../components/demo/cupe4373-cases-console.tsx) | **Ready** | 200, 4.8 KB. | "Every member issue tracked with state, owner, deadline." |
| 5b | Case detail | `/en-CA/dashboard/cases/UE-4373-026` | same | [app/[locale]/dashboard/cases/[id]/page.tsx](../app/[locale]/dashboard/cases/[id]/page.tsx) | **Risky (live build)** | Source clean; **live build still shows `Grand River` + `7 West`** until deploy. | If deploy not done: use a different case ID or open from the list and pick one fresh. |
| 6 | New case / intake | "New case" CTA in cases console | inline button | [components/demo/cupe4373-new-case-button.tsx](../components/demo/cupe4373-new-case-button.tsx) | **Ready** | Sheet opens client-side. | "Stewards intake cases in the same surface they manage." |
| 7 | Grievances | `/en-CA/dashboard/grievances` | same | [components/demo/cupe4373-grievances-page.tsx](../components/demo/cupe4373-grievances-page.tsx) | **Ready** | 200, 3.2 KB. | "Formal grievance ledger with steps and timelines." |
| 8 | Documents | `/en-CA/dashboard/documents` | same | [components/demo/cupe4373-documents-page.tsx](../components/demo/cupe4373-documents-page.tsx) | **Ready** | 200, 3.4 KB. | "Evidence and reference docs scoped to the local." |
| 9 | Members | `/en-CA/dashboard/members` | same | [components/demo/cupe4373-members-console.tsx](../components/demo/cupe4373-members-console.tsx) | **Partial (live build thin)** | 200 but body 806 B on current live build. Full content present in source; needs deploy. | Mention but keep scroll short; jump to a case for depth. |
| 10 | Communications | `/en-CA/dashboard/communications` | same | [components/demo/cupe4373-communications-page.tsx](../components/demo/cupe4373-communications-page.tsx) | **Risky (live build)** | Live build still contains `7 West`; source clean. | Skip until deploy completes; otherwise stay on grievances. |
| 11 | Reports / analytics | `/en-CA/dashboard/reports` | same | [components/demo/cupe4373-reports-page.tsx](../components/demo/cupe4373-reports-page.tsx) | **Partial (live build thin)** | 200, 1.4 KB on live. Source has full content. | One sentence, then move on, until deploy completes. |
| 12 | Governance / continuity | `/en-CA/dashboard/governance` | same | [components/demo/cupe4373-governance-page.tsx](../components/demo/cupe4373-governance-page.tsx) | **Partial (live build thin)** | 200 (no longer times out), 495 B on live. Decisions-of-record + motions present in source. | Show after deploy; before deploy describe verbally. |
| 13 | Inbox | `/en-CA/dashboard/inbox` | same | [components/demo/cupe4373-inbox-page.tsx](../components/demo/cupe4373-inbox-page.tsx) | **Risky (live build)** | Live still contains `7 West`; source clean. | Skip live until deploy; otherwise open priorities first. |
| 14 | Priorities / follow-ups | `/en-CA/dashboard/priorities` | same | [components/demo/cupe4373-priorities-page.tsx](../components/demo/cupe4373-priorities-page.tsx) | **Ready** | 200, 4.3 KB, clean. | "Commitments and deadlines aggregated across the local." |
| 15 | Calendar | `/en-CA/dashboard/calendar` | same | [components/demo/cupe4373-calendar-grid.tsx](../components/demo/cupe4373-calendar-grid.tsx) | **Ready** | 200, 1.7 KB, clean. | "Steward calendar — meetings, deadlines, hearings." |
| 16 | Agreements | `/en-CA/dashboard/agreements` | same | [app/[locale]/dashboard/agreements/agreements-page.tsx](../app/[locale]/dashboard/agreements/agreements-page.tsx) | **Ready** | 200, 1.6 KB, clean. | "Collective agreements available at the steward's fingertips." |
| 17 | Work surface (alt landing) | `/en-CA/dashboard/work` | same | [components/work/work-surface.tsx](../components/work/work-surface.tsx) | **Ready** | 200, 4.9 KB, clean. | Optional — only if asked "where's my work queue." |
| 18 | Admin / demo seed | `/api/admin/seed-cupe-pilot` | same | [app/api/admin/seed-cupe-pilot/route.ts](../app/api/admin/seed-cupe-pilot/route.ts) | **Hidden** | API only; surfaced via [app/components/admin/LoadCUPEPilotForm.tsx](../app/components/admin/LoadCUPEPilotForm.tsx). | **Do not show.** Operational only. |

---

## 4. Screen-by-screen validation (live evidence)

Captured `2026-06-01` via the new walkthrough smoke. `text len` is stripped-HTML body length.

| Route | HTTP | Body | Forbidden terms | Verdict |
|---|---|---|---|---|
| `/en-CA/dashboard` | 200 | 3585 B | none | Ready |
| `/en-CA/dashboard/inbox` | 200 | 2903 B | **7 West** (stale build) | Risky on live |
| `/en-CA/dashboard/priorities` | 200 | 4267 B | none | Ready |
| `/en-CA/dashboard/cases` | 200 | 4807 B | none | Ready |
| `/en-CA/dashboard/cases/UE-4373-026` | 200 | 4430 B | **Grand River, 7 West** (stale build) | Risky on live |
| `/en-CA/dashboard/grievances` | 200 | 3204 B | none | Ready |
| `/en-CA/dashboard/documents` | 200 | 3385 B | none | Ready |
| `/en-CA/dashboard/members` | 200 | 806 B | none | Partial — thin on live |
| `/en-CA/dashboard/communications` | 200 | 2569 B | **7 West** (stale build) | Risky on live |
| `/en-CA/dashboard/governance` | 200 | 495 B | none | Partial — thin on live |
| `/en-CA/dashboard/reports` | 200 | 1416 B | none | Partial — thin on live |
| `/en-CA/dashboard/agreements` | 200 | 1583 B | none | Ready |
| `/en-CA/dashboard/calendar` | 200 | 1694 B | none | Ready |
| `/en-CA/dashboard/work` | 200 | 4851 B | none | Ready |

---

## 5. Demo path checklist (live, in narrative order)

1. ✅ Start on `https://demo.unioneyes.app/en-CA` (public homepage). Hero + CTAs visible.
2. ✅ Explain what Union Eyes is. Point at `Solutions / Pillars / Whitepapers` nav.
3. ✅ Open `/en-CA/sign-in` (or click `Sign In`). Persona tiles render.
4. ✅ Sign in as `steward@cupe4373.demo` / `Demo!2026-Foundation`. Session cookie issued.
5. ✅ Land on `/en-CA/dashboard` (Steward Operations Center). Nav fully populated.
6. ✅ Show priorities (`/en-CA/dashboard/priorities`). 4 KB of real demo content.
7. ✅ Open `/en-CA/dashboard/cases`. Full case list renders.
8. ⚠️  Open one case. **Avoid `UE-4373-026` on live until deploy** (stale Grand River/7 West). Pick any other ID from the list — those re-render from source via the dynamic route.
9. ✅ Talk through documents (`/en-CA/dashboard/documents`).
10. ✅ Open grievances (`/en-CA/dashboard/grievances`).
11. ✅ Open documents (already covered).
12. ⚠️  Communications — **skip on live until deploy** (still shows `7 West`).
13. ⚠️  Members — open briefly but don't dwell (thin until deploy).
14. ⚠️  Reports — same; one sentence, then move on.
15. ⚠️  Governance — **open last; only if deploy has completed**. Verify body > 2 KB before clicking (it's 495 B today).
16. ✅ Close with fit-assessment / Q&A.

**To check deploy status mid-flight:**

```bash
gh api repos/anungis437/nzila-os/actions/runs?head_sha=7784569eef2e02ad6286b1a87a4ddfd122624070 \
  | jq -r '.workflow_runs[] | select(.name=="GitOps Deploy") | "\(.status) \(.conclusion // "-")"'
```

---

## 6. Persona / auth validation

| Check | Result |
| --- | --- |
| `POST /api/auth/login` with `steward@cupe4373.demo` returns 200 + `Set-Cookie` | ✅ |
| `POST /api/auth/login` with `member@cupe4373.demo` returns 200 + `Set-Cookie` | ✅ |
| Steward cookie accesses every CUPE4373 dashboard surface | ✅ |
| Member cookie accesses dashboard shell (intended for demo) | ✅ |
| `/en-CA/dashboard/profile` without cookie → 307 → `/login` | ✅ |
| Dashboard layout enforces `auth()` / `currentUser()` / `getUserRole()` guard | ✅ (asserted in hygiene test) |
| Public homepage does NOT unconditionally redirect to `/dashboard` for anonymous visitors | ✅ (asserted in hygiene test) |

Credentials used (all three personas, same password):
- `member@cupe4373.demo` / `Demo!2026-Foundation`
- `steward@cupe4373.demo` / `Demo!2026-Foundation`
- `officer@cupe4373.demo` / `Demo!2026-Foundation`

---

## 7. Sanitized term check

| Layer | `Grand River` | `7 West` | `CUPE Local 123` | `Brandon` | `Union365` |
|---|---|---|---|---|---|
| Curated CUPE4373 source (`components/demo/cupe4373-*`, `lib/demo/cupe4373-*`, `scripts/seed-cupe4373-*`, `app/api/admin/seed-cupe-pilot/route.ts`) | clean | clean | clean | clean | clean |
| Public marketing surfaces (live) | clean | clean | clean | clean | clean |
| Authenticated CUPE4373 surfaces (live, current build) | **leak on `/cases/UE-4373-026`** | **leak on `/inbox`, `/communications`, `/cases/UE-4373-026`** | clean | clean | clean |
| Test fixtures (`lib/**/__tests__/*`) | n/a | n/a | present (intentional, not user-facing) | n/a | n/a |
| Admin case-study editor placeholder | n/a | n/a | "CUPE Local 1234" placeholder text only | n/a | n/a |

The live leaks are deploy lag, not source contamination. The extended hygiene test (`apps/union-eyes/tests/cupe4373-demo-hygiene.spec.ts`) will fail in CI if anyone reintroduces these terms into curated CUPE4373 source.

---

## 8. Known risks

1. **GitOps Deploy lag.** Workflow for `7784569ee` was `in_progress` at report time. Until it finishes, three surfaces are visibly weaker than the source. **Mitigation:** run the walkthrough smoke immediately before the demo and confirm `Walkthrough OK`.
2. **Case detail dynamic route.** Live `/cases/UE-4373-026` is rendered from a cached/stale build and shows `Grand River` + `7 West`. Other case IDs render fresh from the dynamic route handler.
3. **Governance route was previously broken** (redirected to internal `:3000`). Fixed in source via the same SHA; live still routes through the broken proxy until deploy.
4. **Sentry on demo host** was emitting 429s. Patched in `instrumentation-client.ts` (commit `df434432d`, already deployed).
5. **No Playwright suite** is wired into this app. The walkthrough smoke is a Node fetch script — adequate for go/no-go but does not exercise client JS.

---

## 9. "Do not click" list during the demo

Until `GitOps Deploy` for `7784569eef2e02ad6286b1a87a4ddfd122624070` is `completed/success`:

- ❌ `/en-CA/dashboard/cases/UE-4373-026` (stale Grand River / 7 West). Pick a different case from the list instead.
- ❌ `/en-CA/dashboard/communications` (stale `7 West`).
- ❌ `/en-CA/dashboard/inbox` (stale `7 West`). Open `/dashboard/priorities` instead — same daily-work narrative, clean.
- ⚠️  `/en-CA/dashboard/governance` (renders but very thin until deploy). If deploy isn't done, describe verbally instead of opening.
- ⚠️  `/en-CA/dashboard/members` and `/en-CA/dashboard/reports` (thin until deploy). Open only briefly.

After deploy completes (re-validate with the walkthrough smoke), all of the above clear.

---

## 10. Recommended final live demo route

```
1.  https://demo.unioneyes.app/en-CA                       (public hero)
2.  https://demo.unioneyes.app/en-CA/platform              (what it is)
3.  https://demo.unioneyes.app/en-CA/trust                 (governance posture)
4.  https://demo.unioneyes.app/en-CA/sign-in               (persona picker)
5.  [sign in as steward@cupe4373.demo]
6.  https://demo.unioneyes.app/en-CA/dashboard             (Steward Ops Center)
7.  https://demo.unioneyes.app/en-CA/dashboard/priorities  (daily work)
8.  https://demo.unioneyes.app/en-CA/dashboard/cases       (case ledger)
9.  [open any case other than UE-4373-026 from the list]   (case continuity)
10. https://demo.unioneyes.app/en-CA/dashboard/grievances  (formal track)
11. https://demo.unioneyes.app/en-CA/dashboard/documents   (evidence)
12. https://demo.unioneyes.app/en-CA/dashboard/agreements  (CBA at hand)
13. https://demo.unioneyes.app/en-CA/dashboard/calendar    (steward calendar)
14. [if deploy completed] /dashboard/governance, /dashboard/communications, /dashboard/members, /dashboard/reports
15. Close.
```

---

## 11. Commands run and results

| Command | Result |
| --- | --- |
| `pnpm exec vitest run tests/cupe4373-demo-hygiene.spec.ts` (extended to 4 tests) | ✅ 4/4 pass |
| `node apps/union-eyes/scripts/smoke-cupe4373-personas.mjs --base https://demo.unioneyes.app` (prior session) | ✅ 5/5 |
| `node apps/union-eyes/scripts/smoke-cupe4373-demo-walkthrough.mjs --base https://demo.unioneyes.app` | ⚠️ 41 PASS / 2 FAIL — both FAILs are the known live-build stale `7 West` leaks on `/dashboard/inbox` and `/dashboard/communications`. Clears once deploy of `7784569ee` lands. |
| Public route probe (10 URLs) | ✅ all 200, all clean |
| Authed route probe (14 URLs, steward cookie) | ✅ all 200; 3 stale-content hits (above) |
| Member persona login + dashboard access probe | ✅ |
| Source scan for forbidden terms in `lib/`, `components/`, `app/`, `scripts/` | ✅ Only test fixtures + admin form placeholder remain (non-user-facing). |
| `gh api .../actions/runs?head_sha=7784569ee...` | GitOps Deploy `in_progress`; CI `in_progress`; E2E `in_progress`; governance & GA gates `success`. |

### Files added / changed this pass

- `apps/union-eyes/tests/cupe4373-demo-hygiene.spec.ts` — extended from 1 to 4 tests (forbidden-term scan; no unconditional homepage→dashboard redirect; dashboard layout enforces auth guard; all 13 CUPE4373 dashboard route files exist).
- `apps/union-eyes/scripts/smoke-cupe4373-demo-walkthrough.mjs` — new walkthrough smoke covering public + authenticated demo flow with forbidden-term assertions.
- `apps/union-eyes/reports/cupe4373-demo-instance-validation.md` — this report.

No new database migrations, no new modules, no production code changed in this pass. Source-level fixes for the live-build leaks were made and committed in the prior session (SHA `7784569ee`) and are awaiting deploy.
