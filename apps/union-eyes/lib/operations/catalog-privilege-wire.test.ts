import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import base from './catalog-authority-contract.json'
import {
  admissionQueries,
  assessCatalogAdmission,
  catalogContractDigest,
  currentFunctionViolations,
} from './catalog-admission-core.mjs'

function admission(runtime: string[], expected: string[], nonPublic = false) {
  const payload = { ...structuredClone(base.payload), currentFunctions: [], requiredContainedParentPolicies: [], requiredPhysicalTriggers: [] }
  const table = nonPublic ? 'users' : 'grievance_timeline_events'
  const entry = nonPublic
    ? payload.nonPublic.find((row) => row.schema === 'user_management' && row.table === table)!
    : payload.entries.find((row) => row.table === table)!
  entry.runtime = expected
  entry.system = []
  return assessCatalogAdmission(
    { payload, digest: catalogContractDigest(payload) },
    {
      roles: ['union_eyes_runtime', 'union_eyes_system'].map((rolname) => ({
        rolname,
        rolsuper: false,
        rolbypassrls: false,
        rolcreatedb: false,
        rolcreaterole: false,
      })),
      schemaUsage: [
        ...payload.runtimeSchemaUsage.map((nspname) => ({
          rolname: 'union_eyes_runtime',
          nspname,
        })),
        ...payload.systemSchemaUsage.map((nspname) => ({ rolname: 'union_eyes_system', nspname })),
      ],
      relations: [
        {
          schema_name: nonPublic ? 'user_management' : 'public',
          table_name: table,
          relkind: 'r',
          relrowsecurity: true,
          relforcerowsecurity: true,
          runtime,
          system: [],
        },
      ],
      policies: nonPublic
        ? []
        : [
            {
              table_name: table,
              polname: 'fixture_org_policy',
              polcmd: '*',
              polpermissive: true,
              roles: ['union_eyes_runtime'],
              qual: "organization_id::text=current_setting('app.current_org_id',true)",
              with_check: "organization_id::text=current_setting('app.current_org_id',true)",
            },
          ],
      columnGrants: payload.approvedColumnGrants
        .filter(
          (grant) =>
            grant.table === table && grant.schema === (nonPublic ? 'user_management' : 'public'),
        )
        .flatMap((grant) =>
          grant.columns.map((column_name) => ({
            schema_name: grant.schema,
            table_name: table,
            role_name: grant.role,
            privilege_type: grant.privilege,
            column_name,
        is_grantable: false,
          })),
        ),
    },
  )
}

describe.each([false, true])('exact privilege sets (nonpublic=%s)', (nonPublic) => {
  it.each([
    [
      ['SELECT', 'INSERT'],
      ['INSERT', 'SELECT'],
    ],
    [
      ['INSERT', 'SELECT'],
      ['SELECT', 'INSERT'],
    ],
    [
      ['DELETE', 'UPDATE', 'INSERT', 'SELECT'],
      ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
    ],
    [[], []],
  ])('admits identical complete sets regardless of order', (actual, expected) => {
    expect(admission(actual, expected, nonPublic).violations).toEqual([])
  })
  it.each([
    [['SELECT'], ['SELECT', 'INSERT']],
    [
      ['SELECT', 'INSERT', 'UPDATE'],
      ['SELECT', 'INSERT'],
    ],
    [
      ['SELECT', 'SELECT'],
      ['SELECT', 'INSERT'],
    ],
    [
      ['SELECT', 'INSERT'],
      ['SELECT', 'SELECT'],
    ],
    [
      ['SELECT', 'SELECT'],
      ['SELECT', 'SELECT'],
    ],
    [
      ['SELECT', 'INSERT', 'INSERT'],
      ['INSERT', 'SELECT', 'INSERT'],
    ],
    [
      ['SELECT', 'DELETE'],
      ['SELECT', 'INSERT'],
    ],
    [
      ['SELECT', 'TRUNCATE'],
      ['SELECT', 'TRUNCATE'],
    ],
    [
      ['SELECT', 'UNKNOWN'],
      ['SELECT', 'UNKNOWN'],
    ],
    [
      ['select', 'INSERT'],
      ['SELECT', 'INSERT'],
    ],
  ])('rejects missing, extra, duplicated or unknown permissions', (actual, expected) => {
    expect(
      admission(actual, expected, nonPublic).violations.some((message) =>
        message.includes('privileges are'),
      ),
    ).toBe(true)
  })
})

describe('function argument modes at the PostgreSQL wire boundary', () => {
  const body = 'SELECT input::text'
  const spec = {
    schema: 'public',
    name: 'wire_table_helper',
    signature: 'public.wire_table_helper(text)',
    owner: 'nzila_auth_org_authority_reader',
    bodyDigest: createHash('sha256').update(body).digest('hex'),
    language: 'sql',
    volatility: 's',
    definer: true,
    strict: false,
    leakproof: false,
    returns: 'text',
    returnsSet: true,
    argumentNames: ['input', 'output'],
    argumentModes: ['i', 't'],
    allArgumentTypes: ['text', 'text'],
    defaultCount: 0,
    defaults: null,
    config: ['search_path=pg_catalog'],
    executeAcl: [{ role: 'nzila_auth_org_authority_reader', grantable: false }],
  }
  // Actual PG15/node-pg counterexample: internal "char"[] decodes as
  // "{i,t}"; the same catalog value cast to text[] decodes as ['i','t'].
  it('requests a text array from the actual catalog query', () => {
    expect(admissionQueries.find((query) => query.name === 'currentFunctions')!.sql).toContain(
      'p.proargmodes::text[] AS "argumentModes"',
    )
  })
  it('admits the decoded text array without relaxing function metadata comparison', () => {
    expect(
      currentFunctionViolations([spec], [{ ...spec, body, argumentModes: ['i', 't'] }]),
    ).toEqual([])
  })
  it.each(
    ['{i,t}', ['t', 'i'], ['i', 'o'], ['i'], ['i', 't', 't'], null].map((modes) => ({ modes })),
  )('rejects raw or altered ordered modes $modes', ({ modes }) => {
    expect(currentFunctionViolations([spec], [{ ...spec, body, argumentModes: modes }])).toEqual([
      'current function differs: public.wire_table_helper(text)',
    ])
  })
})
