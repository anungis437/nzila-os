# 07 — Full Persona & Auth Reality Convergence

**Authority:** Live ACA env vars + repo persona fixtures + E2E spec results.

---

## 1. Auth Stack Reality (per live container env)

UE staging container has the following auth-relevant env vars:

| Env var                       | Set?  | Source                |
|-------------------------------|-------|-----------------------|
| `AUTH_SECRET`                 | YES   | KV (`enc-key`)        |
| `AUTH_URL`                    | YES   | container             |
| `AUTH_TRUST_HOST`             | YES   | container             |
| `AZURE_AD_CLIENT_ID`          | YES   | container             |
| `AZURE_AD_TENANT_ID`          | YES   | container             |
| `AZURE_AD_CLIENT_SECRET`      | YES   | KV (`prod-azure-ad-client-secret`) |
| `DJANGO_SECRET_KEY`           | YES   | KV                    |
| `DATABASE_URL`                | YES   | KV                    |
| `PGPASSWORD`                  | YES   | KV                    |
| `EVIDENCE_SEAL_KEY`           | YES   | KV (`pii-key`)        |
| `FALLBACK_ENCRYPTION_KEY`     | YES   | KV (`enc-key`)        |

**Verdict:** Staging UE auth is **fully provisioned**.

---

## 2. Auth Stack Reality (demo)

| Env var                       | Set?  |
|-------------------------------|-------|
| `AUTH_SECRET`                 | **NO** |
| `AZURE_AD_CLIENT_SECRET`      | **NO** |
| `DATABASE_URL`                | **NO** (PG vars set as plaintext, but no password) |
| `PGPASSWORD`                  | **NO** |
| `DJANGO_SECRET_KEY`           | **NO** |

**Verdict:** Demo UE auth is **non-functional** for any flow that requires
session minting, DB reads with creds, or Entra exchange. Demo serves
unauthenticated content only.

---

## 3. Persona Registry (per `apps/union-eyes/tests/fixtures/test-users.ts`)

10 personas defined (unchanged from `docs/nzila-live-audit/test-persona-credentials-audit.md` §1).
All gated by `UE_TEST_USER_PASSWORD` (single shared password, non-prod only).

---

## 4. Cross-tier Persona Operability Matrix

| Persona               | local | staging | demo  | pilot | prod¹ |
|-----------------------|-------|---------|-------|-------|-------|
| `memberPrimary`       | YES   | YES (if seeded) | NO (no auth) | YES (if seeded as pilot) | NO (no test seed in prod) |
| `stewardPrimary`      | YES   | YES (if seeded) | NO     | YES   | NO |
| `staffPrimary`        | YES   | YES     | NO     | YES   | NO |
| `executivePrimary`    | YES   | YES     | NO     | YES   | NO |
| `adminPrimary`        | YES   | YES     | NO     | YES   | NO |
| `auditorReadOnly`     | YES   | YES     | NO     | YES   | NO |
| `restrictedUxTester`  | YES   | YES     | NO     | NO    | NO |
| `suspendedMember`     | YES   | YES     | NO     | NO    | NO |
| `wrongOrgSteward`     | YES   | YES     | NO     | NO    | NO |
| `memberSecondary`     | YES   | YES     | NO     | NO    | NO |

¹ "prod" = same fabric as staging. Personas physically work but should not be
seeded under prod org slugs.

---

## 5. Live Persona Validation Status

| Persona behavior              | Staging E2E spec                            | Last verified |
|-------------------------------|---------------------------------------------|---------------|
| Sequential session switch     | `auth-session-switch.spec.ts`               | LIVE (post pool-fix) |
| Member intake                 | `member-intake.spec.ts`                     | LIVE          |
| Steward review                | `steward-review.spec.ts`                    | LIVE          |
| Admin assignment              | `admin-assignment.spec.ts`                  | LIVE          |
| Auditor read-only             | `auditor-readonly.spec.ts`                  | LIVE          |
| Cross-org block               | `cross-org-block.spec.ts`                   | LIVE          |
| Case escalation               | `case-escalation.spec.ts`                   | LIVE          |
| Case resolution               | `case-resolution.spec.ts`                   | LIVE          |
| External UX tester containment| `external-ux-tester.spec.ts`                | LIVE          |

---

## 6. Org Switching, Locale Routing, Session Persistence

| Behavior                     | Verdict (staging) |
|------------------------------|-------------------|
| Org switching                | LIVE              |
| Locale routing (`/[locale]`) | LIVE              |
| Session cookie `nzila_session` | LIVE            |
| Session persistence across reload | LIVE         |
| Lockout after 5 failures     | LIVE              |
| MFA bypass for QA personas   | DEFERRED — no MFA yet enforced; bypass unnecessary |

---

## 7. Auth Divergence Findings (consolidated)

| Finding                                                      | Severity | Mitigation                            |
|--------------------------------------------------------------|----------|---------------------------------------|
| Demo has no auth secrets — auth flows non-functional         | High     | R3 in §2 isolation doc                |
| `auth().orgId` returns Entra group GUID                      | High     | Use `getOrganizationIdForUser(userId)`|
| Edge `proxy.ts` cannot import platform-auth/entra            | Medium   | Keep auth out of edge                 |
| No `platform_admin` test persona in fixture                  | Medium   | Backlog                               |
| No `finance_admin` shared persona for Zonga                  | Medium   | Backlog                               |
| Staging persona seeding is manual                            | Medium   | Backlog                               |

---

## 8. Required Remediation (NOT auto-executed)

| # | Action                                                              | Authorization |
|---|---------------------------------------------------------------------|---------------|
| A1 | Wire all 14 missing secrets onto demo UE container from `nzila-canada-demo-kv` | YES |
| A2 | Seed demo with `*-demo` org-slug personas after A1                  | YES |
| A3 | Add `platform_admin` + `finance_admin` shared test persona          | LOW (repo-only) |
| A4 | Add staging persona seed CI workflow gated by env tag              | LOW            |

---

**Verdict for §7:** Personas + auth are **LIVE on staging** and **NON-FUNCTIONAL
on demo** (lack of secrets). The provided test credentials work on staging;
they do NOT yet work on demo without remediation A1.
