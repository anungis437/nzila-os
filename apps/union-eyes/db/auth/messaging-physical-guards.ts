/** Source-owned current messaging protections; no migration journal or historical DDL replay. */
export const MESSAGING_REQUIRED_TABLES = [
  'message_threads',
  'triage_designations',
  'message_thread_assignments',
  'message_thread_lifecycle',
  'message_retention_policies',
  'message_thread_reads',
] as const
export const MESSAGING_GUARD_FUNCTIONS = [
  {
    name: 'triage_guard',
    body: "\nBEGIN\n  IF TG_OP = 'DELETE' OR TG_OP = 'TRUNCATE' THEN\n    RAISE EXCEPTION 'triage_designations is append-only: % refused', TG_OP USING ERRCODE = 'restrict_violation';\n  END IF;\n  IF OLD.revoked_at IS NOT NULL THEN\n    RAISE EXCEPTION 'triage_designations: a revoked designation is final' USING ERRCODE = 'restrict_violation';\n  END IF;\n  IF NEW.id IS DISTINCT FROM OLD.id\n     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id\n     OR NEW.scope IS DISTINCT FROM OLD.scope\n     OR NEW.user_id IS DISTINCT FROM OLD.user_id\n     OR NEW.granted_by IS DISTINCT FROM OLD.granted_by\n     OR NEW.granted_at IS DISTINCT FROM OLD.granted_at\n     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN\n    RAISE EXCEPTION 'triage_designations: only revocation may be recorded' USING ERRCODE = 'restrict_violation';\n  END IF;\n  RETURN NEW;\nEND;\n",
    source: 'apps/union-eyes/db/migrations-platform/0014_message_thread_triage.sql',
    sourceSha256: 'e0ce68952b193b373a65072455c6897941969fce79b244462e96d22f46521d6a',
  },
  {
    name: 'message_assignment_guard',
    body: "\nBEGIN\n  IF TG_OP <> 'INSERT' THEN\n    RAISE EXCEPTION 'message_thread_assignments is append-only: % refused', TG_OP USING ERRCODE = 'restrict_violation';\n  END IF;\n  -- The recorded tenant must be the thread's tenant, and the recorded source must be the thread's current assignee.\n  IF NOT EXISTS (\n    SELECT 1 FROM public.message_threads t\n    WHERE t.id = NEW.thread_id\n      AND t.organization_id = NEW.organization_id\n      AND t.staff_id IS NOT DISTINCT FROM NEW.to_staff_id\n  ) THEN\n    RAISE EXCEPTION 'message_thread_assignments: record does not match the thread tenant or its resulting assignee'\n      USING ERRCODE = 'restrict_violation';\n  END IF;\n  RETURN NEW;\nEND;\n",
    source: 'apps/union-eyes/db/migrations-platform/0014_message_thread_triage.sql',
    sourceSha256: 'e0ce68952b193b373a65072455c6897941969fce79b244462e96d22f46521d6a',
  },
  {
    name: 'message_threads_guard_update',
    body: "\nBEGIN\n  IF NEW.id IS DISTINCT FROM OLD.id\n     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id\n     OR NEW.member_id IS DISTINCT FROM OLD.member_id\n     OR NEW.subject IS DISTINCT FROM OLD.subject\n     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN\n    RAISE EXCEPTION 'message_threads: tenant, owner, subject and creation are immutable' USING ERRCODE = 'restrict_violation';\n  END IF;\n  -- An assignment change is only valid together with its history record; the assignment trigger verifies it.\n  RETURN NEW;\nEND;\n",
    source: 'apps/union-eyes/db/migrations-platform/0014_message_thread_triage.sql',
    sourceSha256: 'e0ce68952b193b373a65072455c6897941969fce79b244462e96d22f46521d6a',
  },
  {
    name: 'message_threads_assignment_requires_history',
    body: "\nBEGIN\n  IF NEW.staff_id IS DISTINCT FROM OLD.staff_id THEN\n    IF NOT EXISTS (\n      SELECT 1 FROM public.message_thread_assignments a\n      WHERE a.thread_id = NEW.id\n        AND a.organization_id = NEW.organization_id\n        AND a.to_staff_id IS NOT DISTINCT FROM NEW.staff_id\n        AND a.from_staff_id IS NOT DISTINCT FROM OLD.staff_id\n        AND a.created_at = (SELECT max(created_at) FROM public.message_thread_assignments b WHERE b.thread_id = NEW.id)\n    ) THEN\n      RAISE EXCEPTION 'message_threads: an assignment change requires its history record' USING ERRCODE = 'restrict_violation';\n    END IF;\n  END IF;\n  RETURN NULL;\nEND;\n",
    source: 'apps/union-eyes/db/migrations-platform/0014_message_thread_triage.sql',
    sourceSha256: 'e0ce68952b193b373a65072455c6897941969fce79b244462e96d22f46521d6a',
  },
  {
    name: 'message_threads_lifecycle_guard',
    body: "\nBEGIN\n  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'closed' THEN\n    RAISE EXCEPTION 'message_threads: a conversation can only move to closed' USING ERRCODE = 'restrict_violation';\n  END IF;\n  IF OLD.is_archived IS TRUE AND NEW.is_archived IS NOT TRUE THEN\n    RAISE EXCEPTION 'message_threads: an archived conversation stays archived' USING ERRCODE = 'restrict_violation';\n  END IF;\n  IF NEW.is_archived IS TRUE AND OLD.is_archived IS NOT TRUE AND NEW.status <> 'closed' THEN\n    RAISE EXCEPTION 'message_threads: only a closed conversation can be archived' USING ERRCODE = 'restrict_violation';\n  END IF;\n  RETURN NEW;\nEND;\n",
    source:
      'apps/union-eyes/db/migrations-platform/0025_message_thread_lifecycle_and_retention.sql',
    sourceSha256: '57cac000beedd6841095f5975a01a3c0ad300799b9794f7c4893e7e4a56f6b1c',
  },
  {
    name: 'message_threads_lifecycle_requires_history',
    body: "\nBEGIN\n  IF NEW.status IS DISTINCT FROM OLD.status AND NOT EXISTS (\n    SELECT 1 FROM public.message_thread_lifecycle l\n    WHERE l.thread_id = NEW.id AND l.organization_id = NEW.organization_id\n      AND l.action = 'close' AND l.created_at = transaction_timestamp()\n  ) THEN\n    RAISE EXCEPTION 'message_threads: closing requires its lifecycle record' USING ERRCODE = 'restrict_violation';\n  END IF;\n  IF NEW.is_archived IS TRUE AND OLD.is_archived IS NOT TRUE AND NOT EXISTS (\n    SELECT 1 FROM public.message_thread_lifecycle l\n    WHERE l.thread_id = NEW.id AND l.organization_id = NEW.organization_id\n      AND l.action = 'archive' AND l.created_at = transaction_timestamp()\n  ) THEN\n    RAISE EXCEPTION 'message_threads: archiving requires its lifecycle record' USING ERRCODE = 'restrict_violation';\n  END IF;\n  RETURN NULL;\nEND;\n",
    source:
      'apps/union-eyes/db/migrations-platform/0025_message_thread_lifecycle_and_retention.sql',
    sourceSha256: '57cac000beedd6841095f5975a01a3c0ad300799b9794f7c4893e7e4a56f6b1c',
  },
  {
    name: 'message_lifecycle_guard',
    body: "\nDECLARE\n  thread public.message_threads%ROWTYPE;\n  last_hold text;\nBEGIN\n  IF TG_OP <> 'INSERT' THEN\n    RAISE EXCEPTION 'message_thread_lifecycle is append-only: % refused', TG_OP USING ERRCODE = 'restrict_violation';\n  END IF;\n  SELECT * INTO thread FROM public.message_threads t WHERE t.id = NEW.thread_id AND t.organization_id = NEW.organization_id;\n  IF NOT FOUND THEN\n    RAISE EXCEPTION 'message_thread_lifecycle: the record does not match a conversation of its tenant' USING ERRCODE = 'restrict_violation';\n  END IF;\n  IF NEW.action = 'close' AND thread.status <> 'closed' THEN\n    RAISE EXCEPTION 'message_thread_lifecycle: the conversation is not closed' USING ERRCODE = 'restrict_violation';\n  END IF;\n  IF NEW.action = 'archive' AND thread.is_archived IS NOT TRUE THEN\n    RAISE EXCEPTION 'message_thread_lifecycle: the conversation is not archived' USING ERRCODE = 'restrict_violation';\n  END IF;\n  IF NEW.action IN ('close', 'archive') AND EXISTS (\n    SELECT 1 FROM public.message_thread_lifecycle l WHERE l.thread_id = NEW.thread_id AND l.action = NEW.action\n  ) THEN\n    RAISE EXCEPTION 'message_thread_lifecycle: the conversation already has a % record', NEW.action USING ERRCODE = 'restrict_violation';\n  END IF;\n  IF NEW.action IN ('hold_place', 'hold_release') THEN\n    SELECT l.action INTO last_hold FROM public.message_thread_lifecycle l\n      WHERE l.thread_id = NEW.thread_id AND l.action IN ('hold_place', 'hold_release')\n      ORDER BY l.seq DESC LIMIT 1;\n    IF NEW.action = 'hold_place' AND last_hold = 'hold_place' THEN\n      RAISE EXCEPTION 'message_thread_lifecycle: the conversation is already under a legal hold' USING ERRCODE = 'restrict_violation';\n    END IF;\n    IF NEW.action = 'hold_release' AND last_hold IS DISTINCT FROM 'hold_place' THEN\n      RAISE EXCEPTION 'message_thread_lifecycle: the conversation is not under a legal hold' USING ERRCODE = 'restrict_violation';\n    END IF;\n  END IF;\n  RETURN NEW;\nEND;\n",
    source:
      'apps/union-eyes/db/migrations-platform/0025_message_thread_lifecycle_and_retention.sql',
    sourceSha256: '57cac000beedd6841095f5975a01a3c0ad300799b9794f7c4893e7e4a56f6b1c',
  },
  {
    name: 'message_retention_guard',
    body: "\nBEGIN\n  IF TG_OP = 'DELETE' OR TG_OP = 'TRUNCATE' THEN\n    RAISE EXCEPTION 'message_retention_policies is append-only: % refused', TG_OP USING ERRCODE = 'restrict_violation';\n  END IF;\n  IF OLD.superseded_at IS NOT NULL THEN\n    RAISE EXCEPTION 'message_retention_policies: a superseded policy is final' USING ERRCODE = 'restrict_violation';\n  END IF;\n  IF NEW.id IS DISTINCT FROM OLD.id\n     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id\n     OR NEW.policy_reference IS DISTINCT FROM OLD.policy_reference\n     OR NEW.authority_reference IS DISTINCT FROM OLD.authority_reference\n     OR NEW.retention_days IS DISTINCT FROM OLD.retention_days\n     OR NEW.adopted_by IS DISTINCT FROM OLD.adopted_by\n     OR NEW.adopted_at IS DISTINCT FROM OLD.adopted_at THEN\n    RAISE EXCEPTION 'message_retention_policies: only supersession may be recorded' USING ERRCODE = 'restrict_violation';\n  END IF;\n  RETURN NEW;\nEND;\n",
    source:
      'apps/union-eyes/db/migrations-platform/0025_message_thread_lifecycle_and_retention.sql',
    sourceSha256: '57cac000beedd6841095f5975a01a3c0ad300799b9794f7c4893e7e4a56f6b1c',
  },
  {
    name: 'message_reads_guard',
    body: "\nBEGIN\n  IF TG_OP = 'DELETE' OR TG_OP = 'TRUNCATE' THEN\n    RAISE EXCEPTION 'message_thread_reads: % refused', TG_OP USING ERRCODE = 'restrict_violation';\n  END IF;\n  IF TG_OP = 'UPDATE' THEN\n    IF NEW.thread_id IS DISTINCT FROM OLD.thread_id\n       OR NEW.user_id IS DISTINCT FROM OLD.user_id\n       OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN\n      RAISE EXCEPTION 'message_thread_reads: identity of a read marker is immutable' USING ERRCODE = 'restrict_violation';\n    END IF;\n    IF NEW.last_read_at < OLD.last_read_at THEN\n      RAISE EXCEPTION 'message_thread_reads: a read marker never moves backwards' USING ERRCODE = 'restrict_violation';\n    END IF;\n    RETURN NEW;\n  END IF;\n  IF NOT EXISTS (SELECT 1 FROM public.message_threads t WHERE t.id = NEW.thread_id AND t.organization_id = NEW.organization_id) THEN\n    RAISE EXCEPTION 'message_thread_reads: the marker does not match a conversation of its tenant' USING ERRCODE = 'restrict_violation';\n  END IF;\n  RETURN NEW;\nEND;\n",
    source:
      'apps/union-eyes/db/migrations-platform/0025_message_thread_lifecycle_and_retention.sql',
    sourceSha256: '57cac000beedd6841095f5975a01a3c0ad300799b9794f7c4893e7e4a56f6b1c',
  },
] as const
export const MESSAGING_GUARD_TRIGGERS = [
  {
    name: 'triage_guard_update',
    table: 'triage_designations',
    functionName: 'triage_guard',
    type: 19,
    deferrable: false,
    initiallyDeferred: false,
    sql: 'CREATE TRIGGER triage_guard_update BEFORE UPDATE ON public.triage_designations\n  FOR EACH ROW EXECUTE FUNCTION public.triage_guard();',
    source: 'apps/union-eyes/db/migrations-platform/0014_message_thread_triage.sql',
  },
  {
    name: 'triage_guard_delete',
    table: 'triage_designations',
    functionName: 'triage_guard',
    type: 11,
    deferrable: false,
    initiallyDeferred: false,
    sql: 'CREATE TRIGGER triage_guard_delete BEFORE DELETE ON public.triage_designations\n  FOR EACH ROW EXECUTE FUNCTION public.triage_guard();',
    source: 'apps/union-eyes/db/migrations-platform/0014_message_thread_triage.sql',
  },
  {
    name: 'message_assignment_guard_insert',
    table: 'message_thread_assignments',
    functionName: 'message_assignment_guard',
    type: 5,
    deferrable: true,
    initiallyDeferred: false,
    sql: 'CREATE CONSTRAINT TRIGGER message_assignment_guard_insert AFTER INSERT ON public.message_thread_assignments\n  DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION public.message_assignment_guard();',
    source: 'apps/union-eyes/db/migrations-platform/0014_message_thread_triage.sql',
  },
  {
    name: 'message_assignment_guard_mutate',
    table: 'message_thread_assignments',
    functionName: 'message_assignment_guard',
    type: 27,
    deferrable: false,
    initiallyDeferred: false,
    sql: 'CREATE TRIGGER message_assignment_guard_mutate BEFORE UPDATE OR DELETE ON public.message_thread_assignments\n  FOR EACH ROW EXECUTE FUNCTION public.message_assignment_guard();',
    source: 'apps/union-eyes/db/migrations-platform/0014_message_thread_triage.sql',
  },
  {
    name: 'message_threads_guard_update',
    table: 'message_threads',
    functionName: 'message_threads_guard_update',
    type: 19,
    deferrable: false,
    initiallyDeferred: false,
    sql: 'CREATE TRIGGER message_threads_guard_update BEFORE UPDATE ON public.message_threads\n  FOR EACH ROW EXECUTE FUNCTION public.message_threads_guard_update();',
    source: 'apps/union-eyes/db/migrations-platform/0014_message_thread_triage.sql',
  },
  {
    name: 'message_threads_assignment_requires_history',
    table: 'message_threads',
    functionName: 'message_threads_assignment_requires_history',
    type: 17,
    deferrable: true,
    initiallyDeferred: true,
    sql: 'CREATE CONSTRAINT TRIGGER message_threads_assignment_requires_history AFTER UPDATE ON public.message_threads\n  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.message_threads_assignment_requires_history();',
    source: 'apps/union-eyes/db/migrations-platform/0014_message_thread_triage.sql',
  },
  {
    name: 'message_threads_lifecycle_guard',
    table: 'message_threads',
    functionName: 'message_threads_lifecycle_guard',
    type: 19,
    deferrable: false,
    initiallyDeferred: false,
    sql: 'CREATE TRIGGER message_threads_lifecycle_guard BEFORE UPDATE ON public.message_threads\n  FOR EACH ROW EXECUTE FUNCTION public.message_threads_lifecycle_guard();',
    source:
      'apps/union-eyes/db/migrations-platform/0025_message_thread_lifecycle_and_retention.sql',
  },
  {
    name: 'message_threads_lifecycle_requires_history',
    table: 'message_threads',
    functionName: 'message_threads_lifecycle_requires_history',
    type: 17,
    deferrable: true,
    initiallyDeferred: true,
    sql: 'CREATE CONSTRAINT TRIGGER message_threads_lifecycle_requires_history AFTER UPDATE ON public.message_threads\n  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.message_threads_lifecycle_requires_history();',
    source:
      'apps/union-eyes/db/migrations-platform/0025_message_thread_lifecycle_and_retention.sql',
  },
  {
    name: 'message_lifecycle_guard_write',
    table: 'message_thread_lifecycle',
    functionName: 'message_lifecycle_guard',
    type: 31,
    deferrable: false,
    initiallyDeferred: false,
    sql: 'CREATE TRIGGER message_lifecycle_guard_write BEFORE INSERT OR UPDATE OR DELETE ON public.message_thread_lifecycle\n  FOR EACH ROW EXECUTE FUNCTION public.message_lifecycle_guard();',
    source:
      'apps/union-eyes/db/migrations-platform/0025_message_thread_lifecycle_and_retention.sql',
  },
  {
    name: 'message_retention_guard_update',
    table: 'message_retention_policies',
    functionName: 'message_retention_guard',
    type: 19,
    deferrable: false,
    initiallyDeferred: false,
    sql: 'CREATE TRIGGER message_retention_guard_update BEFORE UPDATE ON public.message_retention_policies\n  FOR EACH ROW EXECUTE FUNCTION public.message_retention_guard();',
    source:
      'apps/union-eyes/db/migrations-platform/0025_message_thread_lifecycle_and_retention.sql',
  },
  {
    name: 'message_retention_guard_delete',
    table: 'message_retention_policies',
    functionName: 'message_retention_guard',
    type: 11,
    deferrable: false,
    initiallyDeferred: false,
    sql: 'CREATE TRIGGER message_retention_guard_delete BEFORE DELETE ON public.message_retention_policies\n  FOR EACH ROW EXECUTE FUNCTION public.message_retention_guard();',
    source:
      'apps/union-eyes/db/migrations-platform/0025_message_thread_lifecycle_and_retention.sql',
  },
  {
    name: 'message_reads_guard_write',
    table: 'message_thread_reads',
    functionName: 'message_reads_guard',
    type: 31,
    deferrable: false,
    initiallyDeferred: false,
    sql: 'CREATE TRIGGER message_reads_guard_write BEFORE INSERT OR UPDATE OR DELETE ON public.message_thread_reads\n  FOR EACH ROW EXECUTE FUNCTION public.message_reads_guard();',
    source:
      'apps/union-eyes/db/migrations-platform/0025_message_thread_lifecycle_and_retention.sql',
  },
] as const
const names = (values: readonly string[]) =>
  values.map((value) => `'${value.replaceAll("'", "''")}'`).join(',')
