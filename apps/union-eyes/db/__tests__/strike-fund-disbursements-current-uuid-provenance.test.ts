// Current-lifecycle proof for
// db/migrations-platform/0008_strike_fund_uuid_membership_provenance.sql.
//
// The historical PGlite fixture in
// strike-fund-disbursements-organization-provenance.test.ts keeps
// organization_members.organization_id as text and exercises frozen
// 20260909. This file uses the canonical UUID foreign key and the
// forward-only platform statement. Passing the historical file is not
// evidence for this file.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const MIGRATION_SQL = readFileSync(
  resolve(__dirname, '../migrations-platform/0008_strike_fund_uuid_membership_provenance.sql'),
  'utf-8',
)

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'
const MEMBER_1 = '44444444-4444-4444-8444-444444444444'
const MEMBER_2 = '55555555-5555-4555-8555-555555555555'
const USER = 'user-1'
const DISB = '33333333-3333-4333-8333-333333333333'

async function createCurrentDb(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(`
    create table organizations (
      id uuid primary key,
      slug text not null unique
    );
    create table organization_members (
      id uuid primary key,
      user_id text not null,
      organization_id uuid not null references organizations(id),
      joined_at timestamptz not null default now(),
      deleted_at timestamptz
    );
    create table strike_fund_disbursements (
      id uuid primary key,
      user_id varchar(255) not null,
      payment_date timestamp not null,
      organization_id uuid
    );
  `)
  return db
}

async function seedOrg(db: PGlite, id: string, slug: string) {
  await db.query(`insert into organizations (id, slug) values ($1, $2)`, [id, slug])
}

async function seedMembership(
  db: PGlite,
  args: { id: string; userId: string; organizationId: string; joinedAt: string; deletedAt?: string | null },
) {
  await db.query(
    `insert into organization_members (id, user_id, organization_id, joined_at, deleted_at) values ($1, $2, $3, $4, $5)`,
    [args.id, args.userId, args.organizationId, args.joinedAt, args.deletedAt ?? null],
  )
}

async function seedDisbursement(
  db: PGlite,
  args: { id: string; userId: string; paymentDate: string; organizationId?: string | null },
) {
  await db.query(
    `insert into strike_fund_disbursements (id, user_id, payment_date, organization_id) values ($1, $2, $3, $4)`,
    [args.id, args.userId, args.paymentDate, args.organizationId ?? null],
  )
}

async function runMigration(db: PGlite): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db.exec(MIGRATION_SQL)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

async function getOrgId(db: PGlite, disbursementId: string): Promise<string | null> {
  const res = await db.query<{ organization_id: string | null }>(
    `select organization_id from strike_fund_disbursements where id = $1`,
    [disbursementId],
  )
  return res.rows[0]?.organization_id ?? null
}

