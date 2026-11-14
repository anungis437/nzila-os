import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  BUSINESS_SESSION_POLICY,
  BUSINESS_SESSION_POLICY_QUERY,
  applyBusinessSessionRepair,
  businessSessionPolicyViolations,
  compileBusinessSessionPolicy,
  planBusinessSessionRepair,
} from './business-session-policy'
import { LEGACY_DEADLINE_GUARD_BODY } from './business-session-event-guard'

const A = '10000000-0000-4000-8000-000000000001'
const B = '20000000-0000-4000-8000-000000000002'
let db: PGlite
async function asRuntime(org: string, bearer = '') {
  await db.exec('RESET ROLE; BEGIN; SET LOCAL ROLE union_eyes_runtime')
  await db.query(
    "SELECT set_config('app.current_org_id',$1,true),set_config('test.verified_org',$2,true)",
    [org, bearer],
  )
}
afterAll(async () => {
  await db.close()
})
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`CREATE ROLE union_eyes_runtime; CREATE ROLE ue_v2_owner; CREATE SCHEMA user_management;
    -- Local fixture for the already separately qualified canonical auth predicate.
    CREATE FUNCTION user_management.auth_business_org_authorized(row_org uuid,required_roles text[] DEFAULT NULL)
    RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT row_org::text=NULLIF(current_setting('test.verified_org',true),'') $$;
    GRANT USAGE ON SCHEMA user_management TO union_eyes_runtime;
    CREATE TABLE public.policy_probe(id integer PRIMARY KEY,organization_id uuid NOT NULL);
    INSERT INTO policy_probe VALUES (1,'${A}'),(2,'${B}');
    GRANT SELECT,INSERT,UPDATE,DELETE ON public.policy_probe TO union_eyes_runtime;
    ALTER TABLE public.policy_probe ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.policy_probe FORCE ROW LEVEL SECURITY;
    ALTER TABLE public.policy_probe OWNER TO ue_v2_owner;
    CREATE POLICY legacy_mutable_context ON public.policy_probe FOR ALL TO union_eyes_runtime
      USING(organization_id::text=current_setting('app.current_org_id',true))
      WITH CHECK(organization_id::text=current_setting('app.current_org_id',true));
    CREATE POLICY canonical_bound_context ON public.policy_probe FOR ALL TO union_eyes_runtime
      USING(user_management.auth_business_org_authorized(organization_id,NULL::text[]))
      WITH CHECK(user_management.auth_business_org_authorized(organization_id,NULL::text[]));`)
})

