import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type pg from 'pg'
import { hash, root } from './source'
import { canonicalRoleSqlList } from './execution-roles'
import { AUTH_EXECUTION_ROLES } from './auth-sql'
import { FRAMEWORK_ROLES } from './framework-contract'

export function producerOwnsSharedRole(producerId: string, canonicalId: string): boolean {
  const roles: readonly string[] =
    producerId === 'CANONICAL_AUTH_EXECUTION'
      ? Object.values(AUTH_EXECUTION_ROLES)
      : producerId === 'CANONICAL_FRAMEWORK_EXECUTION'
        ? Object.values(FRAMEWORK_ROLES)
        : []
  const [kind, ...names] = canonicalId.split(':')
  return (
    ((kind === 'role' && names.length === 1) ||
      (kind === 'role_membership' && names.length === 2)) &&
    names.every((name) => roles.includes(name))
  )
}

export interface Producer {
  canonicalId: string
  source: string
  sourceDigest: string
  sql: string
}
export interface Execution {
  order: number
  producer: Producer
  sqlDigest: string
  producerCodeDigest: string | null
}
export interface NativeAddress {
  canonicalId: string
  address: string
  nativeType: string
  nativeIdentity: string
}
export interface TraceEvent {
  address: string
  order: number
  command: string
}
export interface ExecutionTrace {
  executions: Execution[]
  events: TraceEvent[]
  baseline: NativeAddress[]
}
export type ExecutionHook = (producer: Producer, execute: () => Promise<unknown>) => Promise<void>

export const producerBytes = (file: string) =>
  hash(readFileSync(path.join(root, ...file.split('/'))).toString('utf8'))

