#!/usr/bin/env node
/**
 * Reproducible local runtime for Union Eyes acceptance: the real Next.js app, native PostgreSQL, deterministic QA fixtures.
 *
 *   node tooling/scripts/ue-runtime-up.mjs up      # database, migrations, seed, platform sandbox DB, app, wait healthy
 *   node tooling/scripts/ue-runtime-up.mjs db      # only the native combined DB fixture; no Next server
 *   node tooling/scripts/ue-runtime-up.mjs test    # run the Playwright runtime acceptance (desktop, tablet, mobile)
 *   node tooling/scripts/ue-runtime-up.mjs restart-check  # file a case, restart the app, prove it persisted
 *   node tooling/scripts/ue-runtime-up.mjs all     # up, then test, then restart-check
 *   node tooling/scripts/ue-runtime-up.mjs down    # stop the app and the database container
 *   node tooling/scripts/ue-runtime-up.mjs env     # print the environment the app and the tests use
 *
 * Needs Docker, Python (Django backend migrations), Node and pnpm. Options: --port-db 55430 --port-app 3002 --runtime-id worktree --fresh --prod --rebuild --redis
 * (--prod builds and serves the production bundle, the reliable mode for repeated acceptance runs).
 *
 * LOCAL ONLY. It uses an owned disposable container, separate bounded login credentials, and real password/MFA sessions.
 * The NAR audit store is a local sandbox (never immutable) and the
 * sandbox platform database refuses the relaxation unless its name ends in _sandbox.
 */
import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { hasOwnedContainerLabels, UE_DISPOSABLE_MISSION } from './lib/ue-disposable-container-ownership.mjs'
import { resetRestartCaseHandoff, requireRestartCaseHandoff } from './lib/ue-runtime-restart-handoff.mjs'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import {deriveRuntimeCredentials,runtimeDatabaseUrl,planRuntimeLoginProvisioning,RUNTIME_OPERATOR,RUNTIME_LOGIN_BINDINGS,RUNTIME_NAR_LOGIN} from './lib/ue-runtime-canonical-auth.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const APP = join(ROOT, 'apps', 'union-eyes')
const STATE_ROOT = join(ROOT, '.ue-runtime')
const args = process.argv.slice(2)
const command = args.find((a) => !a.startsWith('--')) ?? 'all'
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const PORT_DB = Number(opt('port-db', '55430'))
const PORT_APP = Number(opt('port-app', '3002'))
const FRESH = args.includes('--fresh')
// A production build (next build + next start) is the reliable runtime: the dev server stalls under repeated acceptance runs.
const PROD = args.includes('--prod')
const REBUILD = args.includes('--rebuild')
// --redis adds a real Redis container so rate limiting and the cache run against the real dependency (and can be stopped to test degradation).
const REDIS = args.includes('--redis')
const PORT_REDIS = Number(opt('port-redis', '56379'))
// --azurite adds the public Azurite emulator and the repository's ClamAV HTTP adapter. The key is Microsoft's published
// emulator key, never an Azure secret. A production process accepts it only for this loopback fixture.
const AZURITE = args.includes('--azurite')
const PORT_AZURITE = Number(opt('port-azurite', '10000'))
const PORT_CLAMAV = Number(opt('port-clamav', '3310'))
const PORT_CLAMAV_HTTP = Number(opt('port-clamav-http', '18080'))
export const AZURITE_FIXTURE_ACCOUNT = 'devstoreaccount1'
export const AZURITE_FIXTURE_KEY = 'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=='
const CLAMAV_IMAGE = 'clamav/clamav@sha256:cbc30de94b6e9b33ac14136ff45306cee02a1f9ae522394a3cc5b9215d1affe9'
const RUNTIME_ID = opt('runtime-id', '')
if (RUNTIME_ID && !/^[a-z0-9][a-z0-9-]{0,31}$/.test(RUNTIME_ID)) {
  throw new Error('Runtime ID must be 1-32 lowercase letters, digits, or hyphens')
}
const STATE = RUNTIME_ID ? join(STATE_ROOT,'runs',RUNTIME_ID) : STATE_ROOT
const runtimeName = (base) => RUNTIME_ID ? `${base}-${RUNTIME_ID}` : base
const REDIS_CONTAINER = runtimeName('ue-runtime-redis')
const AZURITE_CONTAINER = runtimeName('ue-runtime-azurite')
const CLAMAV_CONTAINER = runtimeName('ue-runtime-clamav')
const CONTAINER = runtimeName('ue-runtime-pg')
const APP_DB = 'ue_runtime'
const POSTGRES_VERSION = opt('postgres-version', '16')
if (!['15', '16'].includes(POSTGRES_VERSION)) throw new Error('Only PostgreSQL 15 and 16 are supported for disposable QA fixtures')
const PLATFORM_DB = 'ue_platform_sandbox'
const isWin = process.platform === 'win32'
// Only the Windows .cmd shims (pnpm, npx) need a shell; with a shell, arguments that contain spaces are split apart.
const useShell = (cmd) => isWin && /^(pnpm|npx)$/.test(cmd)

