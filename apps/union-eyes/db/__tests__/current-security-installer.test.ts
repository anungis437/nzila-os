import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { assertNoPartialCurrentSecurityFunctions, executeCurrentFrameworkProgram, joinCurrentSecurityPrograms, planCanonicalOwnership, planCanonicalRoleConvergence, planCurrentAuthColumnConvergence, planCurrentFrameworkProgram, planCurrentIdentityCreation, planVerifiedFrameworkExecuteRestore, type CurrentAuthColumn } from '../../../../tooling/scripts/lib/union-eyes-current-security-installer'
import { frameworkPolicyPreimageQuery, planExistingFrameworkPolicies, planLegacyPhysicalFunctionAdoption } from '../../../../tooling/scripts/lib/union-eyes-current-security-preimage'
import { projectCurrentCompilerSecurity } from '../../../../tooling/scripts/lib/union-eyes-current-security-contract'
import { AUTHORITY_PHYSICAL_GUARDS } from '../auth/authority-physical-guards'
import { CANONICAL_BOOTSTRAP_ROLES } from '../../scripts/bootstrap-v2/execution-roles'
import { buildCurrentPlatformAuthSource, buildCurrentPlatformIdentitySource, type V2Plan } from '../../scripts/bootstrap-v2/source'
import { compileFrameworkSql } from '../../scripts/bootstrap-v2/framework-sql'
import { compileSecurity } from '../../scripts/bootstrap-v2/security'
import { parseSql } from '../../scripts/lib/sql-census/parse'

const roleRows = () => CANONICAL_BOOTSTRAP_ROLES.map(rolname => ({
  rolname, rolsuper: false, rolbypassrls: false, rolcanlogin: false,
  rolinherit: ['ue_v2_owner', 'union_eyes_runtime', 'union_eyes_system'].includes(rolname),
  rolcreatedb: false, rolcreaterole: false,
}))
const edge = () => ({ member: 'ue_framework_gateway', granted: 'ue_framework_identity', admin_option: false, inherit_option: false, set_option: true })

describe('current security role convergence uses source authority', () => {
  it.each([15, 16] as const)('creates only absent canonical roles using PostgreSQL %s source syntax', async major => {
    const empty = await planCanonicalRoleConvergence([], [], major)
    expect(empty.createdRoles).toHaveLength(CANONICAL_BOOTSTRAP_ROLES.length)
    expect(empty.statements.filter(sql => sql.startsWith('CREATE ROLE'))).toHaveLength(CANONICAL_BOOTSTRAP_ROLES.length)
    const existing = await planCanonicalRoleConvergence(roleRows(), [edge()], major)
    expect(existing.createdRoles).toEqual([])
    expect(existing.statements.some(sql => sql.startsWith('CREATE ROLE'))).toBe(false)
    expect(existing.statements.some(sql => sql.includes('ADMIN TRUE'))).toBe(false)
    if (major === 15) expect(existing.statements.join('\n')).not.toContain('WITH ADMIN FALSE, INHERIT')
    else expect(existing.statements.join('\n')).toContain('WITH ADMIN FALSE, INHERIT FALSE, SET TRUE')
  })

  it.each(['rolsuper', 'rolbypassrls', 'rolcanlogin', 'rolcreatedb', 'rolcreaterole'] as const)('refuses unsafe existing %s rather than repairing role authority', async flag => {
    const roles = roleRows()
    roles.find(role => role.rolname === 'union_eyes_runtime')![flag] = true
    await expect(planCanonicalRoleConvergence(roles, [], 16)).rejects.toThrow('Existing canonical role differs')
  })

  it('rejects inheritance drift on either a dedicated gateway or the canonical owner', async () => {
    for (const name of ['ue_framework_gateway', 'ue_v2_owner']) {
      const roles = roleRows(), target = roles.find(role => role.rolname === name)!
      target.rolinherit = !target.rolinherit
      await expect(planCanonicalRoleConvergence(roles, [], 16)).rejects.toThrow('Existing canonical role differs')
    }
  })

  it.each(['admin_option', 'inherit_option', 'set_option'] as const)('rejects changed %s on an existing membership', async flag => {
    const changed = edge()
    changed[flag] = !changed[flag]
    await expect(planCanonicalRoleConvergence(roleRows(), [changed], 16)).rejects.toThrow('Existing canonical membership differs')
  })

  it('rejects an undeclared parent role and duplicate edge facts', async () => {
    await expect(planCanonicalRoleConvergence(roleRows(), [{ ...edge(), granted: 'pg_read_all_data' }], 16)).rejects.toThrow('Existing canonical membership differs')
    await expect(planCanonicalRoleConvergence(roleRows(), [edge(), edge()], 16)).rejects.toThrow('Duplicate canonical membership fact')
  })
})

