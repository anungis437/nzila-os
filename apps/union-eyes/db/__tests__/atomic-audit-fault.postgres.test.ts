/**
 * Mandatory audit on real PostgreSQL, as the runtime role, with fault injection (UE-CONV-K-005).
 *
 * The audit and the business mutation must share one physical transaction. Unlike the in-process suites, this runs
 * against whatever Django `migrate` plus the approved Drizzle bootstrap created, with the runtime role's row-level
 * security and grants. A fault is injected into the audit table itself (a trigger that refuses the insert), and the
 * business row written earlier in the same transaction must disappear with it. The denial path is proven separately:
 * a denial recorded in its own transaction survives the rollback of the refused operation.
 *
 * Every native clone is canonical: persistAtomicAudit appends the hash-chained public.audit_logs, the runtime acts only in a verified
 * business session (the actor is a real canonical member), and the business row is an ordinary tenant write the runtime holds
 * (job_classifications). dues_transactions, the legacy probe's row, has no runtime grant in the canonical source (CONTAINED_NO_AUTHORITY),
 * and the legacy audit_security store is not the canonical runtime's.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ORG, ORG_B, seedMembership, seedUser, type Db } from './authority-kernel-harness'
import { nativeActionUrl, setNativeBusinessContext, withNativeCanonicalActor } from '../../scripts/runtime/native-canonical-fixture'
import { persistAtomicAudit } from '../../lib/audit/atomic-audit'
import type { RLSTx } from '../../lib/db/with-rls-context'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const adapt = (c: pg.Client): Db => ({ exec: (q) => c.query(q), query: (q, p) => c.query(q, p as unknown[]) as never })

describe.skipIf(!URL)('mandatory audit on real PostgreSQL as the runtime role', () => {
  let admin: pg.Client
  let runtime: pg.Client
  const ACTOR = 'user_audit_fault_actor'

  const dues = (member: string) => sql`INSERT INTO job_classifications (organization_id, job_code, job_title, created_by)
    VALUES (${ORG}::uuid, ${member}, 'Audit probe', ${ACTOR})`
  const countDues = async (member: string) => Number((await admin.query('SELECT count(*)::int n FROM job_classifications WHERE job_code = $1', [member])).rows[0].n)
  const countAudits = async (action: string) => Number((await admin.query('SELECT count(*)::int n FROM public.audit_logs WHERE action = $1', [action])).rows[0].n)

  /** One runtime-role transaction in the actor's verified business session, like withRLSContext in canonical mode. */
  async function runtimeTx<T>(org: string, fn: (tx: RLSTx) => Promise<T>, client: pg.Client = runtime): Promise<T> {
    return withNativeCanonicalActor(ACTOR, org, async (binding) => {
      await client.query('BEGIN')
      try {
        await client.query('SET LOCAL ROLE union_eyes_runtime')
        await client.query('SET LOCAL search_path=pg_catalog,public,pg_temp')
        await setNativeBusinessContext(client, binding)
        const out = await fn(drizzle(client) as unknown as RLSTx)
        await client.query('COMMIT')
        return out
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    })
  }

  const entry = (action: string) => ({ organizationId: ORG, userId: ACTOR, action, resourceType: 'dues_transactions', resourceId: randomUUID(), details: { probe: true } })

  beforeAll(async () => {
    expect(process.env.UE_CANONICAL_BOOTSTRAP_V2).toBe('1')
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    for (const [org, slug] of [[ORG, 'fault-a'], [ORG_B, 'fault-b']]) {
      await admin.query(`INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
        VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1) ON CONFLICT (id) DO NOTHING`, [org, slug, slug])
    }
    await seedMembership(adapt(admin), ACTOR, ORG, 'admin')
    runtime = new pg.Client({ connectionString: nativeActionUrl('union_eyes_runtime', URL) })
    await runtime.connect()
  }, 120_000)

  afterAll(async () => {
    await admin?.query('DROP TRIGGER IF EXISTS ue_fault_audit ON public.audit_logs').catch(() => undefined)
    await admin?.query('DROP FUNCTION IF EXISTS public.ue_fault_audit()').catch(() => undefined)
    await runtime?.end().catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  it('commits the business row and its audit record together', async () => {
    await runtimeTx(ORG, async (tx) => {
      await tx.execute(dues('fault-ok'))
      await persistAtomicAudit(tx, entry('fault.commit'))
    })
    expect(await countDues('fault-ok')).toBe(1)
    expect(await countAudits('fault.commit')).toBe(1)
  })

  it('rolls the business row back when the audit table refuses the insert (injected fault)', async () => {
    await admin.query(`CREATE OR REPLACE FUNCTION public.ue_fault_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected audit fault'; END $$`)
    await admin.query(`CREATE TRIGGER ue_fault_audit BEFORE INSERT ON public.audit_logs FOR EACH ROW WHEN (NEW.action = 'fault.injected') EXECUTE FUNCTION public.ue_fault_audit()`)
    await expect(
      runtimeTx(ORG, async (tx) => {
        await tx.execute(dues('fault-injected'))
        await persistAtomicAudit(tx, entry('fault.injected'))
      }),
    ).rejects.toThrow()
    expect(await countDues('fault-injected')).toBe(0)
    expect(await countAudits('fault.injected')).toBe(0)
    await admin.query('DROP TRIGGER ue_fault_audit ON public.audit_logs')
  })

  it('refuses an audit record for another organization under row-level security, and the mutation rolls back', async () => {
    await expect(
      runtimeTx(ORG, async (tx) => {
        await tx.execute(dues('fault-cross-tenant'))
        await persistAtomicAudit(tx, { ...entry('fault.cross_tenant'), organizationId: ORG_B })
      }),
    ).rejects.toThrow()
    expect(await countDues('fault-cross-tenant')).toBe(0)
    expect(await countAudits('fault.cross_tenant')).toBe(0)
  })

  it('refuses an audit record attributed to a different principal than the transaction\'s, and the mutation rolls back', async () => {
    await seedUser(adapt(admin), 'user_someone_else')
    await expect(
      runtimeTx(ORG, async (tx) => {
        await tx.execute(dues('fault-forged-actor'))
        await persistAtomicAudit(tx, { ...entry('fault.forged_actor'), userId: 'user_someone_else' })
      }),
    ).rejects.toThrow()
    expect(await countDues('fault-forged-actor')).toBe(0)
  })

  it('a denial recorded in its own transaction survives the rollback of the refused operation', async () => {
    await expect(
      (async () => {
        try {
          await runtimeTx(ORG, async (tx) => {
            await tx.execute(dues('fault-denied'))
            throw new Error('authorization denied')
          })
        } catch (error) {
          // The denial evidence is written after the rollback, in a transaction of its own.
          await runtimeTx(ORG, (tx) => persistAtomicAudit(tx, entry('fault.denied'), 'failure'))
          throw error
        }
      })(),
    ).rejects.toThrow('authorization denied')
    expect(await countDues('fault-denied')).toBe(0)
    expect(await countAudits('fault.denied')).toBe(1)
    // The canonical record carries no outcome column; persistAtomicAudit keeps the failure in its details.
    const row = (await admin.query(`SELECT details FROM public.audit_logs WHERE action = 'fault.denied'`)).rows[0]
    expect(row.details).toMatchObject({ probe: true, outcome: 'failure' })
  })

  it('concurrent transactions do not cross: one failing audit never rolls back its neighbour', async () => {
    const second = new pg.Client({ connectionString: nativeActionUrl('union_eyes_runtime', URL) })
    await second.connect()
    try {
      await admin.query(`CREATE OR REPLACE FUNCTION public.ue_fault_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected audit fault'; END $$`)
      await admin.query(`CREATE TRIGGER ue_fault_audit BEFORE INSERT ON public.audit_logs FOR EACH ROW WHEN (NEW.action = 'fault.concurrent_bad') EXECUTE FUNCTION public.ue_fault_audit()`)
      const other = () => runtimeTx(ORG, async (tx) => {
        await tx.execute(dues('fault-concurrent-good'))
        await persistAtomicAudit(tx, entry('fault.concurrent_good'))
      }, second)
      const results = await Promise.allSettled([
        runtimeTx(ORG, async (tx) => {
          await tx.execute(dues('fault-concurrent-bad'))
          await persistAtomicAudit(tx, entry('fault.concurrent_bad'))
        }),
        other(),
      ])
      expect(results[0].status).toBe('rejected')
      expect(results[1].status).toBe('fulfilled')
      expect(await countDues('fault-concurrent-bad')).toBe(0)
      expect(await countDues('fault-concurrent-good')).toBe(1)
      expect(await countAudits('fault.concurrent_good')).toBe(1)
    } finally {
      await admin.query('DROP TRIGGER IF EXISTS ue_fault_audit ON public.audit_logs')
      await second.end()
    }
  })
})
