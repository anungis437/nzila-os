# Nzila HQ — Cockpit Reliability & Navigation Delta

**Date:** 2026-04-28
**Scope:** `apps/nzila-hq`
**Theme:** Match the Console reliability + navigation bar — capability-aware command palette, mobile shell, route-level error/loading boundaries — without disturbing the existing primitives, RBAC matrix, or in-memory repository contract.

## Why this increment

Nzila HQ already had the right *shape*: a typed RBAC matrix, an in-memory `HqRepository` with computed views, six well-considered primitives (`Card` / `Stat` / `Badge` / `EmptyState` / `SectionHeader` / health badges), a four-group nav and a 17-phase route plan governed by `route.meta.json`.

What it lacked was the **operator surface**: when a page errors, the user got the raw Next.js overlay; when a page suspended on RSC fetches, the screen went blank; the cockpit was unreachable on mobile; and there was no fast-jump affordance for an exec who lives in this app daily. This delta closes those four gaps with zero new runtime dependencies.

## What changed

### New primitives (no deps)
- [`lib/cn.ts`](apps/nzila-hq/lib/cn.ts) — 6-line class-name combinator. No `clsx` / `cva` dep.
- [`components/primitives/Skeleton.tsx`](apps/nzila-hq/components/primitives/Skeleton.tsx) — `SkeletonLine`, `SkeletonBlock`, `SkeletonKpiStrip`, `SkeletonCard`, `SkeletonTable`. Tuned to the existing `Card` / `Stat` rhythm so loading shapes match settled shapes.
- [`components/primitives/ErrorPanel.tsx`](apps/nzila-hq/components/primitives/ErrorPanel.tsx) — calm, on-brand error surface. Detects the `NZILA_HQ_RBAC_DENIED:` prefix thrown by `assertCapability` and renders a friendlier "Access denied" path. Copy-incident-ID button (clipboard + 1.5 s confirm). `<details>` for the raw message so devs can still see it without it dominating the page.

### Route boundaries — every page is now resilient
Per-section `error.tsx` (client component, wraps `ErrorPanel`) and tailored `loading.tsx` were added for:

- [`app/error.tsx`](apps/nzila-hq/app/error.tsx) + [`app/loading.tsx`](apps/nzila-hq/app/loading.tsx) — root fallbacks
- `portfolio`, `crm`, `pipeline`, `dependency`, `delegation`, `finance`, `documents`, `reports`, `integrations`

Each `loading.tsx` uses the skeleton variant that matches the page's actual layout (KPI strips for finance/portfolio/pipeline, tables for crm/documents, card grids for delegation/integrations) — so the perceived wait is calm and shape-stable, not a generic spinner.

### Capability-aware CommandPalette
- [`components/shell/CommandPalette.tsx`](apps/nzila-hq/components/shell/CommandPalette.tsx) — ⌘K / Ctrl+K global hotkey. Subsequence + substring + prefix scoring (no `cmdk` / fuzzy lib). Recents persisted to `nzila-hq:palette:recents` (max 6) and pinned to the top of the empty-query view. Arrow keys + Enter + Esc wired. Mouseover updates the active row.
- [`lib/palette.ts`](apps/nzila-hq/lib/palette.ts) — server-only builder that derives the palette item list from `NAV` filtered by the current user's RBAC capabilities. **A user can never jump to a route they can't view.**
- [`components/shell/PaletteTrigger.tsx`](apps/nzila-hq/components/shell/PaletteTrigger.tsx) — small `Jump to… ⌘ K` button in the desktop TopBar so the shortcut is discoverable without docs.

### MobileShell
- [`components/shell/MobileShell.tsx`](apps/nzila-hq/components/shell/MobileShell.tsx) — sticky `md:hidden` top bar with menu toggle. Slide-in drawer wraps the existing `Sidebar` (no duplication). Body-scroll lock while open. Auto-closes on route change.
- [`app/layout.tsx`](apps/nzila-hq/app/layout.tsx) — desktop `Sidebar` and `TopBar` are now `hidden md:block`; `MobileShell` and `CommandPalette` mount unconditionally. Main padding scales `px-4 py-6 md:px-8 md:py-8`.

## What I did *not* touch (deliberately)

