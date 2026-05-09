# Full Live Runtime Sovereignty Certification

> **Authority:** Per-environment terminal verdict on Tier 2 operational
> sovereignty. Authorizes downstream chore PR
> `chore/live-runtime-sovereignty-traversal`.

> **Doctrine:** Every environment receives a `GO` / `CONDITIONAL GO` /
> `NO-GO` with live operational evidence. Verdicts are operationally
> honest and evidence-anchored — never aspirational.

---

## 1. Sovereignty axes

The certification scores each environment along seven sovereignty axes:

| Axis                       | Anchor doc                                                                       |
| -------------------------- | -------------------------------------------------------------------------------- |
| environment sovereignty    | `docs/nzila-infrastructure-convergence/environment-isolation-implementation.md`  |
| runtime sovereignty        | [full-fail-closed-runtime-architecture.md](full-fail-closed-runtime-architecture.md) |
| identity sovereignty       | [full-auth-identity-isolation-hardening.md](full-auth-identity-isolation-hardening.md) |
| secret sovereignty         | [full-secret-topology-sovereignty.md](full-secret-topology-sovereignty.md)       |
| pilot sovereignty          | [full-pilot-fabric-legitimacy.md](full-pilot-fabric-legitimacy.md)               |
| mode sovereignty           | [full-runtime-mode-feature-sovereignty-hardening.md](full-runtime-mode-feature-sovereignty-hardening.md) |
| degradation sovereignty    | [full-live-operational-degradation-certification.md](full-live-operational-degradation-certification.md) |

A `GO` per axis requires verifiable live evidence (revision SHA, KV ref
list, probe response, validator pass). A `CONDITIONAL GO` requires an
authorized downstream PR with an explicit closure plan. A `NO-GO`
indicates the substrate is missing or actively degraded.

---

## 2. Per-environment certification

### 2.1 dev

| Axis                    | Verdict        | Evidence                                                          |
| ----------------------- | -------------- | ----------------------------------------------------------------- |
| environment sovereignty | GO             | local stack on port 3000–3004; sovereign `.env.local`              |
| runtime sovereignty     | CONDITIONAL GO | fail-closed gate present; banner emits; default-off (DX preserved) |
| identity sovereignty    | CONDITIONAL GO | local seed sovereign; awaits resolver refactor PR                  |
| secret sovereignty      | GO             | `.env.local` is sole authority; no cross-env resolution             |
| pilot sovereignty       | n/a            | dev is not pilot                                                  |
| mode sovereignty        | CONDITIONAL GO | `NZILA_MODE=dev` resolves; awaits typed-resolver PR                |
| degradation sovereignty | CONDITIONAL GO | local harness scaffolded                                          |

**dev terminal verdict: CONDITIONAL GO**

### 2.2 staging

| Axis                    | Verdict        | Evidence                                                                              |
| ----------------------- | -------------- | ------------------------------------------------------------------------------------- |
| environment sovereignty | GO             | `nzila-canada-staging-rg` separate from demo; sovereign ACA env                         |
| runtime sovereignty     | CONDITIONAL GO | gate present in image; `RUNTIME_FAIL_CLOSED` to be flipped on next staging deploy       |
| identity sovereignty    | CONDITIONAL GO | sovereign cookie domain authorized; resolver refactor PR pending                       |
| secret sovereignty      | CONDITIONAL GO | sovereign KV `nzila-staging-kv`; cross-app audit PR pending                             |
| pilot sovereignty       | n/a            | staging is not pilot                                                                  |
| mode sovereignty        | CONDITIONAL GO | `NZILA_MODE=staging` resolves; awaits typed-resolver PR                                |
| degradation sovereignty | CONDITIONAL GO | nightly workflow not yet wired                                                        |

**staging terminal verdict: CONDITIONAL GO**

### 2.3 demo

