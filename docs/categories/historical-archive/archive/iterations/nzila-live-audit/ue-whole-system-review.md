# 09 — Union Eyes Whole-System Review

**Authority:** UE as institutional OS — full-system operational review.
**Source anchors:**
[apps/union-eyes/](../../apps/union-eyes/),
[docs/nzila-cognition-doctrine/](../nzila-cognition-doctrine/),
this audit corpus.

---

## 1. Module Inventory

| Module                  | Surface                                        | Verdict |
|-------------------------|------------------------------------------------|---------|
| Marketing site          | `/[locale]` landing + 15 hero images           | LIVE    |
| Auth                    | `@nzila/platform-auth` (Argon2id + Entra)     | LIVE    |
| Member intake           | `/[locale]/dashboard/grievances/new`           | LIVE    |
| Steward review          | `/[locale]/dashboard/grievances/[id]`          | LIVE    |
| Workbench (assignment)  | `/[locale]/dashboard/workbench`                | LIVE    |
| Case escalation         | State machine (level 60→80)                    | LIVE    |
| Case resolution         | State machine (level 80→100)                   | LIVE    |
| Audit / read-only       | `/[locale]/dashboard/audit`                    | LIVE    |
| CBA Intelligence        | `/[locale]/dashboard/cba-intelligence`         | LIVE (doctrine-realigned) |
| Analytics               | `/[locale]/dashboard/analytics`                | LIVE    |
| Admin                   | `/[locale]/dashboard/admin`                    | LIVE    |
| Sandbox (UX tester)     | `/[locale]/sandbox`                            | LIVE    |
| Account suspended       | `/[locale]/account-suspended`                  | LIVE    |
| Django sidecar          | `/api/auth_core/*`, `/api/tasks/*`             | LIVE    |
| Feature flags           | DB-backed, audit-logged                        | LIVE    |
| Notifications           | Adapter (in-app + email)                       | LIVE    |
| Evidence packs          | Immutable artifact generation                  | LIVE    |
| Org picker              | Multi-org member support                       | LIVE    |
| Onboarding tour         | First-login walkthrough                        | LIVE    |

---

## 2. Cognition Layer

| Cognition surface           | Bounded? | Doctrine-aligned? | Verdict |
|-----------------------------|----------|-------------------|---------|
| CBA Intelligence            | YES      | YES               | LIVE    |
| Case-similarity hints       | YES      | YES               | LIVE    |
| Escalation triage           | YES      | YES               | LIVE    |
| Doctrine continuity engine  | YES      | YES               | LIVE    |
| Bounded-confidence indicators | YES    | YES               | LIVE    |
| Disclaimers + escalation paths | YES   | YES               | LIVE    |

All cognition surfaces enforce:
- "Final authority remains with [union steward / executive]" language
- Visible escalation pathway
- No autonomy / no optimization framing
- `AIBanner` component on every cognition surface

---

## 3. Governance Layer

| Governance surface                | Verdict |
|-----------------------------------|---------|
| Audit trail (every state change)  | LIVE    |
| Evidence pack generation          | LIVE    |
| Compliance snapshots              | LIVE    |
| Role-based access enforcement     | LIVE    |
| Cross-org containment             | LIVE    |
| Tenant isolation                  | LIVE (org_id scoping) |
| Read-only auditor surface         | LIVE    |
| External-tester sandbox           | LIVE    |
| Demo-mode boundaries              | LIVE    |
| Suspension / lockout              | LIVE    |
| Continuity-tier metadata          | PARTIAL — enforcement deferred |

---

## 4. Onboarding Flow

| Step                              | Implementation                          | Verdict |
|-----------------------------------|-----------------------------------------|---------|
| Sign-up (email or Entra invite)   | `/[locale]/sign-up`                     | LIVE    |
| Email verification                | Magic-link via platform-auth            | LIVE    |
| Org binding (via invite token)    | Auto on accept                          | LIVE    |
| Default role: `member`            | Enforced                                | LIVE    |
| Role escalation (admin action)    | Console / UE admin surface              | LIVE    |
| First-login walkthrough           | In-app tour                             | LIVE    |
| Steward orientation               | Email + in-app reference                | PARTIAL — email exists, deeper guide deferred |

