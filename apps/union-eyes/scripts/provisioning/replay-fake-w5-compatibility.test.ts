import { beforeAll, describe, expect, it } from 'vitest'
import { loadSpecification } from '../../../../scripts/ue/implement-w4p-platform-promotion'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import { read, root } from '../../../../scripts/ue/w4-physical-producers'
import { compileReplayComponents } from './replay-effect-registry'
import {
  createSourceBoundDjangoCatalog,
  loadSourceBoundDjangoBaseline,
  type SourceBoundDjangoBaseline,
} from './replay-fake-django-baseline'
import { replayDigest, replayHash } from './post-w4p-replay'
import {
  applyFakeProspectiveMembershipOverlay,
  buildProspectiveMembershipAuthority,
  membershipUniqueSql,
  type ProspectiveMembershipAuthority,
} from './replay-fake-w5-compatibility'

const wheelhouse = process.env.UE_FAKE_DJANGO_WHEELHOUSE
const first = '11111111-1111-4111-8111-111111111111'
const second = '22222222-2222-4222-8222-222222222222'
let baseline: SourceBoundDjangoBaseline
let authority: ProspectiveMembershipAuthority
async function fixture(members: { organization_id: string | null; user_id: string }[] = []) {
  const catalog = await createSourceBoundDjangoCatalog(baseline, ['organization_members'], {
    schemas: ['pg_catalog', 'public'],
    database: 'fake_w5_compat',
    roles: ['fake_admin'],
    functionContext: {
      actor: 'fake_admin',
      creationSchema: 'public',
      searchPath: ['public', 'pg_catalog'],
      defaultAcl: [],
    },
  })
  for (const table of catalog.tableInventory()) {
    table.owner = 'fake_admin'
    catalog.replaceTable(table)
  }
  const organizations = catalog.inspectTable('public', 'organizations')!
  organizations.rows = [{ id: first }, { id: second }]
  catalog.replaceTable(organizations)
  const table = catalog.inspectTable('public', 'organization_members')!
  table.rows = members
  catalog.replaceTable(table)
  return catalog
}

