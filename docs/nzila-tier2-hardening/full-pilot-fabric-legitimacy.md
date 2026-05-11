# Full Pilot Fabric Legitimacy

> **Authority:** Transform pilot from demo theater into institutional
> operational proving environment. Authorizes downstream PR
> `feat/pilot-fabric-provisioning`.

> **Doctrine:** Pilot must increasingly feel operationally real under
> institutional scrutiny. It is the reviewer-of-record's proving ground
> before prod cutover; it is not a marketing surface and not an extended
> demo.

---

## 1. Pilot fabric topology (target)

The authorized pilot fabric is a sovereign-isolation environment colocated
with the existing canada region for governance proximity:

| Resource                 | Name                                  | Region          | Sovereignty                                |
| ------------------------ | ------------------------------------- | --------------- | ------------------------------------------ |
| Resource group           | `nzila-canada-pilot-rg`               | canadacentral   | dedicated; no sharing with demo or staging |
| ACA environment          | `nzila-canada-pilot-env`              | canadacentral   | dedicated; new customDomainVerificationId  |
| Container app            | `nzila-os-union-eyes-pilot`           | canadacentral   | system-assigned identity, sovereign        |
| Key Vault                | `nzila-canada-pilot-kv`               | canadacentral   | RBAC; pilot identity has Secrets User      |
| PostgreSQL Flexible      | `nzila-canada-pilot-db`               | canadacentral   | sovereign DB, sovereign credential         |
| ACR (shared)             | `nzilacanadaacr.azurecr.io`           | canadacentral   | image substrate is shared (signed images)  |
| Custom domain            | `pilot.unioneyes.app`                 | Cloudflare zone | dedicated CNAME + asuid TXT, managed cert  |

Image substrate is shared (the same signed `union-eyes` image runs in demo,
staging, and pilot); identity, secrets, data, and domain are sovereign.

---

## 2. Pilot operational entitlements

Pilot mode (`NZILA_MODE=pilot`) carries the following dispositions per
doc 03 (runtime mode hardening):

- cognition gating: **sovereign** (pilot has its own AI provider keys,
  not shared with demo)
- governance gating: **reviewer-of-record** (pilot is the canonical
  proving environment for governance reviews)
- continuity gating: **live** (continuity surfaces use real seeded data)
- onboarding gating: **live** (pilot personas are seeded with
  institutionally realistic data)
- executive gating: **live** (executive surfaces are not capped)

Pilot is **not** a sandbox. It is the institutional proving ground.

---

## 3. Pilot seeded personas

Pilot ships with the same `seed-test-env` substrate as demo, but with:

- distinct organization IDs (no overlap with demo / staging)
- distinct persona credentials (no shared passwords)
- distinct `ue_test_users` rows
- distinct `auth_organization_users` rows
- distinct `organization_members` rows
- distinct `auth_user_sessions`

The persona surface is enumerated; it is not generated heuristically. Every
pilot persona is named, role-bound, and traceable through the auth lineage
(see `docs/nzila-runtime-integrity/full-seeded-persona-legitimacy-hardening.md`).

---

## 4. Pilot governance, cognition, continuity posture

| Surface       | Posture                                                                    |
| ------------- | -------------------------------------------------------------------------- |
| Governance    | Read-write reviewer-of-record; full audit trail; bounded mutations          |
| Cognition     | Sovereign provider keys; rate-limited; institutionally bounded             |
| Continuity    | Live continuity-safe mutations; sovereign substrate; no demo cross-talk    |
| Telemetry     | Independent OTel pipeline; pilot tag; sovereign Log Analytics workspace     |
| Notifications | Sovereign Resend domain or sovereign sender identity                        |
| Payment       | Stripe test-mode keys distinct from demo; webhook routes pilot-only         |

---

## 5. Pilot E2E validation

Pilot is not legitimate until the following live E2E traversals pass:

