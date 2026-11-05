/**
 * What the converged schema does for the statements the declarations generate (UE-CONV-H-007), on real PostgreSQL. The convergence ratchet
 * (schema-convergence.postgres.test.ts) proves the shape; this proves the behaviour that shape exists for, through the ORM the application uses:
 *   - an insert that omits id, timestamps and defaulted columns succeeds and the database fills them (platform 0063);
 *   - a key declared unique is unique, so a duplicate is refused and ON CONFLICT can infer it (platform 0064);
 *   - a provider-assigned event id is stored as the text it is, not forced into a uuid (platform 0063);
 *   - a text[] declaration round-trips through a real text[] column (platform 0063);
 *   - a declared enum default and a widened column accept what the declaration allows (platforms 0062, 0063).
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { organizations, paymentRoutingRules, pilotApplications, stripeConnectAccounts, webhookEvents } from '../schema'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

describe.skipIf(!URL)('converged schema behaviour', () => {
  let client: pg.Client
  let db: ReturnType<typeof drizzle>
  const org = randomUUID()

  beforeAll(async () => {
    client = new pg.Client({ connectionString: URL })
    await client.connect()
    db = drizzle(client)
    await client.query(
      `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
       VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
      [org, 'Convergence Local', `convergence-${org}`],
    )
  })
  afterAll(async () => {
    await client.end()
  })

  it('fills the id, timestamps and defaults an insert omits', async () => {
    const [account] = await db
      .insert(stripeConnectAccounts)
      .values({
        accountType: 'operational',
        accountPurpose: 'dues',
        stripeAccountId: `acct_${randomUUID().slice(0, 12)}`,
        accountEmail: 'treasurer@example.org',
        accountName: 'Operating account',
        createdBy: 'convergence-test',
      })
      .returning()
    expect(account.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(account.createdAt).toBeInstanceOf(Date)
    expect(account.accountStatus).toBe('active')
    expect(account.separateAccount).toBe(true)

    // A foreign key between two relations that were text-typed in the declarations is a uuid on both sides now.
    const [rule] = await db
      .insert(paymentRoutingRules)
      .values({ paymentType: 'dues_payment', paymentCategory: 'operational', destinationAccountId: account.id, destinationAccountType: 'operational' })
      .returning()
    expect(rule.destinationAccountId).toBe(account.id)
  })

  it('refuses a duplicate of a declared unique key', async () => {
    const stripeAccountId = `acct_${randomUUID().slice(0, 12)}`
    const row = { accountType: 'operational', accountPurpose: 'dues', stripeAccountId, accountEmail: 'a@example.org', accountName: 'A', createdBy: 'convergence-test' }
    await db.insert(stripeConnectAccounts).values(row)
    await expect(db.insert(stripeConnectAccounts).values(row)).rejects.toMatchObject({ cause: { code: '23505' } })
    // ON CONFLICT can infer the key now that a unique index backs it.
    await db.insert(stripeConnectAccounts).values(row).onConflictDoNothing({ target: stripeConnectAccounts.stripeAccountId })

    const slug = `slug-${randomUUID()}`
    const insertOrganization = (id: string) =>
      client.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
        [id, slug, slug],
      )
    await insertOrganization(randomUUID())
    await expect(insertOrganization(randomUUID())).rejects.toMatchObject({ code: '23505' })
  })

  it('stores a provider-assigned event id as the text it is', async () => {
    const id = `evt_${randomUUID().replace(/-/g, '').slice(0, 24)}`
    const provider = webhookEvents.provider.enumValues[0]
    await db.insert(webhookEvents).values({ id, organizationId: org, provider, eventType: 'invoice.paid', payload: { ok: true } })
    const [stored] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, id))
    expect(stored.id).toBe(id)
    expect(stored.status).toBe('received')
    await expect(db.insert(webhookEvents).values({ id, organizationId: org, provider, eventType: 'invoice.paid', payload: {} })).rejects.toMatchObject({ cause: { code: '23505' } })
  })

  it('round-trips a text[] declaration through a text[] column', async () => {
    const [created] = await db
      .insert(pilotApplications)
      .values({
        organizationName: 'Local 1',
        organizationType: 'local',
        contactName: 'Casey',
        contactEmail: 'casey@example.org',
        memberCount: 40,
        jurisdictions: ['ON', 'QC'],
        sectors: ['health care'],
        challenges: ['paper, "quoted" and {braced}'],
        goals: ['automation'],
      })
      .returning()
    expect(created.jurisdictions).toEqual(['ON', 'QC'])
    expect(created.challenges).toEqual(['paper, "quoted" and {braced}'])
    const type = await client.query(`SELECT data_type FROM information_schema.columns WHERE table_name = 'pilot_applications' AND column_name = 'jurisdictions'`)
    expect(type.rows[0].data_type).toBe('ARRAY')
    // The database can use the array as one: this fails on a text column that merely stores a literal.
    const hit = await db.execute(sql`SELECT 1 FROM pilot_applications WHERE ${created.id}::uuid = id AND 'QC' = ANY (jurisdictions)`)
    expect(hit.rows.length).toBe(1)
  })

  it('accepts the width a declaration allows', async () => {
    const title = 'x'.repeat(500)
    await client.query(`CREATE TEMP TABLE _widths AS SELECT title FROM voting_sessions WHERE false`)
    await client.query(`INSERT INTO _widths (title) VALUES ($1)`, [title.slice(0, 255)])
    const width = await client.query(
      `SELECT character_maximum_length AS len FROM information_schema.columns WHERE table_name = 'voting_sessions' AND column_name = 'title'`,
    )
    expect(Number(width.rows[0].len)).toBeGreaterThanOrEqual(500)
  })

  it('keeps the organization row the other cases used', async () => {
    const [row] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, org))
    expect(row.id).toBe(org)
  })
})
