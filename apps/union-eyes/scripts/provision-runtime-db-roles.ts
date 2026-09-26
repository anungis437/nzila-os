#!/usr/bin/env tsx
/**
 * provision-runtime-db-roles.ts — idempotent, secret-safe, SELF-CONTAINED
 * provisioning for the RLS tenant-isolation foundation's two dedicated
 * database roles (`union_eyes_runtime`, `union_eyes_system`).
 *
 * Canonical split (do not blur it):
 *   principal provisioning (this script) → creates/configures the PRINCIPALS
 *     ONLY — role existence, minimal security attributes, LOGIN, password, and
 *     the single database-CONNECT prerequisite.
 *   scoped migration layer (db/migrations-cache) → owns the application
 *     table/sequence/function privilege envelope.
 *
 * What it does, per invocation:
 *   1. Connects using the ADMIN/migration connection string (never the
 *      application's own runtime credential) — read from
 *      PROVISION_ADMIN_DATABASE_URL. SSL mode is PROVISION_DB_SSLMODE
 *      (require | prefer | disable; default require).
 *   2. Ensures each role EXISTS with the exact minimal security envelope —
 *      creating it if absent, normalizing its attributes if present. It does
 *      NOT require db/migrations/0108 to have been replayed first.
 *   3. Sets the LOGIN password from Key Vault mode (fresh random, rotated) or,
 *      when no Key Vault is configured, from the per-role env var
 *      (UNION_EYES_RUNTIME_DB_PASSWORD / UNION_EYES_SYSTEM_DB_PASSWORD). Never
 *      hard-coded, never logged.
 *   4. Grants ONLY database CONNECT (a role prerequisite). It deliberately
 *      issues NO table/sequence/function grants — a broad ALL-TABLES pre-grant
 *      would mask a missing per-table grant in the scoped migration layer.
 *   5. In Key Vault mode, pushes the resulting postgres:// connection string
 *      into Key Vault via `az keyvault secret set` (value piped through stdin).
 *   6. Verifies the final role attributes (LOGIN, INHERIT, NOSUPERUSER,
 *      NOBYPASSRLS, NOCREATEDB, NOCREATEROLE, NOREPLICATION) and fails closed
 *      on any escalation — logs attributes only, never credentials.
 *
 * Safe to run repeatedly (create-if-absent + normalize-if-present).
 *
 * Required env vars:
 *   PROVISION_ADMIN_DATABASE_URL   — admin/migration connection string
 * Credential source (exactly one):
 *   PROVISION_KEY_VAULT_NAME       — e.g. nzila-staging-kv (rotate + push), OR
 *   UNION_EYES_RUNTIME_DB_PASSWORD + UNION_EYES_SYSTEM_DB_PASSWORD — env/secret
 *     passwords used when no Key Vault is configured (disposable/source-native).
 * Optional:
 *   PROVISION_DB_SSLMODE           — require | prefer | disable (default require)
 *   PROVISION_RUNTIME_SECRET_NAME  — default: union-eyes-runtime-database-url
 *   PROVISION_SYSTEM_SECRET_NAME   — default: union-eyes-system-database-url
 */
import postgres from 'postgres'
import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'

interface RoleSpec {
  roleName: string
  secretEnvVar: string
  defaultSecretName: string
  passwordEnvVar: string
}

const ROLES: RoleSpec[] = [
  { roleName: 'union_eyes_runtime', secretEnvVar: 'PROVISION_RUNTIME_SECRET_NAME', defaultSecretName: 'union-eyes-runtime-database-url', passwordEnvVar: 'UNION_EYES_RUNTIME_DB_PASSWORD' },
  { roleName: 'union_eyes_system', secretEnvVar: 'PROVISION_SYSTEM_SECRET_NAME', defaultSecretName: 'union-eyes-system-database-url', passwordEnvVar: 'UNION_EYES_SYSTEM_DB_PASSWORD' },
]

// Exact, minimal security envelope both principals must carry. NEVER superuser,
// bypassrls, createdb, createrole, or replication. LOGIN is set separately (with
// the password) so a role can be created NOLOGIN first and only made a login
// role once a credential exists.
const ROLE_SECURITY_ATTRS = 'NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT'

function assertSafeRoleName(name: string): void {
  // Role names are hard-coded constants; this guard keeps the identifier
  // interpolation below injection-proof even if the constant list is edited.
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`Refusing to provision unsafe role name: ${JSON.stringify(name)}`)
  }
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

function generatePassword(): string {
  // 32 bytes -> base64url, no characters that need percent-encoding awkwardness beyond what buildConnectionString already handles.
  return randomBytes(32).toString('base64').replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' }[c] as string))
}

function buildConnectionString(baseUrl: URL, roleName: string, password: string): string {
  const url = new URL(baseUrl.toString())
  url.username = roleName
  url.password = password
  return url.toString()
}

function setKeyVaultSecret(vaultName: string, secretName: string, value: string): void {
  // --file /dev/stdin (POSIX only — this script is intended to run on the
  // GitHub Actions ubuntu-latest runner, same as the rest of the deploy
  // pipeline) avoids the value ever appearing as a literal CLI argument.
  const result = spawnSync(
    'az',
    ['keyvault', 'secret', 'set', '--vault-name', vaultName, '--name', secretName, '--file', '/dev/stdin', '--output', 'none'],
    { input: value, stdio: ['pipe', 'inherit', 'inherit'] },
  )
  if (result.status !== 0) {
    throw new Error(`az keyvault secret set failed for ${secretName} (exit ${result.status})`)
  }
}

