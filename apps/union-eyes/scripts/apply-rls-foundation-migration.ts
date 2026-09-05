#!/usr/bin/env tsx
/**
 * apply-rls-foundation-migration.ts — the deterministic, idempotent apply
 * step for db/migrations/0108_rls_tenant_isolation_foundation.sql.
 *
 * This exists because the RLS foundation blocker this remediation fixes was
 * itself caused by a migration/deployment-governance gap: security SQL
 * existed in git but nothing in the deployment pipeline ever applied it, so
 * "the migration is in git" never meant "the migration is in the deployed
 * database" (see docs/union-eyes/reality-remediation/26, layer C). This
 * script is the fix for THAT specific gap for migration 0108 — it replaces
 * "a human remembers to run psql ... < 0108.sql" with a scripted, auditable,
 * idempotent, version-controlled apply path that a CI job (or an operator)
 * can invoke deterministically.
 *
 * What it does, in order:
 *   1. Connects using ADMIN/migration authority (never the application's
 *      own runtime credential).
 *   2. Computes and logs the SHA-256 of the migration file being applied —
 *      exact migration/version evidence in the run log.
 *   3. Applies db/migrations/0108_rls_tenant_isolation_foundation.sql
 *      verbatim. The migration itself is idempotent (DROP POLICY IF EXISTS
 *      / CREATE OR REPLACE FUNCTION / guarded role creation) — safe to
 *      re-run.
 *   4. Verifies the two roles it creates exist with the expected
 *      IMMUTABLE privilege attributes (NOSUPERUSER, NOBYPASSRLS,
 *      NOCREATEDB, NOCREATEROLE, NOREPLICATION) — these never change
 *      across the role's lifecycle. LOGIN capability is intentionally NOT
 *      checked against a fixed expected value here: 0108 creates the roles
 *      NOLOGIN, and scripts/provision-runtime-db-roles.ts later flips them
 *      to LOGIN — both states are valid depending on where an environment
 *      is in its rollout, and this script must remain safe to re-run
 *      AFTER provisioning (idempotent) without falsely failing on a role
 *      that has since been provisioned. Pass --expect-pre-provisioning to
 *      additionally assert NOLOGIN specifically (useful for a first-time
 *      rollout, to prove no login capability existed before this step ran).
 *
 * It does NOT provision LOGIN credentials or touch Key Vault — that is
 * scripts/provision-runtime-db-roles.ts, run as the next step in the
 * rollout sequence (see the fix PR description for the full order).
 *
 * Required env: RLS_MIGRATION_ADMIN_DATABASE_URL (or ADMIN_DATABASE_URL).
 * Never prints the connection string.
 */
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const MIGRATION_PATH = resolve(__dirname, '../db/migrations/0108_rls_tenant_isolation_foundation.sql')
const EXPECTED_ROLES = ['union_eyes_runtime', 'union_eyes_system'] as const

async function main() {
  const expectPreProvisioning = process.argv.includes('--expect-pre-provisioning')
  const adminUrl = process.env.RLS_MIGRATION_ADMIN_DATABASE_URL || process.env.ADMIN_DATABASE_URL
  if (!adminUrl) {
    console.error('[apply-rls-foundation-migration] Missing RLS_MIGRATION_ADMIN_DATABASE_URL / ADMIN_DATABASE_URL.')
    process.exit(1)
  }

  const migrationSql = readFileSync(MIGRATION_PATH, 'utf8')
  const migrationHash = createHash('sha256').update(migrationSql).digest('hex')
  console.log(`[apply-rls-foundation-migration] Applying ${MIGRATION_PATH}`)
  console.log(`[apply-rls-foundation-migration] SHA-256: ${migrationHash}`)

  const sql = postgres(adminUrl, { ssl: adminUrl.includes('localhost') ? false : 'require', max: 1, prepare: false })

  try {
    await sql.unsafe(migrationSql)
    console.log('[apply-rls-foundation-migration] Migration applied without error.')

    const roles = await sql<{
      rolname: string
      rolcanlogin: boolean
      rolsuper: boolean
      rolbypassrls: boolean
      rolcreatedb: boolean
      rolcreaterole: boolean
      rolreplication: boolean
    }[]>`
      SELECT rolname, rolcanlogin, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication
      FROM pg_roles WHERE rolname = ANY(${EXPECTED_ROLES as unknown as string[]})`

    const found = new Map(roles.map((r) => [r.rolname, r]))
    let allGood = true
    for (const roleName of EXPECTED_ROLES) {
      const role = found.get(roleName)
      if (!role) {
        console.error(`[apply-rls-foundation-migration] FAIL: role ${roleName} does not exist after applying the migration.`)
        allGood = false
        continue
      }
      // Immutable across the role's lifecycle — always enforced, regardless
      // of whether provisioning has run yet.
      const bad: string[] = []
      if (role.rolsuper) bad.push('rolsuper=true')
      if (role.rolbypassrls) bad.push('rolbypassrls=true')
      if (role.rolcreatedb) bad.push('rolcreatedb=true')
      if (role.rolcreaterole) bad.push('rolcreaterole=true')
      if (role.rolreplication) bad.push('rolreplication=true')
      // LOGIN capability is lifecycle-dependent (0108 creates NOLOGIN;
      // provision-runtime-db-roles.ts later grants LOGIN) — only checked
      // when the caller explicitly asserts the pre-provisioning stage.
      if (expectPreProvisioning && role.rolcanlogin) {
        bad.push('rolcanlogin=true (--expect-pre-provisioning asserts NOLOGIN at this stage)')
      }
      if (bad.length > 0) {
        console.error(`[apply-rls-foundation-migration] FAIL: role ${roleName} has unexpected attributes: ${bad.join(', ')}`)
        allGood = false
      } else {
        console.log(`[apply-rls-foundation-migration] OK: role ${roleName} exists with expected immutable attributes (NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE, NOREPLICATION); rolcanlogin=${role.rolcanlogin} (lifecycle-dependent, not gated unless --expect-pre-provisioning).`)
      }
    }

    if (!allGood) {
      console.error('[apply-rls-foundation-migration] Role verification failed — do not proceed to provision-runtime-db-roles.ts until this is resolved.')
      process.exit(1)
    }

    console.log('[apply-rls-foundation-migration] Migration + role verification complete. Next: scripts/provision-runtime-db-roles.ts (if not already run for this environment).')
  } finally {
    await sql.end({ timeout: 2 })
  }
}

main().catch((err) => {
  console.error('[apply-rls-foundation-migration] Failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
