import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import base from './catalog-authority-contract.json'
import {
  admissionQueries,
  assessCatalogAdmission,
  catalogContractDigest,
  currentFunctionViolations,
  physicalTriggerViolations,
} from './catalog-admission-core.mjs'
import { createRewardsBoundaryFixture } from '../../db/__tests__/rewards-boundary-testkit'
import { REWARD_NOMINATION_GUARDS } from '../../db/auth/reward-nomination-guards'
import { compileGuardFunction, sourcePhysicalTriggers } from '../../db/auth/physical-guard-catalog'
import { projectCurrentCompilerSecurity } from '../../../../tooling/scripts/lib/union-eyes-current-security-contract'
import { CASE_PRIMARY_DOMAIN_GUARDS, compileCaseDomainSupportSql } from '../../db/auth/case-primary-domain-guards'
import { AUTHORITY_PHYSICAL_GUARDS } from '../../db/auth/authority-physical-guards'
import { compileQueuedCaseMailSql, QUEUED_CASE_MAIL_OPERATION } from '../../db/auth/queued-case-mail'
import { parseSql } from '../../scripts/lib/sql-census/parse'
import { projectSourcePhysicalTriggers } from '../../scripts/bootstrap-v2/physical-trigger-source'
import {
  BUSINESS_SESSION_CATALOG_PREDICATE,
  BUSINESS_SESSION_POLICY,
} from '../../db/auth/business-session-policy'

type Row = Record<string, unknown>
let fixture: Awaited<ReturnType<typeof createRewardsBoundaryFixture>>
let functions: Awaited<ReturnType<typeof projectCurrentCompilerSecurity>>['functions']
const source = sourcePhysicalTriggers([REWARD_NOMINATION_GUARDS])
const triggerQuery = admissionQueries.find((query) => query.name === 'physicalTriggers')!.sql
const functionQuery = admissionQueries.find((query) => query.name === 'currentFunctions')!.sql
const triggers = async () => (await fixture.db.query<Row>(triggerQuery)).rows
beforeAll(async () => {
  fixture = await createRewardsBoundaryFixture()
  functions = (
    await projectCurrentCompilerSecurity(
      REWARD_NOMINATION_GUARDS.functions.flatMap(compileGuardFunction),
    )
  ).functions
}, 30000)
afterAll(async () => {
  await fixture?.db.close()
})