const source = { tables: [{ name: 'claims' }, { name: 'user_management.users' }] } as Pick<V2Plan, 'tables'>
const relations = () => [
  { schema: 'public', table: 'claims', relkind: 'r', owner: 'original_operator' },
  { schema: 'user_management', table: 'users', relkind: 'r', owner: 'original_operator' },
  { schema: 'public', table: 'retained_historical_table', relkind: 'r', owner: 'original_operator' },
]

describe('current security ownership does not infer new data authority', () => {
  it('changes only source-declared ownership and its owned sequences, retaining historical objects', () => {
    const result = planCanonicalOwnership(source, relations(), [
      { schema: 'public', name: 'claims_sequence', owner: 'original_operator', table_schema: 'public', table_name: 'claims' },
      { schema: 'public', name: 'retained_sequence', owner: 'unrelated_owner', table_schema: 'public', table_name: 'retained_historical_table' },
    ], 'original_operator')
    expect(result.statements).toEqual([
      'ALTER TABLE "public"."claims" OWNER TO ue_v2_owner',
      'ALTER TABLE "user_management"."users" OWNER TO ue_v2_owner',
      'ALTER SEQUENCE "public"."claims_sequence" OWNER TO ue_v2_owner',
    ])
    expect(result.statements.join('\n')).not.toMatch(/DROP|TRUNCATE|DELETE|INSERT|UPDATE/)
  })

  it('does not rewrite already canonical table ownership', () => {
    const rows = relations().map(row => ({ ...row, owner: 'ue_v2_owner' }))
    expect(planCanonicalOwnership(source, rows, [], 'original_operator').statements).toEqual([])
  })

  it('refuses missing source tables, views in place of tables and unexpected owners', () => {
    expect(() => planCanonicalOwnership(source, relations().slice(1), [], 'original_operator')).toThrow('Source relation missing')
    expect(() => planCanonicalOwnership(source, relations().map(row => ({ ...row, relkind: 'v' })), [], 'original_operator')).toThrow('ownership differs')
    expect(() => planCanonicalOwnership(source, relations().map(row => ({ ...row, owner: 'foreign_owner' })), [], 'original_operator')).toThrow('ownership differs')
  })

  it('refuses ownership drift on a source-owned sequence', () => {
    expect(() => planCanonicalOwnership(source, relations(), [{ schema: 'public', name: 'claims_sequence', owner: 'foreign_owner', table_schema: 'public', table_name: 'claims' }], 'original_operator')).toThrow('sequence owner differs')
  })

  it('refuses untrusted source identifiers and namespace substitution', () => {
    expect(() => planCanonicalOwnership({ tables: [{ name: 'public.claims;DROP' }] } as Pick<V2Plan, 'tables'>, relations(), [], 'original_operator')).toThrow('identifier')
    expect(() => planCanonicalOwnership({ tables: [{ name: 'foreign_schema.claims' }] } as Pick<V2Plan, 'tables'>, relations(), [], 'original_operator')).toThrow('namespace')
  })
})

