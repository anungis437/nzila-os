import { describe, expect, it } from 'vitest'
import { FakeReplayCatalog } from './replay-fake-catalog'
import { replayHash } from './post-w4p-replay'
import { originalRelationQueries } from './replay-original-relation'
import { positionAuthorityQueries } from './replay-position-authority'

async function catalog() {
  const fake = new FakeReplayCatalog({ schemas: ['pg_catalog', 'public'] })
  const source = 'CREATE TABLE "public"."parent" ("id" uuid PRIMARY KEY, "user_id" text);'
  await fake.applyFrozenUnit(source, replayHash(source))
  return fake
}

describe('independent native grouped canonical ALTER source', () => {
  it('returns isolated native inventories and preserves varchar-array metadata', async () => {
    const fake = await catalog()
    const table = fake.tableInventory()[0]
    table.columns.push({
      name: 'labels',
      type_schema: 'pg_catalog',
      type_name: '_varchar',
      type_kind: 'b',
      postgres_type: 'character varying(12)[]',
      not_null: false,
      identity: '',
      generated: '',
      default_expression: null,
      collation_default: true,
      acl: null,
    })
    fake.replaceTable(table)
    const before = fake.digest()
    fake.tableInventory()[0].columns.length = 0
    expect(fake.digest()).toBe(before)
    expect(await fake.query(originalRelationQueries.columns, ['public', 'parent'])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'labels',
          type_oid: '1015',
          typmod: 16,
          collation: '100',
        }),
      ]),
    )
  })

  it('exposes stable numerical identities for actual native foreign keys', async () => {
    const fake = await catalog()
    const source =
      'ALTER TABLE "public"."parent" ADD COLUMN "owner_id" uuid REFERENCES "public"."parent" ("id");'
    await fake.applyFrozenUnit(source, replayHash(source))
    const first = await fake.query(positionAuthorityQueries.foreignKeys, ['public', 'parent'])
    expect(first).toEqual([
      expect.objectContaining({
        oid: expect.stringMatching(/^[1-9]\d*$/),
        name: 'parent_owner_id_fkey',
        columns: ['owner_id'],
        parent_columns: ['id'],
      }),
    ])
    const index = 'CREATE INDEX "users" ON "public"."parent" ("user_id");'
    await fake.applyFrozenUnit(index, replayHash(index))
    expect(await fake.query(positionAuthorityQueries.foreignKeys, ['public', 'parent'])).toEqual(
      first,
    )
  })

  it.each(['UNIQUE', 'CONSTRAINT "membership" UNIQUE'])(
    'executes ADD COLUMN and %s as one observed statement',
    async (constraint) => {
      const fake = await catalog()
      const source = `ALTER TABLE "public"."parent" ADD COLUMN "organization_id" text NOT NULL, ADD ${constraint} ("organization_id", "user_id");`
      const observed: string[] = []
      await fake.applyObservedFrozenUnit(source, replayHash(source), async (statement) => {
        observed.push(statement.sourceHash)
        expect(statement.beforeDigest).not.toBe(statement.afterDigest)
      })
      expect(observed).toEqual([replayHash(source)])
      const table = fake.tableInventory()[0]
      expect(table.columns.find((column) => column.name === 'organization_id')).toMatchObject({
        postgres_type: 'text',
        not_null: true,
      })
      expect(table.uniqueConstraints).toEqual([
        {
          name: constraint === 'UNIQUE' ? 'parent_organization_id_user_id_key' : 'membership',
          columns: ['organization_id', 'user_id'],
        },
      ])
    },
  )

  it('restores the entire statement if a later grouped command fails', async () => {
    const fake = await catalog(),
      before = fake.digest()
    const source =
      'ALTER TABLE "public"."parent" ADD COLUMN "organization_id" text, ADD COLUMN "id" uuid;'
    await expect(fake.applyFrozenUnit(source, replayHash(source))).rejects.toThrow(
      'FAKE_DUPLICATE_COLUMN',
    )
    expect(fake.digest()).toBe(before)
  })

  it('rejects existing duplicate nonnull keys but preserves PostgreSQL distinct-null semantics', async () => {
    const fake = await catalog()
    const table = fake.tableInventory()[0]
    table.rows = [
      { id: '11111111-1111-4111-8111-111111111111', user_id: 'same' },
      { id: '22222222-2222-4222-8222-222222222222', user_id: 'same' },
    ]
    fake.replaceTable(table)
    const before = fake.digest(),
      source = 'ALTER TABLE "public"."parent" ADD CONSTRAINT "users" UNIQUE ("user_id");'
    await expect(fake.applyFrozenUnit(source, replayHash(source))).rejects.toThrow(
      'FAKE_UNIQUE_EXISTING_ROW_VIOLATION',
    )
    expect(fake.digest()).toBe(before)
    table.rows = [
      { id: '11111111-1111-4111-8111-111111111111', user_id: null },
      { id: '22222222-2222-4222-8222-222222222222', user_id: null },
    ]
    fake.replaceTable(table)
    await fake.applyFrozenUnit(source, replayHash(source))
    expect(fake.tableInventory()[0].uniqueConstraints?.[0].name).toBe('users')
  })
})