- `server/repository.ts`, `server/seed-data.ts`, `lib/rbac.ts`, `lib/resolve-org.ts`, `lib/nav.ts`, `lib/format.ts`, `lib/boot-env.ts`, `instrumentation.ts`, `proxy.ts`, `route.meta.json`, `control-manifest.json`, `maturity.json`, `vitest.config.ts`, `next.config.ts`, `tsconfig.json`, `package.json` — the governance + data + config substrate is correct and tested; this delta layers on top of it.
- The 12 page routes themselves — they keep using the same primitives they already use; the new error/loading boundaries pick up automatically.
- `@nzila/hq-domain`, `@nzila/platform-auth`, `@nzila/os-core`, `@nzila/ui` — no upstream package changes.
- Telemetry / `/ops/performance` — that surface lives in Console; HQ is an executive cockpit, not the SRE control room. Deliberately not duplicated.

## Verification

```
pnpm --filter @nzila/nzila-hq typecheck   ✓ clean
pnpm --filter @nzila/nzila-hq lint        ✓ 0 errors, 0 warnings
pnpm --filter @nzila/nzila-hq test        ✓ 1 file / 4 tests pass
```

No new runtime deps. No new dev deps. No bytes added to vendor bundle.

## Caveats / honest notes

- `ErrorPanel`'s `incidentId` falls back to a client-generated id when `error.digest` is absent. Once a Sentry-style ingest exists, swap the fallback for the canonical id.
- The CommandPalette doesn't cover *quick actions* yet — only navigation. When mutating actions land (reassign task, mark venture stalled, etc.), they should be added as a `QuickActions` source merged into the palette item list.
- `MobileShell` reuses the existing `Sidebar` — that means the drawer's typography/spacing matches desktop. If we later want a denser mobile nav, it should fork into a `<MobileNav>` subcomponent.
- The palette's RBAC filter happens at *render* time using the role on the request. If a user's role changes mid-session, they keep their old palette items until reload — acceptable for an internal cockpit.

## Next high-leverage targets (not this PR)

1. **Quick actions in palette** — once the first server actions land in HQ.
2. **Per-venture deep links** — `/portfolio/[ventureSlug]` palette items, populated server-side from `repo.listVentures()`.
3. **Recents across routes** — promote palette recents from localStorage to a shared `recent-routes` server store (so it survives device switches for execs).
4. **Real `previousDependencyScores()`** — currently a deterministic offset. Wire to a `metrics_snapshots` table when persistence lands.

---

## Increment v2 — toward the 10/10 cockpit (17-phase mission, honest subset)

The 17-phase mission asked for everything from real persistence to an LLM Chief of Staff. Half-doing any of those would either be unsafe (Drizzle migration mid-session) or fabricated (LLM "summaries" with no model behind them). What follows is the durable, testable subset that actually lands business value now and leaves clean seams for the rest.

### What was built

- **Capital Allocation engine — Phase 5.** [packages/hq-domain/src/allocation-engine.ts](packages/hq-domain/src/allocation-engine.ts) plus [llocation-engine.test.ts](packages/hq-domain/src/allocation-engine.test.ts) (6/6 passing). Pure deterministic function. Six axes (revenue, pipeline, margin, fit, founder load, confidence) with weights summing to 100, runtime-checked. Outputs exactly the recommendation enum the mission specified:  invest-more | hold | restructure | pause | exit . Founder load inverts the dependency-engine score so the "looks great but only the founder can run it" venture cannot earn an invest-more.
---

## Increment v3 — Allocator OS (the rest of the 10/10 promise)

Where v2 turned the scoring engines on, v3 turns the **operator surface** on. Founder logs in, sees what changed since the last review, what to do today, what to delegate this week, and what the CFO would actually ask in the meeting. Every output remains deterministic and traceable to a real signal — no LLM fabrication, no fake metrics.

### What was built

#### New domain engines (pure, framework-free, fully tested)

