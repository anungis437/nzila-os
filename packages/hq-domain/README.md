# @nzila/hq-domain

Pure domain logic for **Nzila HQ** — the executive operating cockpit for Nzila Ventures.

This package owns:

- **Types** for ventures, opportunities, contacts, tasks, documents, dependency scores, metrics
  snapshots — the canonical Nzila HQ data model (Phase 15).
- **Dependency Engine** (Phase 5) — computes the founder-dependency score per venture from raw
  signals (task ownership concentration, sole-contact accounts, approval bottlenecks, etc.).
- **Automations** (Phase 16) — pure rule functions that classify the world and emit alerts (stale
  deals, dependency thresholds, MRR drops, pilot-won expansions).
- **Reports** (Phase 17) — deterministic report generators (Weekly CEO Brief, Monthly Portfolio
  Review, Founder Dependency Trend).

## Architectural rules

- **No database calls.** All inputs are passed in; all outputs are plain data.
- **No I/O.** Pure functions only. Time is injected.
- **No UI.** Consumed by `apps/nzila-hq` (and any future executive surface).
- **No duplicate sources of truth.** This package defines _aggregation logic over_ upstream
  systems (Console, Platform Admin, Control Plane); it does not own operational data.

See `docs/nzila-hq/README.md` for the full architecture.
