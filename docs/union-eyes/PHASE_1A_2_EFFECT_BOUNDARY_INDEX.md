# Phase 1A.2b1 — UI Action Effect-Boundary Trace

**Historical b1 gate as recorded: PASS WITH EXPLICIT UNKNOWN BOUNDARIES — SOURCE TRACE ONLY. Callback-closeout gate: FAIL / NOT PROVEN.** The original b1 trace classified all **644** candidate bindings and retained **138** unknowns. A separate source-only closeout now maps those 138 identities, resolves 29 additional boundaries, and retains **109 exact unknown residuals**. The historical b1 classifications and counts below remain unchanged. Route URL and method ambiguities are counted separately. No runtime success, endpoint availability, persistence, authorization, or readiness is established.

The full per-binding evidence and reconciliations are in the [effect-boundary index](./PHASE_1A_2_EFFECT_BOUNDARY_INDEX.json).

The additive Phase 1A.2b1 R1 source-only callback provenance census is recorded in the [R1 report](./reality-remediation/PHASE_1A_2B1_R1_CALLBACK_PROVENANCE.md) and [per-binding evidence index](./reality-remediation/PHASE_1A_2B1_R1_CALLBACK_PROVENANCE.json). It preserves the historical b1 and closeout fields and does not change their gate.

## Scope and method

The denominator is the **644** records marked `actionFamilyCandidate` in [the accepted Phase 1A.2a executable action index](./PHASE_1A_2_EXECUTABLE_ACTION_INDEX.json). For each binding, the trace follows source-level handler definitions, captures and invocation arguments where resolvable, and records the first observed effect boundary. An unresolved prop/callback chain is `UNKNOWN_EFFECT_BOUNDARY`; it is not treated as a no-op.

API observations are compared only with statically inventoried Next.js App Router route files and exported HTTP methods under `apps/union-eyes/app`. A local route or method marked missing is absent from that inventory only. It does not establish that another backend, gateway, proxy, or deployment route is unavailable.

## Primary effect-boundary classifications

| Classification | Bindings |
|---|---:|
| `API_REQUEST` | 255 |
| `CLIENT_DOMAIN_SERVICE` | 12 |
| `DIRECT_BROWSER_API` | 21 |
| `DOWNLOAD_OR_EXPORT` | 22 |
| `LOCAL_CLIENT_STATE` | 138 |
| `LOCAL_STORAGE` | 10 |
| `NAVIGATION_TO_WORKFLOW` | 35 |
| `NO_EFFECT` | 13 |
| `UNKNOWN_EFFECT_BOUNDARY` | 138 |
| **Total** | **644** |

`NO_EFFECT` is deliberately narrow: it covers event-control-only handlers, telemetry-only handlers, informational-toast-only handlers, and one empty handler. It does not mean the product capability is complete. The audit reclassified **67** previously `NO_EFFECT` records as unknown when the resolved body invoked a callback/function without an established effect. It also recovered three concrete boundaries missed by the first pattern pass: one download helper, one browser reload, and one file-input click.

The `MULTI_EFFECT_HANDLER` rule matched **0** bindings after the browser-DOM classification correction. This is a static analyzer result, not proof that the handlers have no secondary runtime effects.

## API route and method observations

There are **255** bindings classified as API requests, comprising **358** source-level request call instances.

| Local App Router path comparison | Request instances |
|---|---:|
| `API_ROUTE_PRESENT` — exact local path found | 210 |
| `API_ROUTE_DYNAMIC_BOUNDED` — normalized local route-family candidate found | 104 |
| `API_ROUTE_MISSING` — no matching local route family found | 42 |
| `API_ROUTE_UNKNOWN` — source URL shape is ambiguous | 2 |
| **Total** | **358** |

The 42 `API_ROUTE_MISSING` instances represent **27 distinct path patterns**. Query-string values are shown in the detailed JSON evidence. The two `API_ROUTE_UNKNOWN` instances are the dynamic `/api/admin/users${searchQuery ? ...}` template: its conditional interpolation does not establish a reliable route pattern.

| Local App Router method comparison | Request instances |
|---|---:|
| `API_METHOD_PRESENT` | 304 |
| `API_METHOD_UNKNOWN` | 46 |
| `API_METHOD_MISSING` | 8 |
| **Total** | **358** |

The eight source-level method mismatches and their local route candidates are:

| UI request | Local candidate exports |
|---|---|
| `PUT /api/organizations/:id/sharing-settings` | `DELETE`, `GET`, `PATCH` |
| `DELETE /api/consent` | `GET`, `POST` |
| `PUT /api/messaging/preferences` | `GET`, `POST` |
| `POST /api/organization/members` | `GET` |
| `POST /api/grievances/:id/assign` | `PATCH` |
| `PUT /api/communications/templates/:id` | `DELETE`, `GET`, `PATCH` |
| `DELETE /api/messages/threads/:threadId` | `GET`, `POST` |
| `POST /api/calendars/:id/events` | `GET` |