describe('absent current shared identity uses the canonical source producer', () => {
  let producer: Awaited<ReturnType<typeof buildCurrentPlatformIdentitySource>>
  beforeAll(async () => { producer = await buildCurrentPlatformIdentitySource() })
  const existing = () => [{ schema: 'user_management', table: 'users', relkind: 'r', owner: 'original_operator' }]
  const fixture = () => ({
    contractVersion: '2.0', lineage: 'PROSPECTIVE_UE_BOOTSTRAP_V2', scope: 'UE_OPERATIONAL',
    statements: structuredClone(producer.statements),
    tables: [structuredClone(producer.table), { name: 'user_management.users' }],
    securityBlockers: [], sourceCommitments: { [producer.source]: producer.sourceDigest },
  }) as V2Plan

  it('preserves the existing canonical IDs, declaration metadata and exact DDL bytes', () => {
    const current = JSON.parse(readFileSync(new URL('../../../../docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json', import.meta.url), 'utf8')) as V2Plan
    expect(current.statements.filter(statement => statement.canonicalId.startsWith('PLATFORM_IDENTITY_CURRENT:'))).toEqual(producer.statements)
    expect(current.tables.find(table => table.name === producer.table.name)).toEqual(producer.table)
  })

  it('materializes only the absent contained declaration with its exact FORCE/RLS/deny program', async () => {
    const result = await planCurrentIdentityCreation(fixture(), existing(), [], producer)
    expect(result.statements).toEqual(producer.statements.map(statement => statement.sql))
    expect(result.objectNames).toEqual(['platform_identity_bindings', 'platform_identity_bindings_pkey', 'platform_identity_provider_subject_uidx', 'platform_identity_user_idx'])
    expect(result.denyStatements).toEqual([
      'ALTER TABLE public."platform_identity_bindings" ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE public."platform_identity_bindings" FORCE ROW LEVEL SECURITY;',
      'REVOKE ALL ON TABLE public."platform_identity_bindings" FROM PUBLIC, union_eyes_runtime, union_eyes_system;',
    ])
    expect(result.statements.join('\n')).not.toMatch(/IF NOT EXISTS|\b(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP)\s+(?:INTO|FROM|TABLE)\b/)
    expect(result.denyStatements.join('\n')).not.toContain('GRANT')
  })

  it('denies every other missing source table and duplicate identity declarations', async () => {
    const other = fixture(); other.tables.push({ name: 'claims' } as V2Plan['tables'][number])
    await expect(planCurrentIdentityCreation(other, existing(), [], producer)).rejects.toThrow('prerequisites are missing')
    const duplicate = fixture(); duplicate.tables.push(structuredClone(producer.table))
    await expect(planCurrentIdentityCreation(duplicate, existing(), [], producer)).rejects.toThrow('declaration or SQL producer differs')
  })

  it.each(['view', 'empty-table', 'foreign-owner', 'apparently-current-table'])('refuses present %s instead of adopting a partial installation', async kind => {
    const row = { schema: 'public', table: 'platform_identity_bindings', relkind: kind === 'view' ? 'v' : 'r', owner: kind === 'foreign-owner' ? 'alien_owner' : 'ue_v2_owner', columns: [] }
    await expect(planCurrentIdentityCreation(fixture(), [...existing(), row], [], producer)).rejects.toThrow('present, partial or conflicting')
  })

  it.each([
    ['relation', 'platform_identity_bindings'], ['type', 'platform_identity_bindings'],
    ['type', '_platform_identity_bindings'], ['index', 'platform_identity_bindings_pkey'],
    ['index', 'platform_identity_provider_subject_uidx'],
  ])('refuses an existing conflicting %s %s before any source creation', async (kind, name) => {
    await expect(planCurrentIdentityCreation(fixture(), existing(), [{ kind, name }], producer)).rejects.toThrow('present, partial or conflicting')
  })

  it.each([
    ['default', 0, "DEFAULT 'active'", "DEFAULT 'revoked'"],
    ['check', 0, "'disabled', 'revoked'", "'disabled', 'unverified'"],
    ['foreign-key', 1, '("user_id")', '("email")'],
    ['index-uniqueness', 2, 'CREATE UNIQUE INDEX', 'CREATE INDEX'],
    ['target', 3, 'ON "platform_identity_bindings"', 'ON "users"'],
  ] as const)('rejects substituted %s SQL even with unchanged source digest', async (_label, index, from, to) => {
    const changed = fixture(), original = changed.statements[index].sql
    changed.statements[index].sql = original.replace(from, to)
    expect(changed.statements[index].sql).not.toBe(original)
    await expect(planCurrentIdentityCreation(changed, existing(), [], producer)).rejects.toThrow('declaration or SQL producer differs')
  })

  it.each(['source', 'digest', 'type', 'nullability', 'authority'])('rejects substituted declaration %s metadata', async kind => {
    const changed = fixture(), table = changed.tables[0]
    if (kind === 'source') table.source = 'untrusted/schema.ts'
    if (kind === 'digest') changed.sourceCommitments[producer.source] = '0'.repeat(64)
    if (kind === 'type') table.columns[0].type = 'text'
    if (kind === 'nullability') table.columns[0].notNull = false
    if (kind === 'authority') table.authority!.requiredRuntimePrivileges = ['SELECT']
    await expect(planCurrentIdentityCreation(changed, existing(), [], producer)).rejects.toThrow('declaration or SQL producer differs')
  })

  it('rejects omitted, reordered and appended producer operations', async () => {
    for (const change of ['omit', 'reorder', 'append']) {
      const altered = fixture()
      if (change === 'omit') altered.statements.pop()
      if (change === 'reorder') altered.statements.reverse()
      if (change === 'append') altered.statements.push({ ...altered.statements[0], canonicalId: 'PLATFORM_IDENTITY_CURRENT:4', sql: 'DROP TABLE public.claims' })
      await expect(planCurrentIdentityCreation(altered, existing(), [], producer)).rejects.toThrow('declaration or SQL producer differs')
    }
  })
})

