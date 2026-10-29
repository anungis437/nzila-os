import assert from 'node:assert/strict'
import pg from 'pg'
import { hash, quote, type V2Plan } from './source'
import { compileSecurity } from './security'
import { producerBytes, type ExecutionHook, type Producer } from './manifest-trace'
import { compileAuthBootstrapSql } from './auth-sql'
import { compileAuthorityMembershipReaderSql } from '../../lib/authority/store/platform-identity'
import { canonicalRoleSqlList } from './execution-roles'
import { compileFrameworkSql } from './framework-sql'
import {
  assertMinimumInstaller,
  inspectVectorObjectIds,
  VECTOR_FUNCTION_ACL_SQL,
} from './minimum-installer'

export interface InstallerOptions {
  profile?: 'OPERATOR_REFERENCE' | 'PREPROVISIONED_NON_SUPERUSER'
}

export interface CatalogObject {
  kind: string
  id: string
  definition: unknown
}
const localClients = new WeakMap<pg.Client, string>()
export async function connectLocalV2(config: pg.ClientConfig) {
  assertLocalTarget(config)
  const client = new pg.Client(config)
  await client.connect()
  const target = await client.query<{ database: string; authenticatedUser: string }>(
    'SELECT current_database() AS database,session_user AS "authenticatedUser"',
  )
  assert.equal(target.rows[0].database, config.database, 'UE_V2_TARGET_IDENTITY_MISMATCH')
  localClients.set(client, target.rows[0].authenticatedUser)
  return client
}
export async function inspectCatalog(client: pg.Client): Promise<CatalogObject[]> {
  const queries = [
    `SELECT 'schema' kind, nspname id, jsonb_build_object('owner',pg_get_userbyid(nspowner),'acl',nspacl::text) definition FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname <> 'information_schema'`,
    `SELECT 'extension' kind, extname id, jsonb_build_object('version',extversion,'schema',extnamespace::regnamespace::text) definition FROM pg_extension`,
    `SELECT 'relation' kind, n.nspname||'.'||c.relname id, jsonb_build_object('kind',relkind,'owner',pg_get_userbyid(relowner),'rls',relrowsecurity,'force',relforcerowsecurity,'acl',relacl::text) definition FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S')`,
    `SELECT 'column' kind, n.nspname||'.'||c.relname||'.'||a.attname id, jsonb_build_object('type',format_type(a.atttypid,a.atttypmod),'notnull',attnotnull,'identity',attidentity,'generated',attgenerated,'acl',a.attacl::text,'collation',CASE WHEN attcollation=0 THEN NULL ELSE attcollation::regcollation::text END,'default',pg_get_expr(d.adbin,d.adrelid)) definition FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped AND c.relkind IN ('r','p','v','m')`,
    `SELECT 'column_default' kind,n.nspname||'.'||c.relname||'.'||a.attname id,jsonb_build_object('expression',pg_get_expr(d.adbin,d.adrelid),'generated',a.attgenerated) definition FROM pg_attrdef d JOIN pg_class c ON c.oid=d.adrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum WHERE n.nspname='public'`,
    `SELECT 'constraint' kind, conrelid::regclass::text||'.'||conname id, jsonb_build_object('type',contype,'definition',pg_get_constraintdef(oid),'validated',convalidated,'deferrable',condeferrable,'deferred',condeferred) definition FROM pg_constraint WHERE connamespace='public'::regnamespace`,
    `SELECT 'index' kind, n.nspname||'.'||c.relname id, jsonb_build_object('definition',pg_get_indexdef(c.oid),'valid',i.indisvalid,'ready',i.indisready,'live',i.indislive,'unique',i.indisunique,'nulls_not_distinct',i.indnullsnotdistinct) definition FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'`,
    `SELECT 'policy' kind, schemaname||'.'||tablename||'.'||policyname id, jsonb_build_object('permissive',permissive,'roles',roles,'command',cmd,'using',qual,'check',with_check) definition FROM pg_policies WHERE schemaname='public'`,
    `SELECT 'enum' kind, n.nspname||'.'||t.typname id, jsonb_build_object('labels',jsonb_agg(e.enumlabel ORDER BY e.enumsortorder),'owner',pg_get_userbyid(t.typowner),'acl',t.typacl::text) definition FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' GROUP BY n.nspname,t.typname,t.typowner,t.typacl::text`,
    `SELECT 'type' kind,n.nspname||'.'||t.typname id,jsonb_build_object('kind',t.typtype,'owner',pg_get_userbyid(t.typowner),'category',t.typcategory,'base',CASE WHEN t.typbasetype=0 THEN NULL ELSE format_type(t.typbasetype,t.typtypmod) END,'element',CASE WHEN t.typelem=0 THEN NULL ELSE format_type(t.typelem,NULL) END,'relation',CASE WHEN t.typrelid=0 THEN NULL ELSE t.typrelid::regclass::text END,'notnull',t.typnotnull,'default',t.typdefault,'acl',t.typacl::text,'input',t.typinput::regproc::text,'output',t.typoutput::regproc::text,'collation',CASE WHEN t.typcollation=0 THEN NULL ELSE t.typcollation::regcollation::text END) definition FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype<>'e'`,
    `SELECT 'sequence' kind,n.nspname||'.'||c.relname id,jsonb_build_object('type',format_type(s.seqtypid,NULL),'start',s.seqstart,'increment',s.seqincrement,'minimum',s.seqmin,'maximum',s.seqmax,'cache',s.seqcache,'cycle',s.seqcycle,'owned_by',(SELECT jsonb_agg(jsonb_build_object('relation',d.refobjid::regclass::text,'column',a.attname,'dependency_type',d.deptype) ORDER BY d.deptype,a.attname) FROM pg_depend d JOIN pg_attribute a ON a.attrelid=d.refobjid AND a.attnum=d.refobjsubid WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.refclassid='pg_class'::regclass AND d.deptype IN ('a','i'))) definition FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'`,
    `SELECT 'operator' kind,n.nspname||'.'||o.oprname||'('||CASE WHEN o.oprleft=0 THEN 'NONE' ELSE format_type(o.oprleft,NULL) END||','||format_type(o.oprright,NULL)||')' id,jsonb_build_object('owner',pg_get_userbyid(o.oprowner),'kind',o.oprkind,'left',CASE WHEN o.oprleft=0 THEN NULL ELSE format_type(o.oprleft,NULL) END,'right',format_type(o.oprright,NULL),'result',format_type(o.oprresult,NULL),'function',o.oprcode::regproc::text,'commutator',CASE WHEN o.oprcom=0 THEN NULL ELSE o.oprcom::regoperator::text END,'negator',CASE WHEN o.oprnegate=0 THEN NULL ELSE o.oprnegate::regoperator::text END,'hash',o.oprcanhash,'merge',o.oprcanmerge) definition FROM pg_operator o JOIN pg_namespace n ON n.oid=o.oprnamespace WHERE n.nspname='public'`,
    `SELECT 'function' kind, p.oid::regprocedure::text id, jsonb_build_object('definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(proowner),'definer',prosecdef,'config',proconfig,'acl',proacl::text) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind IN ('f','p')`,
    `SELECT 'aggregate' kind,p.oid::regprocedure::text id,jsonb_build_object('owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'kind',a.aggkind,'transition',a.aggtransfn::regproc::text,'final',a.aggfinalfn::regproc::text,'combine',a.aggcombinefn::regproc::text,'serialize',a.aggserialfn::regproc::text,'deserialize',a.aggdeserialfn::regproc::text,'transition_type',format_type(a.aggtranstype,NULL),'initial',a.agginitval,'moving_transition',a.aggmtransfn::regproc::text,'moving_inverse',a.aggminvtransfn::regproc::text,'moving_final',a.aggmfinalfn::regproc::text,'moving_type',format_type(a.aggmtranstype,NULL),'moving_initial',a.aggminitval,'final_extra',a.aggfinalextra,'final_modify',a.aggfinalmodify,'moving_final_modify',a.aggmfinalmodify,'parallel',p.proparallel) definition FROM pg_aggregate a JOIN pg_proc p ON p.oid=a.aggfnoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'`,
    `SELECT 'trigger' kind, tgrelid::regclass::text||'.'||tgname id, jsonb_build_object('definition',pg_get_triggerdef(oid),'enabled',tgenabled) definition FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace)`,
    `SELECT 'role' kind, rolname id, jsonb_build_object('superuser',rolsuper,'inherit',rolinherit,'createrole',rolcreaterole,'createdb',rolcreatedb,'login',rolcanlogin,'bypassrls',rolbypassrls) definition FROM pg_roles WHERE rolname IN (${canonicalRoleSqlList})`,
    `SELECT 'role_membership' kind,parent.rolname||':'||member.rolname id,jsonb_build_object('role',parent.rolname,'member',member.rolname,'grantor',grantor.rolname,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) definition FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid JOIN pg_roles member ON member.oid=m.member JOIN pg_roles grantor ON grantor.oid=m.grantor WHERE parent.rolname IN (${canonicalRoleSqlList}) OR member.rolname IN (${canonicalRoleSqlList})`,
    `SELECT 'default_acl' kind, pg_get_userbyid(defaclrole)||'.'||defaclnamespace::regnamespace::text||'.'||defaclobjtype::text id, to_jsonb(defaclacl::text) definition FROM pg_default_acl WHERE defaclrole='ue_v2_owner'::regrole`,
  ]
  const objects: CatalogObject[] = []
  queries.push(
    `SELECT 'operator_class' kind,n.nspname||'.'||c.opcname||' USING '||am.amname id,jsonb_build_object('owner',pg_get_userbyid(c.opcowner),'family',(pg_identify_object('pg_opfamily'::regclass,c.opcfamily,0)).identity,'input',format_type(c.opcintype,NULL),'default',c.opcdefault,'key',CASE WHEN c.opckeytype=0 THEN NULL ELSE format_type(c.opckeytype,NULL) END) definition FROM pg_opclass c JOIN pg_namespace n ON n.oid=c.opcnamespace JOIN pg_am am ON am.oid=c.opcmethod WHERE n.nspname='public'`,
    `SELECT 'operator_family' kind,n.nspname||'.'||f.opfname||' USING '||am.amname id,jsonb_build_object('owner',pg_get_userbyid(f.opfowner),'operators',(SELECT jsonb_agg(jsonb_build_object('strategy',o.amopstrategy,'purpose',o.amoppurpose,'operator',o.amopopr::regoperator::text,'left',format_type(o.amoplefttype,NULL),'right',format_type(o.amoprighttype,NULL),'sort_family',CASE WHEN o.amopsortfamily=0 THEN NULL ELSE (pg_identify_object('pg_opfamily'::regclass,o.amopsortfamily,0)).identity END) ORDER BY o.amopstrategy,o.amoppurpose,format_type(o.amoplefttype,NULL),format_type(o.amoprighttype,NULL)) FROM pg_amop o WHERE o.amopfamily=f.oid),'support',(SELECT jsonb_agg(jsonb_build_object('number',p.amprocnum,'function',p.amproc::regprocedure::text,'left',format_type(p.amproclefttype,NULL),'right',format_type(p.amprocrighttype,NULL)) ORDER BY p.amprocnum,format_type(p.amproclefttype,NULL),format_type(p.amprocrighttype,NULL)) FROM pg_amproc p WHERE p.amprocfamily=f.oid)) definition FROM pg_opfamily f JOIN pg_namespace n ON n.oid=f.opfnamespace JOIN pg_am am ON am.oid=f.opfmethod WHERE n.nspname='public'`,
    `SELECT 'cast' kind,format_type(c.castsource,NULL)||' AS '||format_type(c.casttarget,NULL) id,jsonb_build_object('function',c.castfunc::regprocedure::text,'context',c.castcontext,'method',c.castmethod) definition FROM pg_cast c WHERE c.castsource IN (SELECT oid FROM pg_type WHERE typnamespace IN ('public'::regnamespace,to_regnamespace('user_management'))) OR c.casttarget IN (SELECT oid FROM pg_type WHERE typnamespace IN ('public'::regnamespace,to_regnamespace('user_management')))`,
    `SELECT 'access_method' kind,a.amname id,jsonb_build_object('handler',a.amhandler::regproc::text,'type',a.amtype) definition FROM pg_am a JOIN pg_depend d ON d.classid='pg_am'::regclass AND d.objid=a.oid AND d.deptype='e' JOIN pg_extension e ON e.oid=d.refobjid WHERE e.extname='vector'`,
    `SELECT 'collation' kind,n.nspname||'.'||c.collname id,jsonb_build_object('owner',pg_get_userbyid(c.collowner),'provider',c.collprovider,'deterministic',c.collisdeterministic,'encoding',c.collencoding,'collate',c.collcollate,'ctype',c.collctype,'icu_locale',c.colliculocale,'version',c.collversion) definition FROM pg_collation c JOIN pg_namespace n ON n.oid=c.collnamespace WHERE n.nspname='public'`,
    `SELECT 'range' kind,n.nspname||'.'||t.typname id,jsonb_build_object('subtype',format_type(r.rngsubtype,NULL),'multirange',format_type(r.rngmultitypid,NULL),'collation',CASE WHEN r.rngcollation=0 THEN NULL ELSE r.rngcollation::regcollation::text END,'operator_class',(pg_identify_object('pg_opclass'::regclass,r.rngsubopc,0)).identity,'canonical',r.rngcanonical::regprocedure::text,'difference',r.rngsubdiff::regprocedure::text) definition FROM pg_range r JOIN pg_type t ON t.oid=r.rngtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public'`,
  )
  for (const sql of queries) {
    const scopedSql = sql
      .replaceAll(
        'conrelid::regclass::text',
        '(CASE WHEN conrelid=0 THEN contypid::regtype::text ELSE conrelid::regclass::text END)',
      )
      .replaceAll("n.nspname='public'", "n.nspname IN ('public','user_management')")
      .replaceAll("schemaname='public'", "schemaname IN ('public','user_management')")
      .replaceAll(
        "connamespace='public'::regnamespace",
        "connamespace IN ('public'::regnamespace,to_regnamespace('user_management'))",
      )
      .replaceAll(
        "relnamespace='public'::regnamespace",
        "relnamespace IN ('public'::regnamespace,to_regnamespace('user_management'))",
      )
    const result = await client.query<CatalogObject>(scopedSql)
    objects.push(...result.rows)
  }
  return objects.sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`))
}
export interface NativeDependency {
  objectType: string
  objectIdentity: string
  referencedType: string
  referencedIdentity: string
  dependencyType: string
}
export async function inspectNativeDependencies(client: pg.Client): Promise<NativeDependency[]> {
  const result = await client.query<NativeDependency>(`
    SELECT obj.type AS "objectType",obj.identity AS "objectIdentity",
      target.type AS "referencedType",target.identity AS "referencedIdentity",
      d.deptype AS "dependencyType"
    FROM pg_depend d
    CROSS JOIN LATERAL pg_identify_object(d.classid,d.objid,d.objsubid) obj
    CROSS JOIN LATERAL pg_identify_object(d.refclassid,d.refobjid,d.refobjsubid) target
    WHERE obj.schema IN ('public','user_management')
    ORDER BY obj.type,obj.identity,target.type,target.identity,d.deptype
  `)
  return result.rows
}
export const catalogDigest = (objects: CatalogObject[]) => hash(JSON.stringify(objects))
export const canonicalType = (type: string) =>
  type.replace(/^varchar/, 'character varying').replace(/\s*,\s*/g, ',')

export function assertLocalTarget(config: pg.ClientConfig) {
  if (
    !['127.0.0.1', 'localhost'].includes(config.host ?? '') ||
    !/^ue_v2_clean_[a-z0-9_]+$/.test(String(config.database)) ||
    config.connectionString ||
    String(config.database).length > 63 ||
    !Number.isInteger(config.port) ||
    Number(config.port) < 1024 ||
    Number(config.port) > 65535
  )
    throw new Error('UE_V2_EPHEMERAL_LOCAL_TARGET_REQUIRED')
}

export async function createCurrentState(
  client: pg.Client,
  plan: V2Plan,
  hook?: ExecutionHook,
  options: InstallerOptions = {},
) {
  if (!localClients.has(client)) throw new Error('UE_V2_LOCAL_CLIENT_REQUIRED')
  if (options.profile === 'PREPROVISIONED_NON_SUPERUSER') {
    if (localClients.get(client) !== 'ue_v2_fixture_installer')
      throw new Error('UE_V2_GENUINE_RESTRICTED_INSTALLER_LOGIN_REQUIRED')
    await assertMinimumInstaller(client)
  }
  const execute = async (producer: Producer) => {
    if (hook) await hook(producer, () => client.query(producer.sql))
    else await client.query(producer.sql)
  }
  const installerProducer = (canonicalId: string, sql: string): Producer => ({
    canonicalId,
    sql,
    source: 'apps/union-eyes/scripts/bootstrap-v2/installer.ts',
    sourceDigest: producerBytes('apps/union-eyes/scripts/bootstrap-v2/installer.ts'),
  })
  const extensions = plan.statements.filter((statement) =>
    statement.canonicalId.startsWith('CURRENT_EXTENSION:'),
  )
  for (const extension of extensions) {
    if (
      extension.canonicalId !== 'CURRENT_EXTENSION:vector' ||
      extension.sql !== "CREATE EXTENSION vector WITH VERSION '0.8.1';"
    )
      throw new Error('UE_V2_UNAPPROVED_EXTENSION_PROVISIONING')
    if (options.profile === 'PREPROVISIONED_NON_SUPERUSER') continue
    await execute(extension)
    await execute(installerProducer('EXTENSION_FUNCTION_ACL', VECTOR_FUNCTION_ACL_SQL))
  }
  await client.query('SET LOCAL ROLE ue_v2_owner')
  await client.query('SET LOCAL search_path = public, pg_catalog')
  const deferred: typeof plan.statements = []
  for (const statement of plan.statements) {
    if (statement.canonicalId.startsWith('CURRENT_EXTENSION:')) continue
    if (/^ALTER TABLE.*ADD CONSTRAINT.*FOREIGN KEY/s.test(statement.sql)) deferred.push(statement)
    else await execute(statement)
  }
  for (const statement of deferred) await execute(statement)
  if (plan.authExecution) {
    if (options.profile !== 'PREPROVISIONED_NON_SUPERUSER') await client.query('RESET ROLE')
    await execute({
      canonicalId: 'CANONICAL_AUTH_EXECUTION',
      // The kernel's membership reader is part of the auth-owned execution surface: under this topology the runtime role has no
      // grant on the identity relations, so the kernel can only read membership through it.
      sql: [
        compileAuthBootstrapSql({ rolesPreprovisioned: options.profile === 'PREPROVISIONED_NON_SUPERUSER' }),
        compileAuthorityMembershipReaderSql(),
      ].join('\n'),
      source: plan.authExecution.compilerSource,
      sourceDigest: producerBytes(plan.authExecution.compilerSource),
    })
    await client.query('SET LOCAL ROLE ue_v2_owner')
  }
  if (plan.frameworkExecution) {
    if (options.profile !== 'PREPROVISIONED_NON_SUPERUSER') await client.query('RESET ROLE')
    await execute({
      canonicalId: 'CANONICAL_FRAMEWORK_EXECUTION',
      sql: compileFrameworkSql(plan, {
        rolesPreprovisioned: options.profile === 'PREPROVISIONED_NON_SUPERUSER',
      }),
      source: plan.frameworkExecution.compilerSource,
      sourceDigest: producerBytes(plan.frameworkExecution.compilerSource),
    })
    await client.query('SET LOCAL ROLE ue_v2_owner')
  }
  const security = compileSecurity(plan)
  for (const [index, sql] of security.statements.entries())
    await execute({
      canonicalId: `SECURITY_STATEMENT:${index}`,
      sql,
      source: 'apps/union-eyes/scripts/bootstrap-v2/security.ts',
      sourceDigest: producerBytes('apps/union-eyes/scripts/bootstrap-v2/security.ts'),
    })
  await execute(
    installerProducer(
      'BOOTSTRAP_RECEIPT',
      'CREATE TABLE public.ue_v2_bootstrap_receipt (singleton boolean PRIMARY KEY CHECK(singleton), contract_version text NOT NULL, source_digest text NOT NULL, catalog_digest text NOT NULL)',
    ),
  )
  await execute(
    installerProducer(
      'BOOTSTRAP_RECEIPT_ACL',
      'REVOKE ALL ON TABLE public.ue_v2_bootstrap_receipt FROM PUBLIC, union_eyes_runtime, union_eyes_system',
    ),
  )
  return security
}

export async function applyV2(
  client: pg.Client,
  plan: V2Plan,
  expected: CatalogObject[],
  fault?: 'verify' | 'receipt' | 'commit',
  options: InstallerOptions = {},
) {
  if (!localClients.has(client)) throw new Error('UE_V2_LOCAL_CLIENT_REQUIRED')
  const sourceDigest = hash(JSON.stringify(plan))
  await client.query('BEGIN')
  try {
    if (options.profile === 'PREPROVISIONED_NON_SUPERUSER') {
      if (localClients.get(client) !== 'ue_v2_fixture_installer')
        throw new Error('UE_V2_GENUINE_RESTRICTED_INSTALLER_LOGIN_REQUIRED')
      await assertMinimumInstaller(client)
      await client.query('SET LOCAL ROLE ue_v2_owner')
    }
    await client.query("SELECT pg_advisory_xact_lock(hashtext('UE_BOOTSTRAP_V2'))")
    const current = await inspectCatalog(client)
    const relations = current.filter((object) => object.kind === 'relation')
    if (relations.length) {
      if (catalogDigest(current) !== catalogDigest(expected))
        throw new Error('UE_V2_PRESENT_DRIFTED_OR_PARTIAL_DENIED')
      const receipt = await client.query<{
        contract_version: string
        source_digest: string
        catalog_digest: string
      }>(
        'SELECT contract_version,source_digest,catalog_digest FROM public.ue_v2_bootstrap_receipt WHERE singleton=true',
      )
      if (
        receipt.rows.length !== 1 ||
        receipt.rows[0].contract_version !== '2.0' ||
        receipt.rows[0].source_digest !== sourceDigest ||
        receipt.rows[0].catalog_digest !== catalogDigest(expected)
      )
        throw new Error('UE_V2_AUTHENTICATED_RECEIPT_REQUIRED')
      await client.query('COMMIT')
      return { result: 'NOOP', created: 0, catalogDigest: catalogDigest(current) }
    }
    const vectorIds =
      options.profile === 'PREPROVISIONED_NON_SUPERUSER'
        ? await inspectVectorObjectIds(client)
        : new Set<string>()
    const expectedById = new Map(expected.map((object) => [`${object.kind}:${object.id}`, object]))
    const nonBaseline = current.filter(
      (object) =>
        !['schema', 'extension', 'role', 'role_membership', 'default_acl'].includes(object.kind) &&
        !(
          vectorIds.has(`${object.kind}:${object.id}`) &&
          JSON.stringify(object) === JSON.stringify(expectedById.get(`${object.kind}:${object.id}`))
        ),
    )
    const clusterObjects = (objects: CatalogObject[]) =>
      objects.filter((object) => ['role', 'role_membership'].includes(object.kind))
    if (catalogDigest(clusterObjects(current)) !== catalogDigest(clusterObjects(expected)))
      throw new Error('UE_V2_CLUSTER_PREREQUISITE_DRIFT_DENIED')
    if (
      nonBaseline.length ||
      current.some(
        (object) =>
          object.kind === 'extension' &&
          object.id !== 'plpgsql' &&
          !(options.profile === 'PREPROVISIONED_NON_SUPERUSER' && object.id === 'vector'),
      )
    )
      throw new Error('UE_V2_PARTIAL_PREINSTALL_DENIED')
    await createCurrentState(client, plan, undefined, options)
    const after = await inspectCatalog(client)
    if (fault === 'verify' || catalogDigest(after) !== catalogDigest(expected))
      throw new Error('UE_V2_POSTCONDITION_DENIED')
    if (fault === 'receipt') throw new Error('UE_V2_RECEIPT_FAILURE')
    await client.query('INSERT INTO public.ue_v2_bootstrap_receipt VALUES(true,$1,$2,$3)', [
      '2.0',
      sourceDigest,
      catalogDigest(after),
    ])
    if (fault === 'commit')
      await client.query(
        'CREATE TEMP TABLE ue_v2_commit_parent(id integer PRIMARY KEY); CREATE TEMP TABLE ue_v2_commit_child(parent_id integer REFERENCES ue_v2_commit_parent(id) DEFERRABLE INITIALLY DEFERRED); INSERT INTO ue_v2_commit_child VALUES (1)',
      )
    await client.query('COMMIT')
    return { result: 'CREATED', created: after.length, catalogDigest: catalogDigest(after) }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

export async function verifyCurrentModels(client: pg.Client, plan: V2Plan) {
  const mismatches: { table: string; column: string; expected: unknown; actual: unknown }[] = []
  const columns = await client.query<{
    table: string
    column: string
    type: string
    notnull: boolean
  }>(`
    SELECT c.relname AS table,a.attname AS column,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS notnull
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='public'::regnamespace AND a.attnum>0 AND NOT a.attisdropped
  `)
  for (const model of plan.currentModels.models) {
    for (const column of model.columns) {
      const actual = columns.rows.find(
        (row) => row.table === model.table && row.column === column.name,
      )
      if (
        !actual ||
        actual.notnull !== column.notNull ||
        actual.type !== canonicalType(column.type)
      )
        mismatches.push({ table: model.table, column: column.name, expected: column, actual })
    }
    await client.query(
      `SELECT ${model.columns.map((column) => quote(column.name)).join(',')} FROM public.${quote(model.table)} LIMIT 0`,
    )
  }
  assert.equal(
    mismatches.length,
    0,
    `UE_V2_CURRENT_MODEL_MISMATCH:${JSON.stringify(mismatches.slice(0, 10))}`,
  )
  return {
    result: 'PASS',
    modelTables: plan.currentModels.models.length,
    checkedColumns: plan.currentModels.models.reduce(
      (count, model) => count + model.columns.length,
      0,
    ),
  }
}