// Addresses are local join keys only. Exported dependencies use PostgreSQL identities, never OIDs.
export async function inspectNativeAddresses(client: pg.Client): Promise<NativeAddress[]> {
  const result = await client.query<NativeAddress>(`
    WITH addresses AS (
      SELECT 'schema:'||nspname id,'pg_namespace'::regclass classid,oid objid,0 subid
        FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname<>'information_schema'
      UNION ALL SELECT 'extension:'||extname,'pg_extension'::regclass,oid,0 FROM pg_extension
      UNION ALL SELECT 'relation:'||n.nspname||'.'||c.relname,'pg_class'::regclass,c.oid,0
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname IN ('public','user_management') AND c.relkind IN ('r','p','v','m','S')
      UNION ALL SELECT 'sequence:'||n.nspname||'.'||c.relname,'pg_class'::regclass,c.oid,0
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname IN ('public','user_management') AND c.relkind='S'
      UNION ALL SELECT 'relation:'||n.nspname||'.'||c.relname,'pg_rewrite'::regclass,r.oid,0
        FROM pg_rewrite r JOIN pg_class c ON c.oid=r.ev_class JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname IN ('public','user_management')
      UNION ALL SELECT 'index:'||n.nspname||'.'||c.relname,'pg_class'::regclass,c.oid,0
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname IN ('public','user_management') AND c.relkind IN ('i','I')
      UNION ALL SELECT 'column:'||n.nspname||'.'||c.relname||'.'||a.attname,'pg_class'::regclass,c.oid,a.attnum
        FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname IN ('public','user_management') AND a.attnum>0 AND NOT a.attisdropped AND c.relkind IN ('r','p','v','m')
      UNION ALL SELECT 'column_default:'||n.nspname||'.'||c.relname||'.'||a.attname,'pg_attrdef'::regclass,d.oid,0
        FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum
        JOIN pg_class c ON c.oid=d.adrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname IN ('public','user_management')
      UNION ALL SELECT 'constraint:'||(CASE WHEN conrelid=0 THEN contypid::regtype::text ELSE conrelid::regclass::text END)||'.'||conname,'pg_constraint'::regclass,oid,0
        FROM pg_constraint WHERE connamespace IN ('public'::regnamespace,to_regnamespace('user_management'))
      UNION ALL SELECT 'policy:'||n.nspname||'.'||c.relname||'.'||p.polname,'pg_policy'::regclass,p.oid,0
        FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname IN ('public','user_management')
      UNION ALL SELECT (CASE WHEN t.typtype='e' THEN 'enum:' ELSE 'type:' END)||n.nspname||'.'||t.typname,
        'pg_type'::regclass,t.oid,0 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
        WHERE n.nspname IN ('public','user_management')
      UNION ALL SELECT (CASE WHEN p.prokind='a' THEN 'aggregate:' ELSE 'function:' END)||p.oid::regprocedure::text,
        'pg_proc'::regclass,p.oid,0 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname IN ('public','user_management')
      UNION ALL SELECT 'trigger:'||tgrelid::regclass::text||'.'||tgname,'pg_trigger'::regclass,oid,0
        FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN
        (SELECT oid FROM pg_class WHERE relnamespace IN ('public'::regnamespace,to_regnamespace('user_management')))
      UNION ALL SELECT 'operator:'||n.nspname||'.'||o.oprname||'('||
        CASE WHEN o.oprleft=0 THEN 'NONE' ELSE format_type(o.oprleft,NULL) END||','||format_type(o.oprright,NULL)||')',
        'pg_operator'::regclass,o.oid,0 FROM pg_operator o JOIN pg_namespace n ON n.oid=o.oprnamespace
        WHERE n.nspname IN ('public','user_management')
      UNION ALL SELECT 'role:'||rolname,'pg_authid'::regclass,oid,0 FROM pg_roles
        WHERE rolname IN (${canonicalRoleSqlList})
      UNION ALL SELECT 'role_membership:'||parent.rolname||':'||member.rolname,
        'pg_auth_members'::regclass,m.oid,0
        FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid JOIN pg_roles member ON member.oid=m.member
        WHERE parent.rolname IN (${canonicalRoleSqlList}) OR member.rolname IN (${canonicalRoleSqlList})
      UNION ALL SELECT 'default_acl:'||pg_get_userbyid(defaclrole)||'.'||defaclnamespace::regnamespace::text||'.'||defaclobjtype::text,
        'pg_default_acl'::regclass,oid,0 FROM pg_default_acl WHERE defaclrole='ue_v2_owner'::regrole
      UNION ALL SELECT 'operator_class:'||n.nspname||'.'||c.opcname||' USING '||am.amname,
        'pg_opclass'::regclass,c.oid,0 FROM pg_opclass c JOIN pg_namespace n ON n.oid=c.opcnamespace
        JOIN pg_am am ON am.oid=c.opcmethod WHERE n.nspname IN ('public','user_management')
      UNION ALL SELECT 'operator_family:'||n.nspname||'.'||f.opfname||' USING '||am.amname,
        'pg_opfamily'::regclass,f.oid,0 FROM pg_opfamily f JOIN pg_namespace n ON n.oid=f.opfnamespace
        JOIN pg_am am ON am.oid=f.opfmethod WHERE n.nspname IN ('public','user_management')
      UNION ALL SELECT 'cast:'||format_type(c.castsource,NULL)||' AS '||format_type(c.casttarget,NULL),
        'pg_cast'::regclass,c.oid,0 FROM pg_cast c
        WHERE c.castsource IN (SELECT oid FROM pg_type WHERE typnamespace IN ('public'::regnamespace,to_regnamespace('user_management')))
        OR c.casttarget IN (SELECT oid FROM pg_type WHERE typnamespace IN ('public'::regnamespace,to_regnamespace('user_management')))
      UNION ALL SELECT 'access_method:'||a.amname,'pg_am'::regclass,a.oid,0 FROM pg_am a
        JOIN pg_depend d ON d.classid='pg_am'::regclass AND d.objid=a.oid AND d.deptype='e'
        JOIN pg_extension e ON e.oid=d.refobjid WHERE e.extname='vector'
      UNION ALL SELECT 'collation:'||n.nspname||'.'||c.collname,'pg_collation'::regclass,c.oid,0
        FROM pg_collation c JOIN pg_namespace n ON n.oid=c.collnamespace
        WHERE n.nspname IN ('public','user_management')
      UNION ALL SELECT 'range:'||n.nspname||'.'||t.typname,'pg_type'::regclass,t.oid,0
        FROM pg_range r JOIN pg_type t ON t.oid=r.rngtypid JOIN pg_namespace n ON n.oid=t.typnamespace
        WHERE n.nspname IN ('public','user_management')
    )
    SELECT id AS "canonicalId",classid::text||':'||objid::text||':'||subid::text AS address,
      native.type AS "nativeType",native.identity AS "nativeIdentity"
    FROM addresses CROSS JOIN LATERAL pg_identify_object(classid,objid,subid) native
    ORDER BY id,address
  `)
  return result.rows
}

