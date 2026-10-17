import { execFileSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import pg from 'pg'
import { format } from 'prettier'
import { buildPlan, folder, hash, quote, root } from './source'
import {
  applyV2,
  catalogDigest,
  connectLocalV2,
  createCurrentState,
  inspectCatalog,
  inspectNativeDependencies,
  verifyCurrentModels,
} from './installer'
import { compileSecurity } from './security'
import { proveRuntimeSecurity } from './runtime-security'
import { openNativeRuntimeFixture } from './native-runtime-fixture'
import { systemMutationContracts } from './system-mutation-contracts'
import { beginManifestTrace } from './manifest-trace'
import { buildNativeManifest, renderManifestMarkdown, verifyDeclaredSource } from './manifest'
import { bindApplicationStartupSources, qualifyApplicationStartup } from './manifest-application'
import { AUTH_EXECUTION_ROLES } from './auth-sql'
import { proveAuthExecutionBoundary } from './auth-runtime'
import { proveFrameworkBoundary } from './framework-runtime'
import { FRAMEWORK_ROLES } from './framework-contract'
import { proveFrameworkApplication } from './framework-application'
import { qualifyNativePrivileges } from './manifest-security'
import {
  compileMinimumRoleProvisioningSql,
  INSTALLER_FUNCTION_OWNER_ROLES,
  VECTOR_FUNCTION_ACL_SQL,
} from './minimum-installer'

const image =
  'pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337'
const docker = (args: string[], env?: NodeJS.ProcessEnv) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    env: env ?? process.env,
    timeout: 120000,
  }).trim()
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
export const qualificationExitCode = (evidence: Record<string, unknown>): 0 | 1 =>
  evidence.engineeringReadiness === 'PASS' ? 0 : 1
async function emit(file: string, value: unknown) {
  mkdirSync(folder, { recursive: true })
  writeFileSync(path.join(folder, file), await format(JSON.stringify(value), { parser: 'json' }))
}

export async function proveIntegratedSystemMutations(plan: Awaited<ReturnType<typeof buildPlan>>) {
  for (const file of [
    'apps/union-eyes/scripts/bootstrap-v2/clean-room.ts',
    'apps/union-eyes/scripts/bootstrap-v2/runtime-security.ts',
    'apps/union-eyes/scripts/bootstrap-v2/native-runtime-fixture.ts',
    'apps/union-eyes/scripts/bootstrap-v2/system-mutation-contracts.ts',
    'apps/union-eyes/scripts/bootstrap-v2/fee-adjustment-native-proof.ts',
  ])
    assert.equal(
      plan.sourceCommitments[file],
      hash(readFileSync(path.join(root, ...file.split('/')), 'utf8')),
      `UE_V2_SYSTEM_PRODUCER_SOURCE_NOT_BOUND:${file}`,
    )
  const contracts = systemMutationContracts(plan)
  const fixture = await openNativeRuntimeFixture(plan)
  let proofFailed = false
  let proofError: unknown
  try {
    return await proveRuntimeSecurity(
      fixture.seed,
      fixture.runtime,
      fixture.system,
      plan,
      compileSecurity(plan).rules,
      undefined,
      contracts,
      fixture.systemWriter,
    )
  } catch (error) {
    proofFailed = true
    proofError = error
    throw error
  } finally {
    try {
      await fixture.dispose()
    } catch (error) {
      if (proofFailed)
        throw new AggregateError(
          [proofError, error],
          'SYSTEM component qualification and fixture cleanup both failed',
          { cause: proofError },
        )
      throw error
    }
  }
}

