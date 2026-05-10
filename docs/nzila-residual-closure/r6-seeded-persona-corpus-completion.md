# R6 — Seeded Persona Corpus Completion

> **Status: DEFERRED.** Persona inventory + seed contract shipped; substrate seeding scoped to `chore/r6-seeded-persona-corpus-expansion`.

## Authority

This document is the canonical persona corpus completion procedure for Nzila OS. Personas are the **operationally honest** seed corpus that exercises every steward, governance, onboarding, procurement, and degraded-runtime surface across staging + pilot. Governance-safe (no PII), continuity-safe (deterministic seeds), anti-surveillance (synthetic), evidence-anchored, reviewer-of-record bound. Operational, institutional, deterministic, bounded.

## 1. Persona class matrix

The chore PR must seed the following persona classes across **staging + pilot**:

| Class | Count target | Surfaces exercised | Honest substrate signature |
|---|---|---|---|
| **Executive personas** | ≥3 | dashboard / analytics / pilot overview | `executive_*@persona.unioneyes.app` |
| **Steward personas** | ≥5 | stewards page / case assignment / steward transition / cadence emission | `steward_*@persona.unioneyes.app` |
| **Governance personas** | ≥3 | governance review / verdict authoring / next-actions | `governance_*@persona.unioneyes.app` |
| **Onboarding personas** | ≥3 | onboarding lineage / invitation accept / first-load preservation | `onboarding_*@persona.unioneyes.app` |
| **Procurement personas** | ≥2 | procurement intake / bulk-import / vendor lineage | `procurement_*@persona.unioneyes.app` |
| **Degraded-runtime personas** | ≥3 | partial-completion cases / queued notifications / cognition-suppressed reviews | `degraded_*@persona.unioneyes.app` |

**Total: ≥19 personas per environment × 2 environments = ≥38 seeded persona records.**

## 2. Seed contract (deterministic, governance-safe)

Each persona row:

- **email** — namespaced under `*@persona.unioneyes.app` (synthetic domain — never deliverable, never confused with real users)
- **org affiliation** — bound to a seed org (NOT default org); explicit `organization_members` row
- **role** — explicit role grant; no implicit-role fallback
- **lineage anchor** — `created_by = 'r6-seed-corpus'` audit attribution (never silently authored)
- **idempotency** — re-running the seed is a no-op via `ON CONFLICT (email) DO NOTHING`
- **PII contract** — no real names; no real phone numbers; no real addresses; synthetic-only

## 3. Live seeding procedure

```powershell
# Staging
$env:PGPASSWORD = "<staging-db-password>"
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" `
  -h <staging-db-fqdn> -U nzila -d nzila_automation `
  -f tooling/seeds/r6-persona-corpus.sql

# Pilot
$env:PGPASSWORD = "<pilot-db-password>"
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" `
  -h <pilot-db-fqdn> -U nzila -d nzila_automation `
  -f tooling/seeds/r6-persona-corpus.sql
```

The `tooling/seeds/r6-persona-corpus.sql` file is shipped by the chore PR; this PR enumerates the contract.

## 4. Validation procedure

```sql
-- per environment:
SELECT
  CASE
    WHEN email LIKE 'executive_%' THEN 'executive'
    WHEN email LIKE 'steward_%' THEN 'steward'
    WHEN email LIKE 'governance_%' THEN 'governance'
    WHEN email LIKE 'onboarding_%' THEN 'onboarding'
    WHEN email LIKE 'procurement_%' THEN 'procurement'
    WHEN email LIKE 'degraded_%' THEN 'degraded'
  END AS persona_class,
  count(*) AS seeded
FROM auth_users
WHERE email LIKE '%@persona.unioneyes.app'
GROUP BY 1
ORDER BY 1;
```

Acceptance: each row meets the count target in the matrix above.

## 5. Anti-pattern enumeration (rejected)

- silent attribution to `system` instead of `r6-seed-corpus`
- seeding into the default org (must use seed orgs)
- non-namespaced email addresses
- silent re-seeding that mutates existing rows
- PII in any persona row

## 6. Cadence

Persona corpus is bound to a stewardship cadence:

- per major governance schema change
- per addition of a new operational surface
- quarterly persona freshness review

## 7. Verdict

R6 protocol is **fully specified, evidence-anchored, governance-safe, anti-surveillance**. Substrate seeding deferred to a discrete chore PR — institutional, bounded, honest.

**Status: DEFERRED. Chore PR: `chore/r6-seeded-persona-corpus-expansion`.**
