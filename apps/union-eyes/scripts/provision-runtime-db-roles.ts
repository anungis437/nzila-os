#!/usr/bin/env tsx
/**
 * provision-runtime-db-roles.ts — idempotent, secret-safe provisioning for
 * the RLS tenant-isolation foundation's two dedicated database roles.
 *
 * What it does, per invocation:
 *   1. Connects using the ADMIN/migration connection string (never the
 *      application's own runtime credential) — read from
 *      PROVISION_ADMIN_DATABASE_URL.
 *   2. Confirms db/migrations/0108_rls_tenant_isolation_foundation.sql has
 *      already created the `union_eyes_runtime` and `union_eyes_system`
 *      roles (NOLOGIN placeholders) — refuses to proceed if either is
 *      missing, rather than creating roles this script doesn't own.
 *   3. Generates a fresh, random password for each role, and issues
 *      `ALTER ROLE ... WITH LOGIN PASSWORD $1` using a parameterized query
 *      (the password is never interpolated into a printed/logged string).
 *   4. Builds the resulting postgres:// connection string for each role
 *      and pushes it into Key Vault as a NEW secret (default names:
 *      `union-eyes-runtime-database-url`, `union-eyes-system-database-url`)
 *      via `az keyvault secret set`, with the value piped through stdin —
 *      never as a command-line argument, never logged.
 *   5. Verifies the final role attributes (NOSUPERUSER, NOBYPASSRLS, etc.)
 *      by reading pg_roles back — logs attributes only, never credentials.
 *
 * This script NEVER prints a password or connection string. Re-running it
 * rotates both roles' passwords and updates both Key Vault secrets — safe
 * to run repeatedly (e.g. on a rotation schedule).
 *
 * Required env vars:
 *   PROVISION_ADMIN_DATABASE_URL   — admin/migration connection string
 *   PROVISION_KEY_VAULT_NAME       — e.g. nzila-staging-kv
 * Optional:
 *   PROVISION_RUNTIME_SECRET_NAME  — default: union-eyes-runtime-database-url
 *   PROVISION_SYSTEM_SECRET_NAME   — default: union-eyes-system-database-url
 *   PROVISION_DB_HOST / PROVISION_DB_NAME / PROVISION_DB_SSLMODE — used to
 *     build the connection string for each role (defaults derived from
 *     PROVISION_ADMIN_DATABASE_URL when not set).
 */
import postgres from 'postgres'
import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'

interface RoleSpec {
  roleName: string
  secretEnvVar: string
  defaultSecretName: string
}

const ROLES: RoleSpec[] = [
  { roleName: 'union_eyes_runtime', secretEnvVar: 'PROVISION_RUNTIME_SECRET_NAME', defaultSecretName: 'union-eyes-runtime-database-url' },
  { roleName: 'union_eyes_system', secretEnvVar: 'PROVISION_SYSTEM_SECRET_NAME', defaultSecretName: 'union-eyes-system-database-url' },
]

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
  const vaultName = process.env.PROVISION_KEY_VAULT_NAME
  if (!adminUrl || !vaultName) {
    console.error('[provision-runtime-db-roles] Missing PROVISION_ADMIN_DATABASE_URL or PROVISION_KEY_VAULT_NAME.')
    process.exit(1)
  }

  const parsedAdminUrl = new URL(adminUrl)
  const sql = postgres(adminUrl, { ssl: 'require', max: 1 })

  try {
    for (const role of ROLES) {
      const [existing] = await sql`SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname = ${role.roleName}`
      if (!existing) {
        throw new Error(
          `Role ${role.roleName} does not exist. Run db/migrations/0108_rls_tenant_isolation_foundation.sql ` +
          `(via the admin connection) before running this script — it creates the role's attributes; ` +
          `this script only sets the LOGIN password and pushes the resulting secret.`,
        )
      }

      const password = generatePassword()
      // Parameterized — the password value never appears in a logged SQL string.
      await sql.unsafe(`ALTER ROLE ${role.roleName} WITH LOGIN PASSWORD $1`, [password])

      const connectionString = buildConnectionString(parsedAdminUrl, role.roleName, password)
      const secretName = process.env[role.secretEnvVar] || role.defaultSecretName
      setKeyVaultSecret(vaultName, secretName, connectionString)

      const [verify] = await sql`
        SELECT rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolcanlogin
        FROM pg_roles WHERE rolname = ${role.roleName}`
      console.log(
        `[provision-runtime-db-roles] ${role.roleName}: password rotated, secret "${secretName}" updated in ${vaultName}. ` +
        `Verified attributes: rolsuper=${verify.rolsuper} rolbypassrls=${verify.rolbypassrls} ` +
        `rolcreatedb=${verify.rolcreatedb} rolcreaterole=${verify.rolcreaterole} rolcanlogin=${verify.rolcanlogin}`,
      )
      if (verify.rolsuper || verify.rolbypassrls || verify.rolcreatedb || verify.rolcreaterole) {
        throw new Error(
          `${role.roleName} has an unexpected privileged attribute after provisioning — refusing to continue. ` +
          `This role must never be superuser/bypassrls/createdb/createrole.`,
        )
      }
    }
    console.log('[provision-runtime-db-roles] Done. Remember to re-run the deploy workflow (or dispatch it manually) so the Container App picks up the new secretrefs.')
  } finally {
    await sql.end({ timeout: 2 })
  }
}

main().catch((err) => {
  console.error('[provision-runtime-db-roles] Failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