it('assembles the actual compiled framework and all metadata policies without changing source body bytes', async () => {
  const plan = JSON.parse(readFileSync(new URL('../../../../docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json', import.meta.url), 'utf8')) as V2Plan
  const framework = compileFrameworkSql(plan, { rolesPreprovisioned: true, postgresMajor: 15 })
  const frameworkParsed = await parseSql(framework)
  expect(frameworkParsed.ok).toBe(true)
  if (!frameworkParsed.ok) throw new Error(frameworkParsed.message)
  const security = compileSecurity(plan)
  expect(security.blockers).toEqual([])
  const metadata: string[] = []
  for (const source of security.statements) {
    const parsed = await parseSql(source)
    if (!parsed.ok) throw new Error(parsed.message)
    for (const [index, node] of parsed.statements.entries())
      if (node.CreatePolicyStmt?.policy_name === 'ue_platform_metadata_admin') metadata.push(parsed.texts[index])
  }
  expect(metadata.length).toBeGreaterThan(1)
  // Reproduce the actual failed assembly: parser slices have no separators.
  expect((await parseSql([framework, ...metadata].join('\n'))).ok).toBe(false)
  const combined = joinCurrentSecurityPrograms([framework, ...metadata])
  const parsed = await parseSql(combined)
  expect(parsed.ok).toBe(true)
  if (!parsed.ok) throw new Error(parsed.message)
  expect(parsed.texts).toEqual([...frameworkParsed.texts, ...metadata])
  await expect(frameworkPolicyPreimageQuery(combined)).resolves.toContain('pg_catalog.pg_policy')
  await expect(planExistingFrameworkPolicies(combined, [])).resolves.toEqual([])
})

