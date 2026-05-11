# Full Fail-Closed Runtime Architecture

> **Authority:** Governance-safe runtime degradation across the union-eyes
> runtime substrate. Authorizes downstream PR `feat/runtime-fail-closed-gate`.

> **Doctrine:** The runtime must degrade **honestly**, remain **bounded**,
> preserve **operational integrity**, preserve **governance clarity**, and
> preserve **continuity safety**. The runtime must never silently partially
> operate, never fake operational legitimacy, never fail-open into ambiguity,
> and never hide governance degradation.

---

## 1. Audit surface (canonical)

The fail-closed gate must inspect, at boot, every runtime contract that
governs whether the runtime is **institutionally** entitled to serve traffic:

| Contract                         | Required env                                 | Failure disposition                              |
| -------------------------------- | -------------------------------------------- | ------------------------------------------------ |
| `auth.next.secret`               | `AUTH_SECRET`                                | fail-closed governance — boot refused             |
| `auth.django.secret`             | `DJANGO_SECRET_KEY`                          | fail-closed governance — boot refused             |
| `auth.webhook.secret`            | `AUTH_WEBHOOK_SECRET`                        | bounded runtime — webhooks rejected               |
| `crypto.fallback`                | `FALLBACK_ENCRYPTION_KEY`                    | fail-closed governance — boot refused             |
| `crypto.pii`                     | `EVIDENCE_SEAL_KEY`                          | bounded runtime — sealing endpoints disabled      |
| `identity.entra.client_id`       | `AZURE_AD_CLIENT_ID`                         | continuity-safe fallback — Entra path disabled    |
| `identity.entra.tenant_id`       | `AZURE_AD_TENANT_ID`                         | continuity-safe fallback — Entra path disabled    |
| `identity.entra.client_secret`   | `AZURE_AD_CLIENT_SECRET`                     | continuity-safe fallback — Entra path disabled    |
| `data.database_url`              | `DATABASE_URL`                               | fail-closed governance — boot refused             |
| `lineage.secret_topology`        | `SECRET_TOPOLOGY`                            | explicit degradation — banner emitted             |
| `lineage.secret_authority`       | `SECRET_AUTHORITY`                           | explicit degradation — banner emitted             |
| `lineage.environment_isolation`  | `ENVIRONMENT_ISOLATION`                      | explicit degradation — banner emitted             |

The audit surface is **enumerated**; it is not pluggable. New contracts are
added by amending this table and the validator.

---

## 2. Runtime gate

The gate lives at `apps/union-eyes/lib/runtime/fail-closed.ts`. It exposes:

- `assessRuntimeContracts()` — pure function returning the assessment
  envelope (every contract, status, message). Always safe to call.
- `enforceRuntimeFailClosed()` — boot-time enforcement. Throws
  `RuntimeContractError` when `RUNTIME_FAIL_CLOSED=true` and any contract
  is unmet. Otherwise emits an explicit degradation banner and returns the
  assessment so callers can render the bounded-runtime state.
- `RuntimeContractError` — a discriminable error type carrying the structured
  report so the calling layer (`instrumentation.ts`) does not have to parse
  strings.

The gate is wired into `apps/union-eyes/instrumentation.ts` immediately after
the legacy env-validation block and before the database / Redis startup
checks. Failure surfaces **before** the request lifecycle begins.

---

## 3. Bounded degradation states

When `RUNTIME_FAIL_CLOSED` is unset (dev) or set to `false`, the runtime
emits a structured degradation banner instead of refusing boot. The banner
enumerates every unmet contract and the operationally honest disposition:

```text
[runtime-fail-closed] degraded boot — RUNTIME_FAIL_CLOSED=false
- crypto.pii: missing EVIDENCE_SEAL_KEY → bounded runtime (sealing disabled)
- identity.entra.client_secret: missing → continuity-safe fallback (Entra disabled)
```

The dashboard renders the same banner under
`/admin/runtime/fail-closed` (read-only governance fallback) so the
reviewer-of-record can inspect runtime entitlement without shell access.

---

## 4. Targeted scope

The gate covers union-eyes (the institutional flagship) in v1. Other apps
(`zonga`, `partners`, `console`, `web`) inherit the lineage env vars
(`SECRET_TOPOLOGY`, `SECRET_AUTHORITY`, `ENVIRONMENT_ISOLATION`) but their
contract tables are deferred to dedicated downstream PRs. This is anti-
expansion discipline: one gate, one app, one PR.

---

## 5. Anti-fail-open guarantees

The gate must never:

- silently partially operate
- fake operational legitimacy
- fail-open into ambiguity
- hide governance degradation
- continue past `enforceRuntimeFailClosed()` when it threw

These five negations are the operational floor of the layer.

---

## 6. Authorized downstream PR

`feat/runtime-fail-closed-gate`: implements the gate, the
`apps/union-eyes/lib/runtime/fail-closed.ts` module, and the instrumentation
hook. Adds vitest coverage for `assessRuntimeContracts()` (each contract,
each disposition). Wires `RUNTIME_FAIL_CLOSED=true` into demo and staging
container apps as part of the PR rollout. No mass-rename, no scope creep.

---

## 7. Verdict (live, May 9, 2026)

| Environment | RUNTIME_FAIL_CLOSED | Verdict           | Evidence                                                                  |
| ----------- | ------------------- | ----------------- | ------------------------------------------------------------------------- |
| dev         | unset               | CONDITIONAL GO    | gate present, banner emits; default-off preserves local DX                |
| staging     | `false`             | CONDITIONAL GO    | gate present, banner emits; awaits flip in next deploy                    |
| demo        | `true`              | GO                | gate present, fail-closed enforced (revision `--0000005` Healthy/Running) |
| pilot       | n/a                 | NO-GO (no fabric) | pilot fabric not yet provisioned — see doc 04                             |

The terminal verdict is **continuity-safe**: degraded runtimes are bounded,
governance is preserved, and operational honesty is intact across the four
environments enumerated above.
