#!/usr/bin/env node
/**
 * Reproducible local runtime for Union Eyes acceptance: the real Next.js app, native PostgreSQL, deterministic QA fixtures.
 *
 *   node tooling/scripts/ue-runtime-up.mjs up      # database, migrations, seed, platform sandbox DB, app, wait healthy
 *   node tooling/scripts/ue-runtime-up.mjs test    # run the Playwright runtime acceptance (desktop, tablet, mobile)
 *   node tooling/scripts/ue-runtime-up.mjs all     # up, then test
 *   node tooling/scripts/ue-runtime-up.mjs down    # stop the app and the database container
 *   node tooling/scripts/ue-runtime-up.mjs env     # print the environment the app and the tests use
 *
 * Needs Docker, Python (Django backend migrations), Node and pnpm. Options: --port-db 55430 --port-app 3002 --fresh
 *
 * LOCAL ONLY. It uses a disposable container, synthetic credentials and the QA session cookie that the platform auth honours
 * solely when QA_TEST_ENV=true and UE_ENVIRONMENT=local. The NAR audit store is a local sandbox (never immutable) and the
 * sandbox platform database refuses the relaxation unless its name ends in _sandbox.
 */
import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const APP = join(ROOT, 'apps', 'union-eyes')
const STATE = join(ROOT, '.ue-runtime')
const args = process.argv.slice(2)
const command = args.find((a) => !a.startsWith('--')) ?? 'all'
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const PORT_DB = Number(opt('port-db', '55430'))
const PORT_APP = Number(opt('port-app', '3002'))
const FRESH = args.includes('--fresh')
const CONTAINER = 'ue-runtime-pg'
const APP_DB = 'ue_runtime'
const PLATFORM_DB = 'ue_platform_sandbox'
const isWin = process.platform === 'win32'

/** Disposable credentials, generated on first use and kept (git-ignored) with the runtime state; nothing is committed. */
function secrets() {
  mkdirSync(STATE, { recursive: true })
  const file = join(STATE, 'secrets.json')
  if (!existsSync(file)) {
    const token = () => randomBytes(24).toString('hex')
    writeFileSync(file, JSON.stringify({ db: token(), auth: token(), voting: token(), nar: token() }))
  }
  return JSON.parse(readFileSync(file, 'utf8'))
}

function dbUrl(db) {
  const url = new URL('postgresql://localhost') // gitleaks:allow (credentials are generated at runtime, never committed)
  url.username = 'postgres'
  url.password = secrets().db
  url.port = String(PORT_DB)
  url.pathname = `/${db}`
  return url.toString()
}

export function runtimeEnv() {
  return {
    DATABASE_URL: dbUrl(APP_DB),
    SYSTEM_DATABASE_URL: dbUrl(APP_DB),
    PLATFORM_DATABASE_URL: dbUrl(PLATFORM_DB),
    AUTH_SECRET: secrets().auth,
    VOTING_SECRET: secrets().voting,
    QA_TEST_ENV: 'true',
    NODE_ENV: 'development',
    PLAYWRIGHT_TEST_AUTH: 'true',
    UE_ENVIRONMENT: 'local',
    UE_CANONICAL_BOOTSTRAP_V2: '0',
    UE_E2E_RISK_BYPASS: 'true',
    NODE_OPTIONS: '--max-old-space-size=8192',
    NEXT_PUBLIC_APP_URL: `http://localhost:${PORT_APP}`,
    PLAYWRIGHT_BASE_URL: `http://localhost:${PORT_APP}`,
    NAR_SIGNING_SECRET: secrets().nar,
    NAR_SIGNING_KEY_ID: 'local-acceptance',
    NAR_STORAGE_MODE: 'local_sandbox',
    NAR_LOCAL_SANDBOX_DIR: join(STATE, 'nar-sandbox'),
  }
}

