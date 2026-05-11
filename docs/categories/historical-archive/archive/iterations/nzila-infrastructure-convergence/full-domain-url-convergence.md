# 03 — Full Domain & URL Convergence

**Authority:** ACA `customDomains` enumeration + live HTTP probe (May 9, 2026).

---

## 1. Live URL Probe Results

| URL                                                                                              | HTTP | Resolves to                                                  |
|--------------------------------------------------------------------------------------------------|------|--------------------------------------------------------------|
| `https://app.unioneyes.app`                                                                      | 200  | `nzila-os-union-eyes` (staging fabric)                       |
| `https://staging.unioneyes.app`                                                                  | 200  | `nzila-os-union-eyes` (staging fabric) **— same target**     |
| `https://nzilaventures.com`                                                                      | 200  | `nzila-os-web` (staging fabric)                              |
| `https://console.nzilaventures.com`                                                              | 200  | `nzila-os-console` (staging fabric)                          |
| `https://nzila-os-union-eyes-demo.greenmoss-d27e0e19.canadacentral.azurecontainerapps.io`        | 200  | `nzila-os-union-eyes-demo` (demo fabric)                     |

---

## 2. Canonical URL → ACA Mapping (per `customDomains`)

| Public URL                                  | ACA app                       | Tier     | Status |
|---------------------------------------------|-------------------------------|----------|--------|
| `nzilaventures.com`                         | `nzila-os-web`                | "prod" (shared fabric) | LIVE |
| `www.nzilaventures.com`                     | `nzila-os-web`                | "prod"   | LIVE   |
| `console.nzilaventures.com`                 | `nzila-os-console`            | "prod"   | LIVE   |
| `staging-console.nzilaventures.com`         | `nzila-os-console`            | staging  | LIVE   |
| `partners.nzilaventures.com`                | `nzila-os-partners`           | "prod"   | LIVE   |
| `staging-partners.nzilaventures.com`        | `nzila-os-partners`           | staging  | LIVE   |
| `app.unioneyes.app`                         | `nzila-os-union-eyes`         | "prod"   | LIVE   |
| `unioneyes.app`                             | `nzila-os-union-eyes`         | "prod"   | LIVE   |
| `www.unioneyes.app`                         | `nzila-os-union-eyes`         | "prod"   | LIVE   |
| `staging.unioneyes.app`                     | `nzila-os-union-eyes`         | staging  | LIVE   |
| `staging-app.unioneyes.app`                 | `nzila-os-union-eyes`         | staging  | LIVE   |
| `zonga.nzilaventures.com`                   | `nzila-os-zonga`              | "prod"   | LIVE   |
| `staging-zonga.nzilaventures.com`           | `nzila-os-zonga`              | staging  | LIVE   |
| `control.nzilaventures.com`                 | `nzila-os-control-plane`      | "prod"   | LIVE   |
| `staging-control.nzilaventures.com`         | `nzila-os-control-plane`      | staging  | LIVE   |
| `admin.nzilaventures.com`                   | `nzila-os-platform-admin`     | "prod"   | LIVE   |
| `staging-admin.nzilaventures.com`           | `nzila-os-platform-admin`     | staging  | LIVE   |
| `staging-flow.nzilaventures.com`            | `nzila-os-flow`               | staging  | LIVE   |

---

## 3. Missing / Unresolved URLs (from prompt)

| URL                                                  | Status                                                |
|------------------------------------------------------|-------------------------------------------------------|
| `pilot.unioneyes.app`                                | **MISSING** — not bound on any ACA app                |
| `demo.unioneyes.app`                                 | **MISSING** — demo is on default ACA FQDN             |
| `flow.nzilaventures.com` (prod, no staging-)         | **MISSING** — only `staging-flow.…` exists            |
| `cfo.nzilaventures.com`                              | **MISSING**                                            |
| `agrimo.nzilaventures.com`                           | **MISSING**                                            |
| `cora.nzilaventures.com`                             | **MISSING**                                            |
| `trade.nzilaventures.com`                            | **MISSING**                                            |
| `mobility.nzilaventures.com`                         | **MISSING**                                            |
| `abr.nzilaventures.com` / `faircase.app`             | **MISSING** — ABR is BLOCKED                          |

---

## 4. Routing Determinism Analysis

### 4.1 Same-target collapse (CONDITIONAL — disclosed)

The following URL pairs resolve to the **same** ACA app:

- `app.unioneyes.app` ↔ `staging.unioneyes.app` → both serve `nzila-os-union-eyes`
- `console.nzilaventures.com` ↔ `staging-console.nzilaventures.com` → both serve `nzila-os-console`
- All other `<svc>.nzilaventures.com` ↔ `staging-<svc>.nzilaventures.com` pairs

**Operational consequence:** A user on `app.unioneyes.app` ("prod") and a
QA tester on `staging.unioneyes.app` are hitting the same database, the same
revision, the same secrets. Environment is differentiated only at the
URL/banner layer, not at the runtime layer.

### 4.2 Demo isolation (LIVE)

`nzila-os-union-eyes-demo.greenmoss-d27e0e19.canadacentral.azurecontainerapps.io`
is on a fully separate ACA env + DB + KV. **Real isolation.**
Lacks a friendly custom domain (`demo.unioneyes.app` not bound).

---

## 5. Auth & Callback URLs

`AUTH_URL` is set on the staging UE app (per `az containerapp show`).
Entra App Registration "Nzila OS Platform Auth" allows redirect URIs for:
- `localhost:3000-3004`
- staging domain

Per memory + container env: callback resolves correctly for the staging fabric
but **may need extension** when prod fabric is split out.

---

## 6. Locale Routing

UE marketing + dashboard use `[locale]` segment. Locale resolved by
middleware. No URL-level divergence between tiers — same middleware on shared
fabric.

---

## 7. Authoritative Domain Ownership Map

| Apex domain         | Ownership status                              | DNS managed via | Auto-token |
|---------------------|-----------------------------------------------|-----------------|------------|
| `nzilaventures.com` | OWNED                                         | external (no Azure DNS) | NO (manual CNAME ops) |
| `unioneyes.app`     | OWNED                                         | external        | YES (token-managed per memory) |
| `nzila.ai`          | NOT OWNED (per memory)                        | n/a             | n/a        |

---

## 8. Required Remediation (NOT auto-executed)

| # | Action                                           | Authorization |
|---|--------------------------------------------------|---------------|
| D1 | Bind `demo.unioneyes.app` to `nzila-os-union-eyes-demo` | YES |
| D2 | Bind `pilot.unioneyes.app` (after pilot fabric exists) | YES |
| D3 | Add prod CNAMEs for `flow / cfo / agrimo / cora / trade / mobility` | YES (12+ CNAMEs) |
| D4 | After splitting prod fabric: remove prod custom domains from staging apps | YES (cutover) |

---

**Verdict for §3:** Domain/URL convergence is **PARTIAL**. Live URLs resolve
deterministically to ACA apps; environment determinism is **collapsed** by
the shared-fabric topology. Remediation is documented in §8.