const quoted = (value: string) => `"${value.replaceAll('"', '""')}"`
export const MESSAGING_PHYSICAL_QUERIES = {
  tables: `SELECT wanted.name AS table_name,c.oid::text,pg_get_userbyid(c.relowner) AS owner_name FROM unnest(ARRAY[${names(MESSAGING_REQUIRED_TABLES)}]) wanted(name) LEFT JOIN pg_namespace n ON n.nspname='public' LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=wanted.name AND c.relkind='r' ORDER BY wanted.name`,
  functions: `SELECT p.proname,p.prosrc,p.prosecdef,p.proconfig,p.proargtypes::text AS argument_types,p.prorettype::regtype::text AS return_type,l.lanname AS language,pg_get_userbyid(p.proowner) AS owner_name FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang WHERE n.nspname='public' AND p.proname IN (${names(MESSAGING_GUARD_FUNCTIONS.map((fn) => fn.name))}) ORDER BY p.proname,p.oid`,
  triggers: `SELECT t.tgname,c.relname AS table_name,p.proname AS function_name,pn.nspname AS function_schema,t.tgtype,t.tgenabled,t.tgdeferrable,t.tginitdeferred,t.tgconstraint<>0 AS is_constraint,t.tgqual IS NOT NULL AS has_condition,t.tgattr::text AS columns,t.tgnargs FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace WHERE n.nspname='public' AND t.tgname IN (${names(MESSAGING_GUARD_TRIGGERS.map((t) => t.name))}) ORDER BY c.relname,t.tgname`,
} as const

