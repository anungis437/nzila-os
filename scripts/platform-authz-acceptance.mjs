import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'

const composeFile = 'docker-compose.platform-authz-acceptance.yml'
const project = 'nzila-platform-authz-acceptance'
const databaseUrl =
  'postgresql://platform_authz_acceptance:platform_authz_acceptance_local_only@127.0.0.1:55442/nzila_platform_authz_acceptance'

function run(command, args, options = {}) {
  const isWindowsPnpm = process.platform === 'win32' && command === 'pnpm'
  const executable = isWindowsPnpm ? (process.env.ComSpec ?? 'cmd.exe') : command
  const executableArgs = isWindowsPnpm ? ['/d', '/s', '/c', ['pnpm', ...args].join(' ')] : args
  const result = spawnSync(executable, executableArgs, {
    cwd: process.cwd(),
    stdio: 'inherit',
    ...options,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status ?? 'unknown'}`)
  }
  return result
}

function compose(args, options) {
  run('docker', ['compose', '--project-name', project, '-f', composeFile, ...args], options)
}

function ensureNoPreexistingProject() {
  const containers = spawnSync(
    'docker',
    ['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`],
    { encoding: 'utf8' },
  )
  if (containers.error) throw containers.error
  if (containers.status !== 0) throw new Error('Unable to inspect Docker containers')
  if (containers.stdout.trim()) {
    throw new Error(`Refusing to reuse pre-existing disposable containers for ${project}`)
  }
  const networks = spawnSync(
    'docker',
    ['network', 'ls', '-q', '--filter', `label=com.docker.compose.project=${project}`],
    { encoding: 'utf8' },
  )
  if (networks.error) throw networks.error
  if (networks.status !== 0) throw new Error('Unable to inspect Docker networks')
  if (networks.stdout.trim()) {
    throw new Error(`Refusing to reuse pre-existing disposable networks for ${project}`)
  }
  const result = spawnSync(
    'docker',
    ['volume', 'ls', '-q', '--filter', `label=com.docker.compose.project=${project}`],
    { encoding: 'utf8' },
  )
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error('Unable to inspect Docker volumes')
  if (result.stdout.trim()) {
    throw new Error(`Refusing to reuse pre-existing disposable volume for ${project}`)
  }
}

function applySqlFile(path) {
  compose([
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    'platform_authz_acceptance',
    '-d',
    'nzila_platform_authz_acceptance',
    '-v',
    'ON_ERROR_STOP=1',
    '-f',
    path,
  ])
}

function applyCanonicalAuthFixture(mode, password) {
  const result = run(
    'pnpm',
    ['--filter', '@nzila/db', 'exec', 'tsx', 'bootstrap/platform-authz-fixture.ts', mode],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
      env: { ...process.env, CORA_AUTHZ_FIXTURE_PASSWORD: password ?? '' },
    },
  )
  compose(
    [
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'platform_authz_acceptance',
      '-d',
      'nzila_platform_authz_acceptance',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    {
      input: result.stdout,
      stdio: ['pipe', 'inherit', 'inherit'],
    },
  )
}

function verifyForwardOnlyReplay() {
  const args = [
    'compose',
    '--project-name',
    project,
    '-f',
    composeFile,
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    'platform_authz_acceptance',
    '-d',
    'nzila_platform_authz_acceptance',
    '-v',
    'ON_ERROR_STOP=1',
    '-f',
    '/acceptance/0041_platform_authorization_authority.sql',
  ]
  const replay = spawnSync('docker', args, { encoding: 'utf8' })
  if (replay.error) throw replay.error
  if (replay.status === 0) {
    throw new Error('Migration 0041 unexpectedly replayed instead of failing forward-only')
  }
  if (!`${replay.stdout}\n${replay.stderr}`.includes('already exists')) {
    throw new Error('Migration replay failed for an unexpected reason')
  }
  const verification = spawnSync(
    'docker',
    [
      'compose',
      '--project-name',
      project,
      '-f',
      composeFile,
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'platform_authz_acceptance',
      '-d',
      'nzila_platform_authz_acceptance',
      '-At',
      '-c',
      "select count(*) from platform_identity_bindings where provider = 'test.acceptance'",
    ],
    { encoding: 'utf8' },
  )
  if (verification.error) throw verification.error
  if (verification.status !== 0 || verification.stdout.trim() !== '13') {
    throw new Error('Migration replay changed the seeded authority state')
  }
}

function test() {
  const running = spawnSync(
    'docker',
    [
      'compose',
      '--project-name',
      project,
      '-f',
      composeFile,
      'ps',
      '--status',
      'running',
      '--services',
    ],
    { encoding: 'utf8' },
  )
  if (running.error) throw running.error
  if (running.status !== 0 || !running.stdout.split(/\r?\n/).includes('postgres')) {
    throw new Error('The disposable authorization database is not running')
  }
  const authPassword = randomBytes(32).toString('hex')
  applyCanonicalAuthFixture('login', authPassword)
  const authUrl = new URL(databaseUrl)
  authUrl.username = 'cora_authz_fixture_gateway'
  authUrl.password = authPassword
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    AUTH_DATABASE_URL: authUrl.toString(),
    DATABASE_POOL_SIZE: '3',
    CORA_ACCEPTANCE_AUTH_ENABLED: 'true',
    CORA_ACCEPTANCE_AUTH_SECRET: randomBytes(32).toString('base64url'),
    NODE_ENV: 'test',
  }
  run(
    'pnpm',
    [
      '--filter',
      '@nzila/cora',
      'exec',
      'vitest',
      'run',
      '../../tooling/cora-acceptance/authorization.integration.test.ts',
    ],
    { env },
  )
  run(
    'pnpm',
    [
      '--filter',
      '@nzila/platform-auth',
      'exec',
      'vitest',
      'run',
      'src/authorization-context.acceptance.test.ts',
    ],
    { env },
  )
  run(
    'pnpm',
    [
      '--filter',
      '@nzila/platform-auth',
      'exec',
      'vitest',
      'run',
      'src/cora-acceptance-auth.acceptance.test.ts',
    ],
    { env },
  )
}

const command = process.argv[2] ?? 'run'

if (!['up', 'bootstrap', 'test', 'down', 'run'].includes(command)) {
  throw new Error('Usage: node scripts/platform-authz-acceptance.mjs <up|bootstrap|test|down|run>')
}

if (command === 'down') {
  compose(['down', '--volumes', '--remove-orphans'])
} else if (command === 'run') {
  let started = false
  try {
    ensureNoPreexistingProject()
    started = true
    compose(['up', '--detach', '--wait'])
    applySqlFile('/acceptance/bootstrap.sql')
    applyCanonicalAuthFixture('schema')
    applySqlFile('/acceptance/0041_platform_authorization_authority.sql')
    applySqlFile('/acceptance/fixtures.sql')
    applyCanonicalAuthFixture('boundary')
    verifyForwardOnlyReplay()
    test()
  } finally {
    if (started) compose(['down', '--volumes', '--remove-orphans'])
  }
} else if (command === 'up') {
  ensureNoPreexistingProject()
  compose(['up', '--detach', '--wait'])
} else if (command === 'bootstrap') {
  applySqlFile('/acceptance/bootstrap.sql')
  applyCanonicalAuthFixture('schema')
  applySqlFile('/acceptance/0041_platform_authorization_authority.sql')
  applySqlFile('/acceptance/fixtures.sql')
  applyCanonicalAuthFixture('boundary')
  verifyForwardOnlyReplay()
} else {
  test()
}
