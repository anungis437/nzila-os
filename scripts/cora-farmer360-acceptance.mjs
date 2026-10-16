import { spawnSync } from 'node:child_process'

const composeFile = 'docker-compose.cora-farmer360-acceptance.yml'
const projectName = 'cora-farmer360-acceptance'
const databaseUrl =
  'postgres://cora_acceptance:cora_acceptance_local_only@127.0.0.1:55441/cora_farmer360_acceptance'
const [command] = process.argv.slice(2)

function run(executable, args, options = {}) {
  const command =
    process.platform === 'win32' && executable === 'pnpm'
      ? (process.env.ComSpec ?? 'cmd.exe')
      : executable
  const commandArgs =
    command === executable ? args : ['/d', '/s', '/c', `${executable} ${args.join(' ')}`]
  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    shell: false,
    ...options,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(
      `${executable} ${args.join(' ')} failed with status ${result.status ?? 'unknown'}`,
    )
  }
}

function compose(args) {
  run('docker', ['compose', '--project-name', projectName, '--file', composeFile, ...args])
}

function psql(file) {
  compose([
    'exec',
    '-T',
    'db',
    'psql',
    '-U',
    'cora_acceptance',
    '-d',
    'cora_farmer360_acceptance',
    '-v',
    'ON_ERROR_STOP=1',
    '-f',
    file,
  ])
}

function runAcceptanceTests() {
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    CORA_FARMER360_ACCEPTANCE_DATABASE_URL: databaseUrl,
  }
  run(
    'pnpm',
    [
      '--filter',
      '@nzila/cora',
      'exec',
      'vitest',
      'run',
      'lib/farmer-360/acceptance.integration.test.ts',
    ],
    { env },
  )
}

try {
  switch (command) {
    case 'up':
      compose(['up', '--detach', '--wait', 'db'])
      break
    case 'bootstrap':
      psql('/acceptance/bootstrap/cora-farmer360-acceptance.sql')
      psql('/acceptance/migrations/0039_cora_evidence_foundation.sql')
      psql('/acceptance/migrations/0040_cora_farmer360.sql')
      psql('/acceptance/migrations/0041_platform_authorization_authority.sql')
      psql('/acceptance/bootstrap/cora-farmer360-acceptance-fixtures.sql')
      break
    case 'test':
      runAcceptanceTests()
      break
    case 'down':
      compose(['down', '--volumes', '--remove-orphans'])
      break
    default:
      throw new Error('Usage: node scripts/cora-farmer360-acceptance.mjs <up|bootstrap|test|down>')
  }
} catch (error) {
  console.error(`[CORA_FARMER360_ACCEPTANCE] ${error.message}`)
  process.exitCode = 1
}
