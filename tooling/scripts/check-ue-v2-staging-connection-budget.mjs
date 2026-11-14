import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { evaluateStagingConnectionBudget } from './lib/ue-v2-connection-budget.mjs'

const argument = name => {
  const index = process.argv.indexOf(name)
  if (index < 0 || !process.argv[index + 1]) throw new Error('MISSING_ARGUMENT:' + name)
  return process.argv[index + 1]
}
const policy = JSON.parse(readFileSync(argument('--policy'), 'utf8'))
const parameters = JSON.parse(readFileSync(argument('--parameters'), 'utf8')).parameters
const supplied = process.argv.includes('--server-config')
const rows = supplied
  ? JSON.parse(readFileSync(argument('--server-config'), 'utf8'))
  : ['max_connections', 'reserved_connections', 'superuser_reserved_connections'].map(name => JSON.parse(execFileSync('az', [
    'postgres', 'flexible-server', 'parameter', 'show',
    '--subscription', 'd562ba7f-d891-4504-a489-10917c0ebaaf',
    '-g', 'nzila-canada-staging-rg', '--server-name', 'nzila-ue-v2-staging-db-d562ba7f',
    '--name', name, '--query', '{name:name,value:value}', '--only-show-errors', '-o', 'json',
  ], { encoding: 'utf8', timeout: 60000 })))
const observed = Object.fromEntries(rows.map(row => [row.name, Number(row.value)]))
const result = evaluateStagingConnectionBudget({ policy, maxConnections: observed.max_connections, reservedConnections: observed.reserved_connections, superuserReservedConnections: observed.superuser_reserved_connections, maximumReplicas: parameters.appMaxReplicas?.value })
if (observed.max_connections !== parameters.dbMaxConnections?.value) result.defects.push('DECLARED_AND_OBSERVED_MAX_CONNECTIONS_DIFFER')
result.ok = result.defects.length === 0
console.log(JSON.stringify({ gate: 'staging-connection-budget', ...result, observedServerConfiguration: !supplied }, null, 2))
if (!result.ok) process.exitCode = 1