---

## 5. Cadence Layer

| Cadence surface                                | Verdict |
|------------------------------------------------|---------|
| Weekly digest emails (per-org admin)           | LIVE    |
| Monthly governance pack                        | LIVE    |
| Quarterly continuity audit                     | DEFERRED — manual procedure |
| Annual evidence archive                        | DEFERRED — manual procedure |
| Cadence reminders to stewards                  | LIVE    |
| Console weekly review surface                  | LIVE (Console)|

---

## 6. Continuity Layer

| Continuity guarantee                        | Verdict |
|---------------------------------------------|---------|
| Audit log immutability                      | LIVE    |
| Evidence pack immutability                  | LIVE    |
| Role/permission audit trail                 | LIVE    |
| Org data isolation                          | LIVE    |
| Cross-tier data preservation                | LIVE    |
| Tier-based retention enforcement            | DEFERRED (see Monetization audit §5) |
| PG point-in-time recovery enabled           | LIVE (Azure PG Flexible) |
| Backup verification cadence                 | DEFERRED — manual |
| Disaster recovery runbook                   | LIVE (documented, not drilled) |

---

## 7. Stewardship Layer

| Stewardship support                          | Verdict |
|----------------------------------------------|---------|
| Per-steward case load visibility             | LIVE    |
| Steward assignment workbench                 | LIVE    |
| Steward escalation pathway                   | LIVE    |
| Steward training docs                        | PARTIAL — exist for core flows; gaps in advanced governance |
| Steward feedback loop to UE engineering      | DEFERRED — no in-product channel |
| Steward seat licensing                       | LIVE (per-tier)|

---

## 8. Procurement Posture

UE is positioned for institutional procurement (unions, labor councils,
multi-employer benefit plans). Procurement-grade requirements:

| Requirement                                | Verdict |
|--------------------------------------------|---------|
| SOC 2 Type II                              | DEFERRED — pre-pilot artifacts; full audit not yet engaged |
| GDPR DSR support                           | LIVE (data export + delete) |
| Data residency (Canada)                    | LIVE (Canada Central) |
| Tenant isolation evidence                  | LIVE    |
| Audit log integrity certificate            | LIVE    |
| Pricing transparency                       | LIVE    |
| SLA documentation                          | DEFERRED — internal only |
| Incident response runbook                  | LIVE    |
| Penetration test report                    | DEFERRED — last test pre-doctrine |
| DPA template                               | LIVE    |
| Sub-processor list                         | LIVE    |
| Insurance certificate                      | DEFERRED — entity-level |

---

## 9. Doctrine Convergence Status

UE has converged on the institutional-cognition doctrine:

- All cognition surfaces are bounded
- All governance surfaces enforce escalation pathways
- All monetization tiers honor approved axes
- All AI-adjacent copy passes `validate:cognition`
- All workflows preserve continuity over conversion

---

## 10. Findings — UE-system level

| Finding                                                       | Severity | Mitigation                            |
|---------------------------------------------------------------|----------|---------------------------------------|
| Tier-based retention not enforced                             | High     | Implement retention cron              |
| Quarterly continuity audit is manual                          | Medium   | Automate or schedule                  |
| Steward feedback loop missing in-product                      | Medium   | Add steward feedback widget           |
| SOC 2 Type II not yet engaged                                 | Medium   | Initiate after pilot evidence cycle   |
| Penetration test predates doctrine                            | Medium   | Re-engage post-doctrine               |
| `partners` root 404                                           | Medium   | Tracked in nav audit                  |
| `cfo` post-doctrine final pass pending                        | Low      | Tracked in nav audit                  |

---

**Verdict for §9:** UE is **operationally complete as an institutional OS for
labor governance** at pilot scale. The material gaps for full procurement
readiness (SOC 2, retention enforcement, pen test refresh) are catalogued and
tracked. UE is the most mature application in the platform and serves as the
template for doctrine alignment across other verticals.
