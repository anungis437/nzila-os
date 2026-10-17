import pg from 'pg'
import { describe, expect, it } from 'vitest'
import { storageAuthorityManifest } from '../../db/rls-storage-authority'
import {
  applyV2,
  assertLocalTarget,
  canonicalType,
  catalogDigest,
  createCurrentState,
} from './installer'
import { compileSecurity } from './security'
import {
  assertCurrentModelOwnership,
  currentModelServerDefaults,
  hash,
  quote,
  retainCurrentModelBaseline,
  type CurrentModel,
  type SourceTable,
  type V2Plan,
} from './source'
import { syntheticParameter } from './runtime-security'
import { qualificationExitCode } from './clean-room'

function table(name: string, columns = ['id', 'organization_id']): SourceTable {
  const authority = storageAuthorityManifest.find((entry) => entry.table === name)
  if (!authority) throw new Error(`Test requires current storage authority:${name}`)
  return {
    name,
    columns: columns.map((column) => ({ name: column, type: 'uuid', notNull: false })),
    authority,
    source: 'test-current-model',
    sourceDigest: hash(name),
    foreignKeys: [],
  }
}
function plan(tables: SourceTable[]): V2Plan {
  return {
    contractVersion: '2.0',
    lineage: 'PROSPECTIVE_UE_BOOTSTRAP_V2',
    scope: 'UE_OPERATIONAL',
    currentModels: {
      lineage: 'PROSPECTIVE_UE_BOOTSTRAP_V2',
      contractVersion: '2.0',
      djangoVersion: '5.2.18',
      lockDigest: hash('test'),
      sourceDigests: {},
      models: [],
      ddl: [],
      sourceModelChecks: 'PASS',
      historicalMigrationReplay: false,
      databaseConnectionsDuringCollection: 0,
    },
    statements: [],
    tables,
    decisions: [],
    exclusions: [],
    securityBlockers: [],
    sourceCommitments: {},
  }
}

