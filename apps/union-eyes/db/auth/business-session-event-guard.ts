/** Current compatibility producer for the retained, immutable deadline policy closure. */
export const DEADLINE_SESSION_GUARD_SOURCE =
  'apps/union-eyes/db/migrations-cache/0019_deadline_reassignment_convergence.sql'
export const LEGACY_DEADLINE_GUARD_BODY =
  "\nDECLARE\n  obj record;\n  pol_name text;\n  pol_rel regclass;\n  pol_roles oid[];\n  pol_qual text;\n  pol_check text;\nBEGIN\n  FOR obj IN\n    SELECT *\n    FROM pg_event_trigger_ddl_commands()\n    WHERE command_tag IN ('CREATE POLICY', 'ALTER POLICY')\n      AND object_type = 'policy'\n  LOOP\n    pol_name := NULL;\n    pol_rel := NULL;\n    pol_roles := NULL;\n    pol_qual := NULL;\n    pol_check := NULL;\n    SELECT p.polname, p.polrelid, p.polroles,\n           pg_get_expr(p.polqual, p.polrelid),\n           pg_get_expr(p.polwithcheck, p.polrelid)\n      INTO pol_name, pol_rel, pol_roles, pol_qual, pol_check\n      FROM pg_policy p\n     WHERE p.oid = obj.objid;\n\n    IF pol_name IS NULL THEN\n      IF COALESCE(obj.object_identity, '') ILIKE '%deadline_reassignment_convergence%' THEN\n        RAISE EXCEPTION 'deadline reassignment convergence: refusing policy % outside the canonical closure', obj.object_identity\n          USING ERRCODE = '42501';\n      END IF;\n      CONTINUE;\n    END IF;\n\n    IF pol_rel IS DISTINCT FROM 'public.deadline_reassignment_convergence'::regclass THEN\n      CONTINUE;\n    END IF;\n\n    IF pol_name = 'deadline_reassignment_convergence_tenant_isolation'\n       OR (pol_roles IS NOT NULL AND 0 = ANY (pol_roles))\n       OR COALESCE(pol_qual, '') ~* 'coalesce[[:space:]]*\\([[:space:]]*nullif'\n       OR COALESCE(pol_check, '') ~* 'coalesce[[:space:]]*\\([[:space:]]*nullif'\n       OR pol_name NOT IN (\n         'ue_org_isolation_select',\n         'ue_org_isolation_insert',\n         'ue_org_isolation_update',\n         'ue_org_isolation_delete',\n         'ue_system_full_access'\n       )\n    THEN\n      RAISE EXCEPTION 'deadline reassignment convergence: refusing policy % outside the canonical closure', pol_name\n        USING ERRCODE = '42501';\n    END IF;\n  END LOOP;\nEND;\n"
export const DEADLINE_SESSION_GUARD_QUERY = `SELECT p.oid::text,p.prosrc,p.prosecdef,p.proconfig,
  p.proargtypes::text AS argument_types,pg_get_userbyid(p.proowner) AS owner_name,
  p.prorettype::regtype::text AS return_type,l.lanname AS language,
  e.evtname,e.evtevent,e.evtenabled,e.evttags
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
  LEFT JOIN pg_event_trigger e ON e.evtfoid=p.oid
  WHERE n.nspname='public' AND p.proname='ue_guard_deadline_reassignment_convergence_policy'`
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`

export function currentDeadlineGuardBody(policy: string, predicate: string): string {
  const anchor = "    IF pol_name = 'deadline_reassignment_convergence_tenant_isolation'"
  if (LEGACY_DEADLINE_GUARD_BODY.split(anchor).length !== 2)
    throw new Error('Immutable deadline guard anchor changed')
  const branch = `    IF pol_name = ${literal(policy)} THEN
      IF NOT EXISTS (
        SELECT FROM pg_catalog.pg_policy p WHERE p.oid=obj.objid
          AND p.polpermissive=false AND p.polcmd='*'
          AND p.polroles=ARRAY[(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='union_eyes_runtime')]::oid[]
          AND pg_catalog.pg_get_expr(p.polqual,p.polrelid)=${literal(predicate)}
          AND pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid)=${literal(predicate)}
      ) THEN
        RAISE EXCEPTION 'deadline reassignment convergence: mandatory session policy must be exact and restrictive' USING ERRCODE='42501';
      END IF;
      CONTINUE;
    END IF;

`
  return LEGACY_DEADLINE_GUARD_BODY.replace(anchor, branch + anchor)
}

export function deadlineSessionGuardPlan(
  rows: readonly Record<string, unknown>[],
  policy: string,
  predicate: string,
) {
  if (!rows.length) return { state: 'ABSENT', upgradeSql: null, metadata: rows } as const
  const row = rows[0]
  if (
    rows.length !== 1 ||
    row.owner_name !== 'uev2admin' ||
    row.prosecdef !== false ||
    row.proconfig !== null ||
    row.argument_types !== '' ||
    row.return_type !== 'event_trigger' ||
    row.language !== 'plpgsql' ||
    row.evtname !== 'ue_guard_deadline_reassignment_convergence_policy' ||
    row.evtevent !== 'ddl_command_end' ||
    row.evtenabled !== 'O' ||
    JSON.stringify([...((row.evttags as string[]) ?? [])].sort()) !==
      JSON.stringify(['ALTER POLICY', 'CREATE POLICY'])
  )
    throw new Error(
      'Existing deadline event guard authority differs; automatic replacement refused',
    )
  const current = currentDeadlineGuardBody(policy, predicate)
  if (row.prosrc === current) return { state: 'CURRENT', upgradeSql: null, metadata: rows } as const
  if (row.prosrc !== LEGACY_DEADLINE_GUARD_BODY)
    throw new Error('Existing deadline event guard body differs; automatic replacement refused')
  return {
    state: 'LEGACY',
    metadata: rows,
    upgradeSql: `CREATE OR REPLACE FUNCTION public.ue_guard_deadline_reassignment_convergence_policy() RETURNS event_trigger LANGUAGE plpgsql AS $ue_session_guard$${current}$ue_session_guard$;`,
  } as const
}

export function deadlineSessionGuardViolations(
  rows: readonly Record<string, unknown>[],
  policy: string,
  predicate: string,
): string[] {
  try {
    return deadlineSessionGuardPlan(rows, policy, predicate).state === 'LEGACY'
      ? ['deadline event guard: exact restrictive session-policy compatibility is missing']
      : []
  } catch (error) {
    return [error instanceof Error ? error.message : 'Deadline event guard cannot be qualified']
  }
}