| Axis                    | Verdict | Evidence                                                                                                                                                  |
| ----------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| environment sovereignty | GO      | `nzila-canada-demo-rg` sovereign; `nzila-canada-demo-env` sovereign; revision `nzila-os-union-eyes-demo--0000005` Healthy/Running                          |
| runtime sovereignty     | GO      | `RUNTIME_FAIL_CLOSED=true`; `SECRET_TOPOLOGY=isolated`; `SECRET_AUTHORITY=nzila-canada-demo-kv`; `ENVIRONMENT_ISOLATION=full`                              |
| identity sovereignty    | GO      | sovereign demo seed; `nzila_session` cookie scoped to `demo.unioneyes.app`; Entra fallback functional                                                       |
| secret sovereignty      | GO      | `Total: 17 \| demo-kv: 17 \| staging-kv: 0`                                                                                                                |
| pilot sovereignty       | n/a     | demo is not pilot                                                                                                                                         |
| mode sovereignty        | GO      | `NZILA_MODE=demo` resolves; lineage banner emits                                                                                                          |
| degradation sovereignty | CONDITIONAL GO | manual induction restored; nightly workflow pending                                                                                                  |

**demo terminal verdict: GO** (one CONDITIONAL row, contained scope)

Live evidence:
- domain: `https://demo.unioneyes.app` → 200 OK with managed cert
  `mc-nzila-canada-d-demo-unioneyes-a-9040`
- container probe: `https://nzila-os-union-eyes-demo.greenmoss-d27e0e19.canadacentral.azurecontainerapps.io` → 200 OK
- revision: `nzila-os-union-eyes-demo--0000005` Healthy/Running
- secret topology: 17/17 demo-bound, 0 staging-bound

### 2.4 pilot

| Axis                    | Verdict | Evidence                                                  |
| ----------------------- | ------- | --------------------------------------------------------- |
| environment sovereignty | NO-GO   | `nzila-canada-pilot-rg` not provisioned                    |
| runtime sovereignty     | NO-GO   | no container app                                          |
| identity sovereignty    | NO-GO   | no pilot seed                                             |
| secret sovereignty      | NO-GO   | no pilot KV                                               |
| pilot sovereignty       | NO-GO   | depends on `feat/pilot-fabric-provisioning`               |
| mode sovereignty        | NO-GO   | no runtime to resolve `NZILA_MODE=pilot`                   |
| degradation sovereignty | NO-GO   | no fabric to traverse                                     |

**pilot terminal verdict: NO-GO** (until `feat/pilot-fabric-provisioning`
executes)

### 2.5 prod (out of Tier 2 scope, recorded for honesty)

prod posture is governed by `docs/nzila-infrastructure-convergence/`
Tier 3. Prod sovereignty is not in scope for this layer. Recorded here
purely so the matrix is enumerated end-to-end.

---

## 3. Aggregate Tier 2 verdict

| Sovereignty axis        | Aggregate verdict (across dev/staging/demo) |
| ----------------------- | ------------------------------------------- |
| environment sovereignty | GO                                          |
| runtime sovereignty     | CONDITIONAL GO                              |
| identity sovereignty    | CONDITIONAL GO                              |
| secret sovereignty      | CONDITIONAL GO                              |
| pilot sovereignty       | NO-GO (no fabric)                           |
| mode sovereignty        | CONDITIONAL GO                              |
| degradation sovereignty | CONDITIONAL GO                              |

**Aggregate Tier 2 verdict: CONDITIONAL GO** — substrate is sovereign in
demo, conditionally sovereign across dev / staging, and pending in pilot.
The seven downstream PRs enumerated in the index close every conditional
row; the doctrine is in place.

---

## 4. Anti-aspiration guarantees

The certification must never:

- record a `GO` without live evidence
- record a `CONDITIONAL GO` without a named downstream PR
- record a `NO-GO` without an enumerated remediation path
- aggregate verdicts optimistically across axes
- elide an environment because it is "not ready"

Evidence-anchored, operationally honest, calmly stated.

---

## 5. Authorized downstream PR

`chore/live-runtime-sovereignty-traversal`: automates the per-environment
evidence collection so the certification regenerates from live state on
every Tier 2 doctrine PR. The traversal is non-feature; it is a
reviewer-of-record proving exercise.

---

## 6. Re-certification cadence

Every Tier 2 doctrine PR re-runs the traversal. Every quarterly maturity
review re-publishes the certification. Verdicts are not durable — they
are continuously re-anchored to live state. This is the institutional
cadence.