it('uses qualified identities from the actual immutable-preimage planner without weakening partial-installation refusal', async () => {
  const root = path.resolve(import.meta.dirname, '../../../..')
  const sources = AUTHORITY_PHYSICAL_GUARDS.references.map(reference => readFileSync(path.join(root, reference.path), 'utf8'))
  const released = await projectCurrentCompilerSecurity(sources, 'uev2admin', { immutableReferenceOnly: true })
  const bodies = new Map<string, string>()
  for (const sql of sources) {
    const parsed = await parseSql(sql)
    if (!parsed.ok) throw new Error(parsed.message)
    for (const node of parsed.statements) {
      const fn = node.CreateFunctionStmt
      if (fn) bodies.set(fn.funcname.at(-1).String.sval, fn.options.find((option: { DefElem: { defname: string } }) => option.DefElem.defname === 'as').DefElem.arg.List.items[0].String.sval)
    }
  }
  const actual = released.functions.map(fn => ({ ...fn, body: bodies.get(fn.name)! }))
  const verified = await planLegacyPhysicalFunctionAdoption(root, AUTHORITY_PHYSICAL_GUARDS, actual, 'uev2admin')
  expect(verified.adoptedNames.length).toBeGreaterThan(8)
  const expected = AUTHORITY_PHYSICAL_GUARDS.functions.map(fn => ({ schema: 'public', name: fn.name }))
  expect(() => assertNoPartialCurrentSecurityFunctions(expected, actual, new Set(verified.adoptedNames))).not.toThrow()
  // The previous caller bug doubled the schema of every verified identity.
  expect(() => assertNoPartialCurrentSecurityFunctions(expected, actual, new Set(verified.adoptedNames.map(name => 'public.' + name))))
    .toThrow('Mixed or partial current security installation refused: public.ue_authority_')
  const unknown = { schema: 'public', name: 'unverified_current_function', body: 'private body must not enter diagnostics' }
  expect(() => assertNoPartialCurrentSecurityFunctions([...expected, unknown], [...actual, unknown], new Set(verified.adoptedNames)))
    .toThrow('Mixed or partial current security installation refused: public.unverified_current_function')
  await expect(planLegacyPhysicalFunctionAdoption(root, AUTHORITY_PHYSICAL_GUARDS,
    actual.map(fn => fn.name === 'ue_authority_guard_update' ? { ...fn, body: 'BEGIN RETURN NEW; END;' } : fn), 'uev2admin')).rejects.toThrow('preimage differs')
})