export async function beginManifestTrace(client: pg.Client) {
  const baseline = await inspectNativeAddresses(client)
  // Removed before inspection; no catalog exclusion can conceal an unexpected trace-shaped object.
  await client.query(`
    CREATE SCHEMA ue_v2_manifest_trace;
    REVOKE ALL ON SCHEMA ue_v2_manifest_trace FROM PUBLIC;
    CREATE TABLE ue_v2_manifest_trace.events(address text, execution_order integer, command text);
    CREATE FUNCTION ue_v2_manifest_trace.capture() RETURNS event_trigger LANGUAGE plpgsql
      SECURITY DEFINER SET search_path=pg_catalog AS $trace$
    BEGIN
      INSERT INTO ue_v2_manifest_trace.events
      SELECT classid::regclass::text||':'||objid::text||':'||objsubid::text,
        current_setting('ue_v2.manifest_order')::integer,command_tag
      FROM pg_event_trigger_ddl_commands();
      INSERT INTO ue_v2_manifest_trace.events
      SELECT 'pg_class:'||a.attrelid::text||':'||a.attnum::text,
        current_setting('ue_v2.manifest_order')::integer,command_tag
      FROM pg_event_trigger_ddl_commands() command
      JOIN pg_attribute a ON command.classid='pg_class'::regclass AND a.attrelid=command.objid
      WHERE a.attnum>0 AND NOT a.attisdropped;
      INSERT INTO ue_v2_manifest_trace.events
      SELECT 'pg_attrdef:'||d.oid::text||':0',
        current_setting('ue_v2.manifest_order')::integer,command_tag
      FROM pg_event_trigger_ddl_commands() command
      JOIN pg_attrdef d ON command.classid='pg_class'::regclass AND d.adrelid=command.objid;
      INSERT INTO ue_v2_manifest_trace.events
      SELECT 'pg_class:'||i.indexrelid::text||':0',
        current_setting('ue_v2.manifest_order')::integer,command_tag
      FROM pg_event_trigger_ddl_commands() command
      JOIN pg_index i ON command.classid='pg_class'::regclass AND i.indrelid=command.objid;
      INSERT INTO ue_v2_manifest_trace.events
      SELECT 'pg_constraint:'||k.oid::text||':0',
        current_setting('ue_v2.manifest_order')::integer,command_tag
      FROM pg_event_trigger_ddl_commands() command
      JOIN pg_constraint k ON
        (command.classid='pg_class'::regclass AND k.conrelid=command.objid)
        OR (command.classid='pg_type'::regclass AND k.contypid=command.objid);
    END $trace$;
    REVOKE ALL ON FUNCTION ue_v2_manifest_trace.capture() FROM PUBLIC;
    CREATE EVENT TRIGGER ue_v2_manifest_capture ON ddl_command_end
      EXECUTE FUNCTION ue_v2_manifest_trace.capture();
  `)
  const executions: Execution[] = []
  const producerCodeDigests = new Map<string, string | null>()
  const nonEventCommands: TraceEvent[] = []
  const hook: ExecutionHook = async (producer, execute) => {
    if (!producerCodeDigests.has(producer.source)) {
      const file = path.join(root, ...producer.source.split('/'))
      producerCodeDigests.set(
        producer.source,
        existsSync(file) ? hash(readFileSync(file, 'utf8')) : null,
      )
    }
    const order = executions.length + 1
    await client.query("SELECT set_config('ue_v2.manifest_order',$1,true)", [String(order)])
    await execute()
    if (
      producer.canonicalId === 'CANONICAL_AUTH_EXECUTION' ||
      producer.canonicalId === 'CANONICAL_FRAMEWORK_EXECUTION'
    ) {
      const shared = (await inspectNativeAddresses(client)).filter((entry) =>
        producerOwnsSharedRole(producer.canonicalId, entry.canonicalId),
      )
      nonEventCommands.push(
        ...shared.map((entry) => ({
          address: entry.address,
          order,
          command: 'OBSERVED_SHARED_ROLE_AFTER_EXECUTION',
        })),
      )
    }
    if (/^\s*ALTER DEFAULT PRIVILEGES/i.test(producer.sql)) {
      const acl = await client.query<{ address: string }>(`
        SELECT 'pg_default_acl:'||oid::text||':0' AS address FROM pg_default_acl
        WHERE defaclrole='ue_v2_owner'::regrole
      `)
      nonEventCommands.push(
        ...acl.rows.map((entry) => ({
          address: entry.address,
          order,
          command: 'OBSERVED_DEFAULT_ACL_AFTER_EXECUTION',
        })),
      )
    }
    executions.push({
      order,
      producer,
      sqlDigest: hash(producer.sql),
      producerCodeDigest: producerCodeDigests.get(producer.source)!,
    })
  }
  const finish = async (): Promise<ExecutionTrace> => {
    await client.query('RESET ROLE')
    const result = await client.query<TraceEvent>(`
      SELECT address,execution_order AS "order",command FROM ue_v2_manifest_trace.events
      ORDER BY execution_order,address,command
    `)
    await client.query(`
      DROP EVENT TRIGGER ue_v2_manifest_capture;
      DROP SCHEMA ue_v2_manifest_trace CASCADE;
    `)
    const residual = await client.query(`
      SELECT 1 FROM pg_namespace WHERE nspname='ue_v2_manifest_trace'
      UNION ALL SELECT 1 FROM pg_event_trigger WHERE evtname='ue_v2_manifest_capture'
    `)
    assert.equal(residual.rowCount, 0, 'UE_V2_TRACE_REMOVAL_REQUIRED')
    return { executions, events: [...result.rows, ...nonEventCommands], baseline }
  }
  return { hook, finish }
}
