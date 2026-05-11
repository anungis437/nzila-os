# R8 — Provider Key Rotation Cadence

> **Status: PARTIALLY CLOSED.** Rotation cadence + per-provider procedure shipped; first quarterly rotation scoped to `chore/r8-provider-key-rotation-q1`.

## Authority

This document is the canonical provider key rotation cadence for Nzila OS. Every external provider credential MUST rotate on a bounded cadence with reviewer-of-record attribution, KV mint sovereignty, deterministic substrate update, and post-rotation drill verification. Governance-safe, continuity-safe, anti-surveillance, evidence-anchored, reviewer-of-record bound. Operational, institutional, deterministic, bounded.

## 1. Rotation cadence matrix

| Provider | Cadence | Triggers (out-of-cadence) | KV residence | Post-rotation drill |
|---|---|---|---|---|
| **OpenAI** (gpt-4, embeddings, whisper) | quarterly | suspected key leak, vendor-mandated rotation, departing reviewer-of-record | per-env KV (`*/secrets/openai-api-key`, `*/secrets/azure-openai-whisper-api-key`) | R2 cognition degradation drill |
| **Resend** (email dispatch) | quarterly | suspected key leak, deliverability incident | per-env KV (`*/secrets/resend-api-key`) | R4 notification degradation drill |
| **Stripe** (billing) | semi-annual | webhook signing secret compromise, account ownership change | per-env KV (`*/secrets/stripe-secret-key`, `*/secrets/stripe-webhook-secret`) | end-to-end checkout drill |
| **Telemetry providers** (Sentry, OpenTelemetry collector keys) | semi-annual | new collector deploy, suspected leak | per-env KV (`*/secrets/sentry-dsn`, `*/secrets/otel-exporter-key`) | error-event ingestion smoke |
| **Clerk** | n/a | **Clerk migration complete; legacy keys purged 2026-04-05.** Documented under [Migration history](#migration-history). | n/a | n/a |

## 2. Migration history

**Clerk → `@nzila/platform-auth`** (complete, 2026-04-05). All Clerk secrets purged from KV; CLERK_* env vars removed from all 7 Container Apps; Django auth class aliases preserved for backward compatibility (`ClerkAPIKeyAuthentication = APIKeyAuthentication`). No Clerk key rotation cadence required; provider is decommissioned.

## 3. Per-provider rotation procedure

### 3.1 OpenAI (per resource)

```powershell
# 1. Mint new key in Azure portal (Cognitive Services → Keys → Regenerate Key 2)
# 2. Push to per-env KV (staging shown; repeat for demo / pilot)
az keyvault secret set --vault-name nzila-canada-staging-kv `
  --name azure-openai-api-key `
  --value "<new-key>"

# 3. Restart consumers (containers re-read on cold start)
az containerapp revision restart -g nzila-canada-staging-rg -n nzila-os-union-eyes
az containerapp revision restart -g nzila-canada-staging-rg -n nzila-os-console
# (repeat for all consumers per env)

# 4. Verify
Invoke-WebRequest -UseBasicParsing -Uri "https://staging.unioneyes.app/api/cognition/health"

# 5. Regenerate the OLD key (Key 1) only after verification — strict zero-downtime cutover
# 6. R2 cognition degradation drill — confirm bounded suppression on next planned outage simulation
```

### 3.2 Resend

```powershell
# 1. Mint new key in Resend dashboard
# 2. Push to per-env KV
az keyvault secret set --vault-name nzila-canada-staging-kv `
  --name resend-api-key --value "<new-key>"
# 3. Restart notification consumers
# 4. Test dispatch via internal webhook
# 5. Revoke old key in Resend dashboard
# 6. R4 notification degradation drill
```

### 3.3 Stripe

```powershell
# 1. Roll signing secret first (webhooks); verify webhook delivery before key rotation
# 2. Mint new restricted secret key in Stripe dashboard
# 3. Push both to per-env KV
# 4. Restart billing consumers
# 5. End-to-end checkout drill
# 6. Revoke old keys
```

### 3.4 Telemetry

```powershell
# 1. Mint new DSN / collector key
# 2. Push to per-env KV
# 3. Restart telemetry consumers
# 4. Error-event ingestion smoke
# 5. Revoke old key
```

## 4. Reviewer-of-record contract

Every rotation event MUST capture:

- **rotation reason** — scheduled cadence | leak | vendor-mandated | reviewer-of-record departure
- **reviewer-of-record signature** — GitHub username + UTC timestamp
- **old key fingerprint** — last 4 chars only (never full key)
- **new key fingerprint** — last 4 chars only
- **KV mint version** — `az keyvault secret show --version <id>` output
- **post-rotation drill artifact** — link to drill evidence directory

Rotation events are recorded in the chore PR description and append-only to `docs/nzila-residual-closure/rotation-log.md` (created by the first chore PR). The rotation log is the canonical reviewer-of-record artifact for cadence enforcement.

## 5. Anti-pattern enumeration (rejected)

- silent rotation without reviewer-of-record signature
- key rotation without post-rotation drill
- old-key revocation **before** new-key verification (downtime risk)
- single-env rotation when the same key is shared cross-env (sovereignty violation)
- storing keys outside KV (env vars set directly in container app spec without `keyvaultref`)
- recording full key fingerprints in any artifact

## 6. Cadence enforcement

The chore PR establishes a recurring calendar:

- **Q1** — OpenAI + Resend
- **Q2** — Stripe + Telemetry
- **Q3** — OpenAI + Resend
- **Q4** — Stripe + Telemetry + annual reviewer-of-record cohort review

## 7. Verdict

R8 cadence + per-provider procedure is **fully specified, evidence-anchored, reviewer-of-record bound**. First live rotation scoped to a discrete quarterly chore PR.

**Status: PARTIALLY CLOSED. Chore PR: `chore/r8-provider-key-rotation-q1` (recurring quarterly).**