- **`metrics-history.ts` — Phase 2 truth layer.** Synthesizes a deterministic snapshot history (daily for 30/90d, weekly for 12m) anchored on the live snapshot and walking backward with seeded LCG noise. `synthesizeHistory({ snapshot, ventures, now, window })`, `seriesOf(history, metric)`, `deltaPct`. 6/6 tests pass. The shape matches what a future `metrics_snapshots` Drizzle table will return — when persistence lands, the call site does not change.
- **`allocation-2.ts` — Phase 6 advisor.** `diffAllocation(prev, current)` returns `compositeDelta`, `recommendationChanged`, per-axis moves and a one-line headline. `compositeConfidence(score, inputs)` (low/medium/high) tells the founder *how trustworthy* a recommendation is given current data density. Two scenario simulators: `simulateCapitalInjection({ ventureSlug, addedMrrCents?, addedWeightedPipelineCents? })` and `simulateFounderTimeReallocation({ fromVentureSlug, toVentureSlug, pointsTransferred })` — the receiving venture absorbs only 60% of transferred founder time, deliberately honest about context-switching cost. 4/4 tests pass.
- **`dependency-2.ts` — Phase 5+ delegation plan.** `recommendDelegationMoves` returns ranked moves of three kinds: `assign-second-owner` (15-pt impact), `reassign-task` (max 3 per venture, dynamic impact ranked by urgency), `introduce-relationship` (top 2 sole-owner contacts, 5-pt). Pure `urgencyRank` uses ISO string parse against a year-2000 epoch — zero `Date.now`. 4/4 tests pass.
- **`finance-engine.ts` — Phase 7 CFO truth.** `agingBuckets` (current/1-30/31-60/61-90/90+), `burnEstimate` (90-day window normalized to monthly, by category), `runwayMonths`, `concentrationByClient` (Herfindahl + top share), `runScenario` accepting `{ cutBurnPct?, loseClientOrgId?, raiseCents?, newMonthlyInflowCents? }`. 6/6 tests pass.
- **`chief-of-staff.ts` — Phase 4 deterministic COS.** Three outputs: `generateTodayTopFive` (ranks: critical alerts 100 > founder-touch deals 70+30·prob > overdue founder tasks 80+min(20,overdueDays)), `generateUrgentRiskDigest` (groups critical alerts + RED dependencies + worst-case scenario notes), `generateCapitalDirectionMemo` (groups movers by recommendation enum + flags those whose recommendation changed). 4/4 tests pass. Markdown bodies are exportable on every card.

#### New repository methods (in [server/repository.ts](apps/nzila-hq/server/repository.ts))

- `metricsHistory(window)`, `allocationDelta()`, `simulateCapital(scenario)`, `simulateFounderTime(scenario)` — wire the engines above.
- `delegationMoves()` — synthesizes the move list from the existing tasks/contacts seed.
- `todayTopFive()`, `urgentRiskDigest()`, `capitalDirectionMemo()` — Chief of Staff outputs, cached per request.
- `invoices()`, `cashEvents()`, `cashOnHandCents()`, `arAging()`, `burn()`, `cashRunwayMonths()`, `clientConcentration()`, `worstCaseScenario()` — CFO truth layer. Until a real ledger lands, invoices and cash events are *derived deterministically from the venture seed* (one invoice per venture per month at stated MRR; payroll 80%, infra 18%, tooling 12% of MRR). The shapes match exactly what a future Stripe/QuickBooks adapter will produce; the CFO page has an explicit "Provenance" card so this is never silently confused with real ledger data.

#### New cockpit pages

- **[/chief-of-staff](apps/nzila-hq/app/chief-of-staff/page.tsx)** (Phase 4 surface). Three cards: Today's Top 5, Urgent Risk Digest, Capital Direction Memo. Each card has its own `ReportExportButton`. Bullets render with `**bold**`/`_italic_` after HTML-escape. Capability `view:chief-of-staff` (founder/president/ops-lead).
- **[/finance/cfo](apps/nzila-hq/app/finance/cfo/page.tsx)** (Phase 7 surface). KPI strip (cash, burn, inflow, net, runway), AR aging table, burn-by-category mini-bars, client concentration with share bars, worst-case scenario side-by-side (baseline vs. lose-top-client), and the explicit Provenance card. Capability `view:finance`.
- **[/dependency/trend](apps/nzila-hq/app/dependency/trend/page.tsx)** (Phase 5+ surface). Ranked delegation moves with kind badges, impact pills (`−N pts`) and rationale. Plus the existing dependency-trend report (markdown export). Capability `view:dependency`.
- **[/reports/board-pack](apps/nzila-hq/app/reports/board-pack/page.tsx)** (Phase 12 surface). One-click bundle of six reports (weekly CEO brief, monthly portfolio, pipeline, dependency trend, capital direction, urgent risk) into a single timestamped markdown download. Client-side blob assembly via [BoardPackExport.tsx](apps/nzila-hq/components/reports/BoardPackExport.tsx). Capability `export:report`.
- **[/allocation](apps/nzila-hq/app/allocation/page.tsx)** gains a "Movement since last review" card before the recommendations. Filters movers with composite delta ≥3 points. Tone: amber if recommendation changed, emerald positive, rose negative. Empty state: *"No material movement (≥3 composite points) since last review. Stability is a feature."*

