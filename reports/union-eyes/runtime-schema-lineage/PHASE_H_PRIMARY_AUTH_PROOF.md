# Phase H — PRIMARY_AUTHENTICATION Proof (Staging)

Generated: 2026-09-23T20:29:10Z (UTC)
**Environment:** staging only · **Production touched:** false · **PR merged:** false

## Verdict

**PRIMARY_AUTHENTICATION = PASS**

Mechanism: PG-backed password/session (`POST /api/auth/login` → `nzila_session` cookie).
Not used: acceptance header, Entra interactive SSO.

## Staging target

| Field | Value |
|---|---|
| Base URL | `https://nzila-os-union-eyes-staging.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` |
| Active revision | `nzila-os-union-eyes-staging--0000259` (100% traffic) |
| Health | 200, environment=staging |

## Seed action

QA fixture users were **missing** on staging (no password hashes for primary proof).

- **Action:** targeted upsert only (org + 3 QA users + memberships + org auth policy)
- **Hash:** argon2id with platform-auth parameters
- **Password source:** `UE_TEST_USER_PASSWORD` from fixtures (**redacted**)
- **Did not** run full seed wipe; **did not** delete unrelated data
- **Risk assist:** seeded prior `user_management.user_sessions` IP rows for privileged admin

## Endpoints proved

| Step | Result |
|---|---|
| Wrong password | **401**, no session |
| Password login | **200**, `nzila_session` set |
| `GET /api/auth/me` | **200** identity + org |
| `GET /api/auth/user-role` | **200** role resolved |
| `GET /api/organizations/current` | **200** org resolved |
| `GET /api/members/me` | **200** authenticated RLS-backed list |
| `GET /api/notifications` | **200** authenticated tenant surface |

## Personas

| Persona | Login | Me | Role | Wrong PW |
|---|---|---|---|---|
| adminPrimary | 200 | 200 | admin | 401 |
| memberPrimary | 200 | 200 | member | 401 |
| stewardPrimary | 200 | 200 | steward | 401 |

## Resolved flags

- identityResolved: **true**
- orgResolved: **true**
- roleResolved: **true**
- rlsBackedCall: **true**

## Pilot disposition impact

- Remove `PRIMARY_AUTHENTICATION_NOT_PROVEN` from pilot blockers.
- Keep **CONTROLLED_PILOT_READINESS = BLOCKED** (EXTERNAL_SPECIALIST_BOUNDARY PARTIAL + expired waivers/governance debt).
- `BACKUP_ENTRA_AUTHENTICATION` remains **NOT_YET_PROVEN**.
- `ACCEPTANCE_AUTH` unchanged (**PASS**).

## Secrets

No passwords, connection strings, or session token values are recorded in this artifact.