describe('source physical-trigger admission in the standalone MJS evaluator', () => {
  it('returns actual text-array OID1009 for policy roles, including the empty PUBLIC vector', async () => {
    const query = admissionQueries.find((entry) => entry.name === 'policies')!.sql
    await fixture.db.exec('BEGIN;CREATE POLICY fixture_public_policy ON public.recognition_awards FOR SELECT TO PUBLIC USING(false)')
    try {
      const result = await fixture.db.query<{ roles: string[]; polname: string; public_role: boolean }>(query)
      expect(result.fields.find((field) => field.name === 'roles')?.dataTypeID).toBe(1009)
      expect(result.rows.every((row) => Array.isArray(row.roles))).toBe(true)
      expect(result.rows.find((row) => row.polname === 'fixture_public_policy')).toMatchObject({ roles: [], public_role: true })
    } finally { await fixture.db.exec('ROLLBACK') }
  })

  it('verifies actual source-created trigger metadata and immutable function bytes without table or function authority widening', async () => {
    expect(physicalTriggerViolations(source, await triggers(), functions)).toEqual([])
    const actual = (await fixture.db.query<Row>(functionQuery)).rows.filter(
      (row) => row.name === 'ue_reward_guard_nomination',
    )
    expect(currentFunctionViolations(functions, actual)).toEqual([])
  })

  it('uses the four actual journal compiler owner/definer declarations, retaining exact unknown-owner refusal', async () => {
    const compiled = await projectCurrentCompilerSecurity([
      compileCaseDomainSupportSql(), ...CASE_PRIMARY_DOMAIN_GUARDS.functions.flatMap(compileGuardFunction),
    ])
    const dedicated = compiled.functions.filter(fn => fn.owner === 'nzila_auth_org_authority_reader' && fn.returns === 'trigger')
    expect(dedicated).toHaveLength(4)
    expect(dedicated.every(fn => fn.definer === true)).toBe(true)
    const expected = sourcePhysicalTriggers([CASE_PRIMARY_DOMAIN_GUARDS]).filter(spec => dedicated.some(fn => fn.name === spec.function_name))
    expect(expected).toHaveLength(4)
    // These scalar facts reproduce the native v18 counterexample. Expected
    // ownership comes independently from the actual current compiler above.
    const facts = expected.map(spec => ({ ...spec, table_schema:spec.schema, owner_name: 'ue_v2_owner', relrowsecurity: true, relforcerowsecurity: true,
      function_schema: 'public', function_args: '', function_owner: 'nzila_auth_org_authority_reader', prosecdef: true,
      tgenabled: 'O', is_constraint: spec.is_constraint, has_condition: false, columns: '', column_names:spec.columns, old_table: null, new_table: null }))
    expect(physicalTriggerViolations(expected, facts, compiled.functions)).toEqual([])
    for (const change of [{ function_owner: 'ue_v2_owner' }, { function_owner: 'unreviewed_owner' }, { prosecdef: false }])
      expect(physicalTriggerViolations(expected, facts.map(row => ({ ...row, ...change })), compiled.functions)).not.toEqual([])
    expect(physicalTriggerViolations(expected, facts, compiled.functions.filter(fn => !dedicated.includes(fn)))).not.toEqual([])
  })

  it('verifies the actual conditional queued attachment, auth namespace and source column/transition metadata', async () => {
    const queued = compileQueuedCaseMailSql()
    const parsed = await parseSql(queued)
    if (!parsed.ok) throw new Error(parsed.message)
    const targetStatements = parsed.statements.flatMap((statement, index) => {
      const trigger = statement.CreateTrigStmt
      return trigger && (trigger.trigname === 'ue_record_queued_mail_capability'
        || (trigger.trigname === 'ue_lock_queued_mail_authority' && trigger.relation.schemaname === 'user_management'))
        ? [parsed.texts[index]] : []
    })
    expect(targetStatements).toHaveLength(4)
    const fn = AUTHORITY_PHYSICAL_GUARDS.functions.find(entry => entry.name === 'ue_authority_record_event')!
    const recordProgram = [...compileGuardFunction(fn), 'ALTER FUNCTION public.ue_authority_record_event() OWNER TO ue_v2_owner;']
    const lockIndex = parsed.statements.findIndex(statement => statement.CreateFunctionStmt?.funcname.at(-1)?.String.sval === 'ue_lock_queued_mail_authority')
    expect(lockIndex).toBeGreaterThanOrEqual(0)
    const lockProgram = [parsed.texts[lockIndex], 'ALTER FUNCTION public.ue_lock_queued_mail_authority() OWNER TO ue_v2_owner;',
      'REVOKE ALL ON FUNCTION public.ue_lock_queued_mail_authority() FROM PUBLIC,union_eyes_runtime,union_eyes_system;']
    const supplemental = [
      'CREATE TRIGGER source_columns BEFORE UPDATE OF operation,status ON public.ue_authority_requests FOR EACH ROW EXECUTE FUNCTION public.ue_lock_queued_mail_authority()',
      'CREATE TRIGGER source_transition AFTER UPDATE ON public.ue_authority_requests REFERENCING OLD TABLE AS prior_rows NEW TABLE AS next_rows FOR EACH STATEMENT EXECUTE FUNCTION public.ue_lock_queued_mail_authority()',
    ]
    const sourceStatements = [...targetStatements, ...supplemental]
    const expected = await projectSourcePhysicalTriggers([], sourceStatements, {
      'public.ue_authority_requests': 'ue_v2_owner',
      'user_management.users': 'ue_v2_owner',
      'user_management.organization_users': 'ue_v2_owner',
      'user_management.user_sessions': 'ue_v2_owner',
    })
    const producers = (await projectCurrentCompilerSecurity([...recordProgram, ...lockProgram])).functions
    const before = await fixture.preserved()
    await fixture.db.exec('BEGIN')
    try {
      await fixture.db.exec(`CREATE TABLE public.ue_authority_requests(operation text,status text);
        ALTER TABLE public.ue_authority_requests OWNER TO ue_v2_owner;
        ALTER TABLE public.ue_authority_requests ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.ue_authority_requests FORCE ROW LEVEL SECURITY;
        -- Mirror the canonical installation's source-owned relation ownership
        -- convergence; the small auth fixture otherwise retains its creator.
        ALTER TABLE user_management.users OWNER TO ue_v2_owner;
        ALTER TABLE user_management.organization_users OWNER TO ue_v2_owner;
        ALTER TABLE user_management.user_sessions OWNER TO ue_v2_owner;`)
      await fixture.db.exec([...recordProgram, ...lockProgram, ...sourceStatements].join(';\n'))
      const rows = await triggers()
      expect(physicalTriggerViolations(expected, rows, producers)).toEqual([])
      expect(currentFunctionViolations(producers, (await fixture.db.query<Row>(functionQuery)).rows.filter(row => producers.some(producer => producer.name === row.name)))).toEqual([])
      const conditional = rows.find(row => row.name === 'ue_record_queued_mail_capability')!
      expect(conditional.has_condition).toBe(true)
      expect(conditional.definition).toContain(`${QUEUED_CASE_MAIL_OPERATION}'::text`)
      expect(rows.find(row => row.name === 'source_columns')?.column_names).toEqual(['operation','status'])
      expect(rows.find(row => row.name === 'source_transition')).toMatchObject({old_table:'prior_rows',new_table:'next_rows'})
      const original = targetStatements.find(sql => sql.includes('ue_record_queued_mail_capability'))!
      for (const replacement of [
        original.replace(QUEUED_CASE_MAIL_OPERATION, 'unapproved.operation'),
        original.replace("NEW.operation=", "NEW.status="),
        original.replace(`NEW.operation='${QUEUED_CASE_MAIL_OPERATION}'`, `NEW.operation='${QUEUED_CASE_MAIL_OPERATION}' OR true`),
      ]) {
        await fixture.db.exec('SAVEPOINT changed_condition;DROP TRIGGER ue_record_queued_mail_capability ON public.ue_authority_requests')
        try {
          await fixture.db.exec(replacement)
          expect(physicalTriggerViolations(expected, await triggers(), producers)).not.toEqual([])
        } finally { await fixture.db.exec('ROLLBACK TO SAVEPOINT changed_condition') }
      }
      for (const replacement of [
        supplemental[0].replace('operation,status', 'status'),
        supplemental[1].replace('prior_rows', 'different_rows'),
      ]) {
        const name = replacement.includes('source_columns') ? 'source_columns' : 'source_transition'
        await fixture.db.exec(`SAVEPOINT changed_metadata;DROP TRIGGER ${name} ON public.ue_authority_requests`)
        try {
          await fixture.db.exec(replacement)
          expect(physicalTriggerViolations(expected, await triggers(), producers)).not.toEqual([])
        } finally { await fixture.db.exec('ROLLBACK TO SAVEPOINT changed_metadata') }
      }
    } finally { await fixture.db.exec('ROLLBACK') }
    expect(await fixture.preserved()).toEqual(before)
  })

  it.each([
    { owner_name: 'postgres' },
    { relrowsecurity: false },
    { relforcerowsecurity: false },
    { function_name: 'different_guard' },
    { function_schema: 'user_management' },
    { function_args: 'extra text' },
    { function_owner: 'postgres' },
    { prosecdef: true },
    { tgtype: 5 },
    { tgenabled: 'D' },
    { tgdeferrable: true },
    { tginitdeferred: true },
    { is_constraint: true },
    { has_condition: true },
    { columns: '1' },
    { args_hex: '00' },
    { old_table: 'history' },
    { new_table: 'replacement' },
  ])('rejects changed actual metadata %#', async (change) => {
    expect(
      physicalTriggerViolations(
        source,
        (await triggers()).map((row) => ({ ...row, ...change })),
        functions,
      ),
    ).not.toEqual([])
  })

  it('refuses missing source/function/census facts and duplicate identities rather than defaulting to an empty proof', async () => {
    const rows = await triggers()
    expect(physicalTriggerViolations(undefined, rows, functions)).toEqual([
      'physical trigger source contract is missing',
    ])
    for (const [expected, actual, producers] of [
      [source, [], functions],
      [source, rows, []],
      [[...source, ...source], rows, functions],
      [source, [...rows, ...rows], functions],
    ])
      expect(physicalTriggerViolations(expected, actual as Row[], producers)).not.toEqual([])
  })

  it('rejects real disabled and unowned extra trigger paths, preserving every retained row after rollback', async () => {
    const before = await fixture.preserved()
    for (const sql of [
      'ALTER TABLE public.recognition_awards DISABLE TRIGGER ue_reward_nomination_guard',
      'CREATE TRIGGER extra_nomination_path BEFORE INSERT ON public.recognition_awards FOR EACH ROW EXECUTE FUNCTION public.ue_reward_guard_nomination()',
    ]) {
      await fixture.db.exec('BEGIN')
      try {
        await fixture.db.exec(sql)
        expect(physicalTriggerViolations(source, await triggers(), functions)).not.toEqual([])
      } finally {
        await fixture.db.exec('ROLLBACK')
      }
    }
    expect(await fixture.preserved()).toEqual(before)
    expect(physicalTriggerViolations(source, await triggers(), functions)).toEqual([])
  })
})

