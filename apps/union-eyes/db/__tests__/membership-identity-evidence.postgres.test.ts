/**
 * Read-only membership identity evidence on real PostgreSQL (lib/membership/identity-evidence.ts).
 *
 * What this holds, on synthetic memberships in a fresh organization:
 *   - memberships that share an email under different user ids are one DUPLICATE_EMAIL finding (case- and space-insensitive);
 *   - memberships whose user id names no canonical principal are UNRESOLVED_PRINCIPAL findings;
 *   - a soft-deleted membership and another organization's memberships are not reported when the scope is one organization;
 *   - the findings carry membership ids only, never an email or a name;
 *   - collection changes nothing, and runs in a transaction the database itself refuses to write in.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { collectMembershipIdentityEvidence } from '@/lib/membership/identity-evidence'
import { seedDeclaredCanonicalActor } from './native-declared-actor'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

describe.skipIf(!URL)('membership identity evidence over the real organization_members table', () => {
  const ORG = randomUUID()
  const OTHER = randomUUID()
  let admin: pg.Client
  const ids: Record<string, string> = {}

  const organization = (id: string, name: string) =>
    admin.query(
      `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
       VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
      [id, name, `evi-${id.slice(0, 8)}`],
    )
  const member = async (key: string, organizationId: string, userId: string, email: string, deleted = false) => {
    const id = randomUUID()
    ids[key] = id
    await admin.query(
      `INSERT INTO organization_members (id, user_id, organization_id, name, email, role, status, is_primary, created_at, updated_at, exempt_from_per_capita, deleted_at)
       VALUES ($1, $2, $3, 'Synthetic Member', $4, 'member', 'active', false, now(), now(), false, $5)`,
      [id, userId, organizationId, email, deleted ? new Date() : null],
    )
  }

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    await organization(ORG, 'Evidence Fixture Branch')
    await organization(OTHER, 'Evidence Other Tenant')
    // A real principal with one membership, and two memberships minted for the same address under random ids (the old import's defect).
    const real = `evidence-real-${randomUUID().slice(0, 8)}`
    await seedDeclaredCanonicalActor(admin, real, ORG, 'member')
    await member('real', ORG, real, 'pat@members.example.test')
    await member('mintedA', ORG, randomUUID(), 'PAT@members.example.test ')
    await member('mintedB', ORG, randomUUID(), 'pat@members.example.test')
    await member('deleted', ORG, randomUUID(), 'gone@members.example.test', true)
    await member('otherTenant', OTHER, randomUUID(), 'pat@members.example.test')
  }, 120_000)

  afterAll(async () => {
    await admin?.end().catch(() => undefined)
  })

  it('reports the duplicate address and the unresolved principals in scope, by membership id only', async () => {
    const before = (await admin.query(`SELECT count(*)::int n, max(updated_at) m FROM organization_members WHERE organization_id = ANY($1::uuid[])`, [[ORG, OTHER]])).rows[0]

    const evidence = await collectMembershipIdentityEvidence(admin, { organizationIds: [ORG] })

    expect(evidence.scope).toEqual({ organizationIds: [ORG] })
    const duplicate = evidence.findings.filter((f) => f.kind === 'DUPLICATE_EMAIL')
    expect(duplicate).toEqual([{ kind: 'DUPLICATE_EMAIL', organizationId: ORG, membershipIds: [ids.real, ids.mintedA, ids.mintedB].sort() }])
    const unresolved = evidence.findings.filter((f) => f.kind === 'UNRESOLVED_PRINCIPAL')
    expect(unresolved).toEqual([{ kind: 'UNRESOLVED_PRINCIPAL', organizationId: ORG, membershipIds: [ids.mintedA, ids.mintedB].sort() }])
    expect(evidence.counts).toEqual({ duplicateEmailGroups: 1, duplicateEmailMemberships: 3, unresolvedPrincipalMemberships: 2 })
    expect(JSON.stringify(evidence)).not.toMatch(/@|Synthetic Member/)

    const after = (await admin.query(`SELECT count(*)::int n, max(updated_at) m FROM organization_members WHERE organization_id = ANY($1::uuid[])`, [[ORG, OTHER]])).rows[0]
    expect(after).toEqual(before)
  })

  it('collects inside a transaction the database refuses to write in', async () => {
    const statements: string[] = []
    let writeRefusal: string | undefined
    const probe = {
      query: async (text: string, params?: unknown[]) => {
        statements.push(text.trim().split(/\s+/).slice(0, 4).join(' '))
        const result = await admin.query(text, params)
        if (text.startsWith('BEGIN')) {
          await admin.query('SAVEPOINT write_probe')
          try {
            await admin.query(`UPDATE organization_members SET name = name WHERE organization_id = $1`, [ORG])
          } catch (error) {
            writeRefusal = (error as { code?: string }).code
          }
          await admin.query('ROLLBACK TO SAVEPOINT write_probe')
        }
        return result
      },
    }
    await collectMembershipIdentityEvidence(probe, { organizationIds: [ORG] })
    expect(statements[0]).toBe('BEGIN TRANSACTION READ ONLY')
    expect(statements[statements.length - 1]).toBe('ROLLBACK')
    expect(writeRefusal).toBe('25006') // read_only_sql_transaction
  })
})