/** Disposable credentials, generated on first use and kept (git-ignored) with the runtime state; nothing is committed. */
function secrets() {
  mkdirSync(STATE_ROOT, { recursive: true,mode:0o700 })
  const file = join(STATE_ROOT, 'secrets.json')
  if (!existsSync(file)) {
    const token = () => randomBytes(24).toString('hex')
    writeFileSync(file, JSON.stringify({ db: token(), auth: token(), voting: token(), nar: token(), seal: token() }), { mode: 0o600 })
  }
  const stored = JSON.parse(readFileSync(file, 'utf8'))
  // Older runtimes predate the correspondence seal key; add it once, keeping every other secret.
  if (!stored.seal) {
    stored.seal = randomBytes(24).toString('hex')
    writeFileSync(file, JSON.stringify(stored), { mode: 0o600 })
  }
  return stored
}

/** Opaque per-worktree owner key. Only containers with this exact label may be reused or removed. */
function runtimeOwnerToken() {
  mkdirSync(STATE_ROOT, { recursive: true,mode:0o700 })
  const file = join(STATE_ROOT, 'runtime-owner.txt')
  if (!existsSync(file)) writeFileSync(file, randomBytes(16).toString('hex'), { mode: 0o600, flag: 'wx' })
  const token = readFileSync(file, 'utf8').trim()
  if (!/^[a-f0-9]{32}$/.test(token)) throw new Error('Malformed disposable runtime owner token')
  return token
}

function isOwnedContainer(name) {
  const result = spawnSync('docker', ['inspect', '--format', '{{json .Config.Labels}}', name], {
    cwd: ROOT, encoding: 'utf8',
  })
  if (result.status !== 0) {
    if (/No such object|No such container/i.test(result.stderr ?? '')) return false
    throw new Error(`Unable to inspect Docker ownership for ${name}`)
  }
  let labels
  try { labels = JSON.parse(result.stdout) } catch {
    throw new Error(`Unparseable Docker labels for ${name}`)
  }
  if (!hasOwnedContainerLabels(labels, runtimeOwnerToken())) {
    throw new Error(`Refusing to reuse/remove unowned Docker container ${name}`)
  }
  return true
}

function checkLoopbackPort(name, port, containerPort) {
  const actual = out('docker', ['port', name, `${containerPort}/tcp`])
  if (actual !== `127.0.0.1:${port}`) {
    throw new Error(`Refusing non-loopback or mismatched Docker binding for ${name}`)
  }
}

const credentials=()=>deriveRuntimeCredentials(secrets().db)
const dbUrl=(database,purpose='operator')=>runtimeDatabaseUrl({database,port:PORT_DB,credential:credentials()[purpose]})
export const operatorDatabaseUrl=()=>dbUrl(APP_DB)
export function operatorEnv(){return {...runtimeEnv(),DATABASE_URL:operatorDatabaseUrl(),SYSTEM_DATABASE_URL:operatorDatabaseUrl(),UE_CANONICAL_BOOTSTRAP_V2:'0',AUTH_DATABASE_URL:'',AUTH_SYSTEM_DATABASE_URL:'',NODE_ENV:'development'}}
function seedEnv(){return {...runtimeEnv(),DATABASE_URL:operatorDatabaseUrl(),UE_RUNTIME_OPERATOR_DATABASE_URL:operatorDatabaseUrl(),UE_RUNTIME_DATABASE_URL:dbUrl(APP_DB,'runtime'),NODE_ENV:'development'}}
function testEnv(){return {...runtimeEnv(),UE_RUNTIME_OPERATOR_DATABASE_URL:operatorDatabaseUrl(),UE_RUNTIME_PLATFORM_OPERATOR_DATABASE_URL:dbUrl(PLATFORM_DB)}}