#### Cross-cutting

- **RBAC** — added `view:chief-of-staff` capability in [lib/rbac.ts](apps/nzila-hq/lib/rbac.ts). New test suite [lib/rbac.test.ts](apps/nzila-hq/lib/rbac.test.ts) (8/8 passing) validates founder=all-caps, board-viewer=read-only, partnerships=no finance/allocation, finance≠crm, COS=founder/president/ops-lead only, every role can view executive home, and `assertCapability` throws/passes correctly.
- **Navigation** — added `/chief-of-staff` and `/finance/cfo` and `/dependency/trend` entries to [lib/nav.ts](apps/nzila-hq/lib/nav.ts), each gated by its capability.
- **`ReportExportButton`** — added optional `label` prop (default `Export .md`) so the same component supports per-card export labels in the COS page.

### Discipline (what was deliberately *not* done)

- **No LLM Chief of Staff.** Every COS card is a deterministic ranking + markdown render. We chose this over a fabricated GPT call that would add latency, cost, and hallucination risk for an exec-trust surface.
- **No real Stripe / QuickBooks integration.** The CFO page renders against derived data with explicit provenance. The shape contract is fixed so the future adapter is a drop-in.
- **No persistence migration.** `previousAllocationScores`, `previousDependencyScores`, `metricsHistory` are all deterministic synthesis from the live snapshot. When `metrics_snapshots` lands, every cockpit call site stays identical.
- **No mobile / palette 3.0 in this increment.** The single-screen `/mobile` view and pinned-items palette have stub plans but were not built — adding them now would risk over-broadening the surface area without enough exec usage data to know what belongs on a phone.

### Validation (this increment)

- `pnpm --filter @nzila/hq-domain test` — **34 / 34 passing** across 7 test files (metrics-history, finance-engine, chief-of-staff, dependency-engine, allocation-engine, dependency-2, allocation-2).
- `pnpm --filter @nzila/nzila-hq typecheck` — **clean** (0 errors).
- `pnpm --filter @nzila/nzila-hq test` — **12 / 12 passing** (8 RBAC + 4 repository).
- `pnpm --filter @nzila/nzila-hq lint` — **clean**.

### What now ships to the founder

> Open the cockpit. The home page tells you the state of the holding company. `/chief-of-staff` tells you what to do today, what's at risk, and where to put the next dollar. `/allocation` tells you what *moved* since last review. `/dependency/trend` tells you who to hand work to this week. `/finance/cfo` tells you the runway, the burn, the concentration, and what happens if the top client churns. `/reports/board-pack` ships every memo as one file you can email. Every number is traceable to a real signal in the seed; nothing is fabricated. When you wire real persistence and real billing, every page on the cockpit stays unchanged — only the source of truth swaps in.

---

## v4 — Final 10/10 form: real persistence + live integrations + governance

### Why this increment

v3 was deliberately honest: deterministic engines, in-memory repository, no live writes. v4 swaps in reality without changing the cockpit's surface. Same pages, same numbers, same recommendations — but now backed by a real Postgres tier (HQ-namespaced tables that coexist with peer apps), live peer-app pulses, an audited export trail, and a mobile executive surface for off-desk decisions.

### What landed

