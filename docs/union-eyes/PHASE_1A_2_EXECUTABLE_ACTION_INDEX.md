# Phase 1A.2a — Executable UI Action Binding Index

**Gate: PASS — SOURCE BINDING CENSUS ONLY.** The accepted page universe and its static local UI import closure have been inventoried. Every direct event/action prop has a current source handler identity; unknown bindings: **0**. This does not establish runtime behavior or product readiness.

## Scope and method

The census starts from **343** page records in [the Phase 1A.1 index](./PHASE_1A_1_PAGE_AND_DISCOVERABILITY_INDEX.json), adds ancestor Next.js route-boundary files, and follows TypeScript-resolved local imports. It records one binding per JSX event/action prop at its source location. The canonical denominator is derived from this analysis, not from the historical markup scan. Candidate action bindings are controls classified as form submissions, server-action props, uploads, menu selections, non-obvious-navigation/non-obvious-state clicks, or component action callbacks. Logical families group candidate bindings by source file and handler identity; pairing is not proof of a shared business operation.

| Measure | Count |
|---|---:|
| Accepted page records | 343 |
| Static local source files | 1169 |
| Static UI source files | 720 |
| Executable binding occurrences | 1827 |
| Logical action families | 606 |
| Candidate action bindings | 644 |
| Unknown bindings | 0 |
| Distinct bulk-operation families (source-name heuristic) | 6 |
| Structurally paired confirmation-flow families | 0 |
| Families with mobile-route reachability | 7 |

### Binding classes

| Class | Count |
|---|---:|
| CLICK_ACTION_BINDING | 488 |
| CLIENT_STATE_ONLY | 253 |
| CLIENT_UI_BINDING | 118 |
| COMPONENT_ACTION_CALLBACK | 61 |
| FORM_OR_FILTER_VALUE_BINDING | 724 |
| FORM_SUBMISSION | 43 |
| MENU_SELECTION_BINDING | 41 |
| NAVIGATION_ONLY | 88 |
| UNKNOWN_BINDING | 0 |
| UPLOAD_BINDING | 11 |

### Candidate-binding audience distribution (non-exclusive)

Audience labels come from Phase 1A.1 and are propagated through static imports; because shared components can be imported from pages with different audiences, a binding may appear in multiple rows. This does not establish visibility or permissions.

| Audience class | Candidate bindings |
|---|---:|
| ADMIN | 141 |
| EXECUTIVE | 29 |
| MEMBER | 52 |
| MULTI_PERSONA_AUTHENTICATED | 444 |
| PUBLIC | 42 |
| STAFF | 43 |
| SYSTEM_INTERNAL | 7 |

### Candidate-binding source surface distribution

| Source surface | Candidate bindings |
|---|---:|
| ADMIN_DASHBOARD_ROUTE | 54 |
| APP_UI_MODULE | 38 |
| DASHBOARD_ROUTE | 80 |
| OTHER_APP_ROUTE | 9 |
| PUBLIC_MARKETING_ROUTE | 3 |
| PUBLIC_ROUTE | 3 |
| ROUTE_BOUNDARY | 3 |
| SHARED_COMPONENT | 453 |
| SYSTEM_INTERNAL_ROUTE | 1 |

## Historical markup scan reconciliation

The earlier scan's **1099 markup candidates** are diagnostic evidence, not the canonical denominator. **503** source records are inside the current static page/import closure and **596** outside. For historical unresolved-handler candidates, all **427** match a current source line/element and explicit handler identity; **182** are inside the canonical closure and **245** outside. The outside count remains **UNRECONCILED = 245** for active-scope reachability only; it is neither an unknown handler nor silently labeled inactive. The JSON includes the per-candidate crosswalk.

| Historical class | Total | In current closure | Outside current closure |
|---|---:|---:|---:|
| CLIENT_STATE_ONLY | 6 | 0 | 6 |
| INTENTIONALLY_DISABLED | 293 | 144 | 149 |
| NO_HANDLER | 373 | 177 | 196 |
| UNKNOWN | 427 | 182 | 245 |

## Suspicious-control signals and limits

- Historical no-handler markup in the active closure: **177**; historically disabled markup in the active closure: **144**. These remain source-scan classifications, not inferred business capabilities.
- Empty/null inline handlers: **2**; stub-like handler name/call signals: **0**; bound controls with disabled/aria-disabled attributes: **241**. These are review signals only.
- Repeated row/template controls are counted once per source binding pattern; runtime row cardinality is not inferred.
- Prop-forwarding spreads are not duplicate business-action entries; direct callback bindings are counted at explicit JSX sites.
- Handler bodies, API/server routes, persistence paths and authorization checks were not traced.

## Required status

`ACTION_SERVER_EFFECT_PROVEN` = NO · `ACTION_PERSISTENCE_PROVEN` = NO · `ACTION_AUTHORIZATION_PROVEN` = NO · `ACTION_RUNTIME_PROVEN` = NO · `PRODUCT_READY` = NO.

This closes Phase 1A.2a source binding census only. No action was executed, no remediation was applied, and Phase 1A.2b/1B was not started.
