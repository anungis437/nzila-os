# Phase 1A.2b2-R1 — terminal-effect source closure

**Gate: `FAIL_NOT_PROVEN`.** The accepted b2 census is reconciled at the chain level, but 154 terminal outcomes remain unestablished in source. This is a source-evidence classification, not a runtime or product-readiness verdict.

## Scope and reconciliation

This is an additive closure over the fixed [b2 server-effect census](../PHASE_1A_2_SERVER_EFFECT_INDEX.md), not a rebuilt census. The JSON record contains one classification for each accepted chain ID and binding ID, plus route/method source observations and bounded source-trace references: [PHASE_1A_2B2_R1_TERMINAL_EFFECT_CLOSURE.json](./PHASE_1A_2B2_R1_TERMINAL_EFFECT_CLOSURE.json).

| Measure | Count |
|---|---:|
| Accepted executable-action bindings | 644 |
| Accepted server/provider-bound bindings | 299 |
| Accepted effect chains | 394 |
| Chains classified in this closure | 394 |
| HTTP request chains | 389 |
| Non-HTTP server/provider chains | 5 |
| Terminal effects previously source-observed | 237 |
| Database-operation chains previously source-observed | 3 |
| Terminal chains still not established | 154 |
| Unresolved HTTP route/method roots with bounded AST trace | 64 of 79 |
| Chains linked to those bounded traces | 90 |
| Unchanged b1 carry-forward items | 40 (23 trace candidates + 17 no-caller) |

Chain IDs and binding IDs were copied from b2. The two carry-forward ID arrays are copied unchanged from b2 and remain separate from the 394-chain denominator. The historical b2 result remains `FAIL_NOT_PROVEN`; this record does not supersede it.

## Normalized observations

For each HTTP chain, the requested route-family target and method are retained independently from the local route/method mapping. The resulting local mapping classes are:

| Local source mapping | Chains |
|---|---:|
| Route and method matched | 327 |
| Local route absent | 44 |
| Local method absent | 14 |
| Local route/method mapping unconfirmed | 4 |

An absent local route or method is not evidence of an external backend. The request target remains known from the call site, while the local implementation mapping is explicitly absent or unconfirmed.

The data-effect classification retains the accepted b2 assessment without upgrading it:

| Data-effect source classification | Chains |
|---|---:|
| Database target and operation source-observed | 3 |
| Terminal data/provider effect source-observed; detail not normalized in R1 | 237 |
| Imported service terminal effect not established | 42 |
| Local route/method implementation not established | 58 |
| Terminal data/provider effect not established in source | 52 |
| Provider/server-action implementation not traced | 2 |

The last four categories total 154. The bounded trace roots preserve observed operation calls and source references, and separately record authorization, organization-scope, audit, and provider-call evidence where captured. A source call is not proof of its correctness or completeness. Where the bounded trace did not capture a category, the record says it was not traced or was not found by that bounded trace; it does not infer global absence.

All 389 HTTP chains retain source request facts and explicitly mark response proof as unobserved by the census. Across every chain, persistence success, authorization correctness, organization isolation, audit completeness, provider success, and runtime behavior remain unproven.

The normalized taxonomy has **zero `UNKNOWN_SERVER_TARGET` and zero `UNKNOWN_DATA_EFFECT` labels** because every record is assigned an explicit observed, absent, unconfirmed, not-traced, or not-established state. This does **not** mean effects are resolved: the 154 unestablished chains remain visible and keep the gate at `FAIL_NOT_PROVEN`.

## Boundaries

- No product or application code was changed.
- No app was run; no runtime requests, database writes, journey tests, or provider calls were made.
- No persistence success, response behavior, authorization correctness, organization-scope correctness, or audit completeness is claimed.
- The current Union Eyes operational readiness ruling remains `NO_GO — RUNTIME_PROOF_REQUIRED`.
- The 40 b1 carry-forward items remain unchanged; this closure does not attempt to close them.