These are route-inventory comparisons, not conclusions about production HTTP responses or behavior. The remaining method-unknown records include nonliteral method expressions and the two ambiguous URL observations.

## Trace coverage and residual closure

| Measure | Count |
|---|---:|
| Bindings with captured values | 565 |
| Captured-value records | 2,176 |
| Bindings with invocation arguments | 291 |
| Invocation-argument records | 449 |
| Historical unresolved-handler candidates exactly matched to current source identity/location | 427 |
| Historical candidates still outside the accepted canonical static UI closure | 245 |
| Historical outside-closure candidates re-entered by this trace | 0 |

The accepted closure was not expanded. The remaining **245** historical outside-closure candidates stay unreconciled for active-scope reachability and were not promoted into the 644-binding trace.

## Phase 1A.2b1 callback closeout — separate evidence layer

**Closeout gate: FAIL / NOT PROVEN.** The closeout covers exactly the 138 bindings that were `UNKNOWN_EFFECT_BOUNDARY` in the original b1 record. Each binding identity appears once in `phase1a2b1Closeout.bindingOutcomes` in the JSON index. The b1 fields above, including its original 138 unknowns and 358 API request call instances, are retained unchanged.

| Final closeout boundary | Bindings |
|---|---:|
| `UNKNOWN_EFFECT_BOUNDARY` | 109 |
| `LOCAL_CLIENT_STATE` | 20 |
| `NAVIGATION_TO_WORKFLOW` | 4 |
| `API_REQUEST` | 3 |
| `DOWNLOAD_OR_EXPORT` | 2 |
| **Total** | **138** |

The closeout rejects all **66** analyzer-proposed `NO_EFFECT` outcomes in this subset: their handlers invoke or reference callback targets whose terminal effects were not established. Event-control-only observations such as `stopPropagation` are retained as evidence, not treated as the terminal effect. Five other callback bindings were closed as local state based on their direct state-setter declarations and active JSX callsites. No unknown was converted to `NO_EFFECT`. The 109 residual records carry per-binding callback origin, forwarding/caller evidence, invocation targets, and exact trace-termination reason; the 245 outside-closure candidates remain untouched.

The corrected source trace also found four API request call instances through these callback chains:

| UI request | Local route status | Local method status |
|---|---|---|
| `POST /api/arbitration/precedents/compare` | `API_ROUTE_MISSING` | `API_METHOD_UNKNOWN` |
| `POST /api/clause-library/compare` | `API_ROUTE_PRESENT` | `API_METHOD_PRESENT` |
| `POST /api/calendar-sync/connections/:dynamic/sync` | `API_ROUTE_DYNAMIC_BOUNDED` | `API_METHOD_PRESENT` |
| `GET /api/calendars/:dynamic/events` | `API_ROUTE_DYNAMIC_BOUNDED` | `API_METHOD_PRESENT` |

The precedent-compare request is a newly traced call instance for an already recorded missing local route pattern; it adds no distinct missing pattern. The closeout adds **4** calls to the historical **358**, for **362 reconciled observed call instances** (211 present, 106 dynamic-bounded, 43 missing, 2 unknown). Reconciled method observations are 307 present, 47 unknown, and 8 missing. These are separate reconciliation values, not replacements for b1 counts. All route and method results remain local source-inventory comparisons only.

## Limits and phase boundary

- No application behavior, routes, handlers, or configuration were changed.
- The callback closeout gate remains **FAIL / NOT PROVEN** because 109 bindings still have unknown terminal effects; see the exact residual records in the JSON closeout layer.
- No runtime journey, HTTP request, API implementation, persistence path, authorization rule, integration, or test fixture was evaluated.
- `API_ROUTE_PRESENT` and `API_METHOD_PRESENT` establish source inventory presence only; they do not establish semantics or reachability.
- `API_ROUTE_DYNAMIC_BOUNDED` establishes a normalized local route-family candidate only.
- Lexical false-success/product-theater fields in the JSON are heuristic review signals, not validated findings.
- **Phase 1A.2b1 only** is complete. Phase 1A.2b2, Phase 1B, and all remediation remain unstarted.

`ACTION_EFFECT_BOUNDARY_PROVEN` = NO · `ACTION_RUNTIME_PROVEN` = NO · `ACTION_PERSISTENCE_PROVEN` = NO · `ACTION_AUTHORIZATION_PROVEN` = NO · `PRODUCT_READY` = NO.
