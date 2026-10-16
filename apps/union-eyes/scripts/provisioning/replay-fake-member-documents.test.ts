import { describe, expect, it } from 'vitest'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { compileReplayComponents } from './replay-effect-registry'
import { FakeReplayCatalog } from './replay-fake-catalog'
import {
  inspectProceduralEffect,
  memberDocumentsAggregateQuery,
  type ProceduralContext,
} from './replay-procedural-inspection'
import { replayHash } from './post-w4p-replay'
const { frozen, sourceBytes } = loadFrozenReplay()
const components = compileReplayComponents(
  frozen,
  sourceBytes,
  read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
)
const effect = components.effects.find(
  (effect) =>
    effect.compiled.kind === 'PROCEDURAL' && effect.compiled.contract.geometry.kind === 'BACKFILL',
)!
const first = '11111111-1111-4111-8111-111111111111',
  second = '22222222-2222-4222-8222-222222222222'
async function fixture(includeDocuments = true) {
  const catalog = new FakeReplayCatalog({
    schemas: ['pg_catalog', 'public'],
    database: 'fake_replay',
    roles: ['fake_owner'],
    functionContext: {
      actor: 'fake_owner',
      creationSchema: 'public',
      searchPath: ['pg_catalog', 'public'],
      defaultAcl: [],
    },
  })
  const sources = [
    'CREATE TABLE public.organizations (id uuid PRIMARY KEY NOT NULL);',
    'CREATE TABLE public.organization_members (user_id text, organization_id uuid);',
  ]
  if (includeDocuments)
    sources.push('CREATE TABLE public.member_documents (id text, user_id text);')
  for (const sql of sources) await catalog.applyFrozenUnit(sql, replayHash(sql))
  const organizations = catalog.inspectTable('public', 'organizations')!
  organizations.rows.push({ id: first }, { id: second })
  catalog.replaceTable(organizations)
  return catalog
}
function context(catalog: FakeReplayCatalog): ProceduralContext {
  const snapshotDigest = catalog.digest()
  return {
    effectId: effect.effectId,
    sourceHash: effect.sourceHash,
    boundaryHash: effect.boundaryHash,
    ordinal: effect.ordinal,
    window: 'IMMEDIATE_PRE_SUCCESSOR',
    snapshotDigest,
    actor: 'fake_owner',
    database: 'fake_replay',
    searchPath: ['pg_catalog', 'public'],
    relations: {
      member_documents: 'public',
      organization_members: 'public',
      organizations: 'public',
    },
    catalogVisibility: { snapshotDigest, schemas: ['public'] },
    dataVisibility: Object.fromEntries(
      ['member_documents', 'organization_members'].map((table) => [
        `public.${table}`,
        { snapshotDigest, basis: 'independent-fixture-complete-row-inventory' },
      ]),
    ),
    memberDocumentsForeignKeyName: 'member_documents_organization_id_fkey',
  }
}
async function observe(catalog: FakeReplayCatalog) {
  if (effect.compiled.kind !== 'PROCEDURAL') throw new Error('PROCEDURAL_REQUIRED')
  return inspectProceduralEffect(catalog, effect.compiled.contract, context(catalog))
}
function rows(
  catalog: FakeReplayCatalog,
  documents: Record<string, string | null>[],
  members: Record<string, string | null>[],
) {
  const documentTable = catalog.inspectTable('public', 'member_documents')!
  const memberTable = catalog.inspectTable('public', 'organization_members')!
  documentTable.rows = documents
  memberTable.rows = members
  catalog.replaceTable(documentTable)
  catalog.replaceTable(memberTable)
}
describe('actual member-document DO invariant and UPDATE FROM;fixture rows,not whole107proof', () => {
  it.each(['text', 'varchar'])(
    'denies uncast %s-to-UUID assignment even when both input tables are empty',
    async (type) => {
      const catalog = await fixture()
      const members = catalog.inspectTable('public', 'organization_members')!
      const column = members.columns.find((entry) => entry.name === 'organization_id')!
      column.type_name = type
      column.postgres_type = type === 'varchar' ? 'character varying(255)' : 'text'
      catalog.replaceTable(members)
      const before = catalog.digest()
      await expect(catalog.applyFrozenUnit(effect.source, effect.sourceHash)).rejects.toThrow(
        `FAKE_BACKFILL_NATIVE_ASSIGNMENT_TYPE_MISMATCH:pg_catalog.${type}->pg_catalog.uuid`,
      )
      expect(catalog.digest()).toBe(before)
    },
  )

  it('independently creates nullable FK/indexes and compares real native empty state and stable repeat', async () => {
    const catalog = await fixture()
    await catalog.applyFrozenUnit(effect.source, effect.sourceHash)
    expect((await observe(catalog)).state).toBe('EXACT')
    const digest = catalog.digest()
    await catalog.applyFrozenUnit(effect.source, effect.sourceHash)
    expect(catalog.digest()).toBe(digest)
    expect((await observe(catalog)).state).toBe('EXACT')
  })
  it('uses actual unambiguous membership rows, tolerating duplicate memberships for the same organization', async () => {
    const catalog = await fixture()
    rows(
      catalog,
      [
        { id: 'document-one', user_id: 'member-one' },
        { id: 'document-two', user_id: 'member-two' },
      ],
      [
        { user_id: 'member-one', organization_id: first },
        { user_id: 'member-one', organization_id: first },
        { user_id: 'member-two', organization_id: second },
      ],
    )
    await catalog.applyFrozenUnit(effect.source, effect.sourceHash)
    expect(
      catalog.inspectTable('public', 'member_documents')!.rows.map((row) => row.organization_id),
    ).toEqual([first, second])
    expect((await observe(catalog)).state).toBe('EXACT')
  })
  it('skips absent documents without a fabricated aggregate', async () => {
    const catalog = await fixture(false),
      before = catalog.digest()
    await catalog.applyFrozenUnit(effect.source, effect.sourceHash)
    expect(catalog.digest()).toBe(before)
    expect((await observe(catalog)).state).toBe('EXACT')
  })
  it.each(['no-match', 'multiple-organizations', 'null-membership'])(
    'source invariant aborts and restores column/FK/index state: %s',
    async (fault) => {
      const catalog = await fixture()
      const memberships =
        fault === 'no-match'
          ? []
          : fault === 'null-membership'
            ? [{ user_id: 'member', organization_id: null }]
            : [
                { user_id: 'member', organization_id: first },
                { user_id: 'member', organization_id: second },
              ]
      rows(catalog, [{ id: 'document', user_id: 'member' }], memberships)
      const before = catalog.digest()
      await expect(catalog.applyFrozenUnit(effect.source, effect.sourceHash)).rejects.toThrow(
        'FAKE_BACKFILL_SOURCE_INVARIANT_VIOLATED',
      )
      expect(catalog.digest()).toBe(before)
    },
  )
  it('counts ambiguous groups by source md.id rather than membership count or one group per document row', async () => {
    const catalog = await fixture()
    rows(
      catalog,
      [
        { id: 'shared-id', user_id: 'one' },
        { id: 'shared-id', user_id: 'two' },
      ],
      [
        { user_id: 'one', organization_id: first },
        { user_id: 'two', organization_id: second },
      ],
    )
    const before = catalog.digest()
    await expect(catalog.applyFrozenUnit(effect.source, effect.sourceHash)).rejects.toThrow(
      'FAKE_BACKFILL_SOURCE_INVARIANT_VIOLATED',
    )
    expect(catalog.digest()).toBe(before)
  })
  it('never infers a deterministic UPDATE outcome from distinct-org grouping when matching NULL memberships remain', async () => {
    const catalog = await fixture()
    rows(
      catalog,
      [{ id: 'document', user_id: 'member' }],
      [
        { user_id: 'member', organization_id: first },
        { user_id: 'member', organization_id: null },
      ],
    )
    const before = catalog.digest()
    await expect(catalog.applyFrozenUnit(effect.source, effect.sourceHash)).rejects.toThrow(
      'FAKE_BACKFILL_NONDETERMINISTIC_UPDATE_SOURCE',
    )
    expect(catalog.digest()).toBe(before)
  })
  it('does not fabricate successful updates for an unmatched row sharing an otherwise unambiguous group ID', async () => {
    const catalog = await fixture()
    rows(
      catalog,
      [
        { id: 'shared-id', user_id: 'matched' },
        { id: 'shared-id', user_id: 'missing' },
      ],
      [{ user_id: 'matched', organization_id: first }],
    )
    await catalog.applyFrozenUnit(effect.source, effect.sourceHash)
    expect(
      catalog.inspectTable('public', 'member_documents')!.rows.map((row) => row.organization_id),
    ).toEqual([first, null])
    expect((await observe(catalog)).state).toBe('MISSING_PREREQUISITE')
    expect(await catalog.query(memberDocumentsAggregateQuery('public', 'public'), [])).toEqual([
      { null_rows: '1', zero_match_groups: '1', multi_match_groups: '0' },
    ])
  })
  it('native FK rejects an invented organization during UPDATE and restores all earlier DDL', async () => {
    const catalog = await fixture()
    rows(
      catalog,
      [{ id: 'document', user_id: 'member' }],
      [{ user_id: 'member', organization_id: '33333333-3333-4333-8333-333333333333' }],
    )
    const before = catalog.digest()
    await expect(catalog.applyFrozenUnit(effect.source, effect.sourceHash)).rejects.toThrow(
      'FAKE_FOREIGN_KEY_EXISTING_ROW_VIOLATION',
    )
    expect(catalog.digest()).toBe(before)
  })
  it('commit failure restores real updated rows, DDL and receipt absence', async () => {
    const catalog = await fixture()
    rows(
      catalog,
      [{ id: 'document', user_id: 'member' }],
      [{ user_id: 'member', organization_id: first }],
    )
    const before = catalog.digest()
    await expect(
      catalog.transaction(async (working) => {
        await working.applyFrozenUnit(effect.source, effect.sourceHash)
        working.stageReceipt('member-documents', { sourceHash: effect.sourceHash })
      }, true),
    ).rejects.toThrow('FAKE_COMMIT_FAILED')
    expect(catalog.digest()).toBe(before)
    expect(catalog.readReceipt('member-documents')).toBeNull()
  })
})
