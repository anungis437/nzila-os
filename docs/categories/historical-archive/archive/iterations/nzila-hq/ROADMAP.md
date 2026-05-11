# Nzila HQ — Roadmap & Phase Status

Tracking the 19-phase build of Nzila HQ. v1 (this PR) ships Phases 1–11 against an in-memory data layer. v2+ migrates to Postgres + cross-app aggregation.

## Phase status

| #   | Phase                             | Status                 | Notes                                                                                                                                 |
| --- | --------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Executive Home                    | ✅ shipped             | `app/home/page.tsx` — portfolio snapshot, alerts, expiring deals, founder/operator queues, strategic timeline, venture health table   |
| 2   | Venture Portfolio                 | ✅ shipped             | `app/portfolio/page.tsx` + `[ventureSlug]/page.tsx`                                                                                   |
| 3   | Relationship Intelligence (CRM)   | ✅ shipped (read)      | Trust score visible internally only                                                                                                   |
| 4   | Opportunity Pipeline              | ✅ shipped (read)      | Founder-touch + stale flags computed by automation engine                                                                             |
| 5   | Founder Dependency Engine         | ✅ shipped             | 6 weighted signals; trend report with synthetic baseline (replace when `metrics_snapshots` lands)                                     |
| 6   | Delegation Operating System       | ✅ shipped (read)      | Five queues; create/edit deferred to v2                                                                                               |
| 7   | Finance & Value                   | ✅ shipped (read)      | Margin/CAC/payback nullable until accounting integration lands                                                                        |
| 8   | Strategic Document Hub            | ✅ shipped (read)      | Future: signed-URL preview, AI summarization                                                                                          |
| 9   | Control Plane integration         | ✅ shipped (deep link) | Approvals/releases/freezes — read-only badge counts in v2                                                                             |
| 10  | Platform Admin integration        | ✅ shipped (deep link) | Org/seat/role attribution in v2                                                                                                       |
| 11  | Console integration               | ✅ shipped (deep link) | Incident & escalation rollups in v2                                                                                                   |
| 12  | AI layer                          | ⏳ planned             | Weekly CEO brief generator already exists in `@nzila/hq-domain` (`generateWeeklyCeoBrief`) — wire to scheduled job + `/reports` route |
| 13  | Security / RBAC hardening         | 🟡 partial             | Capability matrix shipped; audit trail + access reviews pending                                                                       |
| 14  | Premium UX polish                 | 🟡 partial             | Card/Stat/Badge primitives shipped; motion + empty-state illustrations pending                                                        |
| 15  | Data model migration              | ⏳ planned             | Drizzle schema + `@nzila/db` adapter behind same `HqRepository` interface                                                             |
| 16  | Automation expansion              | ⏳ planned             | Slack/email channels for `Alert` emission                                                                                             |
| 17  | Reporting cadence                 | ⏳ planned             | Auto-generated weekly brief + monthly portfolio review delivered to founder + board                                                   |
| 18  | Implementation rules / governance | ✅ shipped             | `control-manifest.json`, `route.meta.json`, `maturity.json` peers                                                                     |
| 19  | Acquisition-grade deliverables    | ⏳ planned             | Investor data room, due-diligence pack, acquisition-readiness scorecard                                                               |

## Known limitations (v1)

- **In-memory data only.** All data lives in `server/seed-data.ts`. Edits are not persisted across requests.
- **No write surfaces.** Every page is read-only. Mutations to delegation, CRM, opportunities deferred to v2 once Drizzle schema lands.
- **Synthetic dependency baseline.** `previousDependencyScores()` returns a deterministic +8 offset so the trend report shows movement. Replace with real `metrics_snapshots` table read in v2.
- **No staging-seed registration.** `tooling/staging-seed/src/seeders/` does not exist in this repo at the time of writing — when it lands, register the HQ seeder there.
- **No per-app Dockerfile yet.** Mirror `apps/platform-admin/Dockerfile` when adding container build.
- **No i18n.** English-only — internal tool. Avoids the `[locale]` PowerShell hazard.
- **Sidebar active-link highlighting** uses request headers as a heuristic; consider a client `usePathname()` if Next 16 stops surfacing path on edge headers.

## Open questions

- Will `@nzila/db` package be the right home for HQ schema, or should HQ get its own schema namespace (`hq_*` tables) inside the existing DB?
- For Phase 12 AI: same `@nzila/cognition` integration as Union Eyes, or a new HQ-scoped Foundry agent?
- For Phase 19: should the data-room export be SSR pages or signed PDF generation?

## Migration to Postgres (v2 sketch)

1. Add `hq_*` tables (`hq_ventures`, `hq_opportunities`, `hq_tasks`, `hq_documents`, `hq_strategic_events`) to `packages/db` Drizzle schema.
2. Implement `DrizzleHqRepository` next to `InMemoryHqRepository` — same `HqRepository` interface.
3. `getHqRepository()` chooses based on `process.env.NZILA_HQ_DATA_BACKEND` (`memory` | `db`).
4. Backfill from `server/seed-data.ts` via a one-shot script in `tooling/staging-seed`.
5. Delete `seed-data.ts` once dev DB seed is reliable.