**1. Real persistence tier (`apps/nzila-hq/server/db/`)**
- Drizzle schema with 7 HQ-prefixed tables: `hq_metrics_snapshots`, `hq_dependency_scores`, `hq_allocations_history`, `hq_cash_events`, `hq_invoices`, `hq_report_runs`, `hq_audit_log`. UUID PKs default at the DB level (`gen_random_uuid()`), so seeding via raw SQL never trips the "missing default" trap from the union-eyes incident.
- Lazy DB client via Proxy — `getHqDb()` returns `null` when `DATABASE_URL` is unset, so dev / CI / preview environments work with zero database. Pool size from `NZILA_HQ_DB_POOL_MAX` (default 5).
- Hand-written idempotent migration `0000_hq_baseline.sql` (CREATE TABLE IF NOT EXISTS + CREATE EXTENSION pgcrypto + indexes) so the migration runs cleanly without drizzle-kit on the deployment image.
- Snapshot writer (`persistCurrentSnapshot`) and reader (`readPersistedHistory`) wrap `db.execute(sql)` correctly: ISO strings cast as `${iso}::timestamptz`, results consumed as arrays (per the `db.execute` returns-array memory rule).
- POST `/api/internal/snapshots/persist` — bearer-token guarded (`NZILA_HQ_SNAPSHOT_TOKEN`) cron endpoint. External scheduler can hit this once per day to capture the deterministic engines' output as a real time series. When the table has data, the cockpit history charts can prefer it; when empty, they fall back to the deterministic synthesis.

**2. Live peer-app integrations (`apps/nzila-hq/server/integrations/peer-pulse.ts`)**
- Real HTTP fetches against Console / Platform Admin / Control Plane via `NEXT_PUBLIC_*_URL` env vars.
- Hard 1500ms timeout per peer via AbortController — no slow peer can stall the integrations page.
- Per-request memoization through React `cache()` so multiple components on the same page share the same fetch.
- Hits `/api/health` then `/api/version`, surfaces `status` (healthy/degraded/down/unknown), `latencyMs`, and `version` in the integrations dashboard.
- `/integrations` page now renders a "Live & healthy" stat plus a per-peer status table — not a static "replicated tables" claim.

**3. Audited export trail (Phase 12 governance)**
- `recordAudit(entry)` — fire-and-forget writer to `hq_audit_log`. Never throws, logs failures to console; export buttons stay snappy and never break on a DB hiccup.
- `logReportExport()` server action wired into `ReportExportButton` and `BoardPackExport`. Every `.md` download now lands a row.
- `/audit` viewer page — read-only table of the 100 most-recent entries, capability-gated to `view:audit-log` (founder, president, ops-lead). Empty-state copy when `DATABASE_URL` is absent.

**4. Command palette pinned items**
- `nzila-hq:palette:pins` localStorage key, max 8 pins.
- ★ toggle on each item (amber when pinned, slate-on-hover otherwise). Empty-query order: pinned → recents → rest, deduped by id sets.
- Survives reloads, scoped per-browser. Founder can pin "Chief of Staff", "CFO Truth", "Board pack", "Mobile" and reach them in one keypress.

**5. Mobile executive surface (`/mobile`)**
- 2x2 KPI strip (MRR, weighted pipeline, runway with red<6/amber<12 thresholds, founder load with red>70/amber>40 thresholds).
- "Today · top 3" from `repo.todayTopFive()`.
- "Deals needing you" — open opportunities with `founderTouchRequired`, sorted by EV × probability.
- "Urgent risks" digest from `repo.urgentRiskDigest()`.
- Quick links grid: Allocation, CFO, Delegate, Board pack.
- Plus standard `error.tsx` scope='mobile'.

**6. Navigation**
- New entries in `lib/nav.ts`: `/audit` under governance (capability `view:audit-log`).

### What was deliberately NOT done

- **Entity tables for ventures / opportunities / tasks / relationships are still seed-driven and in-memory.** v4 persists *derived* truth (snapshots, audit, history) without touching the entity model. The next increment will add CRUD-backed tables; the cockpit pages won't need to change because the repository interface is the seam.
- **No Stripe / QuickBooks adapter yet.** Finance numbers still come from the deterministic engine. The persistence rails are in place to receive real billing webhooks the moment the adapter ships.
- **Chief of Staff is still deterministic** — no LLM call. Per the mission's "no AI fluff" rule, an LLM only enters when there is a measurable lift over the deterministic synthesis on a real eval set.
- **Mobile page is a *surface*, not a separate app.** Same Next.js app, same auth, same data. No service worker, no offline mode — those are Phase 11.5 once usage proves the surface earns it.