describe('prospective bootstrap local authority boundaries', () => {
  it('permits only the current commercial transition lookup and returned identifier', () => {
    const compiled = compileSecurity(
      plan([table('commercial_contracts', ['id', 'organization_id', 'contract_number', 'status'])]),
    )
    expect(compiled.rules[0].systemSelectColumns).toEqual(['id', 'contract_number'])
    expect(compiled.rules[0].systemPrivileges).toEqual(['INSERT', 'UPDATE'])
    expect(compiled.statements.join('\n')).toContain(
      'GRANT SELECT ("id", "contract_number") ON TABLE public."commercial_contracts" TO union_eyes_system;',
    )
    expect(compiled.statements.join('\n')).not.toContain(
      'GRANT SELECT ON TABLE public."commercial_contracts" TO union_eyes_system;',
    )
    expect(() => compileSecurity(plan([table('commercial_contracts')]))).toThrow(
      'UE_V2_SYSTEM_PREDICATE_COLUMN_REQUIRED:commercial_contracts',
    )
  })
  it('permits only the source-owned service UPDATE predicate, not broad sync-log reads', () => {
    const source = table('external_data_sync_log', ['id', 'sync_id', 'status'])
    const compiled = compileSecurity(plan([source]))
    expect(compiled.rules[0].systemSelectColumns).toEqual(['sync_id'])
    expect(compiled.rules[0].systemPrivileges).toEqual(['INSERT', 'UPDATE'])
    expect(compiled.statements.join('\n')).toContain(
      'GRANT SELECT ("sync_id") ON TABLE public."external_data_sync_log" TO union_eyes_system;',
    )
    expect(compiled.statements.join('\n')).not.toContain(
      'GRANT SELECT ON TABLE public."external_data_sync_log" TO union_eyes_system;',
    )
    expect(() => compileSecurity(plan([table('external_data_sync_log', ['id'])]))).toThrow(
      'UE_V2_SYSTEM_PREDICATE_COLUMN_REQUIRED:external_data_sync_log',
    )
  })
  it('honors a recorded user-parent override when a child also references a sibling table', () => {
    const workbooks = table('workbooks', ['id', 'claimed_by_user_id'])
    const holders = table('workbook_memory_holders', ['id', 'workbook_id'])
    holders.foreignKeys = [{ column: 'workbook_id', table: 'workbooks', referencedColumn: 'id' }]
    const lineage = table('workbook_governance_lineage_entries', [
      'id',
      'workbook_id',
      'originating_holder_id',
    ])
    lineage.foreignKeys = [
      { column: 'workbook_id', table: 'workbooks', referencedColumn: 'id' },
      { column: 'originating_holder_id', table: 'workbook_memory_holders', referencedColumn: 'id' },
    ]
    const rule = compileSecurity(plan([workbooks, holders, lineage])).rules.find(
      (entry) => entry.table === lineage.name,
    )
    expect(rule?.status).toBe('COMPLETE')
    expect(rule?.predicate).toContain('"workbooks"')
    expect(rule?.predicate).not.toContain('workbook_memory_holders')
  })
  it('distinguishes own-user references from legitimate same-org attribution parents', () => {
    const own = table('ai_usage_metrics', ['id', 'organization_id', 'user_id'])
    own.foreignKeys = [
      { column: 'user_id', table: 'user_management.users', referencedColumn: 'user_id' },
    ]
    const attribution = table('insight_recommendations', [
      'id',
      'organization_id',
      'acknowledged_by',
      'dismissed_by',
    ])
    attribution.foreignKeys = ['acknowledged_by', 'dismissed_by'].map((column) => ({
      column,
      table: 'user_management.users',
      referencedColumn: 'user_id',
    }))
    const current = plan([own, attribution])
    current.authExecution = { compilerSource: 'synthetic-auth-source', roles: [] }
    const rules = compileSecurity(current).rules
    expect(rules.find((rule) => rule.table === own.name)?.checkPredicate).toContain(
      'auth_business_user_parent_authorized',
    )
    const predicate = rules.find((rule) => rule.table === attribution.name)?.checkPredicate
    expect(predicate).toContain('auth_business_member_parent_authorized')
    expect(predicate).not.toContain('auth_business_user_parent_authorized')
    attribution.foreignKeys.push({
      column: 'unclassified_actor',
      table: 'user_management.users',
      referencedColumn: 'user_id',
    })
    expect(() => compileSecurity(current)).toThrow('UE_V2_AUTH_PARENT_SEMANTICS_REQUIRED')
  })
  it('requires authenticated canonical session/membership authority in V2 business policies', () => {
    const current = plan([table('claims')])
    current.authExecution = {
      compilerSource: 'packages/db/src/auth-storage-authority/bootstrap-sql.ts',
      roles: [],
    }
    const compiled = compileSecurity(current)
    const policies = compiled.statements.filter(
      (statement) =>
        statement.startsWith('CREATE POLICY') && statement.includes('TO union_eyes_runtime'),
    )
    expect(policies.length).toBeGreaterThan(0)
    for (const policy of policies)
      expect(policy).toContain('user_management.auth_business_org_authorized')
    expect(compiled.statements.join('\n')).not.toContain('app.is_platform_admin')
  })
  it('does not presume caller server defaults exist in current Django model DDL', () => {
    const current = {
      id: { default: 'gen_random_uuid()', type: 'uuid', notNull: true },
      created_at: { default: 'now()', type: 'timestamp with time zone', notNull: true },
      enabled: { default: true, type: 'boolean', notNull: false },
      declaration_only: { default: 0, type: 'integer', notNull: true },
    }
    const baseline = structuredClone(current)
    retainCurrentModelBaseline(baseline, [
      { name: 'id' },
      { name: 'created_at' },
      { name: 'enabled' },
    ])
    expect(baseline).toEqual({
      id: { type: 'uuid', notNull: true },
      created_at: { type: 'timestamp with time zone', notNull: true },
      enabled: { type: 'boolean', notNull: false },
    })
    expect(current.id.default).toBe('gen_random_uuid()')
    expect(current.created_at.default).toBe('now()')
    expect(current.enabled.default).toBe(true)
  })
  it('materializes only source-proven UUID4 and managed timestamp initialization', () => {
    const column = {
      name: 'id',
      type: 'uuid',
      notNull: true,
      primaryKey: true,
      unique: true,
      index: false,
      hasClientDefault: true,
      clientDefault: null,
      choices: [],
      foreignKey: null,
    }
    const model: CurrentModel = {
      table: 'mobile_devices',
      app: 'notifications',
      model: 'MobileDevices',
      source: 'current-model',
      sourceDigest: hash('current-model'),
      columns: [
        { ...column, defaultKind: 'UUID4' },
        {
          ...column,
          name: 'created_at',
          type: 'timestamp with time zone',
          defaultKind: 'AUDIT_NOW',
        },
        { ...column, name: 'custom', type: 'jsonb', defaultKind: 'CALLABLE' },
        { ...column, name: 'enabled', type: 'boolean', defaultKind: 'SCALAR' },
      ],
      uniqueTogether: [],
      constraints: [],
    }
    expect(currentModelServerDefaults(model)).toEqual([
      'ALTER TABLE public."mobile_devices" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();',
      'ALTER TABLE public."mobile_devices" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;',
    ])
  })
  it('requires canonical model ownership of every current declaration field', () => {
    const model: CurrentModel = {
      table: 'mobile_devices',
      app: 'notifications',
      model: 'MobileDevices',
      source: 'current-model',
      sourceDigest: hash('current-model'),
      columns: [],
      uniqueTogether: [],
      constraints: [],
    }
    expect(() => assertCurrentModelOwnership(model, ['device_token', 'organization_id'])).toThrow(
      'UE_V2_CURRENT_MODEL_OWNERSHIP_GAP:mobile_devices:device_token,organization_id',
    )
    expect(() => assertCurrentModelOwnership(model, [])).not.toThrow()
  })
  it('preserves canonical owner nullability and FK semantics during ownership validation', () => {
    const column = {
      name: 'organization_id',
      type: 'uuid',
      notNull: false,
      primaryKey: false,
      unique: false,
      index: true,
      hasClientDefault: false,
      clientDefault: null,
      choices: [],
      foreignKey: {
        table: 'organizations',
        column: 'id',
        onDelete: 'CASCADE',
        databaseSemantics: 'NO ACTION DEFERRABLE INITIALLY DEFERRED',
      },
    }
    const model: CurrentModel = {
      table: 'mobile_devices',
      app: 'notifications',
      model: 'MobileDevices',
      source: 'current-model',
      sourceDigest: hash('current-model'),
      columns: [column],
      uniqueTogether: [],
      constraints: [],
    }
    const before = JSON.stringify(model)
    assertCurrentModelOwnership(model, ['organization_id'])
    expect(JSON.stringify(model)).toBe(before)
  })
  it('does not report CLI success for failed or missing whole engineering qualification', () => {
    expect(qualificationExitCode({ engineeringReadiness: 'FAIL' })).toBe(1)
    expect(qualificationExitCode({})).toBe(1)
    expect(qualificationExitCode({ engineeringReadiness: 'PASS' })).toBe(0)
  })
  it.each(['production.example', '10.0.0.2', '/var/run/postgresql', ''])(
    'rejects nonlocal host %s',
    (host) => {
      expect(() => assertLocalTarget({ host, port: 5432, database: 'ue_v2_clean_test' })).toThrow(
        'UE_V2_EPHEMERAL_LOCAL_TARGET_REQUIRED',
      )
    },
  )
  it.each(['union_eyes', 'postgres', 'ue_v2_clean_', 'ue_v2_clean_test;DROP DATABASE postgres'])(
    'rejects non-ephemeral database %s',
    (database) => {
      expect(() => assertLocalTarget({ host: '127.0.0.1', port: 5432, database })).toThrow(
        'UE_V2_EPHEMERAL_LOCAL_TARGET_REQUIRED',
      )
    },
  )
  it.each([undefined, 0, 1, 5432.5, 65536])('rejects invalid port %s', (port) => {
    expect(() =>
      assertLocalTarget({ host: '127.0.0.1', port, database: 'ue_v2_clean_test' }),
    ).toThrow('UE_V2_EPHEMERAL_LOCAL_TARGET_REQUIRED')
  })
  it('rejects a connection string that could override the checked local host', () => {
    expect(() =>
      assertLocalTarget({
        host: '127.0.0.1',
        port: 5432,
        database: 'ue_v2_clean_test',
        connectionString: 'postgresql://remote.example/production',
      }),
    ).toThrow('UE_V2_EPHEMERAL_LOCAL_TARGET_REQUIRED')
  })
  it('accepts explicitly named local ephemeral target', () => {
    expect(() =>
      assertLocalTarget({ host: '127.0.0.1', port: 5432, database: 'ue_v2_clean_test' }),
    ).not.toThrow()
  })
  it('denies arbitrary clients before any mutation', async () => {
    const client = new pg.Client()
    await expect(createCurrentState(client, plan([]))).rejects.toThrow(
      'UE_V2_LOCAL_CLIENT_REQUIRED',
    )
    await expect(applyV2(client, plan([]), [])).rejects.toThrow('UE_V2_LOCAL_CLIENT_REQUIRED')
  })
})