type Row = Record<string, unknown>
type Execute = (statement: string) => Promise<Row[]>
export async function inspectMessagingPhysicalCatalog(execute: Execute) {
  return {
    tables: await execute(MESSAGING_PHYSICAL_QUERIES.tables),
    functions: await execute(MESSAGING_PHYSICAL_QUERIES.functions),
    triggers: await execute(MESSAGING_PHYSICAL_QUERIES.triggers),
  }
}
export function planMessagingPhysicalGuards(
  snapshot: Awaited<ReturnType<typeof inspectMessagingPhysicalCatalog>>,
) {
  const missingTables = MESSAGING_REQUIRED_TABLES.filter(
    (name) => !snapshot.tables.some((row) => row.table_name === name && row.oid),
  )
  for (const row of snapshot.tables)
    if (row.oid && row.owner_name !== 'ue_v2_owner')
      throw new Error(`Messaging relation owner differs: ${String(row.table_name)}`)
  const statements: string[] = []
  for (const fn of MESSAGING_GUARD_FUNCTIONS) {
    const rows = snapshot.functions.filter((row) => row.proname === fn.name)
    if (!rows.length)
      statements.push(
        `CREATE FUNCTION public.${quoted(fn.name)}() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $ue_message$${fn.body}$ue_message$;`,
        `REVOKE ALL ON FUNCTION public.${quoted(fn.name)}() FROM PUBLIC,union_eyes_runtime,union_eyes_system;`,
      )
    else if (
      rows.length !== 1 ||
      rows[0].prosrc !== fn.body ||
      rows[0].prosecdef !== false ||
      rows[0].argument_types !== '' ||
      rows[0].return_type !== 'trigger' ||
      rows[0].language !== 'plpgsql' ||
      !['ue_v2_owner', 'uev2admin'].includes(String(rows[0].owner_name)) ||
      JSON.stringify(rows[0].proconfig) !== JSON.stringify(['search_path=pg_catalog, public'])
    )
      throw new Error(`Messaging guard function differs; replacement refused: ${fn.name}`)
  }
  for (const trigger of MESSAGING_GUARD_TRIGGERS) {
    const rows = snapshot.triggers.filter(
      (row) => row.tgname === trigger.name && row.table_name === trigger.table,
    )
    if (!rows.length) statements.push(trigger.sql)
    else if (
      rows.length !== 1 ||
      rows[0].function_name !== trigger.functionName ||
      rows[0].function_schema !== 'public' ||
      rows[0].tgtype !== trigger.type ||
      rows[0].tgenabled !== 'O' ||
      rows[0].tgdeferrable !== trigger.deferrable ||
      rows[0].tginitdeferred !== trigger.initiallyDeferred ||
      rows[0].is_constraint !== trigger.deferrable ||
      rows[0].has_condition !== false ||
      rows[0].columns !== '' ||
      rows[0].tgnargs !== 0
    )
      throw new Error(`Messaging guard trigger differs; replacement refused: ${trigger.name}`)
  }
  return { missingTables, statements }
}
export function messagingPhysicalGuardViolations(
  snapshot: Awaited<ReturnType<typeof inspectMessagingPhysicalCatalog>>,
): string[] {
  try {
    const plan = planMessagingPhysicalGuards(snapshot)
    return [
      ...plan.missingTables.map((name) => `Messaging relation missing: ${name}`),
      ...(plan.statements.length ? ['Current messaging physical protections are missing'] : []),
    ]
  } catch (error) {
    return [
      error instanceof Error ? error.message : 'Messaging physical protections cannot be qualified',
    ]
  }
}
/** Fresh native installation only; existing installations use a separately reviewed additive plan. */
export function compileMessagingPhysicalGuards(tables: readonly { name: string }[]): string[] {
  if (!tables.some((table) => table.name === 'message_threads')) return []
  if (!MESSAGING_REQUIRED_TABLES.every((name) => tables.some((table) => table.name === name)))
    throw new Error('Current messaging declaration universe is incomplete')
  const functions = MESSAGING_GUARD_FUNCTIONS.flatMap((fn) => [
    `CREATE FUNCTION public.${quoted(fn.name)}() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $ue_message$${fn.body}$ue_message$;`,
    `REVOKE ALL ON FUNCTION public.${quoted(fn.name)}() FROM PUBLIC,union_eyes_runtime,union_eyes_system;`,
  ])
  return [...functions, ...MESSAGING_GUARD_TRIGGERS.map((trigger) => trigger.sql)]
}