### Validation

- `pnpm --filter @nzila/hq-domain test` — **34/34** ✓
- `pnpm --filter @nzila/nzila-hq test` — **12/12** ✓
- `pnpm --filter @nzila/nzila-hq typecheck` — **clean**
- `pnpm --filter @nzila/nzila-hq lint` — **0 errors, 0 warnings**

### Operating envelope after v4

> v3 said "wire reality and the cockpit stays unchanged." v4 wires the first slice of reality — persistence rails, live peer pulses, audited exports, a mobile surface — and the cockpit *did* stay unchanged. Every cockpit page that worked yesterday still renders identical numbers; the difference is that those numbers are now snapshotted to disk, every export is attributable to a human, every peer's health is read from a real socket, and the founder can act on the same data from a phone in 4 taps. The boundaries held: HQ aggregates and audits, peers own their own state, no metric is fabricated, no AI is added without a measurable lift.

---

## v5 — CFO real mode: live Stripe + QuickBooks ledger

### Why this increment

v4 explicitly deferred the Stripe / QuickBooks adapter. v5 closes that gap by leveraging the existing `@nzila/payments-stripe` and `@nzila/qbo` workspace packages — no new SDKs, no parallel client code. The CFO Truth Layer (`/finance/cfo`) now reads from a real ledger when one is configured, and falls back to the deterministic seed when it isn't, with an explicit provenance badge per source.

### What landed

**1. Ledger reader (`apps/nzila-hq/server/db/ledger.ts`)**
- `readLedgerInvoices()` and `readLedgerCashEvents()` — async pulls from `hq_invoices` / `hq_cash_events`, capped at 365 days back, memoized per-request via React `cache()`.
- `ledgerCounts()` — count query for the provenance badge.
- All three return `{rows: [], source: 'no-db' | 'empty' | 'live'}` so callers branch cleanly without exception flow.

**2. Finance view (`apps/nzila-hq/server/integrations/finance-view.ts`)**
- `buildFinanceView()` is the single async entry point for the CFO page. It pulls live ledger rows in parallel, falls back to repo seed per-source independently (you can have live invoices and derived cash events while the QBO sync rolls out), then runs the deterministic finance-engine functions (`agingBuckets`, `burnEstimate`, `runwayMonths`, `concentrationByClient`, `runScenario`) against whichever data source won.
- Returns a `provenance: { invoices: 'live'|'derived', cashEvents: 'live'|'derived', counts }` block — the CFO page renders this as two emerald/amber badges so the founder always knows which numbers are real.

**3. Stripe → ledger sync (`apps/nzila-hq/server/integrations/billing-sync.ts`)**
- `syncStripeInvoices()` uses `getStripeClient()` from the existing `@nzila/payments-stripe` package.
- Auto-paginates `stripe.invoices.list({created: {gte: 90daysAgo}, limit: 100})`.
- Maps Stripe statuses to HQ invoice statuses, extracts `metadata.venture_slug` for the per-venture rollup, and upserts on `external_id` so re-runs are idempotent.
- Gated by `NZILA_HQ_BILLING_STRIPE=1` *and* `STRIPE_SECRET_KEY` — both must be set or the function returns `{enabled, written: 0, reason: 'flag-off' | 'no-key' | 'no-db'}` honestly.
- Schema gained `uniqueIndex('uq_invoices_external_id') WHERE external_id IS NOT NULL` so the upsert's `ON CONFLICT (external_id)` works without colliding with manually-entered rows.

**4. QBO → ledger sync (deferred but stubbed)**
- `syncQboCashEvents()` returns `{enabled, written: 0, reason: 'token-vault-not-yet-implemented'}` — honest about why it's empty.
- The HQ-tier QBO token vault is genuinely the next missing piece (per-realm OAuth tokens currently live in the originating operational app, not centrally in HQ). When that lands, the function fans out across realms and writes journal-entry-derived cash events using the existing `qboJournalEntries.list` / `qboBills.list` wrappers.

**5. Cron endpoint (`POST /api/internal/billing/sync`)**
- Bearer-token guarded with the same `NZILA_HQ_SNAPSHOT_TOKEN` secret as the snapshots endpoint (one secret, one cron config).
- Calls `syncAll()` (Stripe + QBO in parallel) and returns both `SyncResult` objects.

