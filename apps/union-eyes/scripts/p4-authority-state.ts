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
type Mode = 'preflight' | 'attest'
type Column = {
  column_name: string
  data_type: string
  character_maximum_length: number | null
  is_nullable: 'YES' | 'NO'
}
type IndexGeometry = {
  index_name: string
  access_method: string
  is_valid: boolean
  is_ready: boolean
  is_partial: boolean
  has_expressions: boolean
  is_unique: boolean
  key_count: number
  attribute_count: number
  key_columns: string[]
}
type ForeignKeyGeometry = {
  constraint_name: string
  source_columns: string[]
  target_schema: string
  target_table: string
  target_columns: string[]
  delete_action: string
}
type PolicyGeometry = {
  policyname: string
  permissive: string
  cmd: string
  roles: string[]
  using_expression: string | null
  check_expression: string | null
}

const TENANT_EXPRESSION = "((organization_id)::text = current_setting('app.current_org_id'::text, true))"
const EXPECTED_POLICY_GEOMETRY: PolicyGeometry[] = [
  { policyname: 'ue_org_isolation_delete', permissive: 'PERMISSIVE', cmd: 'DELETE', roles: ['union_eyes_runtime'], using_expression: TENANT_EXPRESSION, check_expression: null },
  { policyname: 'ue_org_isolation_insert', permissive: 'PERMISSIVE', cmd: 'INSERT', roles: ['union_eyes_runtime'], using_expression: null, check_expression: TENANT_EXPRESSION },
  { policyname: 'ue_org_isolation_select', permissive: 'PERMISSIVE', cmd: 'SELECT', roles: ['union_eyes_runtime'], using_expression: TENANT_EXPRESSION, check_expression: null },
  { policyname: 'ue_org_isolation_update', permissive: 'PERMISSIVE', cmd: 'UPDATE', roles: ['union_eyes_runtime'], using_expression: TENANT_EXPRESSION, check_expression: TENANT_EXPRESSION },
  { policyname: 'ue_system_full_access', permissive: 'PERMISSIVE', cmd: 'ALL', roles: ['union_eyes_system'], using_expression: 'true', check_expression: 'true' },
]

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

    const indexes = await sql<IndexGeometry[]>`
      SELECT
        index_class.relname AS index_name,
        access_method.amname AS access_method,
        index_catalog.indisvalid AS is_valid,
        index_catalog.indisready AS is_ready,
        index_catalog.indpred IS NOT NULL AS is_partial,
        index_catalog.indexprs IS NOT NULL AS has_expressions,
        index_catalog.indisunique AS is_unique,
        index_catalog.indnkeyatts::int AS key_count,
        index_catalog.indnatts::int AS attribute_count,
        ARRAY(
          SELECT attribute.attname
            FROM unnest(index_catalog.indkey::smallint[]) WITH ORDINALITY AS key(attnum, position)
            JOIN pg_attribute attribute
              ON attribute.attrelid = table_class.oid AND attribute.attnum = key.attnum
           WHERE key.position <= index_catalog.indnkeyatts
           ORDER BY key.position
        ) AS key_columns
      FROM pg_index index_catalog
      JOIN pg_class table_class ON table_class.oid = index_catalog.indrelid
      JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
      JOIN pg_class index_class ON index_class.oid = index_catalog.indexrelid
      JOIN pg_am access_method ON access_method.oid = index_class.relam
      WHERE table_namespace.nspname = 'public'
        AND table_class.relname = 'automation_rules'
        AND index_class.relname IN ('idx_automation_rules_org', 'automation_rules_org_idx')
      ORDER BY index_class.relname
    `
    const canonicalIndex = indexes.find(({ index_name }) => index_name === 'idx_automation_rules_org')
    const legacyIndex = indexes.find(({ index_name }) => index_name === 'automation_rules_org_idx')
    const indexIsExact = (index: IndexGeometry | undefined, column: string) => Boolean(
      index?.access_method === 'btree'
      && index.is_valid
      && index.is_ready
      && !index.is_partial
      && !index.has_expressions
      && !index.is_unique
      && index.key_count === 1
      && index.attribute_count === 1
      && index.key_columns.length === 1
      && index.key_columns[0] === column,
    )
    const canonicalIndexIsExact = indexIsExact(canonicalIndex, 'organization_id')
    const legacyIndexIsExact = indexIsExact(legacyIndex, 'org_id')

    const [legacyForeignKey] = await sql<ForeignKeyGeometry[]>`
      SELECT
        constraint_catalog.conname AS constraint_name,
        ARRAY(
          SELECT attribute.attname
            FROM unnest(constraint_catalog.conkey) WITH ORDINALITY AS key(attnum, position)
            JOIN pg_attribute attribute
              ON attribute.attrelid = constraint_catalog.conrelid AND attribute.attnum = key.attnum
           ORDER BY key.position
        ) AS source_columns,
        target_namespace.nspname AS target_schema,
        target_table.relname AS target_table,
        ARRAY(
          SELECT attribute.attname
            FROM unnest(constraint_catalog.confkey) WITH ORDINALITY AS key(attnum, position)
            JOIN pg_attribute attribute
              ON attribute.attrelid = constraint_catalog.confrelid AND attribute.attnum = key.attnum
           ORDER BY key.position
        ) AS target_columns,
        CASE constraint_catalog.confdeltype
          WHEN 'a' THEN 'NO ACTION'
          WHEN 'r' THEN 'RESTRICT'
          WHEN 'c' THEN 'CASCADE'
          WHEN 'n' THEN 'SET NULL'
          WHEN 'd' THEN 'SET DEFAULT'
        END AS delete_action
      FROM pg_constraint constraint_catalog
      JOIN pg_class target_table ON target_table.oid = constraint_catalog.confrelid
      JOIN pg_namespace target_namespace ON target_namespace.oid = target_table.relnamespace
      WHERE constraint_catalog.conrelid = 'public.automation_rules'::regclass
        AND constraint_catalog.contype = 'f'
        AND constraint_catalog.conname = 'automation_rules_org_id_organizations_id_fk'
    `
    const legacyForeignKeyIsExact = Boolean(
      legacyForeignKey
      && JSON.stringify(legacyForeignKey.source_columns) === JSON.stringify(['org_id'])
      && legacyForeignKey.target_schema === 'public'
      && legacyForeignKey.target_table === 'organizations'
      && JSON.stringify(legacyForeignKey.target_columns) === JSON.stringify(['id'])
      && legacyForeignKey.delete_action === 'NO ACTION',
    )
    const [rls] = await sql<{ relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
      SELECT relrowsecurity, relforcerowsecurity
        FROM pg_class
       WHERE oid = 'public.automation_rules'::regclass
    `
    const policies = await sql<PolicyGeometry[]>`
      SELECT policyname, permissive, cmd, roles, qual::text AS using_expression, with_check::text AS check_expression
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
          && canonicalIndexIsExact,
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
        && (canonical.is_nullable === 'NO' || table.row_count === 0)
        && (!canonicalIndex || canonicalIndexIsExact)
        && !legacyIndex
        && !legacyForeignKey
      )
      const legacySupported = Boolean(
        legacy?.data_type === 'uuid'
        && legacy.is_nullable === 'NO'
        && table.row_count === 0
        && legacyForeignKeyIsExact
        && legacyIndexIsExact
        && !canonicalIndex,
      )
      const absentOwnershipSupported = !canonical
        && !legacy
        && table.row_count === 0
        && !canonicalIndex
        && !legacyIndex
        && !legacyForeignKey
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
      requireCondition(canonicalIndexIsExact, 'Canonical ownership index geometry is not exact')
      requireCondition(!legacyIndex, 'Legacy ownership index remains present')
      requireCondition(!legacyForeignKey, 'Legacy ownership foreign key remains present')
      requireCondition(rls.relrowsecurity && rls.relforcerowsecurity, 'RLS and FORCE RLS are not both enabled')
      requireCondition(
        JSON.stringify(policies) === JSON.stringify(EXPECTED_POLICY_GEOMETRY),
        `automation_rules policy geometry is not exact: ${JSON.stringify(policies)}`,
      )
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
        indexes,
        legacyForeignKey: legacyForeignKey ?? null,
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