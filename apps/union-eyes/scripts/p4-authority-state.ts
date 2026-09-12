#!/usr/bin/env tsx
import postgres from 'postgres'

const EXPECTED_HOST = 'nzila-os-union-eyes-prod-db.postgres.database.azure.com'
const EXPECTED_DATABASE = 'nzila_os_prod'
const MIGRATIONS = [
  ['auth_core', '0003_rename_clerk_organization_id'],
  ['content', '0002_pilotapplications_verified_organization'],
  ['content', '0003_pilotapplications_commercial_terms'],
  ['core', '0003_automation_rules_organization_id'],
] as const
const EXPECTED_POLICIES = [
  'ue_org_isolation_delete',
  'ue_org_isolation_insert',
  'ue_org_isolation_select',
  'ue_org_isolation_update',
  'ue_system_full_access',
]

type Mode = 'preflight' | 'attest'
type Column = {
  column_name: string
  data_type: string
  character_maximum_length: number | null
  is_nullable: 'YES' | 'NO'
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function parseMode(): Mode {
  const value = process.argv.find((argument) => argument.startsWith('--mode='))?.split('=')[1]
  if (value !== 'preflight' && value !== 'attest') {
    throw new Error('Expected --mode=preflight or --mode=attest')
  }
  return value
}

function validateTarget(rawUrl: string) {
  const url = new URL(rawUrl)
  const disposableTestTarget = process.env.NODE_ENV === 'test'
    && process.env.UE_P4_ALLOW_DISPOSABLE_TEST_TARGET === '1'
    && ['localhost', '127.0.0.1'].includes(url.hostname)
  requireCondition(['postgres:', 'postgresql:'].includes(url.protocol), 'Unsupported database URL scheme')
  requireCondition(
    url.hostname === EXPECTED_HOST || disposableTestTarget,
    'Database hostname is not the canonical production server',
  )
  requireCondition(decodeURIComponent(url.pathname.slice(1)) === EXPECTED_DATABASE, 'Database name is not the canonical production database')
  requireCondition(Boolean(url.username && url.password), 'Migration-admin database URL is incomplete')
  return disposableTestTarget
}

async function columnNames(sql: postgres.Sql, tableName: string) {
  const rows = await sql<{ column_name: string }[]>`
    SELECT column_name
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ${tableName}
  `
  return new Set(rows.map(({ column_name }) => column_name))
}

async function main() {
  const mode = parseMode()
  const databaseUrl = process.env.UE_P4_MIGRATION_ADMIN_DATABASE_URL
  requireCondition(databaseUrl, 'UE_P4_MIGRATION_ADMIN_DATABASE_URL is required')
  const disposableTestTarget = validateTarget(databaseUrl)

  const sql = postgres(databaseUrl, { ssl: disposableTestTarget ? false : 'require', max: 1, prepare: false })
  try {
    const [identity] = await sql<{ database_name: string }[]>`SELECT current_database() AS database_name`
    requireCondition(identity?.database_name === EXPECTED_DATABASE, 'Connected database identity mismatch')

    const [tableIdentity] = await sql<{ exists: boolean }[]>`
      SELECT to_regclass('public.automation_rules') IS NOT NULL AS exists
    `
    requireCondition(tableIdentity?.exists, 'public.automation_rules is absent')
    const [table] = await sql<{ row_count: number }[]>`
      SELECT count(*)::int AS row_count FROM public.automation_rules
    `

    const columns = await sql<Column[]>`
      SELECT column_name, data_type, character_maximum_length, is_nullable
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'automation_rules'
         AND column_name IN ('organization_id', 'org_id')
       ORDER BY column_name
    `
    const canonical = columns.find(({ column_name }) => column_name === 'organization_id')
    const legacy = columns.find(({ column_name }) => column_name === 'org_id')
    requireCondition(!(canonical && legacy), 'Ambiguous dual ownership geometry')

    const indexes = await sql<{ indexname: string; indexdef: string }[]>`
      SELECT indexname, indexdef
        FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = 'automation_rules'
         AND indexname IN ('idx_automation_rules_org', 'automation_rules_org_idx')
       ORDER BY indexname
    `
    const indexNames = new Set(indexes.map(({ indexname }) => indexname))
    const [legacyForeignKey] = await sql<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'public.automation_rules'::regclass
           AND conname = 'automation_rules_org_id_organizations_id_fk'
      ) AS exists
    `
    const [rls] = await sql<{ relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
      SELECT relrowsecurity, relforcerowsecurity
        FROM pg_class
       WHERE oid = 'public.automation_rules'::regclass
    `
    const policies = await sql<{
      policyname: string
      cmd: string
      roles: string[]
      using_expression: string | null
      check_expression: string | null
    }[]>`
      SELECT policyname, cmd, roles, qual::text AS using_expression, with_check::text AS check_expression
        FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'automation_rules'
       ORDER BY policyname
    `
    const grants = await sql<{ grantee: string; privilege_type: string }[]>`
      SELECT grantee, privilege_type
        FROM information_schema.role_table_grants
       WHERE table_schema = 'public'
         AND table_name = 'automation_rules'
         AND grantee IN ('union_eyes_runtime', 'union_eyes_system')
       ORDER BY grantee, privilege_type
    `
    const migrationApps = MIGRATIONS.map(([app]) => app)
    const migrationNames = MIGRATIONS.map(([, name]) => name)
    const ledgerRows = await sql<{ app: string; name: string }[]>`
      SELECT app, name FROM django_migrations
       WHERE app = ANY(${migrationApps}) AND name = ANY(${migrationNames})
       ORDER BY app, name
    `
    const ledger = new Set(ledgerRows.map(({ app, name }) => `${app}.${name}`))

    const authColumns = await columnNames(sql, 'organizations')
    const contentColumns = await columnNames(sql, 'pilot_applications')
    const ledgerGeometry = [
      {
        migration: 'auth_core.0003_rename_clerk_organization_id',
        physical: authColumns.has('auth_provider_org_id') && !authColumns.has('clerk_organization_id'),
      },
      {
        migration: 'content.0002_pilotapplications_verified_organization',
        physical: contentColumns.has('verified_organization_id'),
      },
      {
        migration: 'content.0003_pilotapplications_commercial_terms',
        physical: [
          'verified_member_count',
          'verified_pilot_amount',
          'verified_subscription_plan_id',
          'commercial_terms_approved_by',
          'commercial_terms_approved_at',
        ].every((column) => contentColumns.has(column)),
      },
      {
        migration: 'core.0003_automation_rules_organization_id',
        physical: Boolean(
          canonical?.data_type === 'character varying'
          && canonical.character_maximum_length === 255
          && canonical.is_nullable === 'NO'
          && !legacy
          && indexNames.has('idx_automation_rules_org'),
        ),
      },
    ]
    for (const state of ledgerGeometry) {
      requireCondition(
        !ledger.has(state.migration) || state.physical,
        `Migration ledger and physical schema disagree for ${state.migration}`,
      )
    }
    for (const state of ledgerGeometry.filter(({ migration }) => !migration.startsWith('core.'))) {
      requireCondition(
        ledger.has(state.migration) === state.physical,
        `Unrecorded prerequisite schema exists for ${state.migration}`,
      )
    }

    if (mode === 'preflight') {
      const canonicalSupported = Boolean(
        canonical?.data_type === 'character varying'
        && canonical.character_maximum_length === 255
        && (canonical.is_nullable === 'NO' || table.row_count === 0),
      )
      const legacySupported = Boolean(
        legacy?.data_type === 'uuid'
        && legacy.is_nullable === 'NO'
        && table.row_count === 0
        && legacyForeignKey.exists
        && indexNames.has('automation_rules_org_idx'),
      )
      const absentOwnershipSupported = !canonical && !legacy && table.row_count === 0
      requireCondition(
        canonicalSupported || legacySupported || absentOwnershipSupported,
        'automation_rules geometry is not supported by the reviewed forward migration',
      )
    } else {
      requireCondition(
        MIGRATIONS.every(([app, name]) => ledger.has(`${app}.${name}`)),
        'Required migration ledger is incomplete',
      )
      requireCondition(ledgerGeometry.every(({ physical }) => physical), 'Required physical migration state is incomplete')
      requireCondition(canonical?.data_type === 'character varying', 'organization_id is not varchar')
      requireCondition(canonical.character_maximum_length === 255, 'organization_id length is not 255')
      requireCondition(canonical.is_nullable === 'NO', 'organization_id is nullable')
      requireCondition(!legacy, 'Legacy org_id remains present')
      requireCondition(indexNames.has('idx_automation_rules_org'), 'Canonical ownership index is absent')
      requireCondition(!indexNames.has('automation_rules_org_idx'), 'Legacy ownership index remains present')
      requireCondition(!legacyForeignKey.exists, 'Legacy ownership foreign key remains present')
      requireCondition(rls.relrowsecurity && rls.relforcerowsecurity, 'RLS and FORCE RLS are not both enabled')
      requireCondition(
        JSON.stringify(policies.map(({ policyname }) => policyname)) === JSON.stringify(EXPECTED_POLICIES),
        'automation_rules policy set is not exact',
      )
      const tenantPolicies = policies.filter(({ policyname }) => policyname.startsWith('ue_org_isolation_'))
      requireCondition(tenantPolicies.length === 4, 'Expected four tenant isolation policies')
      for (const policy of tenantPolicies) {
        const expression = `${policy.using_expression ?? ''} ${policy.check_expression ?? ''}`
        requireCondition(expression.includes('organization_id'), `${policy.policyname} uses the wrong ownership column`)
        requireCondition(expression.includes('current_org_id'), `${policy.policyname} lacks tenant context comparison`)
        requireCondition(/\(organization_id\)::text/.test(expression), `${policy.policyname} does not use text comparison mode`)
      }
      requireCondition(
        JSON.stringify(grants) === JSON.stringify([{ grantee: 'union_eyes_system', privilege_type: 'SELECT' }]),
        'automation_rules runtime/system grants are not exact',
      )
    }

    console.log(JSON.stringify({
      mode,
      target: { host: EXPECTED_HOST, database: EXPECTED_DATABASE },
      automationRules: {
        rowCount: table.row_count,
        columns,
        indexes: indexes.map(({ indexname }) => indexname),
        legacyForeignKey: legacyForeignKey.exists,
        rls,
        policies: policies.map(({ policyname, cmd, roles }) => ({ policyname, cmd, roles })),
        grants,
      },
      migrations: MIGRATIONS.map(([app, name]) => ({ app, name, applied: ledger.has(`${app}.${name}`) })),
      result: 'PASS',
    }, null, 2))
  } finally {
    await sql.end({ timeout: 2 })
  }
}

main().catch((error: unknown) => {
  console.error('[p4-authority-state] Check failed; no database mutation was attempted by this command.')
  if (process.env.NODE_ENV === 'test' && process.env.UE_P4_ALLOW_DISPOSABLE_TEST_TARGET === '1') {
    console.error(error instanceof Error ? error.message : 'Unknown disposable-test failure')
  }
  process.exit(1)
})