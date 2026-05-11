# 11 — Final Live Infrastructure Certification

**Authority:** All sibling documents in `docs/nzila-infrastructure-convergence/`.
**Discipline:** Operational truth over symbolic GO.

---

## 1. Environment Matrix

| Tier      | RG | ACA env | App count | DB | KV | Secrets wired | Custom domains |
|-----------|----|---------|-----------|----|----|---------------|----------------|
| dev       | n/a | n/a    | 0         | local | n/a | n/a         | n/a            |
| staging   | `nzila-canada-staging-rg` | `nzila-canada-staging-env` | 15 | `nzila-staging-db` (PG15) | `nzila-staging-kv` | YES | YES |
| demo      | `nzila-canada-demo-rg` | `nzila-canada-demo-env` | 1 | `nzila-os-union-eyes-demo-db` (PG16) | `nzila-canada-demo-kv` | NO | NO |
| pilot     | n/a (logical on staging) | — | 0 | shares staging | — | inherited | inherited |
| prod      | n/a (custom-domain bind on staging) | — | 0 | shares staging | — | inherited | YES |

---

## 2. URL Matrix

See [full-domain-url-convergence.md §2](full-domain-url-convergence.md). 18 custom
domains LIVE; 9+ planned domains MISSING; demo lacks friendly domain.

---

## 3. Infrastructure Matrix

See [live-infrastructure-discovery.md §3-§10](live-infrastructure-discovery.md).
3 RGs, 2 ACA envs, 16 ACA apps, 2 PG servers, 2 KVs, 1 ACR, 0 Azure DNS zones.

---

## 4. DB Matrix

| Concern             | staging    | demo       |
|---------------------|------------|------------|
| Server name         | `nzila-staging-db` | `nzila-os-union-eyes-demo-db` |
| PG version          | 15         | 16         |
| Migration ledger    | UNVERIFIED | UNVERIFIED |
| Extension inventory | UNVERIFIED | UNVERIFIED |
| Tenant scoping      | LIVE       | LIVE (schema) / N/A (no traffic) |

---

## 5. Release Matrix

| App                          | SHA tag                                       | Lineage env vars |
|------------------------------|-----------------------------------------------|------------------|
| 14 of 15 staging apps        | `f1e66a2d04720c5e8df59454e14e75104292f250`    | YES              |
| `nzila-os-platform-admin`    | `platform-admin-1636e98e-20260422172320:latest` (DRIFT) | unknown |
| `nzila-os-union-eyes-demo`   | `nzila-os-union-eyes:production` (mutable tag) | NO              |

---

## 6. Auth Matrix

| Tier    | AUTH_SECRET | Entra creds | DB creds | Personas usable |
|---------|-------------|-------------|----------|-----------------|
| local   | YES         | YES         | YES      | YES             |
| staging | YES (KV)    | YES (KV)    | YES (KV) | YES             |
| demo    | NO          | NO          | NO       | NO              |
| pilot   | inherited (staging) | inherited | inherited | YES (pilot orgs) |
| prod    | inherited (staging) | inherited | inherited | YES (real users) |

---

## 7. E2E Matrix

| Tier    | Spec coverage | Last green |
|---------|---------------|------------|
| local   | 91 UE specs   | per dev cycle |
| staging | 91 UE specs   | post pool-fix (`3cab20a62`) |
| demo    | 0 (BLOCKED — no auth) | n/a |
| pilot   | manual + CI evidence pack | per release |
| prod    | smoke only    | continuous (probe) |

---

## 8. Rollback Matrix

| Tier    | Rollback target | Recoverable | Drilled |
|---------|------------------|-------------|---------|
| dev     | n/a              | n/a         | n/a     |
| staging | revision N-1     | YES         | NO      |
| demo    | only revision    | NO (no prior) | NO    |
| pilot   | inherited        | inherited   | NO      |
| prod    | inherited        | YES         | NO      |

---

## 9. Unresolved Risks (CRITICAL + HIGH)