async function main() {
  const adminUrl = process.env.PROVISION_ADMIN_DATABASE_URL
  if (!adminUrl) {
    console.error('[provision-runtime-db-roles] Missing PROVISION_ADMIN_DATABASE_URL.')
    process.exit(1)
  }
  // Key Vault is the production credential sink. When it is absent (e.g. a
  // disposable source-native bootstrap), the LOGIN password is taken from the
  // per-role env var instead — never hard-coded, never logged.
  const vaultName = process.env.PROVISION_KEY_VAULT_NAME || ''
  const sslMode = (process.env.PROVISION_DB_SSLMODE || 'require').toLowerCase()
  const ssl = sslMode === 'disable' ? false : sslMode === 'prefer' ? 'prefer' : 'require'

  const parsedAdminUrl = new URL(adminUrl)
  const sql = postgres(adminUrl, { ssl, max: 1 })

  try {
    const [{ current_database: dbName }] = await sql<{ current_database: string }[]>`SELECT current_database()`

    for (const role of ROLES) {
      assertSafeRoleName(role.roleName)

      // (1) PRINCIPAL PROVISIONING ONLY — create the role if absent, or
      // normalize its security attributes if present. Self-contained: does NOT
      // require the frozen db/migrations/0108 lineage to have been replayed.
      const [existing] = await sql`SELECT 1 AS present FROM pg_roles WHERE rolname = ${role.roleName}`
      if (!existing) {
        await sql.unsafe(`CREATE ROLE ${role.roleName} ${ROLE_SECURITY_ATTRS} NOLOGIN`)
      } else {
        await sql.unsafe(`ALTER ROLE ${role.roleName} ${ROLE_SECURITY_ATTRS}`)
      }

      // (2) Resolve the LOGIN password: rotate-and-push in Key Vault mode, or
      // take it from the per-role env var. Never hard-coded.
      let password: string
      if (vaultName) {
        password = generatePassword()
      } else {
        const envPw = process.env[role.passwordEnvVar]
        if (!envPw) {
          throw new Error(
            `No PROVISION_KEY_VAULT_NAME set and ${role.passwordEnvVar} is unset. ` +
            `Provide the role password via ${role.passwordEnvVar} (env/secret) or configure Key Vault.`,
          )
        }
        if (envPw.includes('$pw$')) {
          throw new Error(`${role.passwordEnvVar} must not contain the substring "$pw$".`)
        }
        password = envPw
      }
      await sql.unsafe(`ALTER ROLE ${role.roleName} WITH LOGIN PASSWORD $pw$${password}$pw$`)

      // (3) ROLE PREREQUISITE ONLY — database CONNECT so the principal can
      // connect at all. Deliberately NO table/sequence/function grants: the
      // application privilege envelope is owned by the scoped migration layer
      // (db/migrations-cache), never pre-granted here (a broad ALL TABLES grant
      // would mask a missing per-table grant in the scoped migrations).
      await sql.unsafe(`GRANT CONNECT ON DATABASE ${quoteIdent(dbName)} TO ${role.roleName}`)

      // (4) Publish the resulting credential (production Key Vault path only).
      if (vaultName) {
        const connectionString = buildConnectionString(parsedAdminUrl, role.roleName, password)
        const secretName = process.env[role.secretEnvVar] || role.defaultSecretName
        setKeyVaultSecret(vaultName, secretName, connectionString)
      }

      // (5) Verify the final attribute envelope; fail closed on any escalation.
      const [verify] = await sql`
        SELECT rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication, rolinherit, rolcanlogin
        FROM pg_roles WHERE rolname = ${role.roleName}`
      const ok =
        !verify.rolsuper && !verify.rolbypassrls && !verify.rolcreatedb &&
        !verify.rolcreaterole && !verify.rolreplication && verify.rolinherit && verify.rolcanlogin
      console.log(
        `[provision-runtime-db-roles] ${role.roleName}: ensured (${vaultName ? `secret "${process.env[role.secretEnvVar] || role.defaultSecretName}" updated in ${vaultName}` : 'password set from env'}). ` +
        `attrs super=${verify.rolsuper} bypassrls=${verify.rolbypassrls} createdb=${verify.rolcreatedb} ` +
        `createrole=${verify.rolcreaterole} replication=${verify.rolreplication} inherit=${verify.rolinherit} login=${verify.rolcanlogin}`,
      )
      if (!ok) {
        throw new Error(
          `${role.roleName} does not carry the required minimal envelope after provisioning ` +
          `(must be LOGIN, INHERIT, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE, NOREPLICATION). Refusing to continue.`,
        )
      }
    }
    console.log('[provision-runtime-db-roles] Done. Principals created/configured only; application table privileges are owned by the scoped migration layer.')
  } finally {
    await sql.end({ timeout: 2 })
  }
}

main().catch((err) => {
  console.error('[provision-runtime-db-roles] Failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
