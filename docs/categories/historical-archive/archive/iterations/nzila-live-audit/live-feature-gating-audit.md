# 07 — Live Feature Gating Audit

**Authority:** Reality of feature gating across roles, orgs, environments, demo modes.
**Source anchors:**
[apps/union-eyes/lib/feature-flags.ts](../../apps/union-eyes/lib/feature-flags.ts),
[apps/union-eyes/lib/services/feature-flags-service.ts](../../apps/union-eyes/lib/services/feature-flags-service.ts),
[apps/console/lib/nav-config.ts](../../apps/console/lib/nav-config.ts).

---

## 1. Feature Flag System (UE)

### 1.1 Flag types ([apps/union-eyes/lib/feature-flags.ts](../../apps/union-eyes/lib/feature-flags.ts))

| Flag type     | Behavior                                                  |
|---------------|-----------------------------------------------------------|
| `boolean`     | On/off                                                    |
| `percentage`  | Random rollout (0-100% by hash bucket)                    |
| `tenant`      | Allowlist of `org_id` values                              |
| `user`        | Allowlist of `user_id` values                             |

### 1.2 Storage

| Concern               | Implementation                                           |
|-----------------------|----------------------------------------------------------|
| Flag table            | `feature_flags` (Drizzle schema)                         |
| Flag override table   | `feature_flag_overrides` (per org/user)                  |
| Audit table           | `feature_flag_audit` (every flip recorded)               |
| Cache                 | In-process (request-scoped); revalidated per request     |
| Resolution             | `getFlagState({ flagKey, orgId, userId, env })`         |

### 1.3 Verdict

`LIVE` and operational. Audit table provides full forensic chain.

---

## 2. Active Feature Flags

| Flag key                               | Type        | Default | Notes                            | Verdict |
|----------------------------------------|-------------|---------|----------------------------------|---------|
| `ue.cba_intelligence.enabled`          | boolean     | true    | Doctrine-realigned surface       | LIVE    |
| `ue.workbench.assignment.v2`           | percentage  | 100%    | Stable, can be removed           | LIVE    |
| `ue.case_resolution.evidence_packs`    | tenant      | empty   | Pilot orgs only                  | LIVE    |
| `ue.escalation.auto_notification`      | boolean     | true    | Notifies steward on escalation   | LIVE    |
| `ue.audit.read_only_export`            | boolean     | true    | Auditor PDF export               | LIVE    |
| `ue.demo_mode.synthetic_pii`           | tenant      | demo orgs | Generates synthetic data        | LIVE    |
| `ue.sandbox.ux_tester`                 | user        | UX tester user IDs | Sandbox isolation     | LIVE    |
| `console.weekly_review.v2`             | percentage  | 0%      | Pre-release                      | DEFERRED|
| `cfo.advisory_ai.bounded`              | boolean     | true    | Doctrine-required bounded mode   | LIVE    |
| `zonga.creator_payouts.batch`          | tenant      | client_admin orgs | Batch payouts limited  | LIVE    |

---

## 3. Role-based Gating Patterns

### 3.1 Server-side enforcement

| Pattern                                   | Used in                        | Verdict |
|-------------------------------------------|--------------------------------|---------|
| `requireRole(orgId, ['admin'])`           | Zonga, UE workbench            | LIVE    |
| `ROLE_LEVEL[role] >= 80`                  | UE state machine transitions   | LIVE    |
| `auth().userId` + `getOrganizationIdForUser` | UE org resolution           | LIVE    |
| `useFeatureFlag(flagKey)`                 | UE client surfaces             | LIVE    |
| `getServerSession()` redirect             | All apps                       | LIVE    |

### 3.2 Client-side gating

| Pattern                                   | Used in                        | Verdict |
|-------------------------------------------|--------------------------------|---------|
| `filterNav(navGroups, { roles, enabledFlags })` | Console nav                | PARTIAL — defaults allow-all |
| `<Can I="action" a="resource">`           | UE conditional rendering       | LIVE    |
| `useFeatureFlag(flagKey)`                 | UE client surfaces             | LIVE    |

> **Operational honesty:** Client-side gating is for **UX hint** only. Server
> enforcement is the security boundary. This is correctly implemented.

---

## 4. Environment-Specific Gating

| Behavior                                | local | staging | demo | pilot | prod |
|-----------------------------------------|-------|---------|------|-------|------|
| Synthetic data banner                   | YES   | YES     | YES  | NO    | NO   |
| "Demo mode" surface marker              | NO    | NO      | YES  | NO    | NO   |
| AI bounded-confidence indicators        | YES   | YES     | YES  | YES   | YES  |
| Test-only fixtures accessible           | YES   | NO (gated) | NO | NO  | NO   |
| Sandbox routes enabled                  | YES   | YES     | YES  | NO    | NO   |
| Real payouts enabled (Zonga)            | NO    | NO      | NO   | NO (PARTIAL) | YES (PARTIAL — staging fabric) |
| Real grievance state transitions        | YES   | YES     | YES  | YES   | N/A  |

---

## 5. Demo Mode Boundaries

| Boundary                                          | Implementation                       | Verdict |
|---------------------------------------------------|--------------------------------------|---------|
| Demo orgs cannot mutate non-demo data             | `org_id`-scoped queries              | LIVE    |
| Synthetic PII generated, never real users         | `ue.demo_mode.synthetic_pii` flag    | LIVE    |
| "Demo" badge visible on all surfaces              | UE conditional badge component       | LIVE    |
| Demo data resets on cadence                       | NOT AUTOMATED — manual operator action | PARTIAL |
| Demo personas cannot escalate to platform_admin   | Role hierarchy enforces              | LIVE    |
| Demo mode cannot trigger real notifications       | Notification adapter checks org tier | LIVE    |

> **Reference:** Memory `union-eyes-demo-boundaries-hardening` confirms this
> hardening was completed.

---

## 6. Sandbox Boundaries (UX Tester)

| Boundary                                          | Implementation                       | Verdict |
|---------------------------------------------------|--------------------------------------|---------|
| `restrictedUxTester` confined to `/sandbox/*`     | Middleware redirect                  | LIVE    |
| Cannot view other org data                        | `org_id` scoping                     | LIVE    |
| Cannot modify production schema                   | Read-only DB role                    | DEFERRED — uses standard role with org gating |
| Audit-logged                                      | YES                                  | LIVE    |

---

## 7. Findings

| Finding                                                         | Severity | Mitigation                  |
|-----------------------------------------------------------------|----------|----------------------------|
| Console nav `filterNav` defaults to allow-all                   | Medium   | Wire role-aware filtering  |
| Demo data reset is manual                                       | Medium   | Schedule automation        |
| Sandbox tester uses standard DB role, not read-only             | Low      | Acceptable given org scoping |
| Some flags (`ue.workbench.assignment.v2`) at 100% — should be removed | Low | Cleanup backlog            |
| No flag UI for non-platform_admin (admins must use SQL/CLI)     | Medium   | Build console flag manager |

---

**Verdict for §7:** Feature gating is **architecturally sound and
operationally honest**. The most material gap is the absence of a
self-service flag manager for org admins, which is a UX deficit, not a
security one.