describe('complete additive current auth schema closure', () => {
  let producer: Awaited<ReturnType<typeof buildCurrentPlatformAuthSource>>, plan: V2Plan, legacy: string
  let actual: CurrentAuthColumn[]
  const relations = () => producer.tables.map(table => ({ schema: 'user_management', table: table.name.split('.')[1], relkind: 'r' }))
  beforeAll(async () => {
    producer = await buildCurrentPlatformAuthSource()
    plan = JSON.parse(readFileSync(new URL('../../../../docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json', import.meta.url), 'utf8')) as V2Plan
    legacy = readFileSync(new URL('../../../../tooling/sql/union-eyes-qa-baseline.sql', import.meta.url), 'utf8')
    actual = JSON.parse(readFileSync(new URL('./fixtures/current-security-legacy-auth-columns.json', import.meta.url), 'utf8')).columns
  })
  const converge = (columns = actual, candidate = plan, expected = producer, reference = legacy) => planCurrentAuthColumnConvergence(candidate, columns, relations(), expected, reference)

  it('retains all canonical auth producer bytes and metadata and closes the entire missing nullable family', async () => {
    const result = await converge()
    expect(result.statements).toEqual([
      'ALTER TABLE user_management."magic_links" ADD COLUMN "consumed_ip" varchar(45);',
      'ALTER TABLE user_management."magic_links" ADD COLUMN "requested_ip" varchar(45);',
      'ALTER TABLE user_management."magic_links" ADD COLUMN "requested_user_agent" text;',
    ])
    expect(result.retainedLegacyColumns).toHaveLength(6)
    expect(result.statements.join('\n')).not.toMatch(/IF NOT EXISTS|DEFAULT|NOT NULL|\b(?:INSERT|UPDATE|DELETE|DROP|TRUNCATE)\b/)
  })

  it('emits no additions for a fully present exact current field family', async () => {
    const added = producer.tables.find(table => table.name === 'user_management.magic_links')!.columns
      .filter(column => ['consumed_ip','requested_ip','requested_user_agent'].includes(column.name))
      .map(column => ({ table: 'magic_links', name: column.name, type: column.type, not_null: false, default_expression: null, identity: '', generated: '' }))
    expect((await converge([...actual, ...added])).statements).toEqual([])
    await expect(converge([...actual, added[0]])).rejects.toThrow('Partial current auth column addition')
  })

  it.each(['type','nullability','default','identity','generated','unknown','missing','duplicate','legacy-extra'] as const)('rejects %s drift before proposing any metadata changes', async kind => {
    const rows = structuredClone(actual), user = rows.find(row => row.table === 'users' && row.name === 'email')!
    if (kind === 'type') user.type = 'text'
    if (kind === 'nullability') user.not_null = false
    if (kind === 'default') user.default_expression = "'unreviewed@example.invalid'"
    if (kind === 'identity') user.identity = 'a'
    if (kind === 'generated') user.generated = 's'
    if (kind === 'unknown') rows.push({ ...user, name: 'unreviewed_field' })
    if (kind === 'missing') rows.splice(rows.indexOf(user),1)
    if (kind === 'duplicate') rows.push(user)
    if (kind === 'legacy-extra') rows.find(row => row.name === 'encrypted_sin')!.type = 'integer'
    await expect(converge(rows)).rejects.toThrow(/preimage/)
  })

  it('rejects unknown literal casts and changed operators or default functions', async () => {
    for (const expression of ["'local'::public.unreviewed_type", "'local' || ''", 'current_user']) {
      const rows = structuredClone(actual)
      rows.find(row => row.table === 'users' && row.name === 'account_source')!.default_expression = expression
      await expect(converge(rows)).rejects.toThrow('DEFAULT')
    }
  })

  it('rejects substituted current SQL/declarations and changed immutable legacy references', async () => {
    const changed = structuredClone(plan)
    changed.statements.find(statement => statement.canonicalId === 'PLATFORM_AUTH_CURRENT:magic_links:0')!.sql += '\nDROP TABLE user_management.users;'
    await expect(converge(actual, changed)).rejects.toThrow('declaration or SQL producer differs')
    await expect(converge(actual, plan, producer, legacy + '\n')).rejects.toThrow('Immutable legacy auth schema reference differs')
    const unknown = [...relations(), { schema: 'user_management', table: 'unreviewed_table', relkind: 'r' }]
    await expect(planCurrentAuthColumnConvergence(plan,actual,unknown,producer,legacy)).rejects.toThrow('relation preimage')
  })

  it('requires a separate data migration for a newly required or defaulted source field', async () => {
    for (const constraint of ['NOT NULL', "DEFAULT 'unreviewed'"]) {
      // Simulate a future approved declaration, independently of observed
      // metadata: the additive boundary must still refuse old-row values.
      const expected = structuredClone(producer), candidate = structuredClone(plan)
      const item = expected.statements.find(statement => statement.canonicalId === 'PLATFORM_AUTH_CURRENT:magic_links:0')!
      item.sql = item.sql.replace('"consumed_ip" varchar(45)', '"consumed_ip" varchar(45) ' + constraint)
      if (constraint === 'NOT NULL') expected.tables.find(table => table.name === 'user_management.magic_links')!.columns.find(column => column.name === 'consumed_ip')!.notNull = true
      candidate.statements = candidate.statements.map(statement => statement.canonicalId === item.canonicalId ? item : statement)
      candidate.tables = candidate.tables.map(table => table.name === 'user_management.magic_links' ? expected.tables.find(entry => entry.name === table.name)! : table)
      await expect(converge(actual,candidate,expected)).rejects.toThrow('separately approved data migration')
    }
  })
})

