# Full Live Operational Degradation Certification

> **Authority:** Validate institutional behavior under degradation across
> dev, staging, demo, and pilot. Authorizes downstream chore PR
> `chore/live-degradation-traversal`.

> **Doctrine:** The runtime must increasingly behave like governed
> institutional infrastructure under stress — explicit, bounded,
> governance-safe, continuity-safe, operationally honest.

---

## 1. Degradation matrix

The certification covers the following enumerated degradations. Each
degradation is induced by removing or invalidating exactly one runtime
contract from the surface defined in
[full-fail-closed-runtime-architecture.md](full-fail-closed-runtime-architecture.md).

| # | Induced degradation              | How induced                                | Required runtime behavior                                       | Required degradation banner                            | Continuity safety                | Governance clarity                       | Operational boundedness                            | Fallback legitimacy                       |
| - | -------------------------------- | ------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------- | ---------------------------------------- | -------------------------------------------------- | ----------------------------------------- |
| 1 | missing env vars                 | unset `EVIDENCE_SEAL_KEY`                  | bounded runtime — sealing endpoints reject; rest serves         | `[runtime-fail-closed] crypto.pii: missing`            | open cases remain readable       | reviewer-of-record sees disposition       | sealing surface 503; non-sealing 200               | bounded — sealing disabled, rest legit    |
| 2 | disabled cognition               | unset `AZURE_OPENAI_API_KEY`               | cognition surfaces emit "cognition unavailable"; rest serves    | `[runtime-fail-closed] cognition: missing`              | continuity surfaces unaffected    | banner visible at `/admin/runtime/fail-closed` | cognition surfaces 503; rest 200                  | continuity-safe fallback                  |
| 3 | auth degradation                 | unset `AZURE_AD_CLIENT_SECRET`             | Entra path disabled; PG-session path continues                  | `[runtime-fail-closed] identity.entra.client_secret: missing` | sessions remain valid             | reviewer sees Entra disabled              | Entra surface 503; PG sessions 200                 | continuity-safe fallback                  |
| 4 | governance degradation           | governance runtime cannot bind             | governance surfaces read-only; mutations rejected               | `[governance] runtime degraded — read-only`             | open evidence remains readable    | reviewer sees governance disabled         | mutations 503; reads 200                           | read-only governance fallback              |
| 5 | notification degradation         | unset `RESEND_API_KEY`                     | notifications queued, banner emitted                            | `[notifications] degraded — queued for retry`           | mutations succeed                  | reviewer sees notification disabled        | notifications 503-internal; UI mutations 200       | continuity-safe fallback                  |
| 6 | telemetry degradation            | OTel endpoint unreachable                  | runtime continues; metrics buffered                             | `[telemetry] degraded — buffering`                      | requests unaffected                | reviewer sees telemetry disabled           | requests 200; telemetry buffered                   | bounded runtime                            |
| 7 | continuity degradation           | continuity substrate unhealthy             | continuity surfaces explicit-degradation banner; reads continue | `[continuity] degraded — bounded mutations`             | reads 200; mutations 503           | reviewer sees continuity disabled          | mutations 503; reads 200                           | continuity-safe fallback                  |
| 8 | secret resolution failure        | demo container loses RBAC on demo KV       | container fails health probe; ACA evicts replica                | `[runtime-fail-closed] data.database_url: missing` (or similar) | no service from this replica       | ACA shows replica unhealthy                | replica 0/1 ready                                  | fail-closed governance — boot refused      |

Eight degradations. Eight enumerated runtime behaviors. Eight enumerated
banners. The matrix is the certification surface; nothing extends it
silently.

---

## 2. Per-environment traversal

The traversal runs each degradation against each operative environment:

| Environment | Traversal mechanism                                                               | Notes                                                                                  |
| ----------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| dev         | local `pnpm test:degradation` against a local boot                                | runs in CI per-PR; fast feedback                                                       |
| staging     | `az containerapp update --remove-env-vars` + Playwright traversal; restored after | runs nightly via scheduled workflow; isolated revision label                           |
| demo        | same as staging, against `nzila-os-union-eyes-demo`                                | runs on doctrine PR + nightly; revision pin → restore                                  |
| pilot       | same as staging, against `nzila-os-union-eyes-pilot` (post-fabric)                | activated when pilot fabric exists per [doc 04](full-pilot-fabric-legitimacy.md)        |

Every traversal is **idempotent** — induce → verify → restore. No
traversal leaves the environment in a degraded state.

---

## 3. Required outputs

For each (environment, degradation) cell, the traversal emits a structured
evidence file under `proof-artifacts/tier2-degradation/<env>/<degradation>.json`:

```json
{
  "environment": "demo",
  "degradation": "disabled-cognition",
  "induced_at": "2026-05-09T20:15:33Z",
  "runtime_behavior": "cognition surface 503; rest 200",
  "degradation_banner": "[runtime-fail-closed] cognition: missing",
  "continuity_safety": "preserved",
  "governance_clarity": "reviewer banner present at /admin/runtime/fail-closed",
  "operational_boundedness": "cognition 503; non-cognition 200",
  "fallback_legitimacy": "continuity-safe fallback — bounded runtime",
  "restored_at": "2026-05-09T20:18:11Z"
}
```

The validator (doc 09) consumes these evidence files; missing or malformed
evidence is a NO-GO verdict.

---

## 4. Continuity-safe traversal

The traversal must never:

- leave a production-shaped environment degraded
- leak induced degradation to other tenants
- emit notifications to real recipients during the run
- accumulate in-memory state that survives the restore step

The traversal is operationally honest about its own scope: it is a
proving exercise, not a production drill.

---

## 5. Authorized downstream PR

`chore/live-degradation-traversal`: implements `pnpm test:degradation`,
adds the staging / demo nightly workflow, and wires evidence emission
into `proof-artifacts/`. The PR is non-feature; it is a substrate proving
exercise.

---

## 6. Verdict (live, May 9, 2026)

| Environment | Traversal status                         | Verdict                |
| ----------- | ---------------------------------------- | ---------------------- |
| dev         | local harness scaffolded                 | CONDITIONAL GO          |
| staging     | nightly workflow not yet wired           | CONDITIONAL GO          |
| demo        | manual induced (env removal, restored)    | CONDITIONAL GO          |
| pilot       | depends on pilot fabric                   | NO-GO (no fabric)       |

The terminal verdict is **continuity-safe but not yet automated**. The
authorized PR closes the conditional rows.