export function runtimeEnv() {
  return {
    DATABASE_URL: dbUrl(APP_DB,'runtime'),
    SYSTEM_DATABASE_URL: dbUrl(APP_DB,'system'),
    AUTH_DATABASE_URL: dbUrl(APP_DB,'auth'),
    AUTH_SYSTEM_DATABASE_URL: dbUrl(APP_DB,'authSystem'),
    PLATFORM_DATABASE_URL: dbUrl(PLATFORM_DB,'nar'),
    AUTH_MFA_ENCRYPTION_KEY:credentials().mfaKey,
    AUTH_SECRET: secrets().auth,
    VOTING_SECRET: secrets().voting,
    QA_TEST_ENV: 'true',
    NODE_ENV: PROD ? 'production' : 'development',
    PLAYWRIGHT_TEST_AUTH: 'false',
    UE_ENVIRONMENT: 'local',
    UE_CANONICAL_BOOTSTRAP_V2: '1',
    NODE_OPTIONS: '--max-old-space-size=6144',
    UE_RUNTIME_STATE_DIR:STATE,
    NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${PORT_APP}`,
    PLAYWRIGHT_BASE_URL: `http://127.0.0.1:${PORT_APP}`,
    ...(REDIS ? { REDIS_URL: `redis://127.0.0.1:${PORT_REDIS}` } : {}),
    ...(AZURITE ? {
      AZURE_STORAGE_ACCOUNT_NAME: AZURITE_FIXTURE_ACCOUNT,
      AZURE_STORAGE_ACCOUNT_KEY: AZURITE_FIXTURE_KEY,
      AZURE_STORAGE_BLOB_ENDPOINT: `http://127.0.0.1:${PORT_AZURITE}/${AZURITE_FIXTURE_ACCOUNT}`,
      AZURE_BLOB_CONTAINER: 'union-eyes',
      CLAMAV_URL: `http://127.0.0.1:${PORT_CLAMAV_HTTP}`,
    } : {}),
    UE_RUNTIME_REDIS_CONTAINER: REDIS ? REDIS_CONTAINER : '',
    NAR_SIGNING_SECRET: secrets().nar,
    // Seals queued correspondence (lib/correspondence/email-intent.ts); production provisions its own (bicep evidence-seal-key).
    EVIDENCE_SEAL_KEY: secrets().seal,
    NAR_SIGNING_KEY_ID: 'local-acceptance',
    NAR_STORAGE_MODE: 'local_sandbox',
    NAR_LOCAL_SANDBOX_DIR: join(STATE, 'nar-sandbox'),
  }
}