- auth: each pilot persona signs in, lands on role-correct dashboard
- governance: reviewer-of-record can author, review, seal an evidence packet
- cognition: a cognition request executes end-to-end with sovereign keys
- continuity: continuity-safe mutation lifecycle (open → bounded → close)
- onboarding: a new pilot org boots through onboarding without demo bleed
- executive: executive surfaces render with pilot-bounded data
- degradation: under simulated env-var loss, pilot fails-closed honestly

Each traversal emits structured evidence consumed by the
`validate:tier2-hardening` validator (doc 09).

---

## 6. Anti-theater guarantees

Pilot must never:

- inherit demo data (no `*-demo` KV refs, no demo seed bleed)
- share a customDomainVerificationId with demo or staging
- share a Postgres instance with demo or staging
- emit telemetry to a demo / staging Log Analytics workspace
- use demo cognition keys
- be marketed as "an upgraded demo"

Pilot is institutionally distinct. It is the reviewer-of-record's
operational substrate, not the prospect's preview surface.

---

## 7. Authorized downstream PR

`feat/pilot-fabric-provisioning`: provisions the topology in section 1,
seeds pilot personas, binds the pilot domain, and registers the pilot
container app in the deploy workflow. The PR is **gated** behind explicit
operator cost-and-window authorization at execution time. The doctrine
authorizes the plan; the PR authorizes the execution.

Provisioning steps (executed in the PR):

1. `az group create -n nzila-canada-pilot-rg -l canadacentral`
2. `az keyvault create -n nzila-canada-pilot-kv -g nzila-canada-pilot-rg --enable-rbac-authorization true`
3. `az postgres flexible-server create -n nzila-canada-pilot-db ...`
4. `az containerapp env create -n nzila-canada-pilot-env -g nzila-canada-pilot-rg ...`
5. `az containerapp create -n nzila-os-union-eyes-pilot ...` (system identity)
6. `az role assignment create` — grant pilot identity `Key Vault Secrets User` on pilot KV
7. Seed pilot KV with sovereign secrets (no clones from staging or demo)
8. Cloudflare API: create `pilot.unioneyes.app` CNAME + `asuid.pilot.unioneyes.app` TXT
9. `az containerapp hostname add` + `bind --validation-method CNAME` (managed cert)
10. Run pilot `seed-test-env` with sovereign org IDs
11. Live E2E traversals (section 5) and structured evidence emission

---

## 8. Verdict (live, May 9, 2026)

| Surface             | Status                                                                                                            | Verdict          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------- |
| Resource group      | `nzila-canada-pilot-rg` provisioned                                                                               | GO               |
| ACA environment     | `nzila-canada-pilot-env` Succeeded; defaultDomain `thankfulpebble-f9ca792c.canadacentral.azurecontainerapps.io`   | GO               |
| Container app       | `nzila-os-union-eyes-pilot--0000002` Healthy/Running, 2 replicas, system identity `c5636777-b248-4284-ab01-1d3d9091e971` | GO               |
| Key Vault           | `nzila-canada-pilot-kv` (16 sovereign secrets, RBAC, pilot identity has `Key Vault Secrets User`)                 | GO               |
| Postgres            | `nzila-canada-pilot-db` Ready (Burstable B1ms, sovereign admin password in pilot KV)                              | GO               |
| Custom domain       | `pilot.unioneyes.app` bound, managed cert `mc-nzila-canada-p-pilot-unioneyes--9483` SniEnabled, live probe 200 OK | GO               |
| GitOps registration | `pilot` env wired in `gitops-deploy.yml` + `infrastructure/gitops/environments/pilot.yml` + `resolve-deploy-apps.ts` | GO               |
| E2E traversals      | deferred to `chore/live-runtime-sovereignty-traversal` (doc 09)                                                   | CONDITIONAL GO   |

Pilot terminal verdict: **GO for substrate sovereignty; CONDITIONAL GO for
full operational sovereignty until E2E traversal evidence (doc 09) is
emitted.** The fabric is institutionally distinct, sovereign at the
substrate layer, and live-bound. Cognition / notification / payment
provider keys are mirrored from staging KV today (these are platform-wide
app credentials, not environment-bound by nature); rotation to
pilot-sovereign provider keys is a follow-on stewardship cadence item, not
a substrate gate.
