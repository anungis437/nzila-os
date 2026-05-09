# 06 — Full Pilot Mode & Feature Flag Convergence

**Authority:** ACA env var inspection (UE staging + demo) + repo flag system.

---

## 1. Runtime Mode Env Vars (UE staging — confirmed live)

| Env var                  | Set?  | Source            |
|--------------------------|-------|-------------------|
| `NZILA_MODE`             | YES   | container env     |
| `UE_ENVIRONMENT`         | YES   | container env     |
| `NEXT_PUBLIC_APP_ENV`    | YES   | container env     |
| `UE_DEPLOYMENT_TYPE`     | YES   | container env     |
| `UE_FEATURE_PROFILE`     | YES   | container env     |

**Values:** Confirmed `valueSet: true` on staging app. Specific values not
read in this audit (avoid leaking environment configuration without operator
read-authorization).

---

## 2. Runtime Mode Env Vars (UE demo — confirmed live)

| Env var                  | Set?  |
|--------------------------|-------|
| `NZILA_MODE`             | YES   |
| `UE_ENVIRONMENT`         | YES   |
| `NEXT_PUBLIC_APP_ENV`    | YES   |
| `UE_DEPLOYMENT_TYPE`     | YES   |
| `UE_FEATURE_PROFILE`     | YES   |

> **Honest:** Demo HAS the mode flags but LACKS the secrets that downstream
> code may require when those flags request authenticated behavior. Demo can
> render mode-aware UX but cannot perform mode-gated mutations.

---

## 3. Feature Flag System (per `apps/union-eyes/lib/feature-flags.ts`)

| Flag type     | Behavior                                                  |
|---------------|-----------------------------------------------------------|
| `boolean`     | On/off                                                    |
| `percentage`  | Random rollout (hash bucket)                              |
| `tenant`      | Allowlist of `org_id`                                     |
| `user`        | Allowlist of `user_id`                                    |

Storage: `feature_flags` + `feature_flag_overrides` + `feature_flag_audit`.
Cache: in-process per request.
Verdict: LIVE.

---

## 4. Pilot Mode Reality

| Concern                                       | Verdict |
|-----------------------------------------------|---------|
| `pilot` value of `NZILA_MODE` recognised      | LIVE (per repo) |
| Pilot orgs tagged in staging DB               | LIVE (per `cupe-pilot-readiness.yml`) |
| Pilot users land on staging fabric URLs       | LIVE (no separate pilot fabric) |
| Pilot-mode UI banner / disclosure             | LIVE |
| Pilot-mode feature gating fail-closed         | LIVE |
| Pilot-mode telemetry segregation              | DEFERRED — no separate LAW |

---

## 5. Demo Mode Reality

| Concern                                       | Verdict |
|-----------------------------------------------|---------|
| `demo` value of `NZILA_MODE` recognised       | LIVE   |
| Demo "synthetic data" surface marker          | LIVE   |
| Demo cannot mutate non-demo data              | LIVE (org_id scoping) |
| Demo cannot send real emails                  | DEFERRED — no `RESEND_API_KEY` on demo container, so email is **inert** by default |
| Demo cannot trigger real Stripe              | DEFERRED — no Stripe key on demo |
| Demo data reset cron                          | MISSING |

> **Operational note:** The absence of secrets on the demo container ACTUALLY
> enforces "cannot send / cannot bill" behavior — a happy accident of
> incomplete provisioning. This must be made explicit (fail-closed) rather
> than relied on implicitly.

---

## 6. Role Redirects (per UE auth + middleware)

| Persona               | NZILA_MODE=staging      | NZILA_MODE=demo         | NZILA_MODE=pilot       |
|-----------------------|-------------------------|-------------------------|------------------------|
| `member`              | `/dashboard`            | `/dashboard?mode=demo`  | `/dashboard`           |
| `steward`             | `/dashboard/grievances` | same                    | same                   |
| `executive`           | `/dashboard/analytics`  | same                    | same                   |
| `admin`               | `/dashboard/admin`      | same                    | same                   |
| `auditor (read-only)` | `/dashboard/audit`      | same                    | same                   |
| `restrictedUxTester`  | `/sandbox`              | `/sandbox`              | n/a                    |

Source: live behavior verified by `auth-session-switch.spec.ts` +
`auditor-readonly.spec.ts` on staging.

---

## 7. Required Remediation (NOT auto-executed)

| # | Action                                                              | Authorization |
|---|---------------------------------------------------------------------|---------------|
| F1 | Make demo "no-secrets-no-mutation" posture explicit (fail-closed flag) | LOW (additive) |
| F2 | Add demo data reset cron                                           | YES |
| F3 | Add pilot telemetry segregation                                    | YES |
| F4 | Surface NZILA_MODE in `/api/health` for ops visibility             | LOW |

---

## 8. Findings

| # | Finding                                                            | Severity |
|---|--------------------------------------------------------------------|----------|
| 1 | Demo can render demo-mode UX but cannot mutate (de-facto fail-closed) | LIVE (positive) |
| 2 | Demo data reset is manual                                          | Medium   |
| 3 | No separate pilot Log Analytics workspace                          | Low      |
| 4 | Mode flags set on both tiers — coherent                            | LIVE     |

---

**Verdict for §6:** Pilot/demo mode runtime behavior is **LIVE** on staging;
**PARTIAL** on demo (mode flags work, mutations cannot). Pilot is logical-only.
