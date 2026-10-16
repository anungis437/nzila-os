import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { evidence, files, hash, read, root } from './g3r2i-preservation.mjs'
import { verifyPreservation } from './g3r3-read-census.mjs'
import { check as checkParent } from './g3r3-execution-envelope.mjs'

export const coreDigest = '9cfcda0c4bced61e302128d8455867214f7b64c8b5b101bf5e52f632e8984198'
export const subscription = '5d819f33-d16f-429c-a3c0-5b0e94740ba3'
export const g2 = `/subscriptions/${subscription}/resourceGroups/nzila-g2-proof-xre47vggs5uhw`
export const vm = `${g2}/providers/Microsoft.Compute/virtualMachines/nzila-g2-builder-y3koaeijzi6mu`
export const registry = `${g2}/providers/Microsoft.ContainerRegistry/registries/nzilag2tzo75uuozprbo`
const baselineFile = path.join(evidence, 'G3R3B_PRESERVATION.json')
const ledgerFile = path.join(evidence, 'G3R3B_READ_LEDGER.json')
export const azureRequests = [
  [
    'compute-operations',
    'https://management.azure.com/providers/Microsoft.Compute/operations?api-version=2024-07-01',
  ],
  [
    'registry-operations',
    'https://management.azure.com/providers/Microsoft.ContainerRegistry/operations?api-version=2025-11-01',
  ],
  ['vm', `https://management.azure.com${vm}?api-version=2024-07-01`],
  ['vm-instance-view', `https://management.azure.com${vm}/instanceView?api-version=2024-07-01`],
  ['registry', `https://management.azure.com${registry}?api-version=2025-11-01`],
  ['registry-usage', `https://management.azure.com${registry}/listUsages?api-version=2025-11-01`],
  [
    'agent-pools',
    `https://management.azure.com${registry}/agentPools?api-version=2025-03-01-preview`,
  ],
  [
    'vm-os-disk',
    `https://management.azure.com${g2}/providers/Microsoft.Compute/disks/nzila-g2-builder-y3koaeijzi6mu_OsDisk_1_50cfc12f1bfb422ca576ad15e790b725?api-version=2024-03-02`,
  ],
]
export const documents = [
  [
    'task-openapi',
    'https://raw.githubusercontent.com/Azure/azure-rest-api-specs/main/specification/containerregistry/resource-manager/Microsoft.ContainerRegistry/RegistryTasks/preview/2025-03-01-preview/containerregistry_build.json',
  ],
  [
    'task-openapi-version',
    'https://api.github.com/repos/Azure/azure-rest-api-specs/contents/specification/containerregistry/resource-manager/Microsoft.ContainerRegistry/RegistryTasks/preview/2025-03-01-preview',
  ],
  [
    'task-openapi-directory',
    'https://api.github.com/repos/Azure/azure-rest-api-specs/contents/specification/containerregistry/resource-manager/Microsoft.ContainerRegistry',
  ],
  [
    'managed-run-command',
    'https://learn.microsoft.com/en-us/azure/virtual-machines/linux/run-command-managed',
  ],
  [
    'run-command-api',
    'https://learn.microsoft.com/en-us/rest/api/compute/virtual-machine-run-commands/create-or-update',
  ],
  [
    'run-command-schema',
    'https://learn.microsoft.com/en-us/azure/templates/microsoft.compute/2024-07-01/virtualmachines/runcommands',
  ],
  ['agent-pools', 'https://learn.microsoft.com/en-us/azure/container-registry/tasks-agent-pools'],
  [
    'private-acr',
    'https://learn.microsoft.com/en-us/azure/container-registry/container-registry-private-endpoints',
  ],
  [
    'task-roles',
    'https://learn.microsoft.com/en-us/azure/container-registry/container-registry-rbac-built-in-roles-directory-reference',
  ],
  ['acr-build', 'https://learn.microsoft.com/en-us/cli/azure/acr?view=azure-cli-latest'],
  [
    'schedule-run-api',
    'https://learn.microsoft.com/en-us/javascript/api/@azure/arm-containerregistrytasks/dockerbuildrequest?view=azure-node-preview',
  ],
  [
    'acr-authentication',
    'https://learn.microsoft.com/en-us/azure/container-registry/container-registry-authentication',
  ],
  ['key-vault-pricing', 'https://azure.microsoft.com/en-ca/pricing/details/key-vault/'],
  ['registry-pricing', 'https://azure.microsoft.com/en-ca/pricing/details/container-registry/'],
  ['standard-ssd-pricing', 'https://azure.microsoft.com/en-ca/pricing/details/managed-disks/'],
  ['docker-domains', 'https://docs.docker.com/desktop/setup/allow-list/'],
  [
    'arm-limits',
    'https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits',
  ],
  [
    'agent-pool-api',
    'https://learn.microsoft.com/en-us/azure/templates/microsoft.containerregistry/2025-03-01-preview/registries/agentpools',
  ],
  ['disk-types', 'https://learn.microsoft.com/en-us/azure/virtual-machines/disks-types'],
  [
    'task-schema',
    'https://learn.microsoft.com/en-us/azure/templates/microsoft.containerregistry/2025-03-01-preview/registries/tasks',
  ],
]
export const priceQueries = [
  ['registry-products', "contains(productName, 'Container Registry')"],
  ['key-vault-all', "serviceName eq 'Key Vault'"],
  ['registry-all', "serviceName eq 'Container Registry'"],
  [
    'ssd-transactions',
    "serviceName eq 'Storage' and armRegionName eq 'canadacentral' and contains(meterName, 'Transactions')",
  ],
]
export function allowedPrice(url) {
  const value = new URL(url)
  return (
    value.origin === 'https://prices.azure.com' &&
    value.pathname === '/api/retail/prices' &&
    value.searchParams.get('currencyCode') === "'CAD'" &&
    value.searchParams.get('api-version') === '2023-01-01-preview' &&
    priceQueries.some(
      ([, filter]) =>
        value.searchParams.get('$filter') === `${filter} and priceType eq 'Consumption'`,
    ) &&
    [...value.searchParams.keys()].every((key) =>
      ['currencyCode', 'api-version', '$filter', '$skip'].includes(key),
    ) &&
    (!value.searchParams.has('$skip') || /^\d{1,5}$/.test(value.searchParams.get('$skip')))
  )
}
export function preserve() {
  checkParent()
  if (!existsSync(baselineFile)) {
    const prior = files(evidence).filter((entry) => !entry.path.startsWith('G3R3B'))
    const tools = readdirSync(root).filter(
      (name) => /^g3(?:r|[-.])/.test(name) && !name.startsWith('g3r3b-') && name.endsWith('.mjs'),
    )
    writeFileSync(
      baselineFile,
      `${JSON.stringify(
        {
          coreDigest,
          ROOT_1_REOPENED: 'NO',
          evidence: prior,
          tools: tools.map((name) => ({ name, sha256: hash(readFileSync(path.join(root, name))) })),
        },
        null,
        2,
      )}\n`,
      { flag: 'wx' },
    )
  }
  return verify()
}
export function verify() {
  verifyPreservation()
  checkParent()
  const baseline = read(baselineFile)
  assert.equal(baseline.coreDigest, coreDigest)
  assert.equal(
    read(path.join(evidence, 'G3R3_G2_MUTATION_PACKET.json')).approval.G2_MUTATION_PACKET_DIGEST,
    coreDigest,
  )
  for (const entry of baseline.evidence)
    assert.equal(
      hash(readFileSync(path.join(evidence, entry.path))),
      entry.sha256,
      `FROZEN_PARENT_CHANGED:${entry.path}`,
    )
  for (const entry of baseline.tools)
    assert.equal(
      hash(readFileSync(path.join(root, entry.name))),
      entry.sha256,
      `FROZEN_TOOL_CHANGED:${entry.name}`,
    )
  return baseline
}
export function allowedAzure(url) {
  const candidate = new URL(url)
  return [
    ...azureRequests,
    [
      'retained-rejected-agent-pool-version',
      `https://management.azure.com${registry}/agentPools?api-version=2025-11-01`,
    ],
  ].some(([, value]) => {
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
export async function collect(resume = false) {
  preserve()
  assert(resume || !existsSync(ledgerFile), 'READ_LEDGER_EXISTS_REFUSE_OVERWRITE')
  const ledger = existsSync(ledgerFile) ? read(ledgerFile) : []
  const persist = () => writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`)
  const complete = (name) =>
    ledger.some((entry) => entry.name === name && entry.status === 'SUCCEEDED')
  function azure(name, args, method) {
    const entry = {
      name,
      method,
      mutation: false,
      command: ['az', ...args, '--output', 'json', '--only-show-errors'],
      startedAtUtc: new Date().toISOString(),
      status: 'STARTED',
      responseFile: `G3R3B_READ_${ledger.length + 1}_${name}.json`,
      stderrFile: `G3R3B_READ_${ledger.length + 1}_${name}.stderr.txt`,
    }
    ledger.push(entry)
    persist()
    const result = spawnSync(
      'C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\python.exe',
      ['-IBm', 'azure.cli', ...args, '--output', 'json', '--only-show-errors'],
      { encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024 },
    )
    writeFileSync(path.join(evidence, entry.responseFile), result.stdout ?? '')
    writeFileSync(path.join(evidence, entry.stderrFile), result.stderr ?? '')
    Object.assign(entry, {
      status: result.status === 0 ? 'SUCCEEDED' : 'FAILED',
      exitCode: result.status,
      responseSha256: hash(result.stdout ?? ''),
      stderrSha256: hash(result.stderr ?? ''),
      completedAtUtc: new Date().toISOString(),
      error: result.error?.message ?? null,
    })
    persist()
    assert.equal(result.status, 0, `AZURE_READ_FAILED:${name};ledger and stderr retained`)
    return JSON.parse(result.stdout)
  }
  const account = azure(
    'account',
    ['account', 'show', '--query', '{id:id,tenantId:tenantId,state:state}'],
    'ACCOUNT_SHOW_READ_ONLY',
  )
  assert.equal(account.id, subscription)
  assert.equal(account.tenantId, '5082b8be-b04d-4a13-b61c-b6397670177b')
  assert.equal(account.state, 'Enabled')
  for (const [name, initial] of azureRequests) {
    let url = initial
    for (let page = 1; url; page++) {
      assert(page <= 10 && allowedAzure(url), `NONALLOWLISTED_AZURE_GET:${url}`)
      const key = `${name}-page-${page}`
      const result =
        resume && complete(key)
          ? read(
              path.join(
                evidence,
                ledger.findLast((entry) => entry.name === key && entry.status === 'SUCCEEDED')
                  .responseFile,
              ),
            )
          : azure(key, ['rest', '--method', 'get', '--url', url], 'GET')
      url = result.nextLink
    }
  }
  async function publicRead(name, url, kind) {
    const entry = {
      name,
      kind,
      url,
      method: 'GET',
      mutation: false,
      startedAtUtc: new Date().toISOString(),
      status: 'STARTED',
      responseFile: `G3R3B_PUBLIC_${ledger.length + 1}_${name}.${kind === 'DOCUMENT' ? 'html' : 'json'}`,
    }
    ledger.push(entry)
    persist()
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60000) })
      const text = await response.text()
      writeFileSync(path.join(evidence, entry.responseFile), text)
      Object.assign(entry, {
        httpStatus: response.status,
        finalUrl: response.url,
        status: response.ok ? 'SUCCEEDED' : 'FAILED',
        responseSha256: hash(text),
        completedAtUtc: new Date().toISOString(),
      })
      persist()
      assert(response.ok, `PUBLIC_READ_FAILED:${name}:${response.status};failed body retained`)
      return text
    } catch (error) {
      if (entry.status === 'STARTED') {
        Object.assign(entry, {
          status: 'FAILED',
          error: error.message,
          completedAtUtc: new Date().toISOString(),
        })
        persist()
      }
      throw error
    }
  }
  for (const [name, url] of documents)
    if (!(resume && complete(`doc-${name}`))) await publicRead(`doc-${name}`, url, 'DOCUMENT')
  for (const [name, filter] of priceQueries) {
    const file = path.join(evidence, `G3R3B_PRICE_${name}.json`)
    if (resume && existsSync(file)) continue
    const first = new URL('https://prices.azure.com/api/retail/prices')
    first.searchParams.set('api-version', '2023-01-01-preview')
    first.searchParams.set('currencyCode', "'CAD'")
    first.searchParams.set('$filter', `${filter} and priceType eq 'Consumption'`)
    let url = first.href
    const items = []
    const sources = []
    for (let page = 1; url; page++) {
      const target = new URL(url)
      assert(
        page <= 10 && target.origin === first.origin && allowedPrice(url),
        'PRICE_PAGINATION_BOUNDARY',
      )
      const key = `price-${name}-page-${page}`
      const text =
        resume && complete(key)
          ? readFileSync(
              path.join(
                evidence,
                ledger.findLast((entry) => entry.name === key && entry.status === 'SUCCEEDED')
                  .responseFile,
              ),
              'utf8',
            )
          : await publicRead(key, url, 'PRICE')
      const result = JSON.parse(text)
      assert(
        result.Items.every((item) => item.currencyCode === 'CAD'),
        'NON_CAD_METER',
      )
      items.push(...result.Items)
      sources.push(
        ledger.findLast((entry) => entry.name === key && entry.status === 'SUCCEEDED').responseFile,
      )
      url = result.NextPageLink
    }
    writeFileSync(
      file,
      `${JSON.stringify({ filter, currency: 'CAD', includesNonPrimaryMeters: true, items, sources }, null, 2)}\n`,
      { flag: 'wx' },
    )
  }
  verify()
  checkReads()
  console.log(`G3R3B read-only evidence:${ledger.length} calls;zero mutation`)
}
export function checkReads() {
  verify()
  for (const entry of read(ledgerFile)) {
    assert.equal(entry.mutation, false)
    assert(['GET', 'ACCOUNT_SHOW_READ_ONLY'].includes(entry.method))
    assert(['SUCCEEDED', 'FAILED'].includes(entry.status), `INCOMPLETE_READ:${entry.name}`)
    if (entry.responseSha256)
      assert.equal(
        hash(readFileSync(path.join(evidence, entry.responseFile))),
        entry.responseSha256,
      )
    if (entry.stderrSha256)
      assert.equal(hash(readFileSync(path.join(evidence, entry.stderrFile))), entry.stderrSha256)
    if (entry.command && entry.method === 'GET') {
      assert(allowedAzure(entry.command[entry.command.indexOf('--url') + 1]))
      assert(entry.command.includes('get'))
    }
    if (entry.kind === 'DOCUMENT')
      assert(
        documents.some(([, url]) => url === entry.url) ||
          entry.url ===
            'https://learn.microsoft.com/en-us/rest/api/containerregistry/registries/schedule-run' ||
          entry.url ===
            'https://api.github.com/repos/Azure/azure-rest-api-specs/contents/specification/containerregistry/resource-manager/Microsoft.ContainerRegistry/preview/2025-03-01-preview',
      )
    if (entry.kind === 'PRICE') assert(allowedPrice(entry.url), 'NONALLOWLISTED_PRICE_READ')
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 3, 'ONE_READ_ONLY_MODE_REQUIRED')
  const mode = process.argv[2]
  assert(
    ['--capture', '--collect', '--resume', '--check'].includes(mode),
    'READ_ONLY_FLAGS_REQUIRED',
  )
  if (mode === '--capture') preserve()
  else if (mode === '--check') checkReads()
  else await collect(mode === '--resume')
}
