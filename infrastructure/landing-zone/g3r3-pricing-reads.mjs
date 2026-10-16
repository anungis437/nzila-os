import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { evidence, hash } from './g3r2i-preservation.mjs'
import { verifyPreservation } from './g3r3-read-census.mjs'

export const queries = [
  ['vault-regional', "serviceName eq 'Key Vault' and armRegionName eq 'canadacentral'"],
  ['vault-global-catalog', "serviceName eq 'Key Vault'"],
  ['registry-regional', "serviceName eq 'Container Registry' and armRegionName eq 'canadacentral'"],
  ['registry-global-catalog', "serviceName eq 'Container Registry'"],
  [
    'builder-b2s',
    "serviceName eq 'Virtual Machines' and armSkuName eq 'Standard_B2s' and armRegionName eq 'canadacentral'",
  ],
  [
    'disk-e4',
    "serviceName eq 'Storage' and armRegionName eq 'canadacentral' and contains(meterName, 'E4')",
  ],
  ['bandwidth-regional', "serviceName eq 'Bandwidth' and armRegionName eq 'canadacentral'"],
  ['bandwidth-catalog', "serviceName eq 'Bandwidth'"],
]
export async function collectPricing(resume = false) {
  verifyPreservation()
  const ledgerPath = path.join(evidence, 'G3R3_PUBLIC_READ_LEDGER.json')
  assert(resume || !existsSync(ledgerPath), 'PUBLIC_READ_LEDGER_EXISTS_REFUSE_OVERWRITE')
  const ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : []
  for (const [name, filter] of queries) {
    if (resume && existsSync(path.join(evidence, `G3R3_PRICE_${name}.json`))) continue
    const first = new URL('https://prices.azure.com/api/retail/prices')
    first.searchParams.set('api-version', '2023-01-01-preview')
    first.searchParams.set('currencyCode', "'CAD'")
    first.searchParams.set('$filter', `${filter} and priceType eq 'Consumption'`)
    const items = []
    let url = first.href
    let pages = 0
    while (url) {
      assert(++pages <= 10, 'PRICING_PAGINATION_LIMIT')
      const target = new URL(url)
      assert.equal(target.origin, 'https://prices.azure.com')
      const entry = {
        name,
        url,
        method: 'GET',
        mutation: false,
        startedAtUtc: new Date().toISOString(),
        status: 'STARTED',
        responseFile: `G3R3_PRICE_RAW_${ledger.length + 1}.json`,
      }
      ledger.push(entry)
      writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`)
      const response = await fetch(url, { signal: AbortSignal.timeout(60000) })
      const text = await response.text()
      writeFileSync(path.join(evidence, entry.responseFile), text)
      Object.assign(entry, {
        httpStatus: response.status,
        status: response.ok ? 'SUCCEEDED' : 'FAILED',
        completedAtUtc: new Date().toISOString(),
        responseSha256: hash(text),
      })
      writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`)
      assert(response.ok, `PRICING_READ_FAILED:${name}:${response.status}`)
      const result = JSON.parse(text)
      for (const item of result.Items) {
        assert.equal(item.currencyCode, 'CAD')
        if (item.isPrimaryMeterRegion) items.push(item)
      }
      url = result.NextPageLink
    }
    writeFileSync(
      path.join(evidence, `G3R3_PRICE_${name}.json`),
      `${JSON.stringify({ filter, currency: 'CAD', items, pages, emptyResultNotZeroCost: true }, null, 2)}\n`,
    )
    console.log(`PUBLIC_PRICE_GET:${name}:${items.length} primary CAD meters`)
  }
  verifyPreservation()
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === '--resume'))
  await collectPricing(process.argv[2] === '--resume')
}
