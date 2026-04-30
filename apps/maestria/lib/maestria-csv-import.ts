/**
 * CSV import utilities for Maestria.
 * Parses and validates tabular product/order data before persistence.
 */

export type CsvImportRow = {
  sku: string
  name: string
  quantity: number
  unitPrice: number
  currency: string
  category?: string
}

export type CsvImportResult =
  | { ok: true; rows: CsvImportRow[]; skipped: number; warnings: string[] }
  | { ok: false; error: string }

const REQUIRED_HEADERS = ['sku', 'name', 'quantity', 'unitPrice', 'currency'] as const

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
}

function parseCsvLines(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')))
    .filter((cols) => cols.some((c) => c.length > 0))
}

export function parseMaestriaCsv(csvText: string): CsvImportResult {
  if (!csvText || !csvText.trim()) {
    return { ok: false, error: 'Empty CSV content' }
  }

  const lines = parseCsvLines(csvText)
  if (lines.length < 2) {
    return { ok: false, error: 'CSV must contain a header row and at least one data row' }
  }

  const rawHeaders = lines[0].map(normalizeHeader)
  for (const required of REQUIRED_HEADERS) {
    if (!rawHeaders.includes(required)) {
      return { ok: false, error: `Missing required column: "${required}"` }
    }
  }

  const idx = Object.fromEntries(rawHeaders.map((h, i) => [h, i])) as Record<string, number>

  const rows: CsvImportRow[] = []
  const warnings: string[] = []
  let skipped = 0

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]
    const sku = cols[idx.sku] ?? ''
    const name = cols[idx.name] ?? ''
    const quantityRaw = cols[idx.quantity] ?? ''
    const unitPriceRaw = cols[idx.unit_price ?? idx.unitprice ?? idx.unitPrice] ?? '0'
    const currency = (cols[idx.currency] ?? 'CAD').toUpperCase()

    if (!sku || !name) {
      warnings.push(`Row ${i + 1}: missing sku or name — skipped`)
      skipped++
      continue
    }

    const quantity = parseInt(quantityRaw, 10)
    const unitPrice = parseFloat(unitPriceRaw)

    if (isNaN(quantity) || quantity < 0) {
      warnings.push(`Row ${i + 1} (${sku}): invalid quantity "${quantityRaw}" — skipped`)
      skipped++
      continue
    }

    if (isNaN(unitPrice) || unitPrice < 0) {
      warnings.push(`Row ${i + 1} (${sku}): invalid unitPrice "${unitPriceRaw}" — skipped`)
      skipped++
      continue
    }

    if (!['CAD', 'USD', 'EUR', 'GBP'].includes(currency)) {
      warnings.push(`Row ${i + 1} (${sku}): unrecognised currency "${currency}" — defaulting to CAD`)
    }

    rows.push({
      sku,
      name,
      quantity,
      unitPrice,
      currency: ['CAD', 'USD', 'EUR', 'GBP'].includes(currency) ? currency : 'CAD',
      category: idx.category !== undefined ? (cols[idx.category] ?? undefined) : undefined,
    })
  }

  if (rows.length === 0) {
    return { ok: false, error: 'No valid rows found after parsing' }
  }

  return { ok: true, rows, skipped, warnings }
}
