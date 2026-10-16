# Phase 1A.2b2 — Server/provider effect census

**Gate: FAIL_NOT_PROVEN — NOT_PROVEN.** The static census denominator reconciles; unresolved route, method, service, and terminal-effect chains remain unproven. This is not a runtime or readiness verdict.

## Scope and counts

| Measure | Count |
|---|---:|
| Canonical executable-action binding universe | 644 |
| Server/provider-bound bindings | 299 |
| B1 API_REQUEST bindings | 255 |
| B1 server-bound exports with API calls | 12 |
| B1 client-domain-service bindings | 12 |
| R1 HTTP-bound callbacks | 19 |
| R1 server-action bindings | 1 |
| HTTP request chains | 389 |
| Non-HTTP server/provider chains | 5 |
| Effect chains | 394 |
| Separate R1 carry-forward items (unchanged) | 40 |
| Local-only export bindings excluded | 10 |

**Binding arithmetic:** 255 B1 API_REQUEST + 12 B1 DOWNLOAD_OR_EXPORT with API request + 12 B1 CLIENT_DOMAIN_SERVICE + 19 R1 HTTP-bound callbacks + 1 R1 job-classification server action = 299 unique bindings.

**Chain arithmetic:** 358 B1 API request records + 8 API calls extracted from domain-service bindings + 23 R1 HTTP operations (19 bindings; four create/update bindings each expose POST and PATCH alternatives) + 4 non-HTTP domain/provider actions + 1 R1 job-classification server-action chain = 394 chains.

The 10 excluded local-only exports create browser blobs/object URLs and initiate local downloads; they do not establish a server/provider boundary. Detailed census membership and chain evidence are in [PHASE_1A_2_SERVER_EFFECT_INDEX.json](./PHASE_1A_2_SERVER_EFFECT_INDEX.json).

## Route and method observations

Current source observations across 389 HTTP chains: route statuses {"API_ROUTE_MISSING":44,"API_ROUTE_PRESENT":343,"API_ROUTE_UNKNOWN":2}; method statuses {"API_METHOD_MISSING":14,"API_METHOD_PRESENT":327,"API_METHOD_UNKNOWN":48}. Missing concrete methods: 14 call chains across 10 route/method shapes. Non-literal conditional methods are kept unknown rather than classified as missing. A missing local route or method is an observed source/inventory mismatch, not evidence of an external backend. Known examples include PATCH /api/analytics/insights (local route exports GET/POST) and POST /api/grievances/{id}/assign (local route exports PATCH).

A chain is terminally observed only where local route source shows a direct database/provider operation or a CRUD-factory route whose table target is statically visible. Imported helper/service chains without a terminal operation, absent routes/methods, and other unresolved source paths remain marked unresolved in JSON.

## Carry-forward and limits

The b1 carry-forward remains **40 items**: 23 source-trace candidates and 17 bindings without an in-repository component caller. Their IDs are copied unchanged into the additive JSON index; no attempt was made to close them here.

No application behavior was changed. No journeys, runtime calls, persistence checks, authorization checks, provider-availability checks, or audit-completeness checks were performed. Runtime readiness, successful persistence, authorization correctness, audit completeness, and end-to-end behavior remain NOT PROVEN.

The additive source-only route/effect reconciliation is recorded in [PHASE_1A_2B2_R1_TERMINAL_EFFECT_CLOSURE.md](./reality-remediation/PHASE_1A_2B2_R1_TERMINAL_EFFECT_CLOSURE.md). It preserves this census and its `FAIL_NOT_PROVEN` gate.

The additive source-only dispositions for the 154 chains left unestablished by R1 are recorded in [PHASE_1A_2B2_R2_EXACT_TERMINAL_DISPOSITIONS.md](./reality-remediation/PHASE_1A_2B2_R2_EXACT_TERMINAL_DISPOSITIONS.md), with the per-chain source record in [PHASE_1A_2B2_R2_EXACT_TERMINAL_DISPOSITIONS.json](./reality-remediation/PHASE_1A_2B2_R2_EXACT_TERMINAL_DISPOSITIONS.json). R2 preserves the accepted 394-chain census and does not change runtime readiness: `NO_GO — RUNTIME_PROOF_REQUIRED`.

The additive canonical-enum normalization of all 394 chains is recorded in [PHASE_1A_2B2_R2N_CANONICAL_EFFECT_NORMALIZATION.md](./reality-remediation/PHASE_1A_2B2_R2N_CANONICAL_EFFECT_NORMALIZATION.md), with the full row-level census and exact enum validation in [PHASE_1A_2B2_R2N_CANONICAL_EFFECT_NORMALIZATION.json](./reality-remediation/PHASE_1A_2B2_R2N_CANONICAL_EFFECT_NORMALIZATION.json). R2N preserves unresolved operation subtypes as `UNKNOWN_DATA_EFFECT`; its gate is `FAIL` until existing-evidence ambiguities are separately resolved.
