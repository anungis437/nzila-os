/**
 * Certified-election successor on PGlite. Platform 0033 is applied only inside this disposable database.
 * This is not native qualification and not an institutional activation.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import type { SqlExecutor } from '../../lib/authority/store/executor'
import { certificateProvenance, recordCertifiedSupersession, type SuccessionGrant } from '../../lib/voting/election-succession'

const SQL = readFileSync(resolve(__dirname, '../migrations-platform/0033_election_certificate_successions.sql'), 'utf8')
const OWNERSHIP = readFileSync(resolve(__dirname, '../migrations-platform/0034_election_organization_ownership.sql'), 'utf8')
const ORG = '11111111-1111-4111-8111-111111111111'
const ISSUER = 'issuer-officer'
const REVIEWER = 'reviewer-officer'

function statements(sql: string): string[] {
  return sql
    .split('--> statement-breakpoint')
    .map((part) => part.replace(/--[^\n]*/g, '').trim())
    .filter((part) => part.length > 0)
}

async function emptyDb(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(`
    CREATE TABLE public.audit_logs (
      id uuid PRIMARY KEY,
      audit_id uuid NOT NULL,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL,
      organization_id uuid NOT NULL,
      action text NOT NULL,
      resource_type text NOT NULL,
      resource_id uuid,
      user_id text,
      ip_address inet,
      user_agent text,
      details jsonb NOT NULL,
      changes jsonb NOT NULL,
      content_hash text NOT NULL,
      previous_hash text
    );
  `)
  return db
}

async function withElections(db: PGlite): Promise<void> {
  await db.exec(`
    CREATE TABLE public.council_elections (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      election_year integer NOT NULL,
      election_date date NOT NULL,
      positions_available integer NOT NULL,
      candidates jsonb NOT NULL,
      winners jsonb NOT NULL,
      total_votes integer NOT NULL,
      participation_rate integer,
      verified_by text,
      verification_date date,
      contested_results boolean DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `)
}

function executor(db: PGlite): SqlExecutor {
  return { query: (text, params) => db.query(text, params) }
}

async function apply(db: PGlite, sql: string): Promise<void> {
  for (const statement of statements(sql)) await db.exec(statement)
}

async function own(db: PGlite, electionId: string, organizationId = ORG): Promise<void> {
  await db.query(`INSERT INTO public.election_organization_ownership (election_id, organization_id) VALUES ($1::uuid, $2::uuid)`, [electionId, organizationId])
}

async function seedCertified(db: PGlite, votes = 10): Promise<string> {
  const row = await db.query<{ id: string }>(
    `INSERT INTO public.council_elections
       (election_year, election_date, positions_available, candidates, winners, total_votes, participation_rate, verified_by, verification_date)
     VALUES (2026, '2026-10-01', 2, $1::jsonb, $2::jsonb, $3, 40, 'Independent Auditor', '2026-10-02')
     RETURNING id::text AS id`,
    [JSON.stringify([{ name: 'A' }]), JSON.stringify([{ name: 'A', userId: 'candidate-1' }]), votes],
  )
  return row.rows[0].id
}

async function locked(db: PGlite, id: string) {
  const row = (
    await db.query<Record<string, unknown>>(
      `SELECT id::text AS id, election_year, election_date::text AS election_date, positions_available, candidates, winners,
              total_votes, participation_rate, verified_by, verification_date::text AS verification_date
         FROM public.council_elections WHERE id = $1`,
      [id],
    )
  ).rows[0]
  return {
    id: String(row.id),
    electionYear: Number(row.election_year),
    electionDate: String(row.election_date).slice(0, 10),
    positionsAvailable: Number(row.positions_available),
    candidates: row.candidates,
    winners: row.winners,
    totalVotes: Number(row.total_votes),
    participationRate: row.participation_rate === null ? null : Number(row.participation_rate),
    verifiedBy: row.verified_by === null ? null : String(row.verified_by),
    verificationDate: row.verification_date === null ? null : String(row.verification_date).slice(0, 10),
  }
}

function grant(electionId: string, provenanceHash: string, patch: Partial<SuccessionGrant> = {}): SuccessionGrant {
  return {
    loadedBy: 'authority-kernel',
    action: 'election:supersede_certified_result',
    electionId,
    organizationId: ORG,
    issued: true,
    issuerUserId: ISSUER,
    reviewerUserId: REVIEWER,
    decisionReference: 'council minute 26',
    provenanceHash,
    disputeReference: 'dispute-4',
    recountReference: 'recount-4',
    institutionalNoticeRequired: true,
    ...patch,
  }
}