describe.skipIf(!wheelhouse)('authorized offline source-bound UUID membership overlay', () => {
  beforeAll(async () => {
    if (!wheelhouse) throw new Error('UE_FAKE_DJANGO_WHEELHOUSE_REQUIRED')
    baseline = loadSourceBoundDjangoBaseline({ repositoryRoot: root, wheelhouse })
    authority = buildProspectiveMembershipAuthority(
      baseline,
      (await loadSpecification()).specification,
    )
  })

  it('retains the independent source answer and exact source FK while materializing unique/noop', async () => {
    const source = replayDigest(baseline)
    const catalog = await fixture([
      { organization_id: first, user_id: 'one' },
      { organization_id: second, user_id: 'one' },
      { organization_id: first, user_id: 'two' },
    ])
    const result = await applyFakeProspectiveMembershipOverlay(catalog, authority)
    expect(result.receiptPublished).toBe(false)
    expect(result.executionAuthorized).toBe(false)
    expect(
      catalog.inspectForeignKey('public', 'organization_members', authority.sourceForeignKey.name),
    ).toEqual(authority.sourceForeignKey)
    expect(catalog.inspectTable('public', 'organization_members')?.uniqueConstraints).toEqual([
      { name: 'unique_org_membership', columns: ['organization_id', 'user_id'] },
    ])
    const before = catalog.digest()
    await applyFakeProspectiveMembershipOverlay(catalog, authority)
    expect(catalog.digest()).toBe(before)
    expect(replayDigest(baseline)).toBe(source)
    expect(
      baseline.tables.find((table) => table.name === 'organization_members')?.uniqueConstraints,
    ).toEqual([])
  })

  it.each([
    [
      'duplicate pair',
      [
        { organization_id: first, user_id: 'one' },
        { organization_id: first, user_id: 'one' },
      ],
      'DUPLICATE',
    ],
    ['null organization', [{ organization_id: null, user_id: 'one' }], 'UUID_OR_NULL'],
    ['invalid UUID', [{ organization_id: 'invalid', user_id: 'one' }], 'UUID_OR_NULL'],
    [
      'wrong organization UUID',
      [{ organization_id: '33333333-3333-4333-8333-333333333333', user_id: 'one' }],
      'FK',
    ],
  ] as const)(
    'denies %s without repairing rows or publishing receipt',
    async (_name, rows, code) => {
      const catalog = await fixture(rows.map((row) => ({ ...row })))
      const before = catalog.digest()
      await expect(applyFakeProspectiveMembershipOverlay(catalog, authority)).rejects.toThrow(
        `W5_COMPAT_LEGACY_${code}_DENIED`,
      )
      expect(catalog.digest()).toBe(before)
    },
  )

  it('denies a borrowed or changed prospective authority', async () => {
    const catalog = await fixture()
    await expect(
      applyFakeProspectiveMembershipOverlay(catalog, structuredClone(authority)),
    ).rejects.toThrow('W5_COMPAT_BOUND_AUTHORITY_REQUIRED')
  })

  it.each(['commit', 'postcondition', 'receipt'])(
    'rolls back overlay and staged receipt on forced %s failure',
    async (fault) => {
      const catalog = await fixture()
      const before = catalog.digest()
      await expect(
        catalog.transaction(async () => {
          await applyFakeProspectiveMembershipOverlay(catalog, authority)
          catalog.stageReceipt('overlay-test', { notPublished: true })
          if (fault !== 'commit') throw new Error(`FORCED_${fault.toUpperCase()}_FAILURE`)
        }, fault === 'commit'),
      ).rejects.toThrow(
        fault === 'commit' ? 'FAKE_COMMIT_FAILED' : `FORCED_${fault.toUpperCase()}_FAILURE`,
      )
      expect(catalog.digest()).toBe(before)
    },
  )

  it('denies a conflicting unique identity without overwriting it', async () => {
    const catalog = await fixture()
    const sql = membershipUniqueSql.replace('("organization_id", "user_id")', '("user_id")')
    await catalog.applyFrozenUnit(sql, replayHash(sql))
    const before = catalog.digest()
    await expect(applyFakeProspectiveMembershipOverlay(catalog, authority)).rejects.toThrow(
      'W5_COMPAT_OVERLAY_POSTCONDITION_DENIED',
    )
    expect(catalog.digest()).toBe(before)
  })

  it('interprets preserved E048 UUID assignment without a cast and restores forced failed postcondition', async () => {
    const { frozen, sourceBytes } = loadFrozenReplay()
    const components = compileReplayComponents(
      frozen,
      sourceBytes,
      read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
    )
    const effect = components.effects.find(
      (entry) => entry.effectId === 'UE-W5A-MIGRATION-d264f77905daf432:E048',
    )!
    expect(effect.sourceHash).toBe(
      '32f8b632fb11db40437bd9d9f063e30a7ff54fe7ecdeb938736697e685d6775b',
    )
    const catalog = await fixture([{ organization_id: first, user_id: 'one' }])
    await applyFakeProspectiveMembershipOverlay(catalog, authority)
    const sql = 'CREATE TABLE public.member_documents (id text, user_id text);'
    await catalog.applyFrozenUnit(sql, replayHash(sql))
    const documents = catalog.inspectTable('public', 'member_documents')!
    documents.rows = [{ id: 'doc', user_id: 'one' }]
    catalog.replaceTable(documents)
    const before = catalog.digest()
    await expect(
      catalog.transaction(async () => {
        await catalog.applyFrozenUnit(effect.source, effect.sourceHash)
        expect(catalog.inspectTable('public', 'member_documents')?.rows[0].organization_id).toBe(
          first,
        )
        throw new Error('FORCED_E048_POSTCONDITION_FAILURE')
      }),
    ).rejects.toThrow('FORCED_E048_POSTCONDITION_FAILURE')
    expect(catalog.digest()).toBe(before)
    await catalog.applyFrozenUnit(effect.source, effect.sourceHash)
    expect(catalog.inspectTable('public', 'member_documents')?.rows[0].organization_id).toBe(first)
  })
})
