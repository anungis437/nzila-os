# Full Runtime Mode & Feature-Sovereignty Hardening

> **Authority:** Deterministic operational modes. Authorizes downstream PR
> `feat/runtime-mode-sovereignty`.

> **Doctrine:** Every runtime mode must behave institutionally intentionally.
> Mode resolution must be deterministic, fallback must be governance-safe,
> and invalid modes must fail-closed — never silently default into ambiguity.

---

## 1. Audit surface

The runtime mode lineage is governed by `NZILA_MODE` plus a small set of
gating env vars enumerated below. The legitimate modes are:

| Mode                | NZILA_MODE     | Cognition gating | Governance gating | Continuity gating | Onboarding gating | Executive gating |
| ------------------- | -------------- | ---------------- | ----------------- | ----------------- | ----------------- | ---------------- |
| dev                 | `dev`          | local-only       | open              | mock              | seeded            | seeded           |
| staging             | `staging`      | shared           | open              | live              | live              | live             |
| demo                | `demo`         | shared (capped)  | bounded           | mock              | seeded            | seeded           |
| pilot               | `pilot`        | sovereign        | reviewer-of-record | live              | live              | live             |
| prod                | `prod`         | sovereign        | reviewer-of-record | live              | live              | live             |

The gating columns are operational entitlements. They are **not** feature
flags in the marketing sense; they are governance dispositions. A mode is
not a UI theme — it is an operational entitlement contract.

---

## 2. Required hardening

The runtime mode resolver (`apps/union-eyes/lib/config/pilot-demo-runtime.ts`
and the broader `lib/config/env-validation.ts` surface) must be hardened to:

- **Deterministic resolution** — exactly one canonical mode per boot. The
  resolver returns `runtimeMode`, `normalizedMode`, `isKnownMode`,
  `allowsDemoMutations`, and `startupMessage`. No path produces an
  uncategorized state.
- **Governance-safe fallback** — when `NZILA_MODE` is absent, the resolver
  must default to the **most restrictive** mode (`prod` posture without
  prod entitlement), never the most permissive. The current `dev` default
  is acceptable in development containers but forbidden in container apps.
- **Invalid mode handling** — when `NZILA_MODE` is present but not in the
  enumerated table, the resolver must mark `isKnownMode=false` and log
  loudly; the fail-closed gate (doc 01) treats this as a `lineage` contract
  failure and refuses boot under `RUNTIME_FAIL_CLOSED=true`.
- **Fail-closed mode behavior** — under `RUNTIME_FAIL_CLOSED=true`, an
  unknown or missing `NZILA_MODE` is a boot-refusal condition. Under
  `RUNTIME_FAIL_CLOSED=false`, the runtime emits an explicit degradation
  banner and continues in the most-restrictive disposition.

---

## 3. Deterministic gating

Each gating column above is implemented as a single resolver function whose
return value is **discriminable** (a typed union, not a boolean flag salad).
The resolver is colocated with mode resolution; runtime callers consume the
typed gate rather than reading `process.env` directly.

This is the anti-ambiguity contract: gating decisions never live in business
logic. They live in the mode resolver, which is the canonical operational
authority for entitlement.

---

## 4. Mode lineage broadcast

Every successful boot logs the canonical mode lineage banner once:

```text
[runtime-mode] mode=demo authority=nzila-canada-demo-kv isolation=full fail-closed=true revision=demo-rev4-full-isolation
```

This banner is also surfaced at `/admin/runtime/mode` (read-only governance
fallback). The reviewer-of-record can confirm mode entitlement without shell
access — the operational substrate publishes its own legitimacy.

---

## 5. Anti-mode-drift guarantees

The hardening contract forbids:

- runtime modes that are silently selected from heuristics (URL host,
  request header, user agent, etc.)
- modes that mutate at request time
- modes that depend on undocumented env vars
- modes whose entitlement set is computed in the request path
- demo entitlements leaking into staging or pilot
- pilot entitlements leaking into prod

Mode is a **boot-time identity**, not a request-time property.

---

## 6. Authorized downstream PR

`feat/runtime-mode-sovereignty`: refactors the resolver into a single typed
discriminated union, adds vitest coverage for every (mode, gating) pair,
and removes any business-logic call site that reads `NZILA_MODE` directly.
No new modes are introduced. No marketing-flag plumbing is added.

---

## 7. Verdict (live, May 9, 2026)

| Environment | Mode resolved | Lineage banner | Fail-closed verdict     |
| ----------- | ------------- | -------------- | ----------------------- |
| dev         | `dev`         | local only     | CONDITIONAL GO          |
| staging     | `staging`     | shared         | CONDITIONAL GO          |
| demo        | `demo`        | live, isolated | GO                       |
| pilot       | (no fabric)   | n/a            | NO-GO (no fabric)        |

The terminal verdict is **deterministic**: demo holds the institutionally
intentional disposition; staging requires the resolver refactor PR; pilot
awaits fabric provisioning before mode lineage applies.