function scopedColumnContract() {
  const payload = {
    ...structuredClone(base.payload),
    currentFunctions: [],
    requiredContainedParentPolicies: [],
    requiredPhysicalTriggers: [],
    entries: base.payload.entries.map((entry) =>
      entry.table === 'claims'
        ? { ...entry, classification: 'TENANT_RLS_REQUIRED', runtime: [], system: [] }
        : entry,
    ),
    requiredSessionPolicy: {
      name: BUSINESS_SESSION_POLICY,
      command: '*',
      permissive: false,
      roles: ['union_eyes_runtime'],
      predicate: BUSINESS_SESSION_CATALOG_PREDICATE,
    },
    approvedColumnGrants: [
      {
        schema: 'public',
        table: 'claims',
        role: 'union_eyes_runtime',
        privilege: 'SELECT',
        columns: ['id'],
        grantable: false,
      },
    ],
  }
  return { payload, digest: catalogContractDigest(payload) }
}
function columnSnapshot() {
  return {
    roles: ['union_eyes_runtime', 'union_eyes_system'].map((rolname) => ({
      rolname,
      rolsuper: false,
      rolbypassrls: false,
      rolcreatedb: false,
      rolcreaterole: false,
    })),
    schemaUsage: [
      ...base.payload.runtimeSchemaUsage.map((nspname) => ({
        rolname: 'union_eyes_runtime',
        nspname,
      })),
      ...base.payload.systemSchemaUsage.map((nspname) => ({
        rolname: 'union_eyes_system',
        nspname,
      })),
    ],
    relations: [
      {
        schema_name: 'public',
        table_name: 'claims',
        relkind: 'r',
        runtime: [],
        system: [],
        relrowsecurity: true,
        relforcerowsecurity: true,
      },
    ],
    policies: [
      {
        table_name: 'claims',
        polname: 'source_select',
        polcmd: 'r',
        polpermissive: true,
        roles: ['union_eyes_runtime'],
        qual: 'organization_id = selected_org',
        with_check: null,
      },
      {
        table_name: 'claims',
        polname: BUSINESS_SESSION_POLICY,
        polcmd: '*',
        polpermissive: false,
        roles: ['union_eyes_runtime'],
        qual: BUSINESS_SESSION_CATALOG_PREDICATE,
        with_check: BUSINESS_SESSION_CATALOG_PREDICATE,
      },
    ],
    columnGrants: [
      {
        schema_name: 'public',
        table_name: 'claims',
        role_name: 'union_eyes_runtime',
        privilege_type: 'SELECT',
        column_name: 'id',
        is_grantable: false,
      },
    ],
  }
}
describe('column-only runtime grants retain mandatory session and resource policies', () => {
  it('admits exact column authority while keeping every table power at zero', () => {
    const snapshot = columnSnapshot()
    expect(snapshot.relations[0].runtime).toEqual([])
    expect(assessCatalogAdmission(scopedColumnContract(), snapshot).violations).toEqual([])
  })
  it('refuses removed/changed restrictive session policy and absent permissive read policy', () => {
    for (const removed of [BUSINESS_SESSION_POLICY, 'source_select']) {
      const snapshot = columnSnapshot()
      snapshot.policies = snapshot.policies.filter((policy) => policy.polname !== removed)
      expect(assessCatalogAdmission(scopedColumnContract(), snapshot).ok).toBe(false)
    }
    const snapshot = columnSnapshot()
    snapshot.policies[1].polpermissive = true
    expect(assessCatalogAdmission(scopedColumnContract(), snapshot).violations.join(';')).toContain(
      'verified session policy',
    )
  })
})
