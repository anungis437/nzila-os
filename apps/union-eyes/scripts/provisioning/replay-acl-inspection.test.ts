import { describe, expect, it } from 'vitest'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { replayObject, replayRecords, replayText, replayHash } from './post-w4p-replay'
import {
  compileAclEffect,
  inspectAclEffect,
  aclQueries,
  type AclPositionAuthority,
} from './replay-acl-inspection'
const ledger = replayObject(
  JSON.parse(
    read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
  ),
)
const effects = replayRecords(ledger.BOUNDARIES)
  .flatMap((boundary) => replayRecords(boundary.EFFECTS))
  .filter((effect) => effect.EFFECT_CLASS === 'ACL_CHANGE')
function harness(spec: ReturnType<typeof compileAclEffect>, satisfied = true) {
  const object = {
    schema: spec.schema!,
    name: spec.name ?? 'position_bound_object',
    kind: spec.kind,
    grantor: 'independently-bound-grantor',
  }
  const authority: AclPositionAuthority = {
    sourceHash: spec.sourceHash,
    actor: 'fake-migration-admin',
    defaultOwner: 'fake-migration-admin',
    objects: spec.defaults ? [] : [object],
  }
  const grants: Record<string, unknown>[] = (spec.action === 'GRANT' ? satisfied : !satisfied)
    ? spec.roles.flatMap((grantee) =>
        spec.privileges.map((privilege) => ({
          grantee,
          grantor: spec.defaults ? authority.defaultOwner : object.grantor,
          privilege: privilege === 'ALL' ? 'SELECT' : privilege,
          grantable: false,
        })),
      )
    : []
  const actor = [{ actor: authority.actor }],
    namespace = [{ name: spec.schema }],
    inventory = [{ schema: object.schema, name: object.name, kind: object.kind }]
  const table = [{ name: object.name, kind: object.kind === 'SEQUENCE' ? 'S' : 'r' }],
    role = [{ name: '' }]
  return {
    authority,
    grants,
    actor,
    namespace,
    inventory,
    table,
    role,
    async query(sql: string, parameters: string[]) {
      if (sql === aclQueries.actor) {
        expect(parameters).toEqual([])
        return actor
      }
      if (sql === aclQueries.schema) {
        expect(parameters).toEqual([spec.schema])
        return namespace
      }
      if (sql === aclQueries.role) {
        role[0].name = parameters[0]
        return role
      }
      if (sql === aclQueries.objects) {
        expect(parameters).toEqual([spec.schema, spec.kind])
        return inventory
      }
      if (sql === aclQueries.table) {
        expect(parameters).toEqual([object.schema, object.name])
        return table
      }
      if (sql === aclQueries.defaultAcl) {
        expect(parameters).toEqual([
          spec.schema,
          authority.defaultOwner,
          spec.kind === 'TABLE' ? 'r' : 'S',
        ])
        return grants
      }
      if (sql === aclQueries.schemaAcl) {
        expect(parameters).toEqual([spec.schema])
        return grants
      }
      expect(sql).toBe(aclQueries.tableAcl)
      expect(parameters).toEqual([object.schema, object.name])
      return grants
    },
  }
}
describe('all21source-bound privilege-change components;no least-privilege or boundary claim', () => {
  it('accounts exactly21frozenACL effects', () => {
    expect(effects).toHaveLength(21)
  })
  for (const effect of effects) {
    const source = replayText(replayObject(effect.COMPARATOR).EXACT_SOURCE_SEMANTICS),
      spec = compileAclEffect(source, replayHash(source))
    it(`owned grantor/grantee/privileges:${effect.EFFECT_ID}`, async () => {
      const exact = harness(spec)
      expect((await inspectAclEffect(exact, spec, exact.authority)).definition).toBe('EXACT')
      const absent = harness(spec, false)
      expect((await inspectAclEffect(absent, spec, absent.authority)).definition).toBe('ABSENT')
      expect((await inspectAclEffect(exact, spec, undefined)).definition).toBe(
        'PRECONDITION_MISSING',
      )
      expect(
        (await inspectAclEffect(exact, spec, { ...exact.authority, sourceHash: 'wrong' }))
          .definition,
      ).toBe('PRECONDITION_MISSING')
      const wrongActor = harness(spec)
      wrongActor.actor[0].actor = 'unbound'
      expect((await inspectAclEffect(wrongActor, spec, wrongActor.authority)).definition).toBe(
        'PRECONDITION_MISSING',
      )
      const noSchema = harness(spec)
      noSchema.namespace.length = 0
      expect((await inspectAclEffect(noSchema, spec, noSchema.authority)).definition).toBe(
        'PRECONDITION_MISSING',
      )
      if (!spec.defaults && spec.all) {
        const otherObject = harness(spec)
        otherObject.inventory[0].name = 'not-authorized-at-this-position'
        expect((await inspectAclEffect(otherObject, spec, otherObject.authority)).definition).toBe(
          'PRECONDITION_MISSING',
        )
      }
      if (spec.defaults) {
        expect(
          (
            await inspectAclEffect(exact, spec, {
              ...exact.authority,
              defaultOwner: 'someone-else',
            })
          ).definition,
        ).toBe('PRECONDITION_MISSING')
      } else {
        expect(
          (await inspectAclEffect(exact, spec, { ...exact.authority, objects: [] })).definition,
        ).toBe('PRECONDITION_MISSING')
      }
      const malformed = harness(spec)
      malformed.grants.push({ complete: true })
      await expect(inspectAclEffect(malformed, spec, malformed.authority)).rejects.toThrow(
        'REPLAY_ACL_CATALOG_ROW_INVALID',
      )
    })
  }
  it('does not infer REVOKE removes another grantor or inherited/public rights', async () => {
    const source = 'REVOKE ALL ON TABLE public.exact_table FROM exact_role;'
    const spec = compileAclEffect(source, replayHash(source)),
      fake = harness(spec, false)
    fake.grants[0].grantor = 'another-grantor'
    fake.grants.push({
      grantor: 'independently-bound-grantor',
      grantee: 'public',
      privilege: 'SELECT',
      grantable: true,
    })
    expect((await inspectAclEffect(fake, spec, fake.authority)).definition).toBe('EXACT')
  })
  it('GRANT without grant option preserves rather than revokes an existing grant option', async () => {
    const source = 'GRANT SELECT ON TABLE public.exact_table TO exact_role;'
    const spec = compileAclEffect(source, replayHash(source)),
      fake = harness(spec)
    fake.grants[0].grantable = true
    expect((await inspectAclEffect(fake, spec, fake.authority)).definition).toBe('EXACT')
    fake.grants[0].grantor = 'another-grantor'
    expect((await inspectAclEffect(fake, spec, fake.authority)).definition).toBe('ABSENT')
  })
  it('closed source grammar rejects extra statements or unsupported grant modes', () => {
    const source = 'GRANT USAGE ON SCHEMA public TO exact_role;'
    expect(() =>
      compileAclEffect(source + ' SELECT 1;', replayHash(source + ' SELECT 1;')),
    ).toThrow('REPLAY_STRUCTURAL_GRAMMAR_UNSUPPORTED')
    const grantOption = source.replace(';', ' WITH GRANT OPTION;')
    expect(() => compileAclEffect(grantOption, replayHash(grantOption))).toThrow(
      'REPLAY_STRUCTURAL_GRAMMAR_UNSUPPORTED',
    )
    expect(() => compileAclEffect(source + ' ', replayHash(source))).toThrow(
      'REPLAY_STRUCTURAL_SOURCE_HASH_DRIFT',
    )
  })
})
