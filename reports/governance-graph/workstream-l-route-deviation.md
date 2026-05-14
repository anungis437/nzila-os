# Workstream L — Route Deviation Rationale

## Status
Step 10 of 11.

## Planned vs Implemented
The WS L Step 1 audit proposed chronology surfaces across three existing hosts:
- `dashboard/institutional-memory/` for procedural timeline, institutional evolution, decision lineage.
- `dashboard/continuity-intelligence/` for continuity progression and governance epochs.
- `dashboard/institutional-observability/` for chronology explainability overlays.

Current implementation consolidates WS L chronology delivery in one canonical route:
- `dashboard/institutional-chronology/`

This is a deliberate sequencing deviation to reduce cross-route drift while WS J/WS K convergence wiring remains in progress.

## Why This Deviation Is Intentional
1. Single adapter boundary: one page consumes one chronology adapter (`getInstitutionalChronologyView`) so protected-fence behavior is consistent across all chronology sections.
2. Lower semantic drift risk: procedural timeline, evolution, lineage, continuity, epochs, and explainability are rendered in one narrative surface, preventing subtle vocabulary divergence between host routes.
3. Controlled convergence path: WS J/WS K integration can be added later as context strips and overlays without duplicating chronology builders in multiple pages.
4. Faster guard coverage: one projection-test surface catches protected-kind regressions before route fan-out.

## Doctrine and Safety Impact
The deviation does not change governance doctrine or read-surface safety posture:
- Chronology is still retrospective and inspectable only.
- No scoring, ranking, prediction, optimization, or recommendation is introduced.
- Protected institutional semantics remain redacted at the graph layer before UI projection.

## Forward Reconciliation
After WS L implementation report completion:
1. Keep `dashboard/institutional-chronology/` as canonical chronology reference route.
2. Add convergence overlays into WS J and WS K hosts by reusing chronology view slices.
3. Avoid duplicating chronology composition logic; continue through the single adapter.

This surface is governance-safe transparency over preserved institutional records. It does not evaluate, rank, predict, or recommend. Protected institutional semantics are redacted at the graph layer before reaching this view.
