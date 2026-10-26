/**
 * Native proof of certified-election succession under two concurrent grants.
 * Ownership concurrency is authority-kernel-case-backfill.native.test.ts.
 *
 * Cursor does not set UE_ELECTION_SUCCESSION_NATIVE_PROOF or UE_OWNERSHIP_NATIVE_PROOF and does not start Docker.
 * A skipped run is not evidence. Status stays READY_FOR_VS_EXECUTION.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { certificateProvenance, recordCertifiedSupersession, type SuccessionGrant } from '../../lib/voting/election-succession'

const native = process.env.UE_ELECTION_SUCCESSION_NATIVE_PROOF === '1' ? describe : describe.skip

native('election certificate succession on disposable PostgreSQL', () => {
  const image = 'pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337'
  const name = `ue-election-succession-${process.pid}-${Date.now()}`
  let created = false
  let pool: pg.Pool

  beforeAll(async () => {
    execFileSync('docker', ['run', '--detach', '--name', name, '-e', 'POSTGRES_PASSWORD=synthetic-only', '-p', '127.0.0.1::5432', image], { stdio: 'pipe' })
    created = true
    const ports = JSON.parse(execFileSync('docker', ['inspect', '--format', '{{json .NetworkSettings.Ports}}', name], { encoding: 'utf8' }))
    const port = Number(ports['5432/tcp'][0].HostPort)
    pool = new pg.Pool({ host: '127.0.0.1', port, user: 'postgres', password: 'synthetic-only', database: 'postgres', max: 4 })
    for (let attempt = 0; ; attempt += 1) {
      try {
        await pool.query('SELECT 1')
        break
      } catch (error) {
        if (attempt > 30) throw error
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
    }
    await pool.query(`
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
    for (const file of ['0033_election_certificate_successions.sql', '0034_election_organization_ownership.sql']) {
      const sql = readFileSync(path.join(__dirname, '../migrations-platform', file), 'utf8')
      for (const statement of sql.split('--> statement-breakpoint')) {
        const body = statement.replace(/--[^\n]*/g, '').trim()
        if (body) await pool.query(body)
      }
    }
  }, 120_000)

  afterAll(async () => {
    await pool?.end().catch(() => undefined)
    if (created) execFileSync('docker', ['rm', '--force', name], { stdio: 'pipe' })
  })

  it('stores one successor for two concurrent grants of the same decision', async () => {
    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO public.council_elections
         (election_year, election_date, positions_available, candidates, winners, total_votes, verified_by, verification_date)
       VALUES (2026, '2026-10-01', 1, '[]'::jsonb, '[]'::jsonb, 3, 'Auditor', '2026-10-02')
       RETURNING id::text AS id`,
    )
    const row = inserted.rows[0]
    await pool.query(
      `INSERT INTO public.election_organization_ownership (election_id, organization_id) VALUES ($1::uuid, $2::uuid)`,
      [row.id, '11111111-1111-4111-8111-111111111111'],
    )
    const provenanceHash = certificateProvenance({
      id: row.id,
      electionYear: 2026,
      electionDate: '2026-10-01',
      positionsAvailable: 1,
      candidates: [],
      winners: [],
      totalVotes: 3,
      participationRate: null,
      verifiedBy: 'Auditor',
      verificationDate: '2026-10-02',
    })
    const grant: SuccessionGrant = {
      loadedBy: 'authority-kernel',
      action: 'election:supersede_certified_result',
      electionId: row.id,
      organizationId: '11111111-1111-4111-8111-111111111111',
      issued: true,
      issuerUserId: 'issuer',
      reviewerUserId: 'reviewer',
      decisionReference: 'native minute',
      provenanceHash,
    }
    const runOne = async () => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const result = await recordCertifiedSupersession(
          { query: (text, params) => client.query(text, params) },
          row.id,
          grant,
          grant.organizationId,
        )
        await client.query('COMMIT')
        return result
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }
    const [first, second] = await Promise.allSettled([runOne(), runOne()])
    const ok = [first, second].filter((item) => item.status === 'fulfilled' && item.value.ok)
    expect(ok.length).toBeGreaterThan(0)
    const links = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM public.election_certificate_successions`)
    expect(Number(links.rows[0].n)).toBe(1)
    const elections = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM public.council_elections`)
    expect(Number(elections.rows[0].n)).toBe(2)
    const predecessor = await pool.query<{ verified_by: string }>(`SELECT verified_by FROM public.council_elections WHERE id = $1`, [row.id])
    expect(predecessor.rows[0].verified_by).toBe('Auditor')
  })
})
