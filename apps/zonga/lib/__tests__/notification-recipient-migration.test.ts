import { PGlite } from '@electric-sql/pglite'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { is, SQL } from 'drizzle-orm'
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { zongaNotifications } from '../../../../packages/db/src/schema/zonga'

const db = new PGlite()
const org = randomUUID()
const legacyUser = randomUUID()
const legacyNotification = randomUUID()
const migration = readFileSync(new URL('../../../../packages/db/drizzle/0042_zonga_notification_recipient_identity.sql', import.meta.url), 'utf8')
let historicalRow: unknown

beforeAll(async () => {
  // Exact released notification columns; canonical recipient did not exist.
  await db.exec(`CREATE TABLE orgs(id uuid PRIMARY KEY);
    CREATE TABLE zonga_notifications(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid NOT NULL REFERENCES orgs(id),
      user_id uuid NOT NULL,type varchar(100) NOT NULL,title varchar(500) NOT NULL,
      body text,link text,read boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now());`)
  await db.query('INSERT INTO orgs VALUES($1)', [org])
  await db.query("INSERT INTO zonga_notifications(id,org_id,user_id,type,title,body,link,read,created_at) VALUES($1,$2,$3,'moderation','Retained historical notice','Unbound attribution remains historical','/retained',false,'2026-11-17T00:00:00Z')", [legacyNotification, org, legacyUser])
  historicalRow = (await db.query('SELECT to_jsonb(n) AS row FROM zonga_notifications n')).rows
  await db.exec(migration)
})
afterAll(async () => { await db.close() })

describe('canonical notification recipients without legacy identity inference', () => {
  it('preserves all historical fields and leaves canonical attribution unset', async () => {
    expect((await db.query("SELECT to_jsonb(n)-'recipient_user_id' AS row FROM zonga_notifications n WHERE id=$1", [legacyNotification])).rows).toEqual(historicalRow)
    expect((await db.query('SELECT recipient_user_id FROM zonga_notifications WHERE id=$1', [legacyNotification])).rows).toEqual([{ recipient_user_id: null }])
  })

  it('stores the actual opaque principal without manufacturing a UUID or profile relationship', async () => {
    const id = randomUUID()
    const principal = 'entra:controlled-notification-recipient'
    await db.query("INSERT INTO zonga_notifications(id,org_id,recipient_user_id,type,title) VALUES($1,$2,$3,'moderation','Canonical notice')", [id, org, principal])
    expect((await db.query('SELECT id,user_id,recipient_user_id FROM zonga_notifications WHERE recipient_user_id=$1', [principal])).rows).toEqual([{ id, user_id: null, recipient_user_id: principal }])
  })

  it('never turns matching UUID text into ownership of an unbound legacy row', async () => {
    const id = randomUUID()
    await db.query("INSERT INTO zonga_notifications(id,org_id,recipient_user_id,type,title) VALUES($1,$2,$3,'moderation','Verified UUID-shaped principal')", [id, org, legacyUser])
    expect((await db.query('SELECT id FROM zonga_notifications WHERE recipient_user_id=$1', [legacyUser])).rows).toEqual([{ id }])
    expect((await db.query('SELECT user_id FROM zonga_notifications WHERE id=$1', [legacyNotification])).rows).toEqual([{ user_id: legacyUser }])
  })

  it.each([
    { label: 'no recipient', canonical: null, legacy: null },
    { label: 'empty principal', canonical: '', legacy: null },
    { label: 'whitespace principal', canonical: '   ', legacy: null },
    { label: 'normalized alias', canonical: ' opaque-identity ', legacy: null },
    { label: 'conflicting namespaces', canonical: 'opaque-identity', legacy: legacyUser },
  ])('rejects $label at the physical write boundary', async ({ canonical, legacy }) => {
    await expect(db.query("INSERT INTO zonga_notifications(org_id,user_id,recipient_user_id,type,title) VALUES($1,$2,$3,'moderation','Rejected notice')", [org, legacy, canonical])).rejects.toMatchObject({ code: '23514', constraint: 'zonga_notification_recipient_namespace_ck' })
  })

  it('keeps the source declaration aligned with the migrated physical recipient fields', async () => {
    const declaration = getTableConfig(zongaNotifications)
    expect(declaration.columns.find(column => column.name === 'user_id')?.notNull).toBe(false)
    expect(declaration.columns.find(column => column.name === 'recipient_user_id')?.getSQLType()).toBe('text')
    expect(declaration.checks.map(check => check.name)).toContain('zonga_notification_recipient_namespace_ck')
    expect((await db.query("SELECT column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='zonga_notifications' AND column_name IN('user_id','recipient_user_id') ORDER BY column_name")).rows).toEqual([
      { column_name: 'recipient_user_id', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'user_id', data_type: 'uuid', is_nullable: 'YES' },
    ])
    expect((await db.query("SELECT convalidated FROM pg_constraint WHERE conrelid='public.zonga_notifications'::regclass AND conname='zonga_notification_recipient_namespace_ck'")).rows).toEqual([{ convalidated: true }])
  })

  it('installs the same physical check from the current declaration on a fresh database', async () => {
    const fresh = new PGlite()
    try {
      const declaration = getTableConfig(zongaNotifications)
      const dialect = new PgDialect()
      const quoted = (value: string) => `"${value.replaceAll('"', '""')}"`
      const columns = declaration.columns.map(column => {
        let defaultSql = ''
        if (column.hasDefault) {
          if (is(column.default, SQL)) {
            const expression = dialect.sqlToQuery(column.default)
            expect(expression.params).toEqual([])
            defaultSql = ` DEFAULT ${expression.sql}`
          } else if (typeof column.default === 'boolean') defaultSql = ` DEFAULT ${column.default}`
          else throw new Error('Unreviewed notification default declaration')
        }
        return `${quoted(column.name)} ${column.getSQLType()}${column.notNull ? ' NOT NULL' : ''}${column.primary ? ' PRIMARY KEY' : ''}${defaultSql}`
      })
      const checks = declaration.checks.map(check => {
        const expression = dialect.sqlToQuery(check.value)
        expect(expression.params).toEqual([])
        return `CONSTRAINT ${quoted(check.name)} CHECK (${expression.sql})`
      })
      await fresh.exec(`CREATE TABLE ${quoted(declaration.name)}(${[...columns, ...checks].join(',')})`)
      const query = "SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='public.zonga_notifications'::regclass AND conname='zonga_notification_recipient_namespace_ck'"
      expect((await fresh.query(query)).rows).toEqual((await db.query(query)).rows)
      await fresh.query("INSERT INTO zonga_notifications(org_id,recipient_user_id,type,title) VALUES($1,'opaque:canonical-principal','moderation','Fresh notice')", [org])
      await expect(fresh.query("INSERT INTO zonga_notifications(org_id,user_id,recipient_user_id,type,title) VALUES($1,$2,'conflicting-principal','moderation','Rejected')", [org, legacyUser])).rejects.toMatchObject({ code: '23514', constraint: 'zonga_notification_recipient_namespace_ck' })
    } finally { await fresh.close() }
  })
})
