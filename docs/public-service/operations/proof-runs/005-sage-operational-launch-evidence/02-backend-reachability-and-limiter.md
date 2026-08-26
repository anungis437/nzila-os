# 02 — Backend Reachability and Limiter Adapter (staging Upstash)

## Purpose

SAGE's rate-sensitive delivery operations are designed to fail closed against a
distributed Redis limiter. This section records two things against the **real
staging Upstash backend**: basic key-lifecycle reachability, and — more
importantly — the behaviour of the **actual production limiter adapter**
(`checkDistributedRateLimit` from `@nzila/os-core`).

Credentials (`upstash-redis-url`, `upstash-redis-token`) were read from
`nzila-staging-kv` into process environment only and never printed. All keys were
synthetic (`sage:proof005:*`) and either deleted or given a short TTL.

## A. Backend connectivity — PASS

| Assertion | Outcome |
| --- | --- |
| `SET ... EX 30` acknowledged (`OK`) | true |
| `GET` returns the exact written marker | true |
| `TTL` positive and bounded (0 < ttl ≤ 30) | true |
| `DEL` removes exactly one key | true |
| `GET` after `DEL` returns absent | true |

## B. Real limiter adapter — PASS

The actual production adapter was invoked against staging Upstash:

| Scenario | Result |
| --- | --- |
| Threshold enforcement (limit 3, sequential) | `allow, allow, allow, deny(60s)` — PASS |
| Concurrency (limit 5, 12 concurrent) | exactly **5** allowed via atomic Lua `INCR`+`EXPIRE` — PASS |
| Fail-closed on invalid token | `allowed = false` — PASS |
| Fail-closed on unreachable endpoint | `allowed = false` — PASS |

The adapter is fail-closed **by construction**: it returns `{ allowed: false }`
on any non-OK response, malformed payload, or thrown error, with **no local
in-memory counter**. The atomic Lua script (`INCR` + first-write `EXPIRE` + `TTL`)
enforces a shared fixed window across callers, which the concurrency result
confirms.

## Precise wording for the gate reassessment

```
Staging Redis backend connectivity:          PASS
Basic TTL/key lifecycle:                      PASS
Real limiter adapter — threshold:             PASS (against staging Upstash)
Real limiter adapter — concurrency:           PASS (exactly limit allowed)
Real limiter adapter — fail-closed:           PASS (bad token + unreachable)
SAGE application composition (deployed):      NOT_EXECUTED (no deployed surface)
No in-memory production fallback (deployed):  adapter is fail-closed by construction;
                                              deployed-app behaviour NOT_EXECUTED
```

G7 (notification operational resilience) and G14 (performance & reliability) are
strengthened by this evidence but remain `PASS_WITH_CONDITIONS`: the deployed
application composition and end-to-end behaviour are not exercised because no
SAGE surface is deployed.
