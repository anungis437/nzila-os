import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { evidence, files, hash, read, root, source } from './g3r2i-preservation.mjs'

const subscription = '5d819f33-d16f-429c-a3c0-5b0e94740ba3'
const tenant = '5082b8be-b04d-4a13-b61c-b6397670177b'
const principal = 'bfa4a851-696a-4d3f-927b-5fb1526f79f2'
const application = '3594a951-fcff-4877-a52f-043ed52a9eb0'
const sub = `/subscriptions/${subscription}`
const network = read(path.join(evidence, 'G3R1_NETWORK_CONTRACT.json'))
const g2 = `${sub}/resourceGroups/nzila-g2-proof-xre47vggs5uhw`
const registry = `${g2}/providers/Microsoft.ContainerRegistry/registries/nzilag2tzo75uuozprbo`
const zone = `${g2}/providers/Microsoft.Network/privateDnsZones/privatelink.azurecr.io`
const requests = [
  [
    'keyvault-operations',
    'https://management.azure.com/providers/Microsoft.KeyVault/operations?api-version=2024-11-01',
  ],
  [
    'app-operations',
    'https://management.azure.com/providers/Microsoft.App/operations?api-version=2025-07-01',
  ],
  [
    'network-operations',
    'https://management.azure.com/providers/Microsoft.Network/operations?api-version=2024-05-01',
  ],
  [
    'operator',
    `https://graph.microsoft.com/v1.0/servicePrincipals/${principal}?$select=id,appId,displayName,servicePrincipalType,accountEnabled`,
  ],
  [
    'operator-groups',
    `https://graph.microsoft.com/v1.0/servicePrincipals/${principal}/transitiveMemberOf/microsoft.graph.group?$select=id,securityEnabled`,
  ],
  [
    'operator-application',
    `https://graph.microsoft.com/v1.0/applications/${application}?$select=id,appId,displayName`,
  ],
  [
    'operator-federation',
    `https://graph.microsoft.com/v1.0/applications/${application}/federatedIdentityCredentials?$select=id,name,issuer,subject,audiences`,
  ],
  [
    'assignments',
    `https://management.azure.com${sub}/providers/Microsoft.Authorization/roleAssignments?api-version=2022-04-01`,
  ],
  [
    'inherited-assignments',
    `https://management.azure.com${sub}/providers/Microsoft.Authorization/roleAssignments?api-version=2022-04-01&$filter=atScope()`,
  ],
  [
    'role-definitions',
    `https://management.azure.com${sub}/providers/Microsoft.Authorization/roleDefinitions?api-version=2022-04-01`,
  ],
  [
    'deny-assignments',
    `https://management.azure.com${sub}/providers/Microsoft.Authorization/denyAssignments?api-version=2022-04-01`,
  ],
  [
    'policies',
    `https://management.azure.com${sub}/providers/Microsoft.Authorization/policyAssignments?api-version=2022-06-01`,
  ],
  ['g2-vnet', `https://management.azure.com${network.g2VnetId}?api-version=2024-05-01`],
  [
    'g2-firewall',
    `https://management.azure.com${network.firewall.resource}?api-version=2024-05-01`,
  ],
  ['g2-registry', `https://management.azure.com${registry}?api-version=2025-11-01`],
  [
    'g2-registry-usage',
    `https://management.azure.com${registry}/listUsages?api-version=2025-11-01`,
  ],
  [
    'g2-dns-links',
    `https://management.azure.com${zone}/virtualNetworkLinks?api-version=2020-06-01`,
  ],
  ['g2-dns-records', `https://management.azure.com${zone}/ALL?api-version=2020-06-01`],
  [
    'g2-builder',
    `https://management.azure.com${g2}/providers/Microsoft.Compute/virtualMachines/nzila-g2-builder-y3koaeijzi6mu?api-version=2024-07-01`,
  ],
  [
    'g2-builder-nsg',
    `https://management.azure.com${g2}/providers/Microsoft.Network/networkSecurityGroups/nzila-g2-builder-nsg-y3koaeijzi6mu?api-version=2024-05-01`,
  ],
  [
    'g2-builder-nic',
    `https://management.azure.com${g2}/providers/Microsoft.Network/networkInterfaces/nzila-g2-builder-nic-y3koaeijzi6mu?api-version=2024-05-01`,
  ],
  [
    'g2-builder-route',
    `https://management.azure.com${g2}/providers/Microsoft.Network/routeTables/nzila-g2-builder-rt-y3koaeijzi6mu?api-version=2024-05-01`,
  ],
  [
    'compute-usage',
    `https://management.azure.com${sub}/providers/Microsoft.Compute/locations/canadacentral/usages?api-version=2024-03-01`,
  ],
]
const preservationFile = path.join(evidence, 'G3R3_HISTORICAL_PRESERVATION.json')
export function preserve() {
  if (!existsSync(preservationFile)) {
    writeFileSync(
      preservationFile,
      `${JSON.stringify(
        {
          source: files(source),
          candidate: files(path.join(root, 'synthetic-health')),
          evidence: readdirSync(evidence, { withFileTypes: true })
            .filter((entry) => !entry.name.startsWith('G3R3') && entry.isFile())
            .map((entry) => ({
              path: entry.name,
              sha256: hash(readFileSync(path.join(evidence, entry.name))),
            })),
          g2: read(path.join(evidence, 'G3_EXECUTION_READINESS.json')).preservation
            .localG2SourceHashes,
          ROOT_1_REOPENED: 'NO',
        },
        null,
        2,
      )}\n`,
      { flag: 'wx' },
    )
  }
  return verifyPreservation()
}
export function verifyPreservation() {
  const baseline = read(preservationFile)
  assert.deepEqual(files(source), baseline.source, 'FROZEN_QUALIFIED_SOURCE_CHANGED')
  assert.deepEqual(
    files(path.join(root, 'synthetic-health')),
    baseline.candidate,
    'REJECTED_CANDIDATE_CHANGED',
  )
  for (const entry of baseline.evidence)
    assert.equal(
      hash(readFileSync(path.join(evidence, entry.path))),
      entry.sha256,
      `PRIOR_EVIDENCE_CHANGED:${entry.path}`,
    )
  for (const [name, expected] of Object.entries(baseline.g2))
    assert.equal(hash(readFileSync(path.join(root, name))), expected, `G2_SOURCE_CHANGED:${name}`)
  return baseline
}
export function allowedUrl(url) {
  const candidate = new URL(url)
  return requests.some(([, value]) => {
    const original = new URL(value)
    return (
      candidate.origin === original.origin &&
      candidate.pathname === original.pathname &&
      [...original.searchParams].every(
        ([key, value]) => candidate.searchParams.get(key) === value,
      ) &&
      [...candidate.searchParams.keys()].every(
        (key) => original.searchParams.has(key) || ['$skiptoken', '$skipToken'].includes(key),
      )
    )
  })
}
export function collect(resume = false) {
  preserve()
  const ledgerFile = path.join(evidence, 'G3R3_AZURE_READ_LEDGER.json')
  assert(resume || !existsSync(ledgerFile), 'G3R3_CENSUS_EXISTS_REFUSE_OVERWRITE')
  const ledger = existsSync(ledgerFile) ? read(ledgerFile) : []
  const persist = () => writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`)
  function invoke(name, args, method) {
    const file = `G3R3_READ_${ledger.length + 1}_${name}.json`
    const errorFile = file.replace('.json', '.stderr.txt')
    const entry = {
      name,
      command: ['az', ...args, '--output', 'json', '--only-show-errors'],
      method,
      mutation: false,
      startedAtUtc: new Date().toISOString(),
      status: 'STARTED',
      responseFile: file,
      stderrFile: errorFile,
    }
    ledger.push(entry)
    persist()
    const result = spawnSync(
      'C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\python.exe',
      ['-IBm', 'azure.cli', ...args, '--output', 'json', '--only-show-errors'],
      { encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024 },
    )
    writeFileSync(path.join(evidence, file), result.stdout ?? '')
    writeFileSync(path.join(evidence, errorFile), result.stderr ?? '')
    Object.assign(entry, {
      status: result.status === 0 ? 'SUCCEEDED' : 'FAILED',
      exitCode: result.status,
      completedAtUtc: new Date().toISOString(),
      responseSha256: hash(result.stdout ?? ''),
      error: result.error?.message ?? null,
    })
    persist()
    if (result.status !== 0) {
      console.warn(`READ_FAILED:${name};exact stderr and ledger retained`)
      return null
    }
    return JSON.parse(result.stdout)
  }
  const account = invoke(
    'account',
    ['account', 'show', '--query', '{id:id,tenantId:tenantId,state:state}'],
    'ACCOUNT_SHOW_READ_ONLY',
  )
  assert(
    account?.id === subscription && account?.tenantId === tenant && account?.state === 'Enabled',
    'ACCOUNT_MISMATCH_OR_UNREADABLE;NO_LOGIN_SWITCH',
  )
  for (const [name, initial] of requests) {
    if (
      resume &&
      ledger.some((entry) => entry.name === `${name}-page-1` && entry.status === 'SUCCEEDED')
    )
      continue
    let url = initial
    let page = 0
    while (url) {
      assert(allowedUrl(url), 'READ_URL_OUTSIDE_EXACT_ALLOWLIST')
      assert(++page <= 15, 'BOUNDED_READ_PAGINATION_LIMIT')
      const result = invoke(
        `${name}-page-${page}`,
        ['rest', '--method', 'get', '--url', url],
        'GET',
      )
      url = result?.nextLink ?? result?.['@odata.nextLink']
    }
  }
  verifyPreservation()
  console.log(
    `G3R3 read-only census:${ledger.length} calls;${ledger.filter((entry) => entry.status === 'FAILED').length} failed;zero mutation.`,
  )
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert(
    process.argv.length === 3 &&
      ['--capture', '--collect', '--resume', '--check'].includes(process.argv[2]),
    'G3R3_EXACT_READ_FLAGS_ONLY',
  )
  if (process.argv[2] === '--collect' || process.argv[2] === '--resume')
    collect(process.argv[2] === '--resume')
  else if (process.argv[2] === '--capture') preserve()
  else verifyPreservation()
}
