# Full Auth & Identity Isolation Hardening

> **Authority:** Sovereign identity resolution across dev, staging, demo,
> and pilot. Authorizes downstream PR `feat/auth-identity-isolation`.

> **Doctrine:** Identity resolution must be deterministic and sovereign.
> No environment may bleed identity context into another. Every persona
> resolves to exactly one organization, exactly one role, exactly one
> session disposition.

---

## 1. Audit surface

The hardening covers the union-eyes auth substrate enumerated in
`docs/nzila-runtime-integrity/full-auth-role-lineage-audit.md`:

- `auth()` (canonical resolver — PG-session-first, Entra-fallback)
- `currentUser()` (Next-style accessor)
- `getUserRole`, `getOrganizationIdForUser`
- session table `auth_user_sessions`
- membership table `organization_members`
- Entra-mapped membership `auth_organization_users`
- session cookie `nzila_session`
- selected-org cookie `selected_org_id`
- active-org context `active-organization`

Plus the upstream tables enumerated in
`docs/nzila-runtime-integrity/full-organization-identity-convergence.md`:

- `default_organization_id` on the user record
- `selected_org_id` on the session
- `active-organization` resolution priority

---

## 2. Identity bleed risks (enumerated)

The hardening contract closes the following identity bleed paths:

- **default-org collapse** — when `default_organization_id` is unset and
  `selected_org_id` is unset, no environment may default to an org from
  another environment's seed.
- **role ambiguity** — `getUserRole(userId, orgId)` must return exactly one
  role; multi-role membership is rejected at write time, not resolved
  optimistically at read time.
- **persona drift** — seeded personas in dev / demo / pilot must not share
  user IDs, email addresses, or org memberships. Persona substrates are
  sovereign per environment.
- **redirect ambiguity** — post-sign-in redirect derives from `(role, org,
  environment)` exactly; no environment may inherit another's redirect map.
- **session inconsistency** — `nzila_session` cookie domain must be
  environment-bound (`demo.unioneyes.app`, `staging.unioneyes.app`, etc.);
  no cookie may carry a parent domain (`unioneyes.app`) that crosses tiers.
- **auth degradation** — when Entra is unavailable, the resolver falls back
  to PG-session-only with explicit governance banner; never silently into
  unauthenticated context.

---

## 3. Sovereign identity per environment

| Environment | Persona substrate                            | Org IDs source              | Cookie domain               |
| ----------- | -------------------------------------------- | --------------------------- | --------------------------- |
| dev         | local `seed-test-env`                        | local DB                    | `localhost`                 |
| staging     | sovereign `seed-test-env` (staging seed)     | staging DB                  | `staging-app.unioneyes.app` |
| demo        | sovereign `seed-test-env` (demo seed)        | demo DB                     | `demo.unioneyes.app`        |
| pilot       | sovereign `seed-test-env` (pilot seed)       | pilot DB (post-fabric)      | `pilot.unioneyes.app`       |

The cookie-domain row is the operational discriminator. A cookie scoped to
`.unioneyes.app` would cross-bind sessions across tiers; this is
forbidden by the contract.

---

## 4. Auth resolution contract

`auth()` resolves identity in this order (no skipping, no shortcut):

1. PG session — `nzila_session` cookie → `auth_user_sessions` row → user
2. Entra JWT fallback — only when PG session is absent and Entra is
   available; sets `entra` envelope; never overwrites a PG session
3. Anonymous — explicit `null` user; never an "ambient" identity

The resolver returns a structured envelope with `user`, `org`, `role`,
`session`, `entra`, `disposition` (one of `pg`, `entra`, `anonymous`,
`degraded`). Consumers branch on `disposition`, not on field presence.

---

## 5. Org resolution contract

`getOrganizationIdForUser(userId)` is the canonical org resolver. It:

1. checks `selected_org_id` on the active session
2. falls back to `default_organization_id` on the user
3. falls back to the first `organization_members` row (deterministically
   ordered by `joined_at ASC, organization_id ASC`)
4. returns `null` if no membership exists — never an Entra group GUID

`auth().orgId` (which currently surfaces an Entra group GUID via
`entraProfile.groups[0]`) is **not** authoritative for app-level org lookups.
This is recorded as a known footgun in the User memory; the hardening
contract enforces it via lint rule + code review.

---

## 6. Anti-bleed guarantees

The hardening contract forbids:

- shared user IDs across environment seeds
- shared email addresses across environment seeds
- shared `organization_members` rows across environments
- shared `auth_user_sessions` rows
- shared `bootstrapE2EAuth` outputs
- redirect maps that resolve to another environment's URL
- role navigation that depends on an environment heuristic

---

## 7. Authorized downstream PR

`feat/auth-identity-isolation`: adds the lint rule that bans
`auth().orgId` for membership queries, refactors `getOrganizationIdForUser`
into the canonical resolver, scopes the `nzila_session` cookie domain per
environment, and adds vitest coverage for each disposition (`pg`, `entra`,
`anonymous`, `degraded`). No persona renames. No mass migration of
existing sessions.

---

## 8. Verdict (live, May 9, 2026)

| Environment | PG session | Entra fallback | Cookie domain               | Verdict        |
| ----------- | ---------- | -------------- | --------------------------- | -------------- |
| dev         | functional | functional     | `localhost`                 | CONDITIONAL GO |
| staging     | functional | functional     | `staging-app.unioneyes.app` | CONDITIONAL GO |
| demo        | functional | functional     | `demo.unioneyes.app`        | GO             |
| pilot       | n/a        | n/a            | `pilot.unioneyes.app`       | NO-GO (no fabric) |

Identity bleed risks are enumerated and bounded. Demo holds the institutional
disposition; staging requires the resolver refactor PR; pilot awaits fabric.