describe('strike_fund_disbursements current UUID provenance', () => {
  it('maps the single organization that owned the membership at payment_date', async () => {
    const db = await createCurrentDb()
    await seedOrg(db, ORG_A, 'org-a')
    await seedOrg(db, ORG_B, 'org-b')
    await seedMembership(db, { id: MEMBER_1, userId: USER, organizationId: ORG_A, joinedAt: '2025-01-01' })
    await seedDisbursement(db, { id: DISB, userId: USER, paymentDate: '2025-06-01' })

    const result = await runMigration(db)
    expect(result.ok).toBe(true)
    expect(await getOrgId(db, DISB)).toBe(ORG_A)
  })

  it('does not substitute a membership that began after payment_date', async () => {
    const db = await createCurrentDb()
    await seedOrg(db, ORG_A, 'org-a')
    await seedMembership(db, { id: MEMBER_1, userId: USER, organizationId: ORG_A, joinedAt: '2025-07-01' })
    await seedDisbursement(db, { id: DISB, userId: USER, paymentDate: '2025-06-01' })

    const result = await runMigration(db)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/zero or ambiguous/i)
    expect(await getOrgId(db, DISB)).toBeNull()
  })

  it('keeps a membership that was deleted after the payment date', async () => {
    const db = await createCurrentDb()
    await seedOrg(db, ORG_A, 'org-a')
    await seedMembership(db, {
      id: MEMBER_1,
      userId: USER,
      organizationId: ORG_A,
      joinedAt: '2025-01-01',
      deletedAt: '2025-08-01',
    })
    await seedDisbursement(db, { id: DISB, userId: USER, paymentDate: '2025-06-01' })

    const result = await runMigration(db)
    expect(result.ok).toBe(true)
    expect(await getOrgId(db, DISB)).toBe(ORG_A)
  })

  it('rejects a membership deleted before the payment date', async () => {
    const db = await createCurrentDb()
    await seedOrg(db, ORG_A, 'org-a')
    await seedMembership(db, {
      id: MEMBER_1,
      userId: USER,
      organizationId: ORG_A,
      joinedAt: '2025-01-01',
      deletedAt: '2025-03-01',
    })
    await seedDisbursement(db, { id: DISB, userId: USER, paymentDate: '2025-06-01' })

    const result = await runMigration(db)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/zero or ambiguous/i)
  })

  it('rejects two organizations that were both effective at payment_date', async () => {
    const db = await createCurrentDb()
    await seedOrg(db, ORG_A, 'org-a')
    await seedOrg(db, ORG_B, 'org-b')
    await seedMembership(db, { id: MEMBER_1, userId: USER, organizationId: ORG_A, joinedAt: '2025-01-01' })
    await seedMembership(db, { id: MEMBER_2, userId: USER, organizationId: ORG_B, joinedAt: '2025-02-01' })
    await seedDisbursement(db, { id: DISB, userId: USER, paymentDate: '2025-06-01' })

    const result = await runMigration(db)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/zero or ambiguous/i)
    const remaining = await db.query<{ id: string }>(
      `select id from strike_fund_disbursements where id = $1`,
      [DISB],
    )
    expect(remaining.rows).toHaveLength(1)
  })

  it('rejects a disbursement with no effective membership', async () => {
    const db = await createCurrentDb()
    await seedDisbursement(db, { id: DISB, userId: USER, paymentDate: '2025-06-01' })

    const result = await runMigration(db)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/zero or ambiguous/i)
  })

  it('does not let a later membership replace the organization that owned the payment date', async () => {
    const db = await createCurrentDb()
    await seedOrg(db, ORG_A, 'org-a')
    await seedOrg(db, ORG_B, 'org-b')
    await seedMembership(db, {
      id: MEMBER_1,
      userId: USER,
      organizationId: ORG_A,
      joinedAt: '2025-01-01',
      deletedAt: '2025-07-01',
    })
    await seedMembership(db, { id: MEMBER_2, userId: USER, organizationId: ORG_B, joinedAt: '2025-07-01' })
    await seedDisbursement(db, { id: DISB, userId: USER, paymentDate: '2025-06-01' })

    const result = await runMigration(db)
    expect(result.ok).toBe(true)
    expect(await getOrgId(db, DISB)).toBe(ORG_A)
  })

  it('preserves an existing organization_id and still enforces the foreign key', async () => {
    const db = await createCurrentDb()
    await seedOrg(db, ORG_A, 'org-a')
    await seedOrg(db, ORG_B, 'org-b')
    await seedMembership(db, { id: MEMBER_1, userId: USER, organizationId: ORG_B, joinedAt: '2025-01-01' })
    await seedDisbursement(db, { id: DISB, userId: USER, paymentDate: '2025-06-01', organizationId: ORG_A })

    const result = await runMigration(db)
    expect(result.ok).toBe(true)
    expect(await getOrgId(db, DISB)).toBe(ORG_A)
  })

  it('accepts a second execution after a successful attribution', async () => {
    const db = await createCurrentDb()
    await seedOrg(db, ORG_A, 'org-a')
    await seedMembership(db, { id: MEMBER_1, userId: USER, organizationId: ORG_A, joinedAt: '2025-01-01' })
    await seedDisbursement(db, { id: DISB, userId: USER, paymentDate: '2025-06-01' })
    expect((await runMigration(db)).ok).toBe(true)
    expect((await runMigration(db)).ok).toBe(true)
    expect(await getOrgId(db, DISB)).toBe(ORG_A)
  })

  it('rejects an organization_id that is not an organizations.id', async () => {
    const db = await createCurrentDb()
    await seedOrg(db, ORG_A, 'org-a')
    const result = await runMigration(db)
    expect(result.ok).toBe(true)
    const inserted = await db.exec(
      `insert into strike_fund_disbursements (id, user_id, payment_date, organization_id) values ('${DISB}', '${USER}', '2025-06-01', '${ORG_B}')`,
    ).then(
      () => ({ ok: true as const }),
      (err: unknown) => ({ ok: false as const, error: err instanceof Error ? err.message : String(err) }),
    )
    expect(inserted.ok).toBe(false)
    if (!inserted.ok) expect(inserted.error).toMatch(/foreign key|violates/i)
  })

  it('accepts an empty disbursement table and sets organization_id not null', async () => {
    const db = await createCurrentDb()
    await seedOrg(db, ORG_A, 'org-a')

    const result = await runMigration(db)
    expect(result.ok).toBe(true)
    const column = await db.query<{ is_nullable: string }>(
      `select is_nullable from information_schema.columns
       where table_name = 'strike_fund_disbursements' and column_name = 'organization_id'`,
    )
    expect(column.rows[0]?.is_nullable).toBe('NO')
  })

  it('constrains organization_id when the table is empty and has no payment_date', async () => {
    const db = new PGlite()
    await db.exec(`
      create table organizations (id uuid primary key, slug text not null unique);
      create table organization_members (
        id uuid primary key,
        user_id text not null,
        organization_id uuid not null references organizations(id),
        joined_at timestamptz not null,
        deleted_at timestamptz
      );
      create table strike_fund_disbursements (
        id uuid primary key,
        user_id varchar(255) not null
      );
    `)
    await seedOrg(db, ORG_A, 'org-a')
    const result = await runMigration(db)
    expect(result.ok).toBe(true)
    const column = await db.query<{ is_nullable: string }>(
      `select is_nullable from information_schema.columns
       where table_name = 'strike_fund_disbursements' and column_name = 'organization_id'`,
    )
    expect(column.rows[0]?.is_nullable).toBe('NO')
  })

  it('fails closed when payment_date is absent and a disbursement row exists', async () => {
    const db = new PGlite()
    await db.exec(`
      create table organizations (id uuid primary key, slug text not null unique);
      create table organization_members (
        id uuid primary key,
        user_id text not null,
        organization_id uuid not null references organizations(id),
        joined_at timestamptz not null,
        deleted_at timestamptz
      );
      create table strike_fund_disbursements (
        id uuid primary key,
        user_id varchar(255) not null
      );
    `)
    await seedOrg(db, ORG_A, 'org-a')
    await db.query(`insert into strike_fund_disbursements (id, user_id) values ($1, $2)`, [DISB, USER])
    const result = await runMigration(db)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/payment_date/i)
    const remaining = await db.query<{ id: string; user_id: string }>(
      `select id, user_id from strike_fund_disbursements where id = $1`,
      [DISB],
    )
    expect(remaining.rows).toEqual([{ id: DISB, user_id: USER }])
  })

  it('fails closed when the disbursement table does not exist', async () => {
    const db = new PGlite()
    await db.exec(`
      create table organizations (id uuid primary key, slug text not null unique);
      create table organization_members (
        id uuid primary key,
        user_id text not null,
        organization_id uuid not null,
        joined_at timestamptz not null,
        deleted_at timestamptz
      );
    `)
    const result = await runMigration(db)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/absent/i)
  })

  it('fails closed when membership organization_id is still text', async () => {
    const db = new PGlite()
    await db.exec(`
      create table organizations (id uuid primary key, slug text not null unique);
      create table organization_members (
        id uuid primary key,
        user_id text not null,
        organization_id text not null,
        joined_at timestamptz not null,
        deleted_at timestamptz
      );
      create table strike_fund_disbursements (
        id uuid primary key,
        user_id varchar(255) not null,
        payment_date timestamp not null
      );
    `)
    const result = await runMigration(db)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/not uuid/i)
  })
})