describe('mandatory session gate against additive permissive RLS drift', () => {
  it('reproduces the legacy OR bypass, then denies an unbound reader without changing rows or existing policies', async () => {
    await asRuntime(A)
    expect((await db.query('SELECT id FROM public.policy_probe')).rows).toEqual([{ id: 1 }])
    await db.exec('ROLLBACK; RESET ROLE')
    await db.exec(compileBusinessSessionPolicy('policy_probe'))
    for (const organization of [A, B]) {
      await asRuntime(organization)
      expect((await db.query('SELECT id FROM public.policy_probe')).rows).toEqual([])
      await db.exec('ROLLBACK')
    }
    await db.exec('RESET ROLE')
    expect((await db.query('SELECT id FROM public.policy_probe ORDER BY id')).rows).toEqual([
      { id: 1 },
      { id: 2 },
    ])
    expect(
      (
        await db.query(
          "SELECT polname FROM pg_policy WHERE polrelid='public.policy_probe'::regclass",
        )
      ).rows,
    ).toHaveLength(3)
  })
  it('retains a verified own-organization session and rejects forged organization, insert, update and delete contexts', async () => {
    await asRuntime(A, A)
    expect((await db.query('SELECT id FROM public.policy_probe')).rows).toEqual([{ id: 1 }])
    await db.query('INSERT INTO public.policy_probe VALUES (3,$1)', [A])
    expect((await db.query('SELECT id FROM public.policy_probe ORDER BY id')).rows).toEqual([
      { id: 1 },
      { id: 3 },
    ])
    await db.exec('ROLLBACK')
    await asRuntime(B, A)
    expect((await db.query('SELECT id FROM public.policy_probe')).rows).toEqual([])
    expect((await db.query('UPDATE public.policy_probe SET id=id RETURNING id')).rows).toEqual([])
    expect((await db.query('DELETE FROM public.policy_probe RETURNING id')).rows).toEqual([])
    await expect(db.query('INSERT INTO public.policy_probe VALUES (3,$1)', [B])).rejects.toThrow(
      /row-level security/,
    )
    await db.exec('ROLLBACK; RESET ROLE')
  })
  it('pins native deparsing and rejects a missing, permissive, broadened or incompletely checked gate', async () => {
    const rows = (await db.query<Record<string, unknown>>(BUSINESS_SESSION_POLICY_QUERY)).rows
    expect(businessSessionPolicyViolations(rows)).toEqual([])
    expect(businessSessionPolicyViolations([])).not.toEqual([])
    for (const change of [
      { polname: null },
      { polpermissive: true },
      { public_role: true },
      { owner_name: 'union_eyes_runtime' },
      { roles: ['union_eyes_runtime', 'union_eyes_system'] },
      { qual: 'true' },
      { with_check: null },
      { relforcerowsecurity: false },
    ]) {
      expect(
        businessSessionPolicyViolations(rows.map((row) => ({ ...row, ...change }))),
      ).not.toEqual([])
    }
    await db.exec(`DROP POLICY ${BUSINESS_SESSION_POLICY} ON public.policy_probe`)
    expect(
      businessSessionPolicyViolations(
        (await db.query<Record<string, unknown>>(BUSINESS_SESSION_POLICY_QUERY)).rows,
      ),
    ).not.toEqual([])
  })
  it('applies source-generated SQL from a reviewed metadata fingerprint, refuses drift and repeats without changing data', async () => {
    const execute = async (statement: string) =>
      (await db.query<Record<string, unknown>>(statement)).rows
    const plan = await planBusinessSessionRepair(execute)
    expect(plan.targets).toEqual(['policy_probe'])
    await db.exec('BEGIN')
    await expect(applyBusinessSessionRepair(execute, '0'.repeat(64))).rejects.toThrow(
      /metadata drift/,
    )
    await db.exec('ROLLBACK; BEGIN')
    const result = await applyBusinessSessionRepair(execute, plan.fingerprint)
    expect(result.addedPolicies).toBe(1)
    await db.exec('COMMIT')
    const repeat = await planBusinessSessionRepair(execute)
    expect(repeat.statements).toEqual([])
    await db.exec('BEGIN')
    expect((await applyBusinessSessionRepair(execute, repeat.fingerprint)).addedPolicies).toBe(0)
    await db.exec('COMMIT')
    expect((await db.query('SELECT id FROM public.policy_probe ORDER BY id')).rows).toEqual([
      { id: 1 },
      { id: 2 },
    ])
  })
  it('preserves the immutable deadline closure while admitting only the exact restrictive session gate', async () => {
    const migration = readFileSync(
      new URL('../migrations-cache/0019_deadline_reassignment_convergence.sql', import.meta.url),
      'utf8',
    )
    expect(migration).toContain(`AS $fn$${LEGACY_DEADLINE_GUARD_BODY}$fn$;`)
    await db.exec(`CREATE ROLE uev2admin;
      CREATE TABLE public.deadline_reassignment_convergence(id integer,organization_id uuid);
      ALTER TABLE public.deadline_reassignment_convergence OWNER TO ue_v2_owner;
      ALTER TABLE public.deadline_reassignment_convergence ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.deadline_reassignment_convergence FORCE ROW LEVEL SECURITY;
      GRANT SELECT ON public.deadline_reassignment_convergence TO union_eyes_runtime;
      CREATE FUNCTION public.ue_guard_deadline_reassignment_convergence_policy() RETURNS event_trigger LANGUAGE plpgsql AS $fn$${LEGACY_DEADLINE_GUARD_BODY}$fn$;
      ALTER FUNCTION public.ue_guard_deadline_reassignment_convergence_policy() OWNER TO uev2admin;
      CREATE EVENT TRIGGER ue_guard_deadline_reassignment_convergence_policy ON ddl_command_end
        WHEN TAG IN ('CREATE POLICY','ALTER POLICY') EXECUTE FUNCTION public.ue_guard_deadline_reassignment_convergence_policy();`)
    await expect(
      db.exec(compileBusinessSessionPolicy('deadline_reassignment_convergence')),
    ).rejects.toThrow(/outside the canonical closure/)
    const execute = async (statement: string) =>
      (await db.query<Record<string, unknown>>(statement)).rows
    const plan = await planBusinessSessionRepair(execute)
    expect(plan.protectedGuardState).toBe('LEGACY')
    await db.exec('BEGIN')
    expect(
      (await applyBusinessSessionRepair(execute, plan.fingerprint, execute))
        .upgradedProtectedGuards,
    ).toBe(1)
    await db.exec('COMMIT')
    expect((await planBusinessSessionRepair(execute)).protectedGuardState).toBe('CURRENT')
    for (const tamper of [
      compileBusinessSessionPolicy('deadline_reassignment_convergence').replace(
        'AS RESTRICTIVE',
        'AS PERMISSIVE',
      ),
      compileBusinessSessionPolicy('deadline_reassignment_convergence').replace(
        'TO union_eyes_runtime',
        'TO PUBLIC,union_eyes_runtime',
      ),
      compileBusinessSessionPolicy('deadline_reassignment_convergence').replace(
        /USING \([\s\S]*?\) WITH CHECK/,
        'USING (true) WITH CHECK',
      ),
    ]) {
      await db.exec(
        `BEGIN; DROP POLICY ${BUSINESS_SESSION_POLICY} ON public.deadline_reassignment_convergence`,
      )
      await expect(db.exec(tamper)).rejects.toThrow(/exact and restrictive/)
      await db.exec('ROLLBACK')
    }
    await expect(
      db.exec(
        'CREATE POLICY unexpected_policy ON public.deadline_reassignment_convergence FOR SELECT TO union_eyes_runtime USING (true)',
      ),
    ).rejects.toThrow(/outside the canonical closure/)
    expect(businessSessionPolicyViolations(await execute(BUSINESS_SESSION_POLICY_QUERY))).toEqual(
      [],
    )
  })
})
