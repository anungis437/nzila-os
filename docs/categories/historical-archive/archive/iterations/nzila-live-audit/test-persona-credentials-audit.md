# 04 — Test Persona & Credentials Audit

**Authority:** Canonical validation persona registry across dev / staging / demo.
**Source anchor:** [apps/union-eyes/tests/fixtures/test-users.ts](../../apps/union-eyes/tests/fixtures/test-users.ts)
**Discipline:** Credentials must enable full live UX/UI validation without
exposing real production secrets.

---

## 1. Canonical Test Credential Registry

> **Password policy for test personas:** A single deterministic password is
> shared by all test users in non-production environments. Defined as
> `UE_TEST_USER_PASSWORD` in `apps/union-eyes/tests/fixtures/test-users.ts`.
> **Never used in production**.

| Persona key            | Email                                  | Role                  | Org                        | Status   |
|------------------------|----------------------------------------|-----------------------|----------------------------|----------|
| `memberPrimary`        | `ue.qa.member.primary@nzila.test`      | `member`              | UE primary org             | active   |
| `memberSecondary`      | `ue.qa.member.secondary@nzila.test`    | `member`              | UE secondary org           | active   |
| `stewardPrimary`       | `ue.qa.steward.primary@nzila.test`     | `steward`             | UE primary org             | active   |
| `wrongOrgSteward`      | `ue.qa.steward.secondary@nzila.test`   | `steward`             | UE secondary org           | active   |
| `staffPrimary`         | `ue.qa.staff.primary@nzila.test`       | `support_agent`       | UE primary org             | active   |
| `executivePrimary`     | `ue.qa.executive.primary@nzila.test`   | `president`           | UE primary org             | active   |
| `adminPrimary`         | `ue.qa.admin.primary@nzila.test`       | `admin`               | UE primary org             | active   |
| `auditorReadOnly`      | `ue.qa.auditor.readonly@nzila.test`    | `compliance_manager`  | UE primary org             | active (read-only) |
| `restrictedUxTester`   | `ue.qa.ux.tester@nzila.test`           | `member`              | UE ux-tester isolated org  | active (sandbox) |
| `suspendedMember`      | `ue.qa.member.suspended@nzila.test`    | `member`              | UE primary org             | inactive |

---

## 2. Persona-to-Audit-Role Mapping

The audit prompt requires the following persona coverage. Mapping to canonical
fixtures:

| Audit-required persona  | Canonical fixture        | Coverage status     |
|-------------------------|--------------------------|---------------------|
| executive persona       | `executivePrimary`       | LIVE                |
| steward persona         | `stewardPrimary`         | LIVE                |
| governance persona      | `auditorReadOnly`        | LIVE (read-only)    |
| reviewer persona        | `auditorReadOnly`        | LIVE (read-only) — REVIEWER role TBD if write needed |
| finance persona         | **MISSING** in UE fixture | DEFERRED — Zonga has `finance_admin` but no shared test fixture |
| onboarding persona      | `adminPrimary` (proxies role) | PARTIAL          |
| member persona          | `memberPrimary`          | LIVE                |
| pilot operator persona  | `adminPrimary` (proxies role) | PARTIAL          |
| platform admin persona  | **MISSING** in UE fixture (no `platform_admin` test user) | GAP |

> **Operational honesty gap:** No dedicated `platform_admin` or `finance_admin`
> test persona is defined in the UE fixture. Tests requiring platform-wide
> escalation use `adminPrimary` and assert on permission boundaries instead.

---

## 3. Environment-Specific Credentials

### 3.1 dev (local)

| Mechanism            | Value                                           |
|----------------------|-------------------------------------------------|
| Auth secret          | `AUTH_SECRET=test-auth-secret`                  |
| Voting secret        | `VOTING_SECRET=test-voting-secret-0123456789abcdef` |
| Database             | `postgresql://nzila:nzila_dev@localhost:5433/nzila_automation` |
| Seed                 | `pnpm --filter @nzila/union-eyes seed:test-env` |
| All personas         | Available via fixture                           |

### 3.2 staging (Canada Central ACA)

| Mechanism            | Value                                           |
|----------------------|-------------------------------------------------|
| Auth secret          | Stored in `nzila-staging-kv` (`AUTH_SECRET`)    |
| Entra SSO            | Active (b7b0cb9a-110d-4bf4-baa7-d936d7450181)   |
| Database             | `nzila-staging-db` (PG Flexible)                |
| Test personas        | **NOT seeded by default** in staging — see §5   |
| Real users           | Created via `/sign-up` or Entra invitation      |

