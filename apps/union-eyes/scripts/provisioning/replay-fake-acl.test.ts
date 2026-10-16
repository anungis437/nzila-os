import { describe, expect, it } from 'vitest'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { replayHash, replayObject, replayRecords, replayText } from './post-w4p-replay'
import {
  compileAclEffect,
  inspectAclEffect,
  aclQueries,
  type AclPositionAuthority,
} from './replay-acl-inspection'
import { FakeReplayCatalog } from './replay-fake-catalog'
const ledger = replayObject(
  JSON.parse(
    read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
  ),
)
const effects = replayRecords(ledger.BOUNDARIES)
  .flatMap((boundary) => replayRecords(boundary.EFFECTS))
  .filter((effect) => effect.EFFECT_CLASS === 'ACL_CHANGE')
const schemas = ['public', 'user_management', 'audit_security']
const tables = [
  ['public', 'representation_authorities'],
  ['public', 'external_matter_access_grants'],
  ['public', 'external_document_access_grants'],
  ['user_management', 'users'],
  ['user_management', 'organization_users'],
  ['user_management', 'auth_audit_log'],
  ['user_management', 'mfa_totp'],
  ['user_management', 'org_auth_policies'],
  ['user_management', 'user_sessions'],
  ['audit_security', 'audit_logs'],
]
async function fixture() {
  const catalog = new FakeReplayCatalog({
    schemas: ['pg_catalog'],
    roles: ['fake_owner', 'union_eyes_runtime', 'union_eyes_system'],
    functionContext: {
      actor: 'fake_owner',
      creationSchema: 'public',
      searchPath: ['pg_catalog', 'public', 'user_management', 'audit_security'],
      defaultAcl: [],
    },
    acl: {
      objects: [
        {
          schema: 'public',
          name: 'fixture_sequence',
          kind: 'SEQUENCE',
          owner: 'fake_owner',
          grants: [
            { grantor: 'fake_owner', grantee: 'public', privilege: 'USAGE', grantable: false },
          ],
        },
        {
          schema: 'user_management',
          name: 'fixture_auth_sequence',
          kind: 'SEQUENCE',
          owner: 'fake_owner',
          grants: [],
        },
      ],
      defaults: schemas.flatMap((schema) => [
        {
          schema,
          owner: 'fake_owner',
          kind: 'TABLE' as const,
          grants: [
            {
              grantor: 'fake_owner',
              grantee: 'union_eyes_runtime',
              privilege: 'SELECT',
              grantable: false,
            },
          ],
        },
        {
          schema,
          owner: 'fake_owner',
          kind: 'SEQUENCE' as const,
          grants: [
            {
              grantor: 'fake_owner',
              grantee: 'union_eyes_system',
              privilege: 'USAGE',
              grantable: false,
            },
          ],
        },
      ]),
    },
  })
  for (const schema of schemas) {
    const sql = `CREATE SCHEMA "${schema}";`
    await catalog.applyFrozenUnit(sql, replayHash(sql))
  }
  for (const [schema, name] of tables) {
    const sql = `CREATE TABLE "${schema}"."${name}" (id uuid PRIMARY KEY NOT NULL);`
    await catalog.applyFrozenUnit(sql, replayHash(sql))
  }
  return catalog
}
describe('independent source-native21ACL transitions;fixture physical inventory,not full23boundary proof', () => {
  it('pins all21source effects', () => expect(effects).toHaveLength(21))
  it('observes nonempty fixture sequence inventory and source grants instead of vacuous ALL-SEQUENCES proof', async () => {
    const catalog = await fixture()
    expect(await catalog.query(aclQueries.objects, ['public', 'SEQUENCE'])).toEqual([
      { schema: 'public', name: 'fixture_sequence', kind: 'SEQUENCE' },
    ])
    const sql = 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO union_eyes_runtime;'
    const spec = compileAclEffect(sql, replayHash(sql))
    await catalog.applyFrozenUnit(sql, replayHash(sql))
    expect(
      (
        await inspectAclEffect(catalog, spec, {
          sourceHash: replayHash(sql),
          actor: 'fake_owner',
          defaultOwner: 'fake_owner',
          objects: [
            { schema: 'public', name: 'fixture_sequence', kind: 'SEQUENCE', grantor: 'fake_owner' },
          ],
        })
      ).definition,
    ).toBe('EXACT')
  })
  for (const effect of effects) {
    it(`actual native ACL comparison and repeated-source stability:${effect.EFFECT_ID}`, async () => {
      const catalog = await fixture(),
        source = replayText(replayObject(effect.COMPARATOR).EXACT_SOURCE_SEMANTICS)
      const hash = replayText(effect.EXACT_EFFECT_SHA256),
        spec = compileAclEffect(source, hash)
      const objects = spec.defaults
        ? []
        : spec.all
          ? await catalog.query(aclQueries.objects, [spec.schema!, spec.kind])
          : [{ schema: spec.schema!, name: spec.name!, kind: spec.kind }]
      const authority: AclPositionAuthority = {
        sourceHash: hash,
        actor: 'fake_owner',
        defaultOwner: 'fake_owner',
        objects: objects.map((object) => {
          if (
            !object ||
            typeof object !== 'object' ||
            !('schema' in object) ||
            !('name' in object) ||
            !('kind' in object) ||
            typeof object.schema !== 'string' ||
            typeof object.name !== 'string' ||
            !['SCHEMA', 'TABLE', 'SEQUENCE'].includes(String(object.kind))
          )
            throw new Error('PHYSICAL_ACL_OBJECT_REQUIRED')
          const kind =
            object.kind === 'SCHEMA' ? 'SCHEMA' : object.kind === 'TABLE' ? 'TABLE' : 'SEQUENCE'
          return { schema: object.schema, name: object.name, kind, grantor: 'fake_owner' }
        }),
      }
      await catalog.applyFrozenUnit(source, hash)
      expect((await inspectAclEffect(catalog, spec, authority)).definition).toBe('EXACT')
      const before = catalog.digest()
      await catalog.applyFrozenUnit(source, hash)
      expect(catalog.digest()).toBe(before)
    })
  }
  it('retracts sticky schema defaults without auto-granting newly created tables', async () => {
    const catalog = await fixture()
    const effect = effects.find(
      (effect) => effect.EFFECT_ID === 'UE-W5A-MIGRATION-9931366ae1d06998:E004',
    )!
    await catalog.applyFrozenUnit(
      replayText(replayObject(effect.COMPARATOR).EXACT_SOURCE_SEMANTICS),
      replayText(effect.EXACT_EFFECT_SHA256),
    )
    const sql = 'CREATE TABLE public.future_owned_table (id uuid PRIMARY KEY NOT NULL);'
    await catalog.applyFrozenUnit(sql, replayHash(sql))
    expect(
      (await catalog.query(aclQueries.tableAcl, ['public', 'future_owned_table'])).some(
        (grant) =>
          !!grant &&
          typeof grant === 'object' &&
          'grantee' in grant &&
          grant.grantee === 'union_eyes_runtime',
      ),
    ).toBe(false)
  })
  it('rolls back actual grant changes and staged receipt on commit failure', async () => {
    const catalog = await fixture(),
      before = catalog.digest(),
      effect = effects[0]
    await expect(
      catalog.transaction(async (working) => {
        await working.applyFrozenUnit(
          replayText(replayObject(effect.COMPARATOR).EXACT_SOURCE_SEMANTICS),
          replayText(effect.EXACT_EFFECT_SHA256),
        )
        working.stageReceipt('acl-fake-receipt', { sourceHash: effect.EXACT_EFFECT_SHA256 })
      }, true),
    ).rejects.toThrow('FAKE_COMMIT_FAILED')
    expect(catalog.digest()).toBe(before)
    expect(catalog.readReceipt('acl-fake-receipt')).toBeNull()
  })
  it('denies unsupported grant options,unknown roles and missing targets without publishing partial grants', async () => {
    for (const sql of [
      'GRANT SELECT ON TABLE public.representation_authorities TO missing_role;',
      'GRANT SELECT ON TABLE public.missing_table TO union_eyes_runtime;',
      'GRANT SELECT ON TABLE public.representation_authorities TO union_eyes_runtime WITH GRANT OPTION;',
    ]) {
      const catalog = await fixture(),
        before = catalog.digest()
      await expect(catalog.applyFrozenUnit(sql, replayHash(sql))).rejects.toThrow()
      expect(catalog.digest()).toBe(before)
    }
  })
})
