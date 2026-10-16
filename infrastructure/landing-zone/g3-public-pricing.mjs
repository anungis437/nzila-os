import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('./g3-readiness-evidence/', import.meta.url))
mkdirSync(directory, { recursive: true })
const ledgerPath = path.join(directory, 'public-pricing-read-ledger.json')
const ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : []
const fallback = process.argv.includes('--network-fallback')
const foundationFallback = process.argv.includes('--foundation-fallback')
assert(
  process.argv
    .slice(2)
    .every((argument) => ['--network-fallback', '--foundation-fallback'].includes(argument)),
  'UNSUPPORTED_PUBLIC_PRICE_FLAG',
)
const services = foundationFallback
  ? ['Key Vault', 'Container Registry', 'Azure DNS']
  : fallback
    ? ['Virtual Network', 'Load Balancer', 'Azure Firewall', 'Azure Private Link', 'IP Addresses']
    : [
        'Azure Container Apps',
        'Azure Monitor',
        'Log Analytics',
        'Key Vault',
        'Azure DNS',
        'Virtual Network',
        'Load Balancer',
        'Container Registry',
        'Azure Firewall',
        'Virtual Machines',
        'Storage',
        'Bandwidth',
      ]
const persist = (name, data) =>
  writeFileSync(path.join(directory, name), `${JSON.stringify(data, null, 2)}\n`)
let requestIndex = ledger.length
for (const service of services) {
  const global = service === 'Azure DNS' || fallback || foundationFallback
  const selected =
    service === 'Virtual Machines'
      ? " and armSkuName eq 'Standard_B1s'"
      : service === 'Storage'
        ? " and (contains(meterName, 'E4') or contains(meterName, 'Standard SSD'))"
        : ''
  const filter = `serviceName eq '${service}' and priceType eq 'Consumption'${global ? '' : " and armRegionName eq 'canadacentral'"}${selected}`
  const first = new URL('https://prices.azure.com/api/retail/prices')
  first.searchParams.set('api-version', '2023-01-01-preview')
  first.searchParams.set('currencyCode', "'CAD'")
  first.searchParams.set('$filter', filter)
  let url = first.href
  const items = []
  let pages = 0
  while (url) {
    pages++
    assert(pages <= 10, 'PUBLIC_PRICING_PAGINATION_LIMIT')
    const request = new URL(url)
    assert.equal(request.hostname, 'prices.azure.com', 'UNEXPECTED_PRICING_HOST')
    const entry = {
      name: service,
      method: 'GET',
      url,
      startedAtUtc: new Date().toISOString(),
      status: 'STARTED',
      mutation: false,
    }
    ledger.push(entry)
    persist('public-pricing-read-ledger.json', ledger)
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) })
    const bytes = await response.text()
    entry.httpStatus = response.status
    entry.completedAtUtc = new Date().toISOString()
    entry.responseFile = `pricing-response-${++requestIndex}.json`
    entry.responseSha256 = createHash('sha256').update(bytes).digest('hex')
    entry.status = response.ok ? 'SUCCEEDED' : 'FAILED'
    writeFileSync(path.join(directory, entry.responseFile), bytes)
    persist('public-pricing-read-ledger.json', ledger)
    assert(response.ok, `PUBLIC_PRICING_HTTP_FAILURE:${service}:${response.status}`)
    const result = JSON.parse(bytes)
    assert(Array.isArray(result.Items), 'PUBLIC_PRICING_ITEMS_REQUIRED')
    for (const item of result.Items) {
      assert.equal(item.currencyCode, 'CAD', 'CAD_PRICING_REQUIRED')
      if (item.isPrimaryMeterRegion) items.push(item)
    }
    url = result.NextPageLink
  }
  persist(
    `pricing-${service.replaceAll(' ', '-')}${fallback || foundationFallback ? '-global-fallback' : ''}.json`,
    {
      service,
      currency: 'CAD',
      filter,
      items,
      pages,
      emptyResultIsNotZeroCost: true,
    },
  )
  console.log(`CAD_READ_ONLY ${service}: ${items.length} primary meters`)
}