describe('election certificate succession', () => {
  it('refuses to apply 0033 when council_elections is absent', async () => {
    const db = await emptyDb()
    await expect(db.exec(statements(SQL)[0])).rejects.toThrow(/council_elections does not exist/)
  })

  it('refuses to apply 0034 when council_elections is absent', async () => {
    const db = await emptyDb()
    await expect(db.exec(statements(OWNERSHIP)[0])).rejects.toThrow(/council_elections does not exist/)
  })

  it('writes an uncertified successor, leaves the certified row unchanged, and replays the same decision', async () => {
    const db = await emptyDb()
    await withElections(db)
    await apply(db, SQL)
    await apply(db, OWNERSHIP)
    const id = await seedCertified(db)
    await own(db, id)
    const provenanceHash = certificateProvenance(await locked(db, id))
    const exec = executor(db)

    expect(await recordCertifiedSupersession(exec, id, null, ORG)).toMatchObject({ ok: false, code: 'CORRECTION_UNISSUED' })
    expect(await recordCertifiedSupersession(exec, id, grant(id, provenanceHash, { reviewerUserId: ISSUER }), ORG)).toMatchObject({ ok: false, code: 'RECUSAL_REQUIRED' })
    expect(await recordCertifiedSupersession(exec, id, grant(id, provenanceHash, { issuerUserId: 'candidate-1' }), ORG)).toMatchObject({ ok: false, code: 'RECUSAL_REQUIRED' })
    expect(await recordCertifiedSupersession(exec, id, grant(id, 'a'.repeat(64)), ORG)).toMatchObject({ ok: false, code: 'STALE_CERTIFICATE' })
    expect(await db.query(`SELECT count(*)::int AS n FROM public.council_elections`)).toMatchObject({ rows: [{ n: 1 }] })

    const created = await recordCertifiedSupersession(exec, id, grant(id, provenanceHash), ORG)
    expect(created).toMatchObject({
      ok: true,
      replayed: false,
      predecessorElectionId: id,
      version: 1,
      provenanceHash,
      institutionalNotice: 'required_not_sent',
    })
    if (!created.ok) return
    const predecessor = await db.query<{ verified_by: string; total_votes: number }>(`SELECT verified_by, total_votes FROM public.council_elections WHERE id = $1`, [id])
    expect(predecessor.rows[0]).toMatchObject({ verified_by: 'Independent Auditor', total_votes: 10 })
    const successor = await db.query<{ verified_by: string | null; total_votes: number }>(
      `SELECT verified_by, total_votes FROM public.council_elections WHERE id = $1`,
      [created.successorElectionId],
    )
    expect(successor.rows[0]).toMatchObject({ verified_by: null, total_votes: 10 })
    const audit = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.audit_logs WHERE action = 'governance.election_certificate.supersede'`)
    expect(audit.rows[0].n).toBe(1)

    const replay = await recordCertifiedSupersession(exec, id, grant(id, provenanceHash), ORG)
    expect(replay).toMatchObject({ ok: true, replayed: true, successionId: created.successionId, successorElectionId: created.successorElectionId })
    const elections = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.council_elections`)
    expect(elections.rows[0].n).toBe(2)
  })

  it('does not read council_elections when the election is foreign or missing', async () => {
    const db = await emptyDb()
    await withElections(db)
    await apply(db, SQL)
    await apply(db, OWNERSHIP)
    const id = await seedCertified(db)
    await own(db, id)
    const provenanceHash = certificateProvenance(await locked(db, id))
    const seen: string[] = []
    const exec: SqlExecutor = {
      query: (text, params) => {
        seen.push(text)
        return db.query(text, params)
      },
    }
    const other = '22222222-2222-4222-8222-222222222222'
    const missing = '33333333-3333-4333-8333-333333333333'
    expect(await recordCertifiedSupersession(exec, id, grant(id, provenanceHash, { organizationId: other }), other)).toMatchObject({ ok: false, code: 'NOT_FOUND' })
    expect(await recordCertifiedSupersession(exec, missing, grant(missing, provenanceHash, { electionId: missing }), ORG)).toMatchObject({ ok: false, code: 'NOT_FOUND' })
    expect(seen.join('\n')).not.toContain('council_elections')
  })

  it('rolls the successor back when the audit write fails', async () => {
    const db = await emptyDb()
    await withElections(db)
    await apply(db, SQL)
    await apply(db, OWNERSHIP)
    const id = await seedCertified(db)
    await own(db, id)
    const provenanceHash = certificateProvenance(await locked(db, id))
    await expect(
      db.transaction(async (tx) => {
        const exec: SqlExecutor = {
          query: async (text, params) => {
            if (text.includes('INSERT INTO public.audit_logs')) throw new Error('audit write failed')
            return tx.query(text, params)
          },
        }
        await recordCertifiedSupersession(exec, id, grant(id, provenanceHash), ORG)
      }),
    ).rejects.toThrow(/audit write failed/)
    const elections = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.council_elections`)
    expect(elections.rows[0].n).toBe(1)
    const links = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.election_certificate_successions`)
    expect(links.rows[0].n).toBe(0)
    const owners = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.election_organization_ownership`)
    expect(owners.rows[0].n).toBe(1)
  })

  it('writes nothing when the succession relation is not installed', async () => {
    const db = await emptyDb()
    await withElections(db)
    const id = await seedCertified(db)
    const provenanceHash = certificateProvenance(await locked(db, id))
    const result = await recordCertifiedSupersession(executor(db), id, grant(id, provenanceHash), ORG)
    expect(result).toMatchObject({ ok: false, code: 'STORE_UNAPPLIED' })
    const elections = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.council_elections`)
    expect(elections.rows[0].n).toBe(1)
  })
})