export async function runCleanRoom(planOverride?: Awaited<ReturnType<typeof buildPlan>>) {
  const wheelhouse = process.env.UE_V2_WHEELHOUSE
  if (!wheelhouse && !planOverride) throw new Error('UE_V2_WHEELHOUSE_REQUIRED')
  const plan = bindApplicationStartupSources(planOverride ?? (await buildPlan(wheelhouse!)))
  const security = compileSecurity(plan)
  const name = `ue-v2-clean-${randomUUID()}`
  const password = randomBytes(24).toString('hex')
  const evidence: Record<string, unknown> = {
    architecture: 'CANONICAL_CURRENT_STATE_V2',
    contractVersion: '2.0',
    lineage: 'PROSPECTIVE_UE_BOOTSTRAP_V2',
    image,
    sourcePlanDigest: hash(JSON.stringify(plan)),
    historicalMigrationReplay: false,
    mergeAuthorized: false,
    deployAuthorized: false,
    syntheticOnly: true,
    productionOrStagingConnections: 0,
  }
  let containerId: string | null = null
  let admin: pg.Client | null = null
  const clients: pg.Client[] = []
  let failure: unknown
  try {
    try {
      const startup = qualifyApplicationStartup(plan, wheelhouse)
      evidence.currentBackendStartup = startup
      if ('sourceDigests' in startup)
        for (const [file, digest] of Object.entries(startup.sourceDigests))
          assert.equal(
            plan.sourceCommitments[file],
            digest,
            `UE_V2_CURRENT_STARTUP_SOURCE_NOT_BOUND:${file}`,
          )
    } catch (error) {
      evidence.currentBackendStartup = {
        startup: 'FAIL',
        runtimeDatabaseQualification: 'NOT_PROVEN',
        error: error instanceof Error ? error.message : String(error),
      }
      throw error
    }
    evidence.sourcePlanDigest = hash(JSON.stringify(plan))
    await emit('UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json', plan)
    containerId = docker(
      [
        'run',
        '-d',
        '--pull',
        'never',
        '--name',
        name,
        '--label',
        'nzila.mission=UE_BOOTSTRAP_V2_CLEANROOM',
        '--memory',
        '1g',
        '--cpus',
        '2',
        '--tmpfs',
        '/var/lib/postgresql/data:rw,size=768m',
        '-p',
        '127.0.0.1::5432',
        '-e',
        'POSTGRES_PASSWORD',
        image,
      ],
      { ...process.env, POSTGRES_PASSWORD: password },
    )
    const binding = JSON.parse(
      docker(['inspect', '--format', '{{json .NetworkSettings.Ports}}', containerId]),
    )
    const port = Number(binding['5432/tcp'][0].HostPort)
    const config = { host: '127.0.0.1', port, user: 'postgres', password }
    let ready = false
    for (let attempt = 0; attempt < 40; attempt++) {
      const probe = new pg.Client({
        ...config,
        database: 'postgres',
        connectionTimeoutMillis: 1000,
      })
      try {
        await probe.connect()
        await probe.query('SELECT 1')
        admin = probe
        ready = true
        break
      } catch (error: unknown) {
        await probe.end()
        if (attempt === 39) throw error
        await delay(250)
      }
    }
    assert(ready && admin, 'UE_V2_CLEANROOM_NOT_RESPONSIVE')
    const roleSql = compileMinimumRoleProvisioningSql()
    await admin.query(roleSql)
    const database = async (suffix: string) => {
      const db = `ue_v2_clean_${suffix}`
      await admin!.query(`CREATE DATABASE ${quote(db)} OWNER ue_v2_owner`)
      const client = await connectLocalV2({ ...config, database: db })
      clients.push(client)
      return client
    }
    const reference = await database('reference')
    await reference.query('BEGIN')
    const tracer = await beginManifestTrace(reference)
    await createCurrentState(reference, plan, tracer.hook)
    const trace = await tracer.finish()
    await reference.query('COMMIT')
    const expected = await inspectCatalog(reference)
    const nativeDependencies = await inspectNativeDependencies(reference)
    evidence.currentSchemaObjectCount = expected.length
    evidence.currentModelCompatibility = await verifyCurrentModels(reference, plan)
    evidence.sourceSecurityBlockers = security.blockers
    const manifest = await buildNativeManifest(reference, plan, expected, trace, { image, roleSql })
    writeFileSync(
      path.join(folder, 'UE_CANONICAL_SCHEMA_V2.json'),
      JSON.stringify({ ...manifest, nativeDependencies }, null, 2) + '\n',
    )
    writeFileSync(path.join(folder, 'UE_CANONICAL_SCHEMA_V2.md'), renderManifestMarkdown(manifest))
    evidence.nativeManifestQualification = {
      status: manifest.status,
      blockers: manifest.blockers,
      independentSource: manifest.qualification,
      measuredExecutions: trace.executions.length,
      instrumentationRemovedBeforeCatalogInspection: true,
    }
    const fresh = await database('fresh')
    evidence.freshBootstrap = await applyV2(fresh, plan, expected)
    evidence.freshDeclaredSource = await verifyDeclaredSource(fresh, plan)
    evidence.secondRunNoop = await applyV2(fresh, plan, expected)
    await fresh.query(
      'ALTER TABLE public.organization_members ADD COLUMN ue_v2_injected_drift text',
    )
    await assert.rejects(applyV2(fresh, plan, expected), /UE_V2_PRESENT_DRIFTED_OR_PARTIAL_DENIED/)
    evidence.driftDenial = 'PASS'
    const partial = await database('partial')
    await partial.query('CREATE TABLE public.partial_state(id integer)')
    const partialBefore = catalogDigest(await inspectCatalog(partial))
    await assert.rejects(
      applyV2(partial, plan, expected),
      /UE_V2_PRESENT_DRIFTED_OR_PARTIAL_DENIED/,
    )
    assert.equal(catalogDigest(await inspectCatalog(partial)), partialBefore)
    evidence.partialStateDenial = 'PASS'
    const rollbacks: Record<string, string> = {}
    for (const fault of ['verify', 'receipt', 'commit'] as const) {
      const client = await database(`rollback_${fault}`)
      const before = catalogDigest(await inspectCatalog(client))
      await assert.rejects(applyV2(client, plan, expected, fault))
      assert.equal(catalogDigest(await inspectCatalog(client)), before)
      rollbacks[fault] = 'PASS'
    }
    evidence.rollback = rollbacks
    const recreated = await database('recreated')
    await applyV2(recreated, plan, expected)
    const firstCatalog = catalogDigest(await inspectCatalog(recreated))
    await recreated.end()
    clients.splice(clients.indexOf(recreated), 1)
    await admin.query('DROP DATABASE ue_v2_clean_recreated')
    const recreatedAgain = await database('recreated')
    evidence.recreate = await applyV2(recreatedAgain, plan, expected)
    assert.equal(catalogDigest(await inspectCatalog(recreatedAgain)), firstCatalog)
    assert.equal(firstCatalog, catalogDigest(expected))
    evidence.destroyRecreate = {
      databaseDropped: true,
      sameSourcePlan: true,
      sameNativeCatalog: true,
    }
    evidence.determinism = 'PASS'
    const delegationDriftDenials: string[] = []
    for (const [name, sql] of [
      ['missingOwner', `REVOKE ${quote(INSTALLER_FUNCTION_OWNER_ROLES[0])} FROM ue_v2_owner`],
      [
        'administrativeOwner',
        `GRANT ${quote(INSTALLER_FUNCTION_OWNER_ROLES[0])} TO ue_v2_owner WITH ADMIN TRUE`,
      ],
      ['extraExecutionPrincipal', 'GRANT union_eyes_runtime TO ue_v2_owner'],
    ]) {
      await reference.query('BEGIN')
      try {
        await reference.query(sql)
        const inspection = await qualifyNativePrivileges(reference, plan)
        assert(
          inspection.mismatches.includes('INSTALLER_FUNCTION_OWNER_DELEGATION_DRIFT'),
          `UE_V2_INSTALLER_DELEGATION_INJECTION_NOT_REJECTED:${name}`,
        )
        delegationDriftDenials.push(name)
      } finally {
        await reference.query('ROLLBACK')
      }
    }
    assert.equal(catalogDigest(await inspectCatalog(reference)), catalogDigest(expected))
    await admin.query(
      `CREATE ROLE ue_v2_fixture_installer LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${password}';
       GRANT ue_v2_owner TO ue_v2_fixture_installer WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;`,
    )
    const minimumExpected = await inspectCatalog(reference)
    const minimumDatabase = async (suffix: string) => {
      const operator = await database(`minimum_${suffix}`)
      await operator.query("CREATE EXTENSION vector WITH VERSION '0.8.1'")
      await operator.query(VECTOR_FUNCTION_ACL_SQL)
      const installer = await connectLocalV2({
        ...config,
        user: 'ue_v2_fixture_installer',
        database: `ue_v2_clean_minimum_${suffix}`,
      })
      clients.push(installer)
      return { operator, installer }
    }
    const minimumOptions = { profile: 'PREPROVISIONED_NON_SUPERUSER' } as const
    const minimum = await minimumDatabase('fresh')
    const installerIdentity = await minimum.installer.query<{
      session_user: string
      current_user: string
      superuser: boolean
      bypassrls: boolean
      createrole: boolean
      createdb: boolean
    }>(`SELECT session_user,current_user,rolsuper AS superuser,rolbypassrls AS bypassrls,
      rolcreaterole AS createrole,rolcreatedb AS createdb FROM pg_roles WHERE rolname=session_user`)
    assert.equal(installerIdentity.rows[0].session_user, 'ue_v2_fixture_installer')
    assert.equal(installerIdentity.rows[0].current_user, 'ue_v2_fixture_installer')
    for (const flag of ['superuser', 'bypassrls', 'createrole', 'createdb'] as const)
      assert.equal(installerIdentity.rows[0][flag], false)
    const privilegeDenials: string[] = []
    for (const [name, sql] of [
      ['createRole', 'CREATE ROLE ue_v2_forbidden_installer_role'],
      ['createDatabase', 'CREATE DATABASE ue_v2_clean_forbidden_installer'],
      ['setSuperuserRole', 'SET ROLE postgres'],
      ['bypassRls', 'ALTER ROLE ue_v2_fixture_installer BYPASSRLS'],
    ]) {
      await assert.rejects(minimum.installer.query(sql), { code: '42501' })
      privilegeDenials.push(name)
    }
    const minimumFresh = await applyV2(
      minimum.installer,
      plan,
      minimumExpected,
      undefined,
      minimumOptions,
    )
    const minimumNoop = await applyV2(
      minimum.installer,
      plan,
      minimumExpected,
      undefined,
      minimumOptions,
    )
    await minimum.operator.query(
      'ALTER TABLE public.organization_members ADD COLUMN ue_v2_injected_drift text',
    )
    await assert.rejects(
      applyV2(minimum.installer, plan, minimumExpected, undefined, minimumOptions),
      /UE_V2_PRESENT_DRIFTED_OR_PARTIAL_DENIED/,
    )
    const minimumPartial = await minimumDatabase('partial')
    await minimumPartial.operator.query('CREATE TABLE public.partial_state(id integer)')
    const minimumPartialBefore = catalogDigest(await inspectCatalog(minimumPartial.operator))
    await assert.rejects(
      applyV2(minimumPartial.installer, plan, minimumExpected, undefined, minimumOptions),
      /UE_V2_PRESENT_DRIFTED_OR_PARTIAL_DENIED/,
    )
    assert.equal(catalogDigest(await inspectCatalog(minimumPartial.operator)), minimumPartialBefore)
    const minimumRollbacks: Record<string, string> = {}
    for (const fault of ['verify', 'receipt', 'commit'] as const) {
      const target = await minimumDatabase(`rollback_${fault}`)
      const before = catalogDigest(await inspectCatalog(target.operator))
      await assert.rejects(
        applyV2(target.installer, plan, minimumExpected, fault, minimumOptions),
        fault === 'commit'
          ? { code: '23503' }
          : new RegExp(fault === 'verify' ? 'UE_V2_POSTCONDITION_DENIED' : 'UE_V2_RECEIPT_FAILURE'),
      )
      assert.equal(catalogDigest(await inspectCatalog(target.operator)), before)
      minimumRollbacks[fault] = 'PASS'
    }
    const minimumRecreated = await minimumDatabase('recreated')
    await applyV2(minimumRecreated.installer, plan, minimumExpected, undefined, minimumOptions)
    const minimumFirstCatalog = catalogDigest(await inspectCatalog(minimumRecreated.operator))
    for (const client of [minimumRecreated.installer, minimumRecreated.operator]) {
      await client.end()
      clients.splice(clients.indexOf(client), 1)
    }
    await admin.query('DROP DATABASE ue_v2_clean_minimum_recreated')
    const minimumRecreatedAgain = await minimumDatabase('recreated')
    await applyV2(minimumRecreatedAgain.installer, plan, minimumExpected, undefined, minimumOptions)
    assert.equal(
      catalogDigest(await inspectCatalog(minimumRecreatedAgain.operator)),
      minimumFirstCatalog,
    )
    assert.equal(minimumFirstCatalog, catalogDigest(minimumExpected))
    evidence.minimumInstaller = {
      result: 'PASS',
      profile: minimumOptions.profile,
      authenticatedLogin: installerIdentity.rows[0],
      operatorPreparedPrerequisites: {
        rolesAndExactMemberships: true,
        databaseOwner: 'ue_v2_owner',
        extension: 'vector@0.8.1',
        extensionFunctionAcls: true,
        installerFunctionOwnerDelegations: INSTALLER_FUNCTION_OWNER_ROLES,
        installerDelegationAdminOption: false,
      },
      privilegeDenials,
      independentDelegationDriftDenials: delegationDriftDenials,
      freshBootstrap: minimumFresh,
      secondRunNoop: minimumNoop,
      driftDenial: 'PASS',
      partialStateDenial: 'PASS',
      rollback: minimumRollbacks,
      destroyRecreateDeterminism: 'PASS',
      sameNativeCatalogAsOperatorReference: true,
      qualificationOnlyLoginMembershipObjects: 1,
      applicationRuntimeUsesInstallerOwner: false,
    }
    evidence.roleGrantSecurity = await roleProof(reference)
    evidence.applicationRequiredContract = await applicationProof(reference)
    await admin.query(
      `CREATE ROLE ue_v2_fixture_actor LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${password}'; CREATE ROLE ue_v2_fixture_system LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${password}'; GRANT union_eyes_runtime TO ue_v2_fixture_actor; GRANT union_eyes_system TO ue_v2_fixture_system`,
    )
    const runtimeActor = await connectLocalV2({
      ...config,
      user: 'ue_v2_fixture_actor',
      database: 'ue_v2_clean_reference',
    })
    const systemActor = await connectLocalV2({
      ...config,
      user: 'ue_v2_fixture_system',
      database: 'ue_v2_clean_reference',
    })
    clients.push(runtimeActor, systemActor)
    if (plan.authExecution) {
      await admin.query(`
        CREATE ROLE ue_v2_fixture_auth_ordinary LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${password}';
        CREATE ROLE ue_v2_fixture_auth_legacy LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${password}';
        CREATE ROLE ue_v2_fixture_auth LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${password}';
        CREATE ROLE ue_v2_fixture_auth_system LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${password}';
        GRANT union_eyes_runtime TO ue_v2_fixture_auth_ordinary;
        GRANT union_eyes_system TO ue_v2_fixture_auth_legacy;
        GRANT ${quote(AUTH_EXECUTION_ROLES.gateway)} TO ue_v2_fixture_auth;
        GRANT ${quote(AUTH_EXECUTION_ROLES.systemGateway)} TO ue_v2_fixture_auth_system;
      `)
      const authClient = async (user: string) => {
        const client = await connectLocalV2({ ...config, user, database: 'ue_v2_clean_reference' })
        clients.push(client)
        return client
      }
      const ordinary = await authClient('ue_v2_fixture_auth_ordinary')
      const legacySystem = await authClient('ue_v2_fixture_auth_legacy')
      const auth = await authClient('ue_v2_fixture_auth')
      const authSystem = await authClient('ue_v2_fixture_auth_system')
      const beforeAuth = catalogDigest(await inspectCatalog(reference))
      evidence.authExecutionBoundary = await proveAuthExecutionBoundary({
        owner: reference,
        ordinary,
        legacySystem,
        auth,
        authSystem,
      })
      assert.equal(
        catalogDigest(await inspectCatalog(reference)),
        beforeAuth,
        'UE_V2_AUTH_PROOF_CATALOG_RESIDUE',
      )
    }
    const frameworkProof = plan.frameworkExecution
      ? await (async () => {
          await admin!.query(`
            CREATE ROLE ue_v2_fixture_framework_request LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${password}';
            CREATE ROLE ue_v2_fixture_framework_worker LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${password}';
            GRANT ${quote(FRAMEWORK_ROLES.gateway)} TO ue_v2_fixture_framework_request WITH INHERIT FALSE, SET TRUE;
            GRANT ${quote(FRAMEWORK_ROLES.workerGateway)} TO ue_v2_fixture_framework_worker WITH INHERIT FALSE, SET TRUE;
          `)
          const request = await connectLocalV2({
            ...config,
            user: 'ue_v2_fixture_framework_request',
            database: 'ue_v2_clean_reference',
          })
          const worker = await connectLocalV2({
            ...config,
            user: 'ue_v2_fixture_framework_worker',
            database: 'ue_v2_clean_reference',
          })
          clients.push(request, worker)
          const beforeFramework = catalogDigest(await inspectCatalog(reference))
          const proof = await proveFrameworkBoundary(
            {
              owner: reference,
              ordinary: runtimeActor,
              legacySystem: systemActor,
              request,
              worker,
            },
            plan,
            () => {
              if (!containerId || !wheelhouse)
                throw new Error('UE_V2_FRAMEWORK_APPLICATION_LOCAL_TARGET_REQUIRED')
              const proof = proveFrameworkApplication({
                containerId,
                wheelhouse,
                database: 'ue_v2_clean_reference',
                password,
                users: {
                  runtime: 'ue_v2_fixture_actor',
                  auth: 'ue_v2_fixture_auth',
                  request: 'ue_v2_fixture_framework_request',
                  worker: 'ue_v2_fixture_framework_worker',
                },
              })
              for (const [file, digest] of Object.entries(proof.sourceDigests))
                assert.equal(
                  plan.sourceCommitments[file],
                  digest,
                  `UE_V2_FRAMEWORK_APPLICATION_SOURCE_NOT_BOUND:${file}`,
                )
              return proof
            },
          )
          assert.equal(
            catalogDigest(await inspectCatalog(reference)),
            beforeFramework,
            'UE_V2_FRAMEWORK_PROOF_CATALOG_RESIDUE',
          )
          return proof
        })()
      : undefined
    evidence.frameworkExecutionBoundary = frameworkProof ?? { result: 'NOT_CONFIGURED' }
    evidence.runtimeSecurityComponentMatrix = await proveRuntimeSecurity(
      reference,
      runtimeActor,
      systemActor,
      plan,
      security.rules,
      frameworkProof,
    )
    evidence.systemMutationComponentMatrix = await proveIntegratedSystemMutations(plan)
    evidence.systemMutationFixtureRemoved = true
    evidence.rlsRuntime = 'FAIL_FULL_CURRENT_TABLE_AND_ACTOR_QUALIFICATION_NOT_PROVEN'
    evidence.tenantIsolation = 'FAIL_FULL_CURRENT_TABLE_AND_ACTOR_QUALIFICATION_NOT_PROVEN'
    evidence.engineeringReadiness = 'FAIL'
    evidence.productionSecurityReadiness = 'FAIL'
    evidence.externalGates = []
  } catch (error: unknown) {
    failure = error
    evidence.failure = error instanceof Error ? error.message : String(error)
    evidence.engineeringReadiness = 'FAIL'
    evidence.productionSecurityReadiness = 'FAIL'
  } finally {
    for (const client of clients) await client.end()
    if (admin) await admin.end()
    if (containerId) {
      const label = docker([
        'inspect',
        '--format',
        '{{index .Config.Labels "nzila.mission"}}',
        containerId,
      ])
      assert.equal(label, 'UE_BOOTSTRAP_V2_CLEANROOM')
      docker(['rm', '-f', containerId])
      evidence.cleanRoomContainerRemoved = true
    }
    await emit('UE_BOOTSTRAP_V2_RUNTIME_EVIDENCE.json', evidence)
  }
  if (failure) throw failure
  process.stdout.write(
    `${JSON.stringify({
      currentSchemaObjectCount: evidence.currentSchemaObjectCount,
      freshBootstrap: evidence.freshBootstrap,
      secondRunNoop: evidence.secondRunNoop,
      engineeringReadiness: evidence.engineeringReadiness,
      productionSecurityReadiness: evidence.productionSecurityReadiness,
      evidence: 'UE_BOOTSTRAP_V2_RUNTIME_EVIDENCE.json',
    })}\n`,
  )
  return evidence
}

