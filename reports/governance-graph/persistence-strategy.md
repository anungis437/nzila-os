# Persistence Strategy
## Phase 3 — Institutional Governance Graph

**Question this document answers:** Where does the IGG live at rest, if anywhere?
**Recommendation up front:** Stay projection-only in Phase 3. Defer cached materialisation to Phase 3.5 once a real query-load case appears. Do **not** adopt a graph database.

---

## 1. Current state (truth)

- Phase 2 IGG is a pure in-memory projection: `buildGovernanceGraphProjection(adapter)` returns nodes/edges/decisions on demand.
- The platform's existing graph substrates have **persistent backends** (`@nzila/platform-entity-graph` and `@nzila/platform-decision-graph` both ship Drizzle-backed stores), but the IGG package itself stores nothing.
- All institutional source data already persists in `apps/union-eyes` PostgreSQL tables. The IGG re-derives a graph view from them.

This is the right starting point. The question is whether to add another persistence layer beneath it, and if so, which.

---

## 2. Five strategies, scored on seven axes

| Strategy | Complexity | Repo alignment | Governance risk | Explainability | Operational burden | Procurement optics | Continuity implications |
|---|---|---|---|---|---|---|---|
| **A. Projection-only** *(current)* | Lowest | Highest | Lowest | Highest — direct trace to source rows | Lowest | Neutral | Source tables remain authoritative |
| **B. Cached projection** *(materialise into existing entity/decision graph tables on demand)* | Low | High | Low–medium — cache invalidation becomes a correctness concern | High — provenance preserved via `sourceRecordId` | Medium — adds invalidation logic | Neutral | Source tables remain authoritative; cache is rebuildable |
| **C. Relational IGG store** *(new dedicated tables `igg_nodes`, `igg_edges`, `igg_decisions`)* | Medium | Medium — adds tables to a domain that already has them | Medium — duplication invites drift | Medium — provenance must be enforced by FK or app-level constraint | Medium–high — migrations, RLS policies, backups | Negative — "more tables" perception | Source still authoritative; relational store is queryable but redundant |
| **D. Graph-native store** *(Neo4j, Memgraph, AGE)* | Highest | Lowest — no graph DB anywhere in repo | High — new infra, new attack surface, new RBAC model | Medium — query language differs, traceability less direct | Highest — new operational competence required | Negative — adds a new vendor / runtime | Source authoritative; graph DB is a derived view requiring sync infra |
| **E. Hybrid** *(B for hot reads, D for analytical)* | Highest | Lowest | Highest | Lowest — two materialisations to keep consistent | Highest | Negative | Two derived views to validate against source |

---

## 3. Recommended path

### Phase 3: Strategy **A** (projection-only).

Justification:

1. **No demonstrated query-load problem.** Phase 2 returns a coherent projection in <50 ms over ~10 source rows. We have no benchmark case where projection cost is the bottleneck.
2. **Provenance is purest.** Every node/edge carries `sourceRecordId` pointing at the canonical row. There is no second copy that can drift.
3. **Operational burden is zero.** No migrations, no cache invalidation, no backup story, no RLS extension.
4. **Reversibility is total.** If Phase 3 finds the wrong abstraction, no data is left behind.
5. **Procurement-safe.** No new infrastructure; nothing for an external auditor to question.

### Phase 3.5 (deferred trigger): Strategy **B** (cached projection).

Adopt only when **one of** the following triggers fires:

- **Query latency:** A governance dashboard exceeds 500 ms server time on realistic data volumes.
- **Cross-org analytics:** A surface needs to compare IGG projections across ≥ 5 tenants without N+1 reads.
- **Chronology integration:** The decision-graph integration starts back-pressuring source reads (motion-outcome reconstruction over years of history).

Cache invalidation rules (when triggered):
- Cache is keyed by `(tenantId, projectionVersion)`.
- Invalidation is *coarse* — any write to a tracked source table invalidates the whole tenant projection. No per-row diffing.
- Cache lives in `entity_graph` / `decision_nodes` tables (already exist), tagged with `metadata.cachedFromIgg = true`.
- A scheduled rebuild (daily) is the safety net.

### Phase 4+ (no Phase 3 commitment): Strategies C, D, E.

Strategy C is plausible if the IGG develops independent write-side semantics (it currently has none).
Strategies D and E are explicitly *not* on any Phase 3 or Phase 4 roadmap. Adopting either would require a separate platform initiative with its own governance review.

---

## 4. Decision matrix

| Question | Answer |
|---|---|
| Add new tables in Phase 3? | No |
| Add caching layer in Phase 3? | No (deferred to 3.5 with explicit triggers) |
| Use existing entity-graph / decision-graph stores at all? | Yes — for Phase 3 *decision integration* (one-way emit), not for caching the topology projection |
| Adopt a graph database? | No — not in Phase 3, not in Phase 4 |
| Permit any IGG write path? | No |

---

## 5. Operational stance

- The IGG package remains stateless and pure.
- The new "decision integration layer" (separate Phase 3 deliverable) is the only place that talks to a persistent store, and it writes only to `decision_nodes` / `decision_edges` via the existing `@nzila/platform-decision-graph` API.
- A reseed of the IGG is always: re-read source rows → re-run projection. There is no cache to flush.
- An adversarial source-row mutation cannot poison a stale IGG cache because there is no cache.

---

## 6. Risks of *this* recommendation

| Risk | Mitigation |
|---|---|
| Projection cost grows linearly with source rows | Phase 3.5 trigger is in place; we monitor latency. |
| Consumers begin treating the projection as authoritative for writes | A `README` warning + a runtime assertion in `buildGovernanceGraphProjection` (returns `Object.freeze`d objects) makes this difficult. |
| Decision-graph integration creates an implicit chronology cache | Explicitly documented; the chronology lives in `decision_nodes`, not in the IGG. The IGG re-derives the *topology*; the decision graph stores the *acts*. |

---

## 7. Conclusion

> **Phase 3 persistence strategy: status quo.**
> The IGG remains a stateless projection. The decision-graph integration is the only Phase 3 surface that writes anything, and it writes only into substrate that already exists.

This conclusion holds unless Phase 3 implementation surfaces a concrete failure mode that none of the audit signals predict. In that case, this document is amended before Strategy B is adopted.