describe('source-driven prospective security compilation', () => {
  it.each(['claims', 'grievances', 'security_events'])(
    'preserves nullable %s while requiring own organization',
    (name) => {
      const source = table(name)
      const compiled = compileSecurity(plan([source]))
      expect(source.columns.find((column) => column.name === 'organization_id')?.notNull).toBe(
        false,
      )
      expect(compiled.rules[0].predicate).toContain('"organization_id"::text')
      expect(compiled.rules[0].predicate).not.toContain('IS NULL OR')
      expect(compiled.statements.join('\n')).toContain('FORCE ROW LEVEL SECURITY')
      expect(compiled.statements.join('\n')).toContain(
        "current_setting('app.current_user_id', true)",
      )
    },
  )
  it('does not invent grants or successful geometry for unowned source', () => {
    const source = { ...table('claims'), name: 'unowned_current_relation', authority: null }
    const compiled = compileSecurity(plan([source]))
    expect(compiled.blockers).toHaveLength(1)
    expect(compiled.rules[0].status).toBe('DENY_UNRESOLVED')
    expect(compiled.rules[0].runtimePrivileges).toEqual([])
    expect(compiled.statements.some((statement) => /^GRANT .* ON TABLE/.test(statement))).toBe(
      false,
    )
  })
  it('denies tenant source without its actual organization column', () => {
    const compiled = compileSecurity(plan([table('claims', ['id'])]))
    expect(compiled.rules[0].status).toBe('DENY_UNRESOLVED')
    expect(compiled.statements.some((statement) => /^GRANT .* ON TABLE/.test(statement))).toBe(
      false,
    )
  })
  it('guards a current tenant foreign key against invisible foreign-tenant parents', () => {
    const child = table('grievances', ['id', 'organization_id', 'claim_id'])
    child.foreignKeys = [{ column: 'claim_id', table: 'claims', referencedColumn: 'id' }]
    const compiled = compileSecurity(plan([child, table('claims')]))
    expect(compiled.rules.find((rule) => rule.table === 'grievances')?.checkPredicate).toContain(
      'v2_fk."id" = "grievances"."claim_id"',
    )
  })
  it('is independent of table enumeration order', () => {
    const sources = [table('claims'), table('grievances')]
    expect(compileSecurity(plan(sources))).toEqual(compileSecurity(plan([...sources].reverse())))
  })
  it.each([
    'USER_RLS_REQUIRED',
    'MIXED_GLOBAL_TENANT_RLS_REQUIRED',
    'MULTI_PARTY_RLS_REQUIRED',
  ] as const)(
    'checks visible FK parents classified %s without weakening the child write boundary',
    (classification) => {
      const parent = table('profiles', ['id', 'user_id', 'organization_id'])
      parent.authority = { ...parent.authority!, classification }
      const child = table('grievances', ['id', 'organization_id', 'profile_id'])
      child.foreignKeys = [{ column: 'profile_id', table: parent.name, referencedColumn: 'id' }]
      const compiled = compileSecurity(plan([child, parent]))
      const rule = compiled.rules.find((entry) => entry.table === child.name)!
      expect(rule.writePredicate).toContain('"organization_id"::text')
      expect(rule.checkPredicate).toContain('public."profiles"')
      expect(rule.checkPredicate).toContain('v2_fk."id" = "grievances"."profile_id"')
      expect(rule.checkPredicate).toContain('"profile_id" IS NULL')
    },
  )
  it('uses one restricted invoker helper for self-FK checks without recursive UPDATE visibility', () => {
    const source = table('bargaining_proposals', [
      'id',
      'negotiation_id',
      'parent_proposal_id',
      'superseded_by_id',
    ])
    source.foreignKeys = [
      { column: 'negotiation_id', table: 'negotiations', referencedColumn: 'id' },
      { column: 'parent_proposal_id', table: source.name, referencedColumn: 'id' },
      { column: 'superseded_by_id', table: source.name, referencedColumn: 'id' },
    ]
    const compiled = compileSecurity(plan([source, table('negotiations')]))
    const rule = compiled.rules.find((entry) => entry.table === source.name)!
    expect(rule.status).toBe('COMPLETE')
    expect(rule.writePredicate).not.toContain('ue_v2_visible_parent')
    expect(rule.checkPredicate).toContain('ue_v2_visible_parent')
    const functions = compiled.statements.filter((sql) => sql.startsWith('CREATE FUNCTION'))
    expect(functions).toHaveLength(1)
    expect(functions[0]).toContain('SECURITY INVOKER SET search_path = pg_catalog, pg_temp')
    expect(compiled.statements.join('\n')).not.toContain('SECURITY DEFINER')
    expect(compiled.statements.join('\n')).toMatch(
      /REVOKE ALL ON FUNCTION.*FROM PUBLIC, union_eyes_system/,
    )
  })
  it('retains the current geofence tenant alias instead of inventing organization_id', () => {
    const compiled = compileSecurity(plan([table('geofences', ['id', 'union_local_id'])]))
    expect(compiled.rules[0].predicate).toContain('"union_local_id"::text')
    expect(compiled.rules[0].status).toBe('COMPLETE')
  })
  it('uses the current organization alias for source-classified tenant storage', () => {
    const compiled = compileSecurity(plan([table('integration_registry', ['id', 'org_id'])]))
    expect(compiled.rules[0].predicate).toContain('"org_id"::text')
    expect(compiled.rules[0].status).toBe('COMPLETE')
    expect(compiled.rules[0].runtimePrivileges).toEqual(
      storageAuthorityManifest.find((entry) => entry.table === 'integration_registry')!
        .requiredRuntimePrivileges,
    )
  })
  it('uses both authenticated organization parents for a source-classified read-only junction', () => {
    const source = table('congress_memberships', ['id', 'organization_id', 'congress_id'])
    source.foreignKeys = [
      { column: 'organization_id', table: 'organizations', referencedColumn: 'id' },
      { column: 'congress_id', table: 'organizations', referencedColumn: 'id' },
    ]
    const compiled = compileSecurity(plan([source, table('organizations')]))
    expect(compiled.rules.find((rule) => rule.table === source.name)?.predicate).toContain(
      '"organization_id"::text',
    )
    expect(compiled.rules.find((rule) => rule.table === source.name)?.predicate).toContain(
      '"congress_id"::text',
    )
    expect(compiled.rules.find((rule) => rule.table === source.name)?.runtimePrivileges).toEqual([
      'SELECT',
    ])
  })
  it('retains the document root instead of mistaking a signer participant for tenant ownership', () => {
    const source = table('document_signers', ['id', 'document_id', 'user_id'])
    source.foreignKeys = [
      { column: 'document_id', table: 'signature_documents', referencedColumn: 'id' },
      { column: 'user_id', table: 'profiles', referencedColumn: 'user_id' },
    ]
    const compiled = compileSecurity(
      plan([source, table('signature_documents'), table('profiles', ['id', 'user_id'])]),
    )
    const rule = compiled.rules.find((entry) => entry.table === source.name)!
    expect(rule.status).toBe('COMPLETE')
    expect(rule.predicate).toContain('public."signature_documents"')
    expect(rule.predicate).not.toContain('public."profiles"')
  })
  it('does not install security-definer helpers or blanket runtime grants', () => {
    const sql = compileSecurity(plan([table('claims')])).statements.join('\n')
    expect(sql).not.toMatch(/SECURITY DEFINER|BYPASSRLS|GRANT.*ON ALL TABLES/)
  })
})