| # | Risk                                                              | Severity |
|---|-------------------------------------------------------------------|----------|
| 1 | Prod fabric is shared with staging                                | HIGH     |
| 2 | Demo container has no auth secrets — non-functional for E2E       | HIGH     |
| 3 | Demo image uses mutable `:production` tag                         | HIGH     |
| 4 | Demo lacks release lineage env vars                               | HIGH     |
| 5 | platform-admin app drift from canonical SHA                       | HIGH     |
| 6 | Restoration not drilled                                           | MEDIUM   |
| 7 | Application Insights presence unverified                          | MEDIUM   |
| 8 | Migration ledger UNVERIFIED on both DBs                           | MEDIUM   |
| 9 | DB version skew (PG 15 vs 16)                                     | MEDIUM   |
| 10 | No pilot fabric                                                  | MEDIUM   |
| 11 | No dev Azure tier                                                | DOCUMENTED |

---

## 10. Per-tier Operational Verdicts

> **Verdict semantics:**
> - **GO** — fully operational with no HIGH risks
> - **CONDITIONAL GO** — operational with disclosed HIGH risks; usable for
>   institutional pilot but not enterprise procurement
> - **NO-GO** — not operational; cannot be used for live traffic

| Tier      | Verdict           | Rationale                                                                 |
|-----------|-------------------|---------------------------------------------------------------------------|
| **DEV**   | **NO-GO** (Azure) | No Azure dev tier exists. Local-only is sufficient for dev work but does NOT satisfy "dev tier" in the prompt. |
| **STAGING** | **GO**          | 15 apps Running, uniform SHA (14/15), secrets wired, DB+KV isolated, E2E LIVE, custom domains bound. |
| **DEMO**  | **CONDITIONAL GO**| Real isolated infra exists; auth non-functional (HIGH risk #2); single revision; mutable image tag. Usable for surface UX walkthrough only. |
| **PILOT** | **CONDITIONAL GO**| Logical-only on staging fabric. CUPE pilot scaffolding LIVE. No dedicated isolation. |
| **PROD**  | **CONDITIONAL GO**| URLs LIVE and TLS-active; runtime is the staging fabric. Acceptable for institutional pilot disclosed-shared-fabric posture; NOT enterprise-procurement-grade. |

---

## 11. Final Status

```text
NZILA LIVE INFRASTRUCTURE STATUS: CONDITIONAL GO

DEV:     NO-GO            (no Azure tier; local-only)
STAGING: GO               (full isolation, full secrets, E2E LIVE)
DEMO:    CONDITIONAL GO   (isolated infra, no auth secrets)
PILOT:   CONDITIONAL GO   (logical-only on staging fabric)
PROD:    CONDITIONAL GO   (shared fabric with staging)
```

**This is the operationally honest verdict.** Symbolic "FULL GO" is NOT
warranted by the live evidence above. Achieving FULL GO requires execution
of remediation R1–R9 (isolation), D1–D4 (URL), P1–P5 (parity), DB1–DB6
(database), F1–F4 (flags), A1–A4 (auth), E1–E6 (E2E), RB1–RB5 (rollback),
H1–H8 (hardening) — most of which require explicit operator authorization
because they are destructive or shared-infra operations.

---

## 12. Recommended Path to Full GO

**Tier 1 — within current sprint (additive, low-risk):**
- A1 (wire demo secrets), RB1 (demo release env vars), P1 (platform-admin
  reconcile), DB1+DB2 (read-only verification), H1 (App Insights check),
  H2 (security headers audit), E1+E2+E3 (new E2E specs).

**Tier 2 — within current quarter (medium-risk):**
- D1+D2 (demo + pilot custom domains), R3 (demo secret wiring), R4 (demo
  SHA pinning), P2+P3 (demo release lineage), F1+F2 (demo fail-closed +
  reset cron), DB5 (demo seed runner), E5 (demo E2E enabled).

**Tier 3 — within current half (high-risk, procurement-grade):**
- R1+R2 (prod fabric split + DNS cutover), R8 (pilot fabric provision),
  DB3 (PG 15→16 upgrade), H4 (prod fabric split), H5 (SOC 2), H6 (pen test),
  H8 (DR drill).

Each tier expands the verdict envelope:
- After Tier 1 → STAGING **GO**, DEMO **GO** (UX walkthrough), others
  unchanged.
- After Tier 2 → DEMO **GO**, PILOT **GO** (logical-tier).
- After Tier 3 → PROD **GO**, PILOT **GO** (physical isolation),
  DEV optional.

---

**Final certification authority:** This document is the canonical
infrastructure-tier verdict. It supersedes any prior verdict. Updates require
re-running discovery and re-issuing this certification.
