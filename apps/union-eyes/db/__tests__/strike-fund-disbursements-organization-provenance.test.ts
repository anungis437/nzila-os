// Round 58 Phase 0 (corrected) — behavioural proof that
// db/migrations/20260909_strike_fund_disbursements_organization_id.sql
// backfills organization_id from HISTORICAL, effective-at-payment-date
// organization_members provenance, not present-day membership.
//
// Runs the actual migration SQL against a real, in-process PostgreSQL
// (PGlite is a WASM build of PostgreSQL — same pattern as
// packages/sage-core/src/records-live-postgres.test.ts). No Docker or
// external service required.
//
// strike_id was evaluated as a potentially stronger provenance root
// (disbursement -> strike -> organization) per the Round 58 review. No
// "strikes"/strike-fund parent table exists anywhere in db/schema/** for
// strike_id to resolve against (confirmed via exhaustive grep), so there is
// no second provenance root to reconcile against organization_members here —
// only the organization_members effective-at-payment-date path applies.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const MIGRATION_SQL = readFileSync(
  resolve(__dirname, '../migrations/20260909_strike_fund_disbursements_organization_id.sql'),
  'utf-8',
)

/** Minimal pre-migration schema: just the columns the migration reads/writes. */
async function createFixtureDb(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(`
    create table organizations (
      id uuid primary key,
      slug text not null unique
    );
    create table organization_members (
      id uuid primary key,
      user_id text not null,
      organization_id text not null, -- slug, matches production schema-organizations.ts
      joined_at timestamptz not null default now(),
      deleted_at timestamptz
    );
    create table strike_fund_disbursements (
      id uuid primary key,
      user_id varchar(255) not null,
      payment_date timestamp not null
    );
  `)
  return db
}

async function seedOrg(db: PGlite, id: string, slug: string) {
  await db.query(`insert into organizations (id, slug) values ($1, $2)`, [id, slug])
}

async function seedMembership(
  db: PGlite,
  args: { id: string; userId: string; orgSlug: string; joinedAt: string; deletedAt?: string | null },
) {
  await db.query(
    `insert into organization_members (id, user_id, organization_id, joined_at, deleted_at) values ($1, $2, $3, $4, $5)`,
    [args.id, args.userId, args.orgSlug, args.joinedAt, args.deletedAt ?? null],
  )
}

async function seedDisbursement(db: PGlite, args: { id: string; userId: string; paymentDate: string }) {
  await db.query(`insert into strike_fund_disbursements (id, user_id, payment_date) values ($1, $2, $3)`, [
    args.id,
    args.userId,
    args.paymentDate,
  ])
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

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'
const MEMBER_1 = '44444444-4444-4444-8444-444444444444'
const MEMBER_2 = '55555555-5555-4555-8555-555555555555'
const USER = 'user-1'
const DISB = '33333333-3333-4333-8333-333333333333'

describe('strike_fund_disbursements organization_id backfill — historical provenance (Round 58 Phase 0)', () => {
  it('single historically valid membership -> maps to that organization', async () => {
    const db = await createFixtureDb()
    await seedOrg(db, ORG_A, 'org-a')
    await seedMembership(db, { id: MEMBER_1, userId: USER, orgSlug: 'org-a', joinedAt: '2025-01-01' })
    await seedDisbursement(db, { id: DISB, userId: USER, paymentDate: '2025-06-01' })

    const result = await runMigration(db)
    expect(result.ok).toBe(true)
    expect(await getOrgId(db, DISB)).toBe(ORG_A)
  })

  it('membership that began AFTER payment_date -> does not map (migration aborts)', async () => {
    const db = await createFixtureDb()
    await seedOrg(db, ORG_A, 'org-a')
    // Joined 2025-07-01, but the disbursement was paid earlier, 2025-06-01.
    await seedMembership(db, { id: MEMBER_1, userId: USER, orgSlug: 'org-a', joinedAt: '2025-07-01' })
    await seedDisbursement(db, { id: DISB, userId: USER, paymentDate: '2025-06-01' })

    const result = await runMigration(db)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/zero or ambiguous/i)
  })

  it('membership deleted AFTER payment_date -> maps (was still valid at payment time)', async () => {
    const db = await createFixtureDb()
    await seedOrg(db, ORG_A, 'org-a')
    await seedMembership(db, {
      id: MEMBER_1,
      userId: USER,
      orgSlug: 'org-a',
      joinedAt: '2025-01-01',
      deletedAt: '2025-08-01',
    })
    await seedDisbursement(db, { id: DISB, userId: USER, paymentDate: '2025-06-01' })

    const result = await runMigration(db)
    expect(result.ok).toBe(true)
    expect(await getOrgId(db, DISB)).toBe(ORG_A)
  })

  it('membership deleted BEFORE payment_date -> does not map (migration aborts)', async () => {
    const db = await createFixtureDb()
    await seedOrg(db, ORG_A, 'org-a')
    await seedMembership(db, {
      id: MEMBER_1,
      userId: USER,
      orgSlug: 'org-a',
      joinedAt: '2025-01-01',
      deletedAt: '2025-03-01',
    })
    await seedDisbursement(db, { id: DISB, userId: USER, paymentDate: '2025-06-01' })

    const result = await runMigration(db)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/zero or ambiguous/i)
  })

  it('two memberships valid at payment_date (different organizations) -> ambiguity, migration aborts', async () => {
    const db = await createFixtureDb()
    await seedOrg(db, ORG_A, 'org-a')
    await seedOrg(db, ORG_B, 'org-b')
    await seedMembership(db, { id: MEMBER_1, userId: USER, orgSlug: 'org-a', joinedAt: '2025-01-01' })
    await seedMembership(db, { id: MEMBER_2, userId: USER, orgSlug: 'org-b', joinedAt: '2025-02-01' })
    await seedDisbursement(db, { id: DISB, userId: USER, paymentDate: '2025-06-01' })

    const result = await runMigration(db)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/zero or ambiguous/i)
  })

  it('zero memberships valid at payment_date -> unmapped, migration aborts', async () => {
    const db = await createFixtureDb()
    await seedDisbursement(db, { id: DISB, userId: USER, paymentDate: '2025-06-01' })
    // No organization_members rows exist for this user at all.

    const result = await runMigration(db)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/zero or ambiguous/i)
  })

  it('a later, still-current membership does not retroactively override an earlier valid one', async () => {
    const db = await createFixtureDb()
    await seedOrg(db, ORG_A, 'org-a')
    await seedOrg(db, ORG_B, 'org-b')
    // Valid at payment time: org-a. Joined org-b only after the payment.
    await seedMembership(db, {
      id: MEMBER_1,
      userId: USER,
      orgSlug: 'org-a',
      joinedAt: '2025-01-01',
      deletedAt: '2025-07-01',
    })
    await seedMembership(db, { id: MEMBER_2, userId: USER, orgSlug: 'org-b', joinedAt: '2025-07-01' })
    await seedDisbursement(db, { id: DISB, userId: USER, paymentDate: '2025-06-01' })

    const result = await runMigration(db)
    expect(result.ok).toBe(true)
    expect(await getOrgId(db, DISB)).toBe(ORG_A)
  })
})