async function roleProof(client: pg.Client) {
  const roles = await client.query<{
    rolname: string
    rolsuper: boolean
    rolbypassrls: boolean
    rolcreaterole: boolean
    rolcreatedb: boolean
  }>(
    "SELECT rolname,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname IN ('ue_v2_owner','union_eyes_runtime','union_eyes_system')",
  )
  assert.equal(roles.rows.length, 3)
  assert(
    roles.rows.every(
      (role) => !role.rolsuper && !role.rolbypassrls && !role.rolcreaterole && !role.rolcreatedb,
    ),
  )
  const schema = await client.query<{ allowed: boolean }>(
    "SELECT has_schema_privilege('union_eyes_runtime','public','CREATE') allowed",
  )
  assert.equal(schema.rows[0].allowed, false)
  const functions = await client.query(
    "SELECT p.oid::regprocedure::text FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prosecdef",
  )
  return {
    status: functions.rows.length
      ? 'REQUIRES_PRIVILEGED_FUNCTION_REVIEW'
      : 'PASS_FOR_CANDIDATE_ROLES',
    privilegedFunctions: functions.rows,
  }
}
async function applicationProof(client: pg.Client) {
  const contract = JSON.parse(
    readFileSync(
      path.join(
        root,
        'apps',
        'union-eyes',
        'db',
        'schema-authority',
        'runtime-required-contract.json',
      ),
      'utf8',
    ),
  ) as { entries: { schema: string; table: string; column: string }[] }
  const columns = await client.query<{ schema: string; table: string; column: string }>(
    `SELECT table_schema AS schema,table_name AS table,column_name AS column FROM information_schema.columns`,
  )
  const missing = contract.entries.filter(
    (entry) =>
      !columns.rows.some(
        (row) =>
          row.schema === entry.schema && row.table === entry.table && row.column === entry.column,
      ),
  )
  return {
    status: missing.length ? 'FAIL' : 'PASS_REQUIRED_FIELD_SUBSET',
    missing,
    fullApplicationStartup: 'NOT_PROVEN',
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  runCleanRoom()
    .then((evidence) => {
      process.exitCode = qualificationExitCode(evidence)
      if (process.exitCode !== 0)
        process.stderr.write(
          'UE_V2_ENGINEERING_QUALIFICATION_FAILED: see persisted runtime evidence\n',
        )
    })
    .catch((error: unknown) => {
      console.error(error)
      process.exitCode = 1
    })