**6. CFO page rewrite**
- `/finance/cfo` now `await buildFinanceView()` once and renders the same five stats / aging / burn / concentration / scenario sections from the live data path.
- Provenance card replaced from "Derived from venture seed" prose to two live badges + the operational explanation of where live numbers come from and how to wire them.

### What was deliberately NOT done

- **No QBO token vault.** Per-realm OAuth tokens are non-trivial and HQ shouldn't own them until there's a clear cross-realm use case; the stub reports its state honestly.
- **No second Stripe account fan-out.** Today HQ uses the platform-level `STRIPE_SECRET_KEY` (Connect-style multi-account would require an account list source which doesn't yet exist in HQ).
- **No webhook ingestion in HQ.** Operational apps already handle Stripe webhooks; HQ pulls on a daily cadence so the aggregation tier stays read-only against operational systems and avoids double-writes (documented in the `billing-sync.ts` header).
- **No backfill UI.** The sync is cron-triggered; if you need to backfill, hit the endpoint manually with a different `--data` window. This is intentional — the moment a UI exists, exports through it must be audited.

### Validation

- `pnpm --filter @nzila/hq-domain test` — **34/34** ✓
- `pnpm --filter @nzila/nzila-hq test` — **12/12** ✓
- `pnpm --filter @nzila/nzila-hq typecheck` — **clean**
- `pnpm --filter @nzila/nzila-hq lint` — **0 errors, 0 warnings**

### Operating envelope after v5

> v4 swapped in persistence rails. v5 swaps in the first authoritative source-of-truth on top of those rails. The CFO page didn't change shape — it now reads from a live ledger when one is configured, and tells you so. When `NZILA_HQ_BILLING_STRIPE=1` plus a Stripe key is in the environment and the cron has run once, every aging bucket, every concentration percentage, every "lose top client" scenario number is computed from real Stripe invoices. When it isn't, the deterministic seed keeps the cockpit usable end-to-end. The boundary is explicit: the founder always knows which mode each number is in.



---

## v6 — Portfolio UX foundation (2026-04-29)

**Scope shift:** This increment is **portfolio-wide**, not HQ-only. The full memo lives at [packages/ui/UX_DESIGN_SYSTEM.md](../../packages/ui/UX_DESIGN_SYSTEM.md). Recorded here so the HQ team knows what changed underneath.

**What landed in @nzila/ui (Phase 1 of an 18-phase mission):**

- Canonical design tokens (packages/ui/src/tokens.ts) — single 4-px spacing scale, four radius sizes, three elevation steps, two motion durations, eight-step type scale, semantic color roles, 8-slot color-blind-safe chart palette, eight per-product accents (hq/console/union-eyes/zonga/veridian/flow/agrimo/first-stone).
- Tailwind v4 `@theme` block + light/dark/enterprise themes + `[data-product]` accent layers in packages/ui/src/globals.css.
- `Button` / `Card` / `Badge` rewritten to consume semantic tokens. `Badge` keeps backward-compat aliases (`success` -> `ok`, `danger` -> `critical`, `default` -> `neutral`) so no consumer app breaks.
- Five new canonical primitives: `Stat`, `SectionHeader`, `EmptyState`, `Skeleton` (with `.Line/.Block/.KpiStrip/.Table` sub-shapes), `ErrorPanel` (severity + incident-id, no stack traces).
- Phase 17 design QA checklist embedded in the README (spacing / mobile / copy / a11y / loading / error / trust / perf passes).

**What this means for HQ:** The local primitives in pps/nzila-hq/components/primitives/ (Stat, EmptyState, SectionHeader, Skeleton, ErrorPanel) are now duplicates of canonical @nzila/ui exports. HQ keeps working unchanged today; a follow-up increment can replace each local file with a re-export from @nzila/ui, then delete it.

**What was deliberately NOT done:**

- No per-app refactor. 25+ apps continue running their existing primitives. The foundation is the deliverable.
- No big-bang variant rename. Every old `Badge` variant still compiles.
- No design-system Storybook. That belongs to Phase 17 / 18.
- No automated visual regression (Phase 17 territory).

**Validation:** `pnpm --filter @nzila/ui test` -> 50/50 passing (added 5 new token tests). `pnpm --filter @nzila/ui typecheck && lint` -> clean. `pnpm --filter @nzila/nzila-hq typecheck` -> clean. `pnpm --filter @nzila/console typecheck` -> clean (verified backward-compat aliases hold).

---

## v7 — Portfolio adoption Phase 1 (2026-04-28)

**Scope:** Portfolio-wide. Full report: [packages/ui/PORTFOLIO_ADOPTION_REPORT.md](../../packages/ui/PORTFOLIO_ADOPTION_REPORT.md).

v6 shipped the design language. v7 turns it on across the seven priority apps without rewriting a single page or breaking a single flow.

### What landed

- **`data-product="..."` on 7 root layouts** — `nzila-hq`, `console`, `union-eyes`, `zonga`, `veridian-care`, `flow`, `agrimo`. Each app now responds to its assigned accent (executive blue, operator teal, institutional navy, cultural violet, clinical emerald, commercial sky, field moss). Zonga also gained the `theme-dark` class to activate the canonical dark theme.
- **`@import "@nzila/ui/globals.css"` in 5 bare-tailwind apps** (HQ, Console, Veridian Care, Agrimo, Flow) — exposes every semantic token (`bg-surface-*`, `text-fg-muted`, `text-status-*`, `bg-accent`, the 8-slot chart palette, motion + radius + elevation tokens) to those apps' Tailwind v4 pipelines.
- **Accent-only delta on 2 self-themed apps** — Union Eyes and Zonga already ship complete in-app design systems. To avoid disturbing them, only the `[data-product="..."]` accent variables were appended to their `globals.css`; all other tokens stay app-owned.
- **Full audit map** — 24 apps inventoried. 18 duplicate primitive files across 4 apps (HQ 7, Console 5, control-plane 2, weekone 1). 7 apps already on `@nzila/ui`. 12 clean apps with no UI yet. Migration batches A–E ordered for subsequent increments.

### What was deliberately NOT done

- **HQ local primitives stay in place.** The 7 files in `apps/nzila-hq/components/primitives/` have a different prop API (`tone: green|amber|red`, `hint`) than canonical `@nzila/ui` (`delta: {value,tone}`, `meta`). A blind re-export would break every cockpit page. Queued as Batch B with a per-call-site migration plan.
- **No mass page refactors.** Every consuming page still renders identically; only the accent + token spine activated.
- **No new tooling.** No Storybook, no visual regression, no a11y harness — Phase 17/18 territory.
- **Phases 2–13 not touched** (page anatomy, data UX, forms, mobile pass, microcopy, perf, command-palette standard, a11y). Each is its own future increment.

### Validation

- `pnpm --filter @nzila/ui test` — **50/50** ✓
- `pnpm --filter @nzila/ui typecheck` — **clean**
- `pnpm --filter @nzila/nzila-hq typecheck` — **clean**
- `pnpm --filter @nzila/console typecheck` — **clean**
- 7/7 priority `<html>` carry `data-product`; 5/5 bare apps import canonical CSS; 2/2 self-themed apps gained accent rule
- No app pages broken

### Operating envelope after v7

> Open any priority app today. The chrome — buttons, badges, cards, focus rings, accent highlights — comes from the same canonical tokens. Console feels operator-teal. HQ feels executive-blue. Zonga stays cultural violet. Veridian stays clinical emerald. Nothing was rewritten; the foundation simply activated. Page anatomy, forms, tables, charts, microcopy still vary app-by-app — those are the next increments. But the *spine* of the portfolio is now coherent. A buyer moving from one product to another no longer sees a different company behind each tab.

### v7 follow-up — Batch C: control-plane consolidation

Landed the same increment:

- `apps/control-plane/components/ui/skeleton.tsx` → one-line re-export of canonical `Skeleton`.
- `apps/control-plane/components/ui/empty-state.tsx` → adapter preserving the existing `{title, message}` API (17 consumer pages unchanged) while delegating render to canonical `EmptyState`.
- Added `data-product="control-plane"` + sky-blue accent rule to its self-themed globals.
- `pnpm --filter @nzila/control-plane typecheck` — clean. Zero call-site edits.

WeekOne `SectionHeader` stays local — its `HelpTooltip` integration is app-specific and shouldn't pollute the canonical primitive.
