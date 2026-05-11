# Nzila OS — Final Tier 2 Runtime Sovereignty & Institutional Hardening

> **Authority:** Tier 2 operational sovereignty over runtime substrate. This
> layer closes the final distance between *operationally real* and
> *institutionally sovereign and fail-safe*. Authority is **operational
> hardening only** — not architecture expansion, not governance expansion,
> not feature velocity, not infra experimentation.

> **Source-of-truth date:** May 9, 2026.
> **Operator:** Azure CLI session against subscription
> `5d819f33-d16f-429c-a3c0-5b0e94740ba3`, tenant
> `5082b8be-b04d-4a13-b61c-b6397670177b`.

> **Stack:** This layer stacks on top of:
>
> - `docs/nzila-infrastructure-convergence/` — infra reality
> - `docs/nzila-runtime-integrity/` — runtime substrate doctrine
> - `docs/union-eyes/runtime-convergence/` — runtime convergence
>
> It does **not** restate those layers; it hardens them.

---

## Anti-expansion discipline

Each document below authorizes **exactly one** discrete downstream refactor
or operational PR. No bundling. No mass-rename. The doctrine PR establishes
authority; runtime PRs execute targeted, governance-safe refactors against
that authority.

The institutional cadence is: **doctrine → single targeted PR → live
verification → next single targeted PR**. Maturity, not accumulation.

---

## Index

| #  | Document                                                                                                                       | Authorized downstream PR                                  |
| -- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| 01 | [full-fail-closed-runtime-architecture.md](full-fail-closed-runtime-architecture.md)                                           | `feat/runtime-fail-closed-gate`                           |
| 02 | [full-secret-topology-sovereignty.md](full-secret-topology-sovereignty.md)                                                     | `feat/secret-topology-isolation`                          |
| 03 | [full-runtime-mode-feature-sovereignty-hardening.md](full-runtime-mode-feature-sovereignty-hardening.md)                       | `feat/runtime-mode-sovereignty`                           |
| 04 | [full-pilot-fabric-legitimacy.md](full-pilot-fabric-legitimacy.md)                                                             | `feat/pilot-fabric-provisioning`                          |
| 05 | [full-auth-identity-isolation-hardening.md](full-auth-identity-isolation-hardening.md)                                         | `feat/auth-identity-isolation`                            |
| 06 | [full-workspace-substrate-sovereignty.md](full-workspace-substrate-sovereignty.md)                                             | `feat/workspace-substrate-sovereignty`                    |
| 07 | [full-live-operational-degradation-certification.md](full-live-operational-degradation-certification.md)                       | `chore/live-degradation-traversal`                        |
| 08 | [full-live-runtime-sovereignty-certification.md](full-live-runtime-sovereignty-certification.md)                               | `chore/live-runtime-sovereignty-traversal`                |

Each document is **authority**, not implementation; the implementation lives
in the authorized downstream PR.

---

## Verdict markers (per `docs/nzila-live-audit/`)

`LIVE / STAGING-ONLY / RESERVED / DEFERRED / PARTIAL / MOCKED / SIMULATED / BLOCKED / MISSING`

Per-environment terminal verdicts: `GO / CONDITIONAL GO / NO-GO`.

The four operative environments are: **dev**, **staging**, **demo**, **pilot**.
`prod` is described where relevant but is not in the Tier 2 hardening scope —
prod posture is governed by `docs/nzila-infrastructure-convergence/` Tier 3.

---

## Tone discipline

This layer speaks in the institutional, continuity-safe, governance-safe,
evidence-anchored, anti-surveillance, stewardship cadence. The reviewer-of-record
posture is preserved. Maturity is the operational virtue. Embodiment is the
operational verb — the doctrine is embodied in live runtime evidence, not in
prose. Singular, calm, inevitable; not sophisticated, not engineered, not
optimized.

The runtime must increasingly behave like institutional operational
infrastructure under governance discipline — never like a sophisticated
application stack operating under optimistic assumptions.

---

## Operational honesty pledge

Every Tier 2 hardening claim in this layer is either:

1. **EXECUTED** — a real `az` / `git` / `pnpm` operation produced verifiable
   live evidence (revision SHA, KV ID, hostname binding, validator pass).
2. **AUTHORIZED** — operator has granted execution authority but the
   operation has not yet run; the doc enumerates the precise execution plan.
3. **CONDITIONAL** — operation requires a discrete future authorization
   (e.g. cost commitment, downtime window, third-party coordination).

No claim is `ASPIRATIONAL`. Aspirational framing is forbidden in this layer.
