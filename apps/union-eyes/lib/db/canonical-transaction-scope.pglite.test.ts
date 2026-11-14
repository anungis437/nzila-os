/** Local physical regression. Synthetic tokens here are not real staging authentication evidence. */
import { PGlite } from '@electric-sql/pglite'
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { AuthenticatedOrgBinding } from '@nzila/platform-auth/org-binding'
import type { RLSTx } from './with-rls-context'
import {
  MESSAGING_GUARD_FUNCTIONS,
  MESSAGING_GUARD_TRIGGERS,
} from '@/db/auth/messaging-physical-guards'
import { withCanonicalTenantScope, nestedCanonicalTenantScope } from './canonical-transaction-scope'

async function fixture() {
  const pg = new PGlite(),
    org = randomUUID(),
    id = randomUUID()
  await pg.exec(`CREATE ROLE rt;
    CREATE TABLE local_sessions(token text PRIMARY KEY,active boolean);
    INSERT INTO local_sessions VALUES('outer',true),('inner',true);
    CREATE TABLE message_threads(id uuid PRIMARY KEY,organization_id uuid,staff_id text);
    CREATE TABLE message_thread_assignments(thread_id uuid,organization_id uuid,from_staff_id text,to_staff_id text,created_at timestamptz DEFAULT now());
    GRANT SELECT ON local_sessions TO rt;
    GRANT SELECT,INSERT,UPDATE ON message_threads,message_thread_assignments TO rt;
    ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
    ALTER TABLE message_threads FORCE ROW LEVEL SECURITY;
    ALTER TABLE message_thread_assignments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE message_thread_assignments FORCE ROW LEVEL SECURITY;`)
  for (const table of ['message_threads', 'message_thread_assignments'])
    await pg.exec(
      `CREATE POLICY authenticated_only ON ${table} TO rt USING (EXISTS(SELECT FROM local_sessions WHERE token=current_setting('app.current_session_token',true) AND active)) WITH CHECK (EXISTS(SELECT FROM local_sessions WHERE token=current_setting('app.current_session_token',true) AND active));`,
    )
  // The exact current production deferred-history guard, not a test implementation.
  const fn = MESSAGING_GUARD_FUNCTIONS.find(
    (f) => f.name === 'message_threads_assignment_requires_history',
  )!
  const trigger = MESSAGING_GUARD_TRIGGERS.find((t) => t.name === fn.name)!
  await pg.exec(
    `CREATE FUNCTION public.${fn.name}() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $body$${fn.body}$body$;${trigger.sql}`,
  )
  await pg.query('INSERT INTO message_threads VALUES($1,$2,NULL)', [id, org])
  const context = async (token: string) => {
    await pg.exec('SET LOCAL ROLE rt')
    await pg.query("SELECT set_config('app.current_session_token',$1,true)", [token])
  }
  const assign = async () => {
    await pg.query("UPDATE message_threads SET staff_id='steward' WHERE id=$1", [id])
    await pg.query(
      "INSERT INTO message_thread_assignments(thread_id,organization_id,from_staff_id,to_staff_id) VALUES($1,$2,NULL,'steward')",
      [id, org],
    )
  }
  let sequence = 0
  const tx = {
    transaction: async (operation: (tx: RLSTx) => Promise<unknown>) => {
      const savepoint = 'scope_' + ++sequence
      await pg.exec('SAVEPOINT ' + savepoint)
      try {
        const value = await operation(tx as unknown as RLSTx)
        await pg.exec('RELEASE SAVEPOINT ' + savepoint)
        return value
      } catch (error) {
        await pg.exec('ROLLBACK TO SAVEPOINT ' + savepoint + ';RELEASE SAVEPOINT ' + savepoint)
        throw error
      }
    },
  } as unknown as RLSTx
  const binding: AuthenticatedOrgBinding = {
    userId: 'steward',
    organizationId: org,
    sessionToken: 'outer',
    role: 'steward',
    isSystemAdmin: false,
    expiresAt: new Date(Date.now() + 30000),
    authority: 'verified-provider-bridge',
  }
  return { pg, org, id, context, assign, tx, binding }
}

describe('verified nested tenant transaction lifetime', () => {
  it('reproduces the missing-history refusal when a released inner bridge remains in the outer GUC', async () => {
    const f = await fixture()
    try {
      await f.pg.exec('BEGIN')
      await f.context('outer')
      await f.pg.exec('SAVEPOINT broken')
      await f.context('inner')
      await f.assign()
      await f.pg.exec('RELEASE SAVEPOINT broken')
      await f.pg.exec(
        "RESET ROLE;UPDATE local_sessions SET active=false WHERE token='inner';SET LOCAL ROLE rt",
      )
      await expect(f.pg.exec('COMMIT')).rejects.toThrow(
        'an assignment change requires its history record',
      )
      await f.pg.exec('ROLLBACK;RESET ROLE')
      expect((await f.pg.query('SELECT staff_id FROM message_threads')).rows).toEqual([
        { staff_id: null },
      ])
    } finally {
      await f.pg.close()
    }
  })

  it('keeps the verified outer token through deferred checks and retains nested rollback and scope refusal', async () => {
    const f = await fixture()
    try {
      await f.pg.exec('BEGIN')
      await f.context('outer')
      await withCanonicalTenantScope(f.tx, f.binding, async () => {
        await expect(
          nestedCanonicalTenantScope('another-actor', f.org, async () => {}),
        ).rejects.toMatchObject({ code: 'ACTOR_MISMATCH' })
        await expect(
          nestedCanonicalTenantScope('steward', randomUUID(), async () => {}),
        ).rejects.toMatchObject({ code: 'MEMBERSHIP_REQUIRED' })
        await expect(
          nestedCanonicalTenantScope('steward', f.org, async () => {
            await f.assign()
            throw new Error('local rollback')
          }),
        ).rejects.toThrow('local rollback')
        expect((await f.pg.query('SELECT staff_id FROM message_threads')).rows).toEqual([
          { staff_id: null },
        ])
        const result = await nestedCanonicalTenantScope('steward', f.org, async () => {
          await f.assign()
          return 'assigned'
        })
        expect(result).toEqual({ nested: true, value: 'assigned' })
      })
      expect(await nestedCanonicalTenantScope('steward', f.org, async () => {})).toEqual({
        nested: false,
      })
      expect(
        (await f.pg.query("SELECT current_setting('app.current_session_token') token")).rows,
      ).toEqual([{ token: 'outer' }])
      await f.pg.exec('COMMIT;RESET ROLE')
      expect((await f.pg.query('SELECT staff_id FROM message_threads')).rows).toEqual([
        { staff_id: 'steward' },
      ])
      expect(
        (await f.pg.query('SELECT count(*)::int n FROM message_thread_assignments')).rows,
      ).toEqual([{ n: 1 }])
    } finally {
      await f.pg.close()
    }
  })
})
