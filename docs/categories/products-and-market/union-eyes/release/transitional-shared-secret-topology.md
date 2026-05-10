# Transitional Controlled Shared-Secret Topology (TSOSA)

**Status:** Active — non-production environments only
**Owner:** Platform / Union Eyes Release Governance
**Effective:** 2026-05-09
**Scope:** Demo, staging, pilot-prep environments of `nzila-os-union-eyes-*`
**Excluded:** Production environments of `nzila-os-union-eyes-*` (any region)

---

## 1. Statement of Intent

This topology is an intentional transitional operational bridge to accelerate
environment legitimacy validation while preserving production isolation
boundaries.

It is recorded here, in version control, so that:

- Every operator can see what is shared, what is not, and why.
- The runtime exposes the topology in its own metadata
  (`SECRET_TOPOLOGY`, `SECRET_AUTHORITY`, `ENVIRONMENT_ISOLATION`).
- The exit criteria for retiring TSOSA are explicit and enforceable.

Production environments remain prohibited from consuming shared
non-production secret authorities.

---

## 2. What Is Shared and What Is Not

### 2.1 Per-environment Key Vaults (always isolated)

Every Union Eyes environment provisions its own dedicated Key Vault:

| Environment | Per-env Key Vault            | Holds                                                       |
|-------------|------------------------------|-------------------------------------------------------------|
| demo        | `nzila-canada-demo-kv`       | `DB-PASSWORD`, `database-url` (per-env DB credentials only) |
| staging     | `nzila-canada-staging-kv`    | `DB-PASSWORD`, `database-url` (per-env DB credentials only) |
| pilot       | `nzila-canada-pilot-kv`      | `DB-PASSWORD`, `database-url` (per-env DB credentials only) |
| **prod**    | `nzila-canada-production-kv` | **All secrets — no shared authority permitted**             |

**Database credentials are never shared.** Every environment has its own
PostgreSQL Flexible Server, its own admin password, and its own
`DATABASE_URL`, all stored only in that environment's per-env Key Vault.

### 2.2 Transitional Shared Operational Secret Authority

For non-production environments only, the following Key Vault acts as the
**Transitional Shared Operational Secret Authority**:

- **Vault:** `nzila-staging-kv`
  (`https://nzila-staging-kv.vault.azure.net/`)

It currently holds the 15 shared application secrets that Union Eyes runtime
needs but that are not environment-coupled (third-party API keys, signing
secrets, OAuth client secrets, etc.).

The full list of shared secret names is enumerated in
`.secrets/staging-aca-secrets.json` (operator-only, gitignored).

### 2.3 Wiring Pattern

Every non-production Container App resolves secrets via Managed Identity:

- Each ACA has a system-assigned Managed Identity.
- Each MI is granted **Key Vault Secrets User** on:
  - the per-env vault (for `DB-PASSWORD` and `database-url`), and
  - `nzila-staging-kv` (for the 15 shared app secrets).
- Secrets are bound on the Container App as
  `keyvaultref:<vault-uri>/secrets/<name>,identityref:system`.
- Environment variables reference the bound secrets via `secretref:`.

No secret values are ever stored in the Container App definition, in
Bicep, in repository code, or in CI variables.

---

## 3. Accepted Temporary Risk

By granting the demo and pilot Managed Identities **read** access to
`nzila-staging-kv`, we accept that:

- A compromise of the demo or pilot Managed Identity yields read access
  to the 15 non-production shared secrets in `nzila-staging-kv`.
- The blast radius is bounded to non-production third-party integrations
  (which themselves point at sandboxes/test tenants where applicable).
- Production secrets, production DB credentials, and the production Key
  Vault are unaffected by any non-production MI compromise.

This risk is accepted because it is strictly bounded to non-production
operational surface area and because it materially reduces the time and
operational error rate required to validate environment legitimacy.

---

## 4. Production Prohibition

The following are **prohibited** under TSOSA:

- Production Container Apps must not be granted any role on
  `nzila-staging-kv` or any other non-production vault.
- Production environment variables must not contain `secretref:` entries
  resolving to non-production vaults.
- Production must be provisioned with a per-env vault that contains the
  full set of secrets (DB credentials + all shared app secrets) self-
  sufficiently. There is no shared authority for production.
- Production migration off TSOSA is not a refactor — it is an absolute
  starting condition.

`nzila-os-union-eyes-production` and any future production-tier
Container App **must** advertise:

```
SECRET_TOPOLOGY=isolated
SECRET_AUTHORITY=nzila-canada-production-kv
ENVIRONMENT_ISOLATION=full
```

Any production deployment whose runtime metadata advertises
`SECRET_TOPOLOGY=transitional-shared` is a **release-blocking incident**
and must be rolled back immediately.

---

## 5. Runtime Topology Advertisement

All non-production Container Apps under TSOSA carry the following
environment variables, which are surfaced through internal governance
metadata (not the public health endpoint):

| Variable                  | Non-prod value             | Prod value (required)             |
|---------------------------|----------------------------|-----------------------------------|
| `SECRET_TOPOLOGY`         | `transitional-shared`      | `isolated`                        |
| `SECRET_AUTHORITY`        | `nzila-staging-kv`         | `nzila-canada-production-kv`      |
| `ENVIRONMENT_ISOLATION`   | `partial`                  | `full`                            |

Operators may verify topology at runtime by reading these variables on
the Container App revision. They are intentionally not exposed on the
public `/api/health` payload.

---

## 6. Exit Criteria — Retirement of TSOSA

TSOSA is retired (for a given non-production environment) when all of the
following are true:

1. A per-env vault (e.g. `nzila-canada-demo-kv`) holds the full set of
   application secrets — not only DB credentials.
2. The Container App's secret bindings all resolve to the per-env vault.
3. The Managed Identity's Key Vault Secrets User role on
   `nzila-staging-kv` has been removed.
4. Runtime metadata advertises `SECRET_TOPOLOGY=isolated`,
   `SECRET_AUTHORITY=<per-env vault>`, `ENVIRONMENT_ISOLATION=full`.
5. The retirement is recorded in the environment's validation report.

---

## 7. Migration Path to Full Isolation

For each non-production environment, the migration sequence is:

1. Mirror the 15 shared app secrets from `nzila-staging-kv` into the
   per-env vault.
2. Re-bind the Container App's `secretref:` entries to the per-env vault.
3. Roll a new revision and verify health + governance metadata.
4. Revoke the MI's role on `nzila-staging-kv`.
5. Update `SECRET_TOPOLOGY`, `SECRET_AUTHORITY`, `ENVIRONMENT_ISOLATION`
   environment variables to the isolated values.
6. Update the per-environment validation report to record the change.

This sequence is reversible at each step except (4); operators should
not perform (4) until (3) has been verified.

---

## 8. Audit & Enforcement

- The runtime advertisement variables (§5) make TSOSA participation a
  property of the deployed revision. Any environment whose revision lacks
  these variables is operating outside of governed topology.
- A future contract test should assert that any environment with
  `NZILA_MODE=production` (or `UE_ENVIRONMENT=production`) advertises
  `SECRET_TOPOLOGY=isolated`. Until that test exists, operators must
  enforce it manually as part of the production release checklist.
- The list of MIs holding **Key Vault Secrets User** on
  `nzila-staging-kv` is the canonical inventory of TSOSA participants.
  An operator must review it before any production cutover.