describe('framework ACLs are effective before their source dependencies run', () => {
  const currentPlan = () => JSON.parse(readFileSync(new URL('../../../../docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json', import.meta.url), 'utf8')) as V2Plan
  it('restores the exact projected ACL immediately after each real framework CREATE OR REPLACE', async () => {
    const framework = compileFrameworkSql(currentPlan(), { rolesPreprovisioned: true, postgresMajor: 15 })
    const parsed = await parseSql(framework)
    if (!parsed.ok) throw new Error(parsed.message)
    const projected = await projectCurrentCompilerSecurity([framework])
    const replacements = parsed.statements.flatMap((node,index) => node.CreateFunctionStmt
      ? [{ originalSql: parsed.texts[index], replacementSql: parsed.texts[index].replace(/^CREATE FUNCTION/, 'CREATE OR REPLACE FUNCTION') }] : [])
    const program = await planCurrentFrameworkProgram(framework, projected.functions, replacements, [])
    expect(replacements).toHaveLength(2)
    const beforeCompile = await planVerifiedFrameworkExecuteRestore(projected.functions, replacements)
    expect(beforeCompile).toHaveLength(2)
    for (const replacement of replacements) {
      const index = program.indexOf(replacement.replacementSql)
      const declaration = await parseSql(replacement.originalSql)
      if (!declaration.ok) throw new Error(declaration.message)
      const name = declaration.statements[0].CreateFunctionStmt.funcname[1].String.sval
      const fn = projected.functions.find(fn => fn.name === name)!
      expect(program[index + 1]).toBe(`GRANT EXECUTE ON FUNCTION ${fn.signature} TO ${fn.executeAcl.map(grant => '"' + grant.role + '"').join(',')}`)
      expect(beforeCompile).toContain(program[index + 1])
      expect(fn.executeAcl.some(grant => grant.role === fn.owner)).toBe(true)
      expect(fn.executeAcl.some(grant => grant.role === 'PUBLIC' || grant.role === 'union_eyes_runtime' || grant.role === 'union_eyes_system')).toBe(false)
    }
    const actorCreate = program.findIndex(sql => sql.startsWith('CREATE OR REPLACE FUNCTION user_management.ue_framework_actor_authorized'))
    const adminCreate = program.findIndex(sql => sql.startsWith('CREATE OR REPLACE FUNCTION user_management.ue_framework_admin_authorized'))
    expect(actorCreate + 1).toBeLessThan(adminCreate)
    expect(program.filter(sql => !sql.startsWith('GRANT EXECUTE ON FUNCTION')))
      .toEqual(parsed.texts.filter(sql => !sql.startsWith('GRANT EXECUTE ON FUNCTION')).map(sql => replacements.find(replacement => replacement.originalSql === sql)?.replacementSql ?? sql))
    await expect(planVerifiedFrameworkExecuteRestore(projected.functions, [replacements[0], replacements[0]])).rejects.toThrow('Duplicate verified framework function')
    await expect(planVerifiedFrameworkExecuteRestore(projected.functions, [{ originalSql: 'DROP TABLE public.auth_user', replacementSql: '' }])).rejects.toThrow('Verified framework function source required')
  })

  it('rejects missing or ambiguous source function identities and grant-option drift', async () => {
    const framework = compileFrameworkSql(currentPlan(), { rolesPreprovisioned: true, postgresMajor: 15 })
    const projected = await projectCurrentCompilerSecurity([framework])
    await expect(planCurrentFrameworkProgram(framework, [], [], [])).rejects.toThrow('Exact source framework function ACL identity')
    await expect(planCurrentFrameworkProgram(framework, [...projected.functions, projected.functions[0]], [], [])).rejects.toThrow('Exact source framework function ACL identity')
    const altered = structuredClone(projected.functions)
    altered[0].executeAcl[0].grantable = true
    await expect(planCurrentFrameworkProgram(framework, altered, [], [])).rejects.toThrow('grant options are not admitted')
  })

  it('records actual statement identity and executor while excluding SQL bodies and driver detail', async () => {
    const parsed = await parseSql(compileFrameworkSql(currentPlan(), { rolesPreprovisioned: true, postgresMajor: 15 }))
    if (!parsed.ok) throw new Error(parsed.message)
    const index = parsed.statements.findIndex(node => node.CreateFunctionStmt?.funcname[1]?.String?.sval === 'ue_framework_actor_authorized')
    const error = Object.assign(new Error('permission denied for function ue_framework_actor_authorized'), { code: '42501', detail: 'private driver detail', internalQuery: 'private SQL body' })
    let failure: Error | undefined
    try {
      await executeCurrentFrameworkProgram([parsed.texts[index]], async sql => {
        if (sql === 'SELECT current_user::text AS current_role') return [{ current_role: 'ue_v2_owner' }]
        throw error
      })
    } catch (caught) { failure = caught as Error }
    expect(failure?.message).toBe('Current framework statement failed: ' + JSON.stringify({ index: 1, kind: 'CreateFunctionStmt', currentRole: 'ue_v2_owner', function: 'user_management.ue_framework_actor_authorized()', sqlstate: '42501', deniedKind: 'function', deniedIdentity: 'ue_framework_actor_authorized' }))
    expect(failure?.message).not.toContain('private')
    expect(failure?.message).not.toContain('SELECT EXISTS')
  })
})