describe('exact native catalog commitment', () => {
  it('encodes JSON arrays as JSON rather than node-pg SQL array parameters', () => {
    expect(syntheticParameter('jsonb', [{ synthetic: true }])).toBe('[{"synthetic":true}]')
    expect(syntheticParameter('json', 'synthetic')).toBe('"synthetic"')
    expect(syntheticParameter('jsonb', null)).toBeNull()
    expect(syntheticParameter('text[]', ['synthetic'])).toEqual(['synthetic'])
  })
  it('normalizes only PostgreSQL spelling and typemod whitespace', () => {
    expect(canonicalType('numeric(19, 2)')).toBe('numeric(19,2)')
    expect(canonicalType('varchar(255)')).toBe('character varying(255)')
    expect(canonicalType('numeric(19, 3)')).not.toBe(canonicalType('numeric(19, 2)'))
    expect(canonicalType('text')).not.toBe(canonicalType('uuid'))
  })
  it('changes on a physical object definition change', () => {
    expect(
      catalogDigest([
        { kind: 'column', id: 'public.claims.organization_id', definition: { type: 'uuid' } },
      ]),
    ).not.toBe(
      catalogDigest([
        { kind: 'column', id: 'public.claims.organization_id', definition: { type: 'text' } },
      ]),
    )
  })
  it('quotes identifiers rather than treating them as SQL', () => {
    expect(quote('x"; DROP TABLE claims; --')).toBe('"x""; DROP TABLE claims; --"')
  })
})
