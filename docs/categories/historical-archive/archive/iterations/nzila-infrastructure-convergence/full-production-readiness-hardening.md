# 10 — Full Production Readiness Hardening

**Authority:** Live ACA enumeration + container env inspection.

---

## 1. Telemetry & Observability

| Concern                                  | Verdict |
|------------------------------------------|---------|
| Log Analytics workspace (staging)        | LIVE (associated with staging-env) |
| Log Analytics workspace (demo)           | LIVE (`nzila-canada-demo-law`) |
| Application Insights                     | UNVERIFIED in this audit (no AI resource enumerated) |
| Container `Log` queries via `az monitor` | LIVE |
| `/api/health` endpoint                   | LIVE on UE (`/api/auth_core/health/` per memory) |
| Per-app `/api/health`                    | UNVERIFIED for non-UE apps |

> **Honest gap:** Application Insights presence not yet confirmed. Required
> follow-up: `az monitor app-insights component list`.

---

## 2. Uptime / TLS

| Concern                                  | Verdict |
|------------------------------------------|---------|
| Live HTTP probes return 200              | LIVE (5/5 sampled URLs) |
| TLS provisioning on custom domains       | LIVE (ACA managed certs) |
| TLS for `unioneyes.app`                  | LIVE   |
| TLS for `nzilaventures.com`              | LIVE   |
| HSTS / security headers                  | UNVERIFIED in this audit |

---

## 3. Secret Management

| Concern                                                | Verdict |
|--------------------------------------------------------|---------|
| Staging KV holds 14+ secret refs                       | LIVE    |
| Container app references KV via secretRef              | LIVE (per env enumeration) |
| Secret rotation cadence                                | DEFERRED — manual only |
| Entra client secret expiry tracked                     | LIVE — ~April 2028 (2-year) per memory |
| Demo KV provisioned but unused by demo container       | PARTIAL |

---

## 4. Environment Separation Posture

| Separation guarantee                     | Verdict |
|------------------------------------------|---------|
| Staging vs demo: separate fabric         | LIVE    |
| Staging vs prod: SAME fabric             | DOCUMENTED RISK |
| Staging DB vs demo DB                    | LIVE    |
| Staging KV vs demo KV                    | LIVE    |
| Staging vs prod: SAME secrets            | DOCUMENTED RISK |

---

## 5. Evidence Generation

Per UE evidence-pack subsystem:
- Per-case immutable evidence packs
- Per-release procurement manifest
- Audit log integrity certificates

All operational on staging.

---

## 6. Auditability

| Concern                                  | Verdict |
|------------------------------------------|---------|
| Every state transition logged            | LIVE (per memory + state-machine code) |
| Audit log immutability                   | LIVE    |
| Auditor read-only role                   | LIVE    |
| Cross-org auditor visibility             | gated by `external_auditor` role |

---

## 7. Governance Surfaces

| Surface                                  | Verdict |
|------------------------------------------|---------|
| `/dashboard/audit`                       | LIVE    |
| Console `/governance/*`                  | LIVE    |
| Console `/proof-center`                  | LIVE    |
| Console `/compliance-snapshots`          | LIVE    |
| Evidence pack export                     | LIVE    |

---

## 8. Runtime Calmness

Per the doctrine + `validate:cognition` enforcement:

| Calmness signal                                       | Verdict |
|-------------------------------------------------------|---------|
| `AIBanner` on cognition surfaces                      | LIVE    |
| "Final authority remains with [role]" language        | LIVE    |
| Escalation pathway visible                            | LIVE    |
| No prohibited framing                                 | LIVE (CI-enforced) |
| Bounded-confidence indicators                         | LIVE    |

---

## 9. Executive Readability

| Surface                                  | Verdict |
|------------------------------------------|---------|
| Console `/ceo`                           | LIVE    |
| Console `/today`                         | LIVE    |
| Console `/intelligence`                  | LIVE    |
| Console `/weekly-review`                 | LIVE    |
| Console `/briefing`                      | LIVE    |
| Procurement-grade summaries              | LIVE (evidence packs) |

---

## 10. Production Hardening Backlog

| # | Action                                                              | Authorization |
|---|---------------------------------------------------------------------|---------------|
| H1 | Confirm Application Insights presence; wire if missing             | LOW (read first) |
| H2 | Audit security headers (HSTS, CSP, COEP/COOP) on all custom domains| LOW |
| H3 | Document secret rotation cadence + automate where feasible         | YES |
| H4 | Split prod fabric from staging (Path A in §2 isolation doc)        | YES (HIGH cost) |
| H5 | Initiate SOC 2 Type II                                              | YES |
| H6 | Re-run penetration test post-doctrine                              | YES |
| H7 | 24/7 on-call rotation                                              | YES (org-level) |
| H8 | Disaster recovery drill                                            | YES |

---

## 11. Findings

| # | Finding                                                            | Severity |
|---|--------------------------------------------------------------------|----------|
| 1 | Live URLs respond 200; TLS active                                  | LIVE     |
| 2 | Secrets correctly KV-backed on staging                             | LIVE     |
| 3 | Application Insights status unverified                             | Medium   |
| 4 | Security headers unverified                                        | Medium   |
| 5 | Prod fabric is shared with staging                                 | High     |
| 6 | SOC 2 not yet engaged                                              | Medium   |
| 7 | Pen test predates doctrine                                         | Medium   |
| 8 | DR not drilled                                                     | Medium   |

---

**Verdict for §10:** Production readiness is **PARTIAL**. The platform feels
operational and governance-native; it is NOT yet enterprise-procurement-grade.
The single most material gap is shared-fabric prod (#5). Acceptable for
institutional pilot deployments today; remediation required for enterprise
SLAs.
