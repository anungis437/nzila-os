# Full Secret Topology Sovereignty

> **Authority:** Sovereign secret identity per environment, with no implicit
> cross-environment lineage. Authorizes downstream PR `feat/secret-topology-isolation`.

> **Doctrine:** Every environment must possess sovereign secret identity,
> sovereign secret lineage, and sovereign runtime bindings. No environment
> may inherit operational identity from another environment.

---

## 1. Audit surface (Key Vault inventory)

| KV                          | Subscription scope             | RBAC model | Role                                    |
| --------------------------- | ------------------------------ | ---------- | --------------------------------------- |
| `nzila-staging-kv`          | `nzila-staging-rg`             | RBAC       | staging authority + DNS / domain config |
| `nzila-canada-demo-kv`      | `nzila-canada-demo-rg`         | RBAC       | demo authority — sovereign              |
| `nzila-canada-staging-kv`   | `nzila-canada-staging-rg`      | RBAC       | canada-staging authority                |
| (prod KV)                   | (deferred to Tier 3)           | n/a        | not in Tier 2 scope                     |

The Tier 2 sovereignty contract is: **demo container app references demo KV
only**. Staging KV may host DNS / domain config that is read once at
provisioning time, but no runtime container in `nzila-canada-demo-rg` may
hold a `keyvaultref` against `nzila-staging-kv`.

---

## 2. Secret families covered

The hardening scope is the union-eyes runtime contract surface:

- cognition secrets — `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_WHISPER_API_KEY`
- payment secrets — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- notification secrets — `RESEND_API_KEY`
- auth secrets — `AUTH_SECRET`, `AZURE_AD_CLIENT_SECRET`,
  `AUTH_WEBHOOK_SECRET`, `DJANGO_SECRET_KEY`, `JWT_SECRET_KEY`
- telemetry secrets — `CRON_SECRET`
- crypto secrets — `FALLBACK_ENCRYPTION_KEY`, `EVIDENCE_SEAL_KEY` (`pii-key`)
- AI provider secrets — covered by cognition above
- ephemeral runtime secrets — `UPSTASH_REDIS_REST_URL`,
  `UPSTASH_REDIS_REST_TOKEN`

Each family is sovereign per environment. Cross-environment fallback
resolution is forbidden. Implicit fallback to staging is forbidden. Orphaned
secret references in container apps must be removed (not left dormant).

---

## 3. Eliminations (executed against demo)

The following collapses were eliminated on May 9, 2026:

- shared secret lineage — demo container previously bound 13 keyvaultrefs to
  `nzila-staging-kv`; all 13 removed.
- staging-secret inheritance — demo now has 8 sovereign third-party clones
  (`stripe-key-demo`, `stripe-webhook-secret-demo`, `resend-key-demo`,
  `openai-key-demo`, `openai-whisper-key-demo`, `upstash-redis-url-demo`,
  `upstash-redis-token-demo`, `azure-ad-client-secret-demo`).
- implicit fallback secrets — none remain on the demo container.
- cross-environment secret resolution — verified zero `keyvaultref` URLs
  pointing outside `nzila-canada-demo-kv` (`Total: 17 | demo-kv: 17 |
  staging-kv: 0`).
- orphaned secret references — 13 staging-bound container secrets removed.

---

## 4. Sovereign runtime bindings

Demo container env vars rebound to demo KV refs:

```text
AZURE_AD_CLIENT_SECRET   → secretref:azure-ad-client-secret-demo
STRIPE_SECRET_KEY        → secretref:stripe-key-demo
STRIPE_WEBHOOK_SECRET    → secretref:stripe-webhook-secret-demo
RESEND_API_KEY           → secretref:resend-key-demo
AZURE_OPENAI_API_KEY     → secretref:openai-key-demo
AZURE_OPENAI_WHISPER_API_KEY → secretref:openai-whisper-key-demo
UPSTASH_REDIS_REST_URL   → secretref:upstash-redis-url-demo
UPSTASH_REDIS_REST_TOKEN → secretref:upstash-redis-token-demo
```

Topology lineage env vars added:

```text
SECRET_TOPOLOGY=isolated
SECRET_AUTHORITY=nzila-canada-demo-kv
ENVIRONMENT_ISOLATION=full
RUNTIME_FAIL_CLOSED=true
REVISION_TAG=demo-rev4-full-isolation
```

These three lineage markers are the **runtime evidence** that sovereignty
holds. The fail-closed gate (doc 01) verifies them at boot.

---

## 5. Anti-collapse guarantees

The hardening contract forbids:

- shared secret lineage across environments
- staging-secret inheritance via env-var fallback
- implicit fallback secrets ("if missing, try staging")
- cross-environment secret resolution at runtime
- orphaned secret references on container apps

A future container app deployed in `nzila-canada-demo-rg` that references
`nzila-staging-kv` is a doctrine violation and must be rejected at PR review.

---

## 6. Authorized downstream PR

`feat/secret-topology-isolation`: extends the same isolation contract to
the remaining apps in `nzila-canada-demo-rg` and `nzila-canada-staging-rg`,
adds an `az`-driven CI check (in `tooling/scripts/`) that fails when any
container app holds a cross-environment `keyvaultref`. No mass-rotation,
no churn — targeted closure of the remaining cross-tier collapse.

---

## 7. Verdict (live, May 9, 2026)

| Environment      | Container app                   | KV authority             | Cross-tier refs | Verdict        |
| ---------------- | ------------------------------- | ------------------------ | --------------- | -------------- |
| demo             | `nzila-os-union-eyes-demo`      | `nzila-canada-demo-kv`   | **0**           | GO             |
| canada-staging   | `nzila-os-union-eyes` et al.    | `nzila-staging-kv` (sov) | n/a (own KV)    | CONDITIONAL GO |
| dev              | (local)                         | `.env.local`             | n/a             | CONDITIONAL GO |
| pilot            | (no fabric)                     | n/a                      | n/a             | NO-GO          |

The terminal verdict is **operationally honest**: demo is sovereign;
canada-staging awaits the same enumerated audit; pilot has no fabric and
no secrets to isolate.