### 3.3 demo (logical tenancy on staging)

| Mechanism            | Value                                           |
|----------------------|-------------------------------------------------|
| Demo orgs            | Seeded under `*-demo` org slugs                 |
| Demo personas        | Use `staging` credentials with demo `org_id`    |
| Demo isolation       | Logical only — same DB, separate `org_id`       |

### 3.4 pilot (CUPE)

| Mechanism            | Value                                           |
|----------------------|-------------------------------------------------|
| Pilot tenant         | Seeded via `cupe-pilot-readiness.yml` workflow  |
| Pilot personas       | Real CUPE-affiliated users + invited stewards   |
| Pilot personas (test)| Mirror of staging fixtures with `cupe-` prefix  |

---

## 4. Expected Landing Pages by Persona

| Persona                | Default landing                       | After locale resolve         |
|------------------------|---------------------------------------|------------------------------|
| `memberPrimary`        | `/dashboard`                          | `/{locale}/dashboard`        |
| `stewardPrimary`       | `/dashboard/grievances`               | `/{locale}/dashboard/grievances` |
| `staffPrimary`         | `/dashboard/cases`                    | `/{locale}/dashboard/cases`  |
| `executivePrimary`     | `/dashboard/analytics`                | `/{locale}/dashboard/analytics` |
| `adminPrimary`         | `/dashboard/admin`                    | `/{locale}/dashboard/admin`  |
| `auditorReadOnly`      | `/dashboard/audit`                    | `/{locale}/dashboard/audit`  |
| `restrictedUxTester`   | `/sandbox` (sandbox-only)             | `/{locale}/sandbox`          |
| `suspendedMember`      | `/account-suspended`                  | `/{locale}/account-suspended` |

---

## 5. Expected Workflow Access

| Persona                | Can intake | Can review | Can assign | Can resolve | Can audit |
|------------------------|------------|------------|------------|-------------|-----------|
| `memberPrimary`        | YES (own)  | NO         | NO         | NO          | NO        |
| `stewardPrimary`       | YES        | YES        | YES        | NO (level 60 < arbitration->resolved required level 80) | NO |
| `staffPrimary`         | YES        | YES        | YES        | NO          | NO        |
| `executivePrimary`     | YES        | YES        | YES        | YES         | NO        |
| `adminPrimary`         | YES        | YES        | YES        | YES         | YES       |
| `auditorReadOnly`      | NO         | NO (read)  | NO         | NO          | YES (read) |
| `restrictedUxTester`   | YES (sandbox) | NO      | NO         | NO          | NO        |
| `suspendedMember`      | NO         | NO         | NO         | NO          | NO        |

---

## 6. Staging Persona Bootstrapping — Required Action

Production-grade staging operations require seeded personas in the staging DB.
Proposed protocol:

1. Run `pnpm --filter @nzila/union-eyes seed:test-env` against `staging` DB
   **with the `STAGING_TEST_USERS=true` flag** (gated to staging-only).
2. Restrict bootstrap to a pre-approved org slug (`ue-qa-org-primary`).
3. Tag personas with `metadata.environment = 'staging'` for runtime filtering.
4. Auto-rotate `UE_TEST_USER_PASSWORD` every 90 days; secret stored in
   `nzila-staging-kv`.

> **Status:** This protocol is **PARTIAL** — local seeding works; staging
> seeding requires manual operator action. Tracked as a gap in the verdict.

---

## 7. Findings

| Finding                                                            | Severity | Owner                                |
|--------------------------------------------------------------------|----------|--------------------------------------|
| No `platform_admin` test persona in UE fixture                     | Medium   | union-eyes-engineering               |
| No shared `finance_admin` (Zonga) test persona                     | Medium   | zonga-engineering                    |
| Staging persona bootstrapping is manual                            | Medium   | platform-admin                       |
| `restrictedUxTester` org isolation depends on org_id alone (no RLS at this layer) | Low | union-eyes-engineering          |

---

**Verdict for §4:** UE persona registry is **comprehensive for UE workflows**.
Cross-app persona coverage (platform admin, finance admin) is **PARTIAL** and
must be expanded before procurement-grade demos.
