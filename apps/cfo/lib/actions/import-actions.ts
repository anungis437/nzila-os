/**
 * CFO Server Actions — Bulk client import via CSV.
 *
 * Parses a CSV file and batch-creates orgs.
 * Expected CSV columns: name, email, jurisdiction, incorporationNumber,
 * fiscalYearEnd, businessType, industry, phone
 */
'use server'

import { auth } from '@nzila/platform-auth/entra/server'
import { requirePermission } from '@/lib/rbac'
import { platformDb } from '@nzila/db/platform'
import { orgs } from '@nzila/db/schema'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'

interface ImportRow {
  name: string
  email?: string
  jurisdiction?: string
  incorporationNumber?: string
  fiscalYearEnd?: string
  businessType?: string
  industry?: string
  phone?: string
}

interface ImportResult {
  ok: boolean
  imported: number
  skipped: number
  errors: string[]
}

/**
 * Parse raw CSV text into structured rows.
 * Handles quoted fields and trims whitespace.
 */
function parseCsv(csvText: string): { headers: string[]; rows: string[][] } {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return { headers: [], rows: [] }

  const parseLine = (line: string): string[] => {
    const fields: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    fields.push(current.trim())
    return fields
  }

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ''))
  const rows = lines.slice(1).map(parseLine)
  return { headers, rows }
}

// Map common CSV header variations to our canonical field names
const HEADER_ALIASES: Record<string, keyof ImportRow> = {
  name: 'name',
  legalname: 'name',
  legal_name: 'name',
  clientname: 'name',
  client_name: 'name',
  company: 'name',
  companyname: 'name',
  email: 'email',
  contactemail: 'email',
  contact_email: 'email',
  jurisdiction: 'jurisdiction',
  province: 'jurisdiction',
  prov: 'jurisdiction',
  incorporationnumber: 'incorporationNumber',
  incorporation_number: 'incorporationNumber',
  federalbn: 'incorporationNumber',
  federal_bn: 'incorporationNumber',
  bn: 'incorporationNumber',
  businessnumber: 'incorporationNumber',
  fiscalyearend: 'fiscalYearEnd',
  fiscal_year_end: 'fiscalYearEnd',
  fye: 'fiscalYearEnd',
  yearend: 'fiscalYearEnd',
  businesstype: 'businessType',
  business_type: 'businessType',
  type: 'businessType',
  industry: 'industry',
  sector: 'industry',
  phone: 'phone',
  telephone: 'phone',
  tel: 'phone',
}

const PROVINCE_ALIASES: Record<string, string> = {
  ontario: 'CA-ON',
  on: 'CA-ON',
  quebec: 'CA-QC',
  qc: 'CA-QC',
  'british columbia': 'CA-BC',
  bc: 'CA-BC',
  alberta: 'CA-AB',
  ab: 'CA-AB',
  saskatchewan: 'CA-SK',
  sk: 'CA-SK',
  manitoba: 'CA-MB',
  mb: 'CA-MB',
  'new brunswick': 'CA-NB',
  nb: 'CA-NB',
  'nova scotia': 'CA-NS',
  ns: 'CA-NS',
  'prince edward island': 'CA-PE',
  pe: 'CA-PE',
  pei: 'CA-PE',
  'newfoundland': 'CA-NL',
  nl: 'CA-NL',
  yukon: 'CA-YT',
  yt: 'CA-YT',
  'northwest territories': 'CA-NT',
  nt: 'CA-NT',
  nunavut: 'CA-NU',
  nu: 'CA-NU',
}

function normalizeProvince(raw?: string): string {
  if (!raw) return 'CA-ON'
  const trimmed = raw.trim()
  // Already in CA-XX format
  if (/^CA-[A-Z]{2}$/.test(trimmed)) return trimmed
  return PROVINCE_ALIASES[trimmed.toLowerCase()] ?? 'CA-ON'
}

export async function importClientsFromCsv(csvText: string): Promise<ImportResult> {
  const { userId } = await auth()
  if (!userId) return { ok: false, imported: 0, skipped: 0, errors: ['Unauthorized'] }
  await requirePermission('clients:create')

  const { headers, rows } = parseCsv(csvText)
  if (headers.length === 0) {
    return { ok: false, imported: 0, skipped: 0, errors: ['CSV appears empty or has no headers.'] }
  }

  // Map headers to canonical field names
  const headerMap = headers.map((h) => HEADER_ALIASES[h] ?? null)
  const nameIdx = headerMap.indexOf('name')
  if (nameIdx === -1) {
    return {
      ok: false,
      imported: 0,
      skipped: 0,
      errors: [`Could not find a "name" column. Found headers: ${headers.join(', ')}`],
    }
  }

  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // 1-indexed + header row

    // Build an ImportRow from the mapped columns
    const record: ImportRow = { name: '' }
    for (let j = 0; j < headerMap.length; j++) {
      const field = headerMap[j]
      if (field && row[j]) {
        ;(record as unknown as Record<string, string>)[field] = row[j]
      }
    }

    if (!record.name.trim()) {
      errors.push(`Row ${rowNum}: Skipped — name is empty`)
      skipped++
      continue
    }

    try {
      await platformDb.insert(orgs).values({
        legalName: record.name.trim(),
        jurisdiction: normalizeProvince(record.jurisdiction),
        incorporationNumber: record.incorporationNumber?.trim() || null,
        fiscalYearEnd: record.fiscalYearEnd?.trim() || null,
        status: 'active',
        policyConfig: {
          contactEmail: record.email?.trim() || null,
          businessType: record.businessType?.trim() || null,
          industry: record.industry?.trim() || null,
          phone: record.phone?.trim() || null,
          importedFrom: 'csv',
        },
      })
      imported++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`Row ${rowNum} (${record.name}): ${msg}`)
      skipped++
    }
  }

  logger.info('CSV import completed', { imported, skipped, errorCount: errors.length, actorId: userId })
  revalidatePath('/dashboard/clients')
  return { ok: imported > 0, imported, skipped, errors: errors.slice(0, 20) }
}