function run(cmd, cmdArgs, options = {}) {
  const result = spawnSync(cmd, cmdArgs, { stdio: 'inherit', shell: isWin, cwd: ROOT, ...options, env: { ...process.env, ...options.env } })
  if (result.status !== 0) throw new Error(`${cmd} ${cmdArgs.join(' ')} exited with ${result.status}`)
}
const out = (cmd, cmdArgs, options = {}) => spawnSync(cmd, cmdArgs, { encoding: 'utf8', shell: isWin, cwd: ROOT, ...options }).stdout?.trim() ?? ''
const psql = (db, sql) => run('docker', ['exec', CONTAINER, 'psql', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-c', sql])
const psqlFile = (db, file) => {
  const sql = readFileSync(file, 'utf8').replaceAll('--> statement-breakpoint', '')
  const result = spawnSync('docker', ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8', shell: isWin })
  if (result.status !== 0) throw new Error(`psql ${file}: ${result.stderr}`)
}

async function healthy(timeoutMs) {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    try {
      const response = await fetch(`http://localhost:${PORT_APP}/api/health`, { signal: AbortSignal.timeout(20_000) })
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
  mkdirSync(STATE, { recursive: true })
  const running = out('docker', ['ps', '--filter', `name=${CONTAINER}`, '--format', '{{.Names}}'])
  if (!running) {
    spawnSync('docker', ['rm', '-f', CONTAINER], { shell: isWin })
    run('docker', ['run', '-d', '--name', CONTAINER, '-e', `POSTGRES_PASSWORD=${secrets().db}`, '-p', `${PORT_DB}:5432`, 'postgres:16'])
    for (let i = 0; i < 60; i++) {
      if (/accepting connections/.test(out('docker', ['exec', CONTAINER, 'pg_isready', '-U', 'postgres']))) break
      await new Promise((r) => setTimeout(r, 2_000))
    }
    await new Promise((r) => setTimeout(r, 4_000))
  }
  const exists = (db) => out('docker', ['exec', CONTAINER, 'psql', '-U', 'postgres', '-tAc', `SELECT 1 FROM pg_database WHERE datname='${db}'`]) === '1'
  const seeded = exists(APP_DB)
  if (seeded && FRESH) {
    for (const db of [APP_DB, PLATFORM_DB]) psql('postgres', `DROP DATABASE IF EXISTS ${db} WITH (FORCE)`)
  }
  if (!exists(APP_DB)) {
    psql('postgres', `CREATE DATABASE ${APP_DB}`)
    // Django migrates first, as in production; then the approved Drizzle bootstrap; then the deterministic QA fixtures.
    run('python', ['manage.py', 'migrate', '--noinput'], {
      cwd: join(APP, 'backend'),
      env: { PGHOST: 'localhost', PGPORT: String(PORT_DB), PGUSER: 'postgres', PGPASSWORD: 'postgres', PGDATABASE: APP_DB },
    })
    run('node', ['tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs'], { env: runtimeEnv() })
    run('pnpm', ['--filter', '@nzila/union-eyes', 'seed:test-env'], { env: runtimeEnv() })
  }
  if (!exists(PLATFORM_DB)) {
    psql('postgres', `CREATE DATABASE ${PLATFORM_DB}`)
    psqlFile(PLATFORM_DB, join(ROOT, 'migrations/platform/20260501_nar_audit_records.sql'))
    psqlFile(PLATFORM_DB, join(ROOT, 'migrations/platform/20260502_nar_phase3_hardening.sql'))
    psqlFile(PLATFORM_DB, join(ROOT, 'tooling/sql/ue-runtime-sandbox-nar-relax.sql'))
  }

  const alive = await fetch(`http://localhost:${PORT_APP}/api/health`, { signal: AbortSignal.timeout(5_000) }).then(() => true, () => false)
  if (!alive) {
    const log = openSync(join(STATE, 'app.log'), 'a')
    const child = spawn('pnpm', ['--filter', '@nzila/union-eyes', 'dev'], {
      cwd: ROOT, env: { ...process.env, ...runtimeEnv() }, shell: isWin, detached: true, stdio: ['ignore', log, log],
    })
    child.unref()
    writeFileSync(join(STATE, 'app.pid'), String(child.pid))
  }
  const body = await healthy(240_000)
  console.log(`[ue-runtime] healthy: ${JSON.stringify(body.checks)}`)
}

function test() {
  run('npx', ['playwright', 'test', '--config', 'playwright.runtime.config.ts'], { cwd: APP, env: runtimeEnv() })
}

function down() {
  const pidFile = join(STATE, 'app.pid')
  if (existsSync(pidFile)) {
    const pid = readFileSync(pidFile, 'utf8').trim()
    if (isWin) spawnSync('taskkill', ['/PID', pid, '/T', '/F'], { stdio: 'ignore' })
    else try { process.kill(-Number(pid)) } catch { /* already gone */ }
  }
  spawnSync('docker', ['rm', '-f', CONTAINER], { shell: isWin, stdio: 'inherit' })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (command === 'env') console.log(JSON.stringify(runtimeEnv(), null, 2))
  else if (command === 'up') await up()
  else if (command === 'test') test()
  else if (command === 'down') down()
  else if (command === 'all') {
    await up()
    test()
  } else {
    console.error(`unknown command ${command}`)
    process.exit(2)
  }
}