function run(cmd, cmdArgs, options = {}) {
  const result = spawnSync(cmd, cmdArgs, { stdio: 'inherit', shell: useShell(cmd), cwd: ROOT, ...options, env: { ...process.env, ...options.env } })
  // Never print command arguments on failure: Docker arguments can contain generated database credentials.
  if (result.status !== 0) throw new Error(`${cmd} exited with ${result.status ?? 'unknown'} (arguments withheld)`)
}
const out = (cmd, cmdArgs, options = {}) => spawnSync(cmd, cmdArgs, { encoding: 'utf8', shell: useShell(cmd), cwd: ROOT, ...options }).stdout?.trim() ?? ''
const psql = (db, sql) => run('docker', ['exec', CONTAINER, 'psql', '-U', RUNTIME_OPERATOR, '-d', db, '-v', 'ON_ERROR_STOP=1', '-c', sql])
const psqlFile = (db, file) => {
  const sql = readFileSync(file, 'utf8').replaceAll('--> statement-breakpoint', '')
  const result = spawnSync('docker', ['exec', '-i', CONTAINER, 'psql', '-U', RUNTIME_OPERATOR, '-d', db, '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`psql ${file}: ${result.stderr}`)
}

async function provisionRuntimeLogins(){
  const {tsImport}=await import('tsx/esm/api')
  const {canonicalPostgresMajor,membershipCatalogProjectionSql}=await tsImport('../../packages/db/src/auth-storage-authority/membership-semantics.ts',{parentURL:import.meta.url})
  const operator=new pg.Client({connectionString:operatorDatabaseUrl()})
  await operator.connect()
  try{
    await operator.query('BEGIN')
    const version=(await operator.query("SELECT pg_catalog.current_setting('server_version_num') AS version")).rows[0].version
    const major=canonicalPostgresMajor(version),projection=membershipCatalogProjectionSql(major)
    const roles=(await operator.query("SELECT rolname,rolcanlogin,rolsuper,rolbypassrls,rolinherit,rolcreatedb,rolcreaterole FROM pg_catalog.pg_roles WHERE rolname LIKE 'ue_runtime_%'")).rows
    const memberships=(await operator.query(`SELECT member.rolname AS member,target.rolname AS granted,m.admin_option,${projection.inheritOption} AS inherit_option,${projection.setOption} AS set_option FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles member ON member.oid=m.member JOIN pg_catalog.pg_roles target ON target.oid=m.roleid WHERE member.rolname LIKE 'ue_runtime_%' OR target.rolname LIKE 'ue_runtime_%'`)).rows
    for(const sql of await planRuntimeLoginProvisioning({roles,memberships,postgresMajor:major,credentials:credentials()}))await operator.query(sql)
    await operator.query('COMMIT')
  }catch(error){await operator.query('ROLLBACK');throw error}finally{await operator.end()}
  // Prove that each generated credential connects and can SET only its intended
  // bounded context; no login receives INHERIT or database ownership.
  for(const binding of RUNTIME_LOGIN_BINDINGS){
    const login=new pg.Client({connectionString:dbUrl(APP_DB,binding.key)})
    await login.connect()
    try{
      await login.query('BEGIN')
      await login.query(`SET LOCAL ROLE "${binding.target}"`)
      const row=(await login.query('SELECT current_user::text AS role')).rows[0]
      if(row.role!==binding.target)throw new Error('Disposable login context verification failed')
      await login.query('ROLLBACK')
    }finally{await login.end()}
  }
}

async function provisionNarLogin(){
  const operator=new pg.Client({connectionString:dbUrl(PLATFORM_DB)})
  await operator.connect()
  try{
    await operator.query('BEGIN')
    const roles=(await operator.query('SELECT rolcanlogin,rolsuper,rolbypassrls,rolinherit,rolcreatedb,rolcreaterole FROM pg_catalog.pg_roles WHERE rolname=$1',[RUNTIME_NAR_LOGIN])).rows
    if(roles.length>1)throw new Error('Duplicate NAR sandbox login')
    if(roles.length){
      if(roles[0].rolcanlogin!==true||['rolsuper','rolbypassrls','rolinherit','rolcreatedb','rolcreaterole'].some(key=>roles[0][key]!==false))throw new Error('Existing NAR sandbox login differs')
    }else await operator.query(`CREATE ROLE ${RUNTIME_NAR_LOGIN} LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${credentials().nar.password}'`)
    if((await operator.query('SELECT FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles r ON r.oid=m.member WHERE r.rolname=$1',[RUNTIME_NAR_LOGIN])).rowCount)throw new Error('NAR sandbox login must have no role memberships')
    await operator.query(`REVOKE ALL ON TABLE public.audit_records FROM PUBLIC; GRANT USAGE ON SCHEMA public TO ${RUNTIME_NAR_LOGIN}; GRANT SELECT,INSERT ON TABLE public.audit_records TO ${RUNTIME_NAR_LOGIN}`)
    const grants=(await operator.query(`SELECT c.relname,p.privilege,pg_catalog.has_table_privilege($1::name,c.oid,p.privilege) AS allowed FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','REFERENCES','TRIGGER','TRUNCATE']) p(privilege) WHERE n.nspname='public' AND c.relkind IN('r','p','v','m','f')`,[RUNTIME_NAR_LOGIN])).rows
    if(grants.some(row=>row.allowed!==(row.relname==='audit_records'&&['SELECT','INSERT'].includes(row.privilege))))throw new Error('NAR sandbox privileges differ from append/read source')
    await operator.query('COMMIT')
  }catch(error){await operator.query('ROLLBACK');throw error}finally{await operator.end()}
}

async function healthy(timeoutMs) {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT_APP}/api/health`, { signal: AbortSignal.timeout(120_000) })
      const body = await response.json().catch(() => ({}))
      if (response.ok && body.ok === true) return body
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 3_000))
  }
  throw new Error('the application did not report healthy in time')
}

async function up() {
  mkdirSync(STATE, { recursive: true, mode: 0o700 })
  const owner = runtimeOwnerToken()
  const labels = ['--label', `nzila.mission=${UE_DISPOSABLE_MISSION}`, '--label', `nzila.qualification-owner=${owner}`]
  const redisExists = isOwnedContainer(REDIS_CONTAINER)
  const pgExists = isOwnedContainer(CONTAINER)
  if (AZURITE) await ensureDocumentFixture(labels)
  if (REDIS) {
    const redisRunning = out('docker', ['ps', '--filter', `name=^/${REDIS_CONTAINER}$`, '--format', '{{.Names}}'])
    if(FRESH&&redisExists)run('docker',['rm','-f',REDIS_CONTAINER])
    if (!redisRunning||FRESH) {
      if(redisExists&&!FRESH)run('docker',['start',REDIS_CONTAINER])
      else run('docker', ['run', '-d', '--name', REDIS_CONTAINER, ...labels, '-p', `127.0.0.1:${PORT_REDIS}:6379`, 'redis:7-alpine'])
    }
    checkLoopbackPort(REDIS_CONTAINER, PORT_REDIS, 6379)
  }
  const running = out('docker', ['ps', '--filter', `name=^/${CONTAINER}$`, '--format', '{{.Names}}'])
  if(pgExists&&!FRESH){
    const configured=JSON.parse(out('docker',['inspect','--format','{{json .Config.Env}}',CONTAINER]))
    if(!configured.includes(`POSTGRES_USER=${RUNTIME_OPERATOR}`))throw new Error('Existing runtime uses the historical operator; use a new runtime ID or an explicit owned --fresh reset')
  }
  if (FRESH&&pgExists)run('docker',['rm','-f',CONTAINER])
  if (!running||FRESH) {
    if(pgExists&&!FRESH)run('docker',['start',CONTAINER])
    else run('docker', ['run', '-d', '--name', CONTAINER, ...labels, '-e', `POSTGRES_USER=${RUNTIME_OPERATOR}`, '-e', `POSTGRES_PASSWORD=${secrets().db}`, '-p', `127.0.0.1:${PORT_DB}:5432`, `postgres:${POSTGRES_VERSION}`])
    for (let i = 0; i < 60; i++) {
      if (/accepting connections/.test(out('docker', ['exec', CONTAINER, 'pg_isready', '-U', RUNTIME_OPERATOR]))) break
      await new Promise((r) => setTimeout(r, 2_000))
    }
    await new Promise((r) => setTimeout(r, 4_000))
  }
  checkLoopbackPort(CONTAINER, PORT_DB, 5432)
  const actualImage = out('docker', ['inspect', '--format', '{{.Config.Image}}', CONTAINER])
  if (actualImage !== `postgres:${POSTGRES_VERSION}`) {
    throw new Error('Refusing PostgreSQL QA container with wrong major version')
  }
  const exists = (db) => out('docker', ['exec', CONTAINER, 'psql', '-U', RUNTIME_OPERATOR, '-d','postgres','-tAc', `SELECT 1 FROM pg_database WHERE datname='${db}'`]) === '1'
  if (!exists(APP_DB)) {
    psql('postgres', `CREATE DATABASE ${APP_DB}`)
    // Django migrates first, as in production; then the approved Drizzle bootstrap; then the deterministic QA fixtures.
    run('python', ['manage.py', 'migrate', '--noinput'], {
      cwd: join(APP, 'backend'),
      env: { PGHOST: '127.0.0.1', PGPORT: String(PORT_DB), PGUSER: RUNTIME_OPERATOR, PGPASSWORD: secrets().db, PGDATABASE: APP_DB,UE_CANONICAL_BOOTSTRAP_V2:'0' },
    })
    run('node', ['tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs'], { env: operatorEnv() })
    await provisionRuntimeLogins()
    run('pnpm', ['--filter', '@nzila/union-eyes', 'seed:test-env'], { env: seedEnv() })
  }else{
    // Reusing state means verifying the mandatory current boundary; it cannot
    // revive a previously prepared flag-off database by merely starting Next.
    run('node',['tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs'],{env:operatorEnv()})
    await provisionRuntimeLogins()
  }
  if (!exists(PLATFORM_DB)) {
    psql('postgres', `CREATE DATABASE ${PLATFORM_DB}`)
    psqlFile(PLATFORM_DB, join(ROOT, 'migrations/platform/20260501_nar_audit_records.sql'))
    psqlFile(PLATFORM_DB, join(ROOT, 'migrations/platform/20260502_nar_phase3_hardening.sql'))
    psqlFile(PLATFORM_DB, join(ROOT, 'tooling/sql/ue-runtime-sandbox-nar-relax.sql'))
  }

  await provisionNarLogin()

  // CI's native database gate needs migrations and seed but must never start Next.js.
  if (command === 'db') return

  const alive = await fetch(`http://127.0.0.1:${PORT_APP}/api/health`, { signal: AbortSignal.timeout(5_000) }).then(() => true, () => false)
  const startedAt = Date.now()
  if (!alive) startApp()
  // Cold start on a loaded workstation has exceeded 240 s on some runs (finding R-21); the wait is bounded and the elapsed time is reported, not hidden.
  const body = await healthy(480_000)
  console.log(`[ue-runtime] healthy after ${Math.round((Date.now() - startedAt) / 1000)} s: ${JSON.stringify(body.checks)}`)
}

function startApp() {
  const filter = ['--filter', '@nzila/union-eyes']
  // Use the application's canonical build command. Calling `next build`
  // directly defaults to Turbopack in Next 16 and bypasses the webpack
  // extension aliases required by NodeNext-style workspace source imports.
  if (PROD && (REBUILD || !existsSync(join(APP, '.next', 'BUILD_ID'))))
    run('pnpm', [...filter, 'build'], { env: runtimeEnv() })
  const serve = PROD ? ['exec', 'next', 'start', '--hostname', '127.0.0.1', '--port', String(PORT_APP)] : ['exec', 'next', 'dev', '--webpack', '--port', String(PORT_APP)]
  const log = openSync(join(STATE, 'app.log'), 'a')
  const child = spawn('pnpm', [...filter, ...serve], {
    cwd: ROOT, env: { ...process.env, ...runtimeEnv() }, shell: useShell('pnpm'), detached: true, stdio: ['ignore', log, log],
  })
  child.unref()
  writeFileSync(join(STATE, 'app.pid'), String(child.pid))
}

function stopApp() {
  const pidFile = join(STATE, 'app.pid')
  if (!existsSync(pidFile)) return
  const pid = readFileSync(pidFile, 'utf8').trim()
  if (isWin) spawnSync('taskkill', ['/PID', pid, '/T', '/F'], { stdio: 'ignore' })
  else try { process.kill(-Number(pid)) } catch { /* already gone */ }
}

function test() {
  // Separate machine-readable reports ensure later Playwright invocations never overwrite earlier proof.
  // They stay under the ignored disposable state directory and must be selectively uploaded (no secrets.json).
  run('npx', ['playwright', 'test', '--config', 'playwright.runtime.config.ts', '--grep-invert', 'persistence after a restart'], {
    cwd: APP, env: { ...testEnv(), ...ownedAzuriteEnv(), UE_RUNTIME_REPORT: join(STATE, 'playwright-main.json') },
  })
}

/** Storage settings recorded by `up --azurite`, so a later spec or test sees the same loopback fixture. */
function ownedAzuriteEnv() {
  const file = join(STATE, 'runtime-public.json')
  if (!existsSync(file)) return {}
  let fixture
  try { fixture = JSON.parse(readFileSync(file, 'utf8')) } catch { return {} }
  const azurite = fixture?.azurite
  if (!azurite?.endpoint || !azurite.container || !azurite.clamavUrl) return {}
  return {
    AZURE_STORAGE_ACCOUNT_NAME: AZURITE_FIXTURE_ACCOUNT,
    AZURE_STORAGE_ACCOUNT_KEY: AZURITE_FIXTURE_KEY,
    AZURE_STORAGE_BLOB_ENDPOINT: azurite.endpoint,
    AZURE_BLOB_CONTAINER: azurite.container,
    CLAMAV_URL: azurite.clamavUrl,
  }
}

/** Runs one extra Playwright config (browser or document acceptance) against the owned runtime, with its own report. */
function spec() {
  const config = opt('config', '')
  if (!/^playwright\.[a-z-]+\.config\.ts$/.test(config)) throw new Error('spec requires --config playwright.<name>.config.ts')
  const extra = ['project', 'grep'].flatMap((name) => (opt(name, '') ? [`--${name}`, opt(name, '')] : []))
  const label = opt('label', config.replace(/^playwright\.|\.config\.ts$/g, ''))
  run('npx', ['playwright', 'test', '--config', config, ...extra], {
    cwd: APP,
    env: {
      ...testEnv(),
      ...ownedAzuriteEnv(),
      PLAYWRIGHT_BASE_URL: `http://127.0.0.1:${PORT_APP}`,
      UE_RUNTIME_STATE_DIR: STATE,
      UE_RUNTIME_REPORT: join(STATE, `playwright-${label}.json`),
      UE_RUNTIME_ARTIFACTS: join(STATE, `playwright-${label}-artifacts`),
    },
  })
}

/** Re-applies the deterministic QA fixtures (idempotent) to a running database. */
function seed() {
  run('pnpm', ['--filter', '@nzila/union-eyes', 'seed:test-env'], { env: seedEnv() })
}

/** Files a case, stops the application, starts it again, and proves the case, its audit proof and its boundaries survived. */
async function restartCheck() {
  // Prepare a fresh filing and independent triage journey without rewriting
  // the protected escalation history from an earlier complete run.
  const caseStateFile = join(STATE, 'journey-a-state.json')
  // Never accept a stale hand-off from an earlier QA run as evidence of this run's filing.
  resetRestartCaseHandoff(caseStateFile)
  const desktop = ['playwright', 'test', '--config', 'playwright.runtime.config.ts', '--project=desktop']
  run('npx', [...desktop, 'e2e/runtime/01', '-g', 'the member files an intake through the real route'], {
    cwd: APP,
    env: {
      ...testEnv(),
      // Isolated Playwright output directory, never a production setting.
      UE_RUNTIME_ARTIFACTS: join(STATE, 'playwright-restart-artifacts'),
      UE_RUNTIME_REPORT: join(STATE, 'playwright-restart-pre-case.json'),
    },
  })
  requireRestartCaseHandoff(caseStateFile)
  run('npx', [...desktop, 'e2e/runtime/03', 'e2e/runtime/05'], {
    cwd: APP, env: { ...testEnv(), UE_RUNTIME_REPORT: join(STATE, 'playwright-restart-pre-mandates.json') },
  })
  stopApp()
  await new Promise((r) => setTimeout(r, 5_000))
  startApp()
  await healthy(300_000)
  run('npx', ['playwright', 'test', '--config', 'playwright.runtime.config.ts', '--project=desktop', 'e2e/runtime/02'], {
    cwd: APP, env: { ...testEnv(), UE_RUNTIME_REPORT: join(STATE, 'playwright-restart-persistence.json') },
  })
}

function down() {
  const pgOwned = isOwnedContainer(CONTAINER)
  const redisOwned = isOwnedContainer(REDIS_CONTAINER)
  const azuriteOwned = isOwnedContainer(AZURITE_CONTAINER)
  const clamavOwned = isOwnedContainer(CLAMAV_CONTAINER)
  stopApp()
  stopClamavAdapter()
  if (pgOwned) run('docker', ['rm', '-f', CONTAINER])
  if (redisOwned) run('docker', ['rm', '-f', REDIS_CONTAINER])
  if (azuriteOwned) run('docker', ['rm', '-f', AZURITE_CONTAINER])
  if (clamavOwned) run('docker', ['rm', '-f', CLAMAV_CONTAINER])
}

function stopClamavAdapter() {
  const pidFile = join(STATE, 'clamav-adapter.pid')
  if (!existsSync(pidFile)) return
  const pid = readFileSync(pidFile, 'utf8').trim()
  try { process.kill(Number(pid)) } catch { /* already gone */ }
}

async function ensureDocumentFixture(labels) {
  stopClamavAdapter()
  const startOwned = (name, args) => {
    const exists = isOwnedContainer(name)
    if (FRESH && exists) run('docker', ['rm', '-f', name])
    const running = out('docker', ['ps', '--filter', `name=^/${name}$`, '--format', '{{.Names}}'])
    if (!running || FRESH) {
      if (exists && !FRESH) run('docker', ['start', name])
      else run('docker', ['run', '-d', '--name', name, ...labels, ...args])
    }
  }
  startOwned(AZURITE_CONTAINER, ['-p', `127.0.0.1:${PORT_AZURITE}:10000`, 'mcr.microsoft.com/azure-storage/azurite'])
  checkLoopbackPort(AZURITE_CONTAINER, PORT_AZURITE, 10000)
  await waitHttp(PORT_AZURITE, 60_000)
  startOwned(CLAMAV_CONTAINER, ['-p', `127.0.0.1:${PORT_CLAMAV}:3310`, CLAMAV_IMAGE])
  checkLoopbackPort(CLAMAV_CONTAINER, PORT_CLAMAV, 3310)
  const log = openSync(join(STATE, 'clamav-adapter.log'), 'a')
  const child = spawn(process.execPath, [join(ROOT, 'services/clamav-adapter/server.js')], {
    cwd: ROOT,
    env: { ...process.env, CLAMD_HOST: '127.0.0.1', CLAMD_PORT: String(PORT_CLAMAV), PORT: String(PORT_CLAMAV_HTTP) },
    detached: true,
    stdio: ['ignore', log, log],
  })
  child.unref()
  writeFileSync(join(STATE, 'clamav-adapter.pid'), String(child.pid))
  const until = Date.now() + 180_000
  while (Date.now() < until) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT_CLAMAV_HTTP}/health`, { signal: AbortSignal.timeout(3_000) })
      if (response.ok) break
    } catch { /* clamd is still loading its signature database */ }
    await new Promise((r) => setTimeout(r, 3_000))
  }
  const ready = await fetch(`http://127.0.0.1:${PORT_CLAMAV_HTTP}/health`, { signal: AbortSignal.timeout(3_000) }).then((response) => response.ok, () => false)
  if (!ready) throw new Error('the owned ClamAV fixture did not become healthy')
  writeFileSync(join(STATE, 'runtime-public.json'), JSON.stringify({
    azurite: {
      endpoint: `http://127.0.0.1:${PORT_AZURITE}/${AZURITE_FIXTURE_ACCOUNT}`,
      container: 'union-eyes',
      clamavUrl: `http://127.0.0.1:${PORT_CLAMAV_HTTP}`,
    },
  }), { mode: 0o600 })
}

async function waitHttp(port, timeoutMs) {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    try {
      await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(2_000) })
      return
    } catch (error) {
      if (!/ECONNREFUSED|fetch failed/i.test(String(error))) return
    }
    await new Promise((r) => setTimeout(r, 1_000))
  }
  throw new Error(`127.0.0.1:${port} did not accept connections`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (command === 'env') console.log(JSON.stringify(runtimeEnv(), null, 2))
  else if (command === 'up' || command === 'db') await up()
  else if (command === 'seed') seed()
  else if (command === 'test') test()
  else if (command === 'spec') spec()
  else if (command === 'restart-check') await restartCheck()
  else if (command === 'down') down()
  else if (command === 'all') {
    await up()
    test()
    await restartCheck()
  } else {
    console.error(`unknown command ${command}`)
    process.exit(2)
  }
}
