/**
 * Excel Export — .xlsx Workbook Generation Engine
 *
 * Generates formatted Excel workbooks for financial reports including
 * trial balance, income statement, balance sheet, GL detail, T2 schedules,
 * payroll summaries, and custom report templates.
 *
 * Uses a lightweight builder pattern — no external xlsx library required.
 * Produces Office Open XML .xlsx files (ZIP of XML parts).
 *
 * @module cfo/excel-export
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type CellType = 'string' | 'number' | 'date' | 'formula' | 'boolean'

export interface CellValue {
  value: string | number | boolean | null
  type: CellType
  format?: string
  bold?: boolean
  italic?: boolean
  align?: 'left' | 'center' | 'right'
  fillColor?: string
  fontColor?: string
  colspan?: number
  rowspan?: number
}

export interface SheetColumn {
  header: string
  key: string
  width?: number
  type?: CellType
  format?: string
  align?: 'left' | 'center' | 'right'
  totalFormula?: 'sum' | 'average' | 'count' | 'none'
}

export interface SheetDefinition {
  name: string
  columns: SheetColumn[]
  rows: Record<string, string | number | boolean | null>[]
  headerStyle?: {
    bold?: boolean
    fillColor?: string
    fontColor?: string
  }
  freezePane?: { row: number; col: number }
  autoFilter?: boolean
  showTotals?: boolean
}

export interface WorkbookDefinition {
  filename: string
  creator?: string
  title?: string
  sheets: SheetDefinition[]
}

export interface ExportResult {
  filename: string
  buffer: Buffer
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  sheetCount: number
  totalRows: number
}

// ── XML Helpers ─────────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function colLetter(index: number): string {
  let result = ''
  let n = index
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result
    n = Math.floor(n / 26) - 1
  }
  return result
}

function cellRef(col: number, row: number): string {
  return `${colLetter(col)}${row}`
}

// ── Shared Strings ──────────────────────────────────────────────────────────

class SharedStrings {
  private strings = new Map<string, number>()
  private list: string[] = []

  add(str: string): number {
    const existing = this.strings.get(str)
    if (existing !== undefined) return existing
    const idx = this.list.length
    this.strings.set(str, idx)
    this.list.push(str)
    return idx
  }

  toXml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${this.list.length}" uniqueCount="${this.list.length}">
${this.list.map((s) => `<si><t>${escapeXml(s)}</t></si>`).join('\n')}
</sst>`
  }

  get count(): number { return this.list.length }
}

// ── Sheet XML Generator ─────────────────────────────────────────────────────

function generateSheetXml(
  sheet: SheetDefinition,
  sharedStrings: SharedStrings,
): string {
  const { columns, rows, freezePane, autoFilter, showTotals, headerStyle } = sheet
  const lines: string[] = []

  lines.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')
  lines.push('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">')

  // Column widths
  lines.push('<cols>')
  columns.forEach((col, i) => {
    const width = col.width ?? 12
    lines.push(`<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`)
  })
  lines.push('</cols>')

  // Freeze pane
  if (freezePane) {
    lines.push('<sheetViews><sheetView tabSelected="1" workbookViewId="0">')
    lines.push(`<pane ySplit="${freezePane.row}" xSplit="${freezePane.col}" topLeftCell="${cellRef(freezePane.col, freezePane.row + 1)}" activePane="bottomRight" state="frozen"/>`)
    lines.push('</sheetView></sheetViews>')
  }

  lines.push('<sheetData>')

  // Header row
  const headerRow = 1
  lines.push(`<row r="${headerRow}">`)
  columns.forEach((col, i) => {
    const ssi = sharedStrings.add(col.header)
    const style = headerStyle?.bold ? ' s="1"' : ''
    lines.push(`<c r="${cellRef(i, headerRow)}" t="s"${style}><v>${ssi}</v></c>`)
  })
  lines.push('</row>')

  // Data rows
  rows.forEach((row, rowIdx) => {
    const r = rowIdx + 2
    lines.push(`<row r="${r}">`)
    columns.forEach((col, colIdx) => {
      const val = row[col.key]
      if (val == null) return

      const ref = cellRef(colIdx, r)

      if (typeof val === 'number') {
        lines.push(`<c r="${ref}"><v>${val}</v></c>`)
      } else if (typeof val === 'boolean') {
        lines.push(`<c r="${ref}" t="b"><v>${val ? 1 : 0}</v></c>`)
      } else {
        const ssi = sharedStrings.add(String(val))
        lines.push(`<c r="${ref}" t="s"><v>${ssi}</v></c>`)
      }
    })
    lines.push('</row>')
  })

  // Totals row
  if (showTotals && rows.length > 0) {
    const totalsRow = rows.length + 2
    lines.push(`<row r="${totalsRow}">`)
    columns.forEach((col, i) => {
      const formula = col.totalFormula ?? 'none'
      if (formula === 'none') {
        if (i === 0) {
          const ssi = sharedStrings.add('Total')
          lines.push(`<c r="${cellRef(i, totalsRow)}" t="s" s="1"><v>${ssi}</v></c>`)
        }
        return
      }

      const fn = formula.toUpperCase()
      const range = `${cellRef(i, 2)}:${cellRef(i, rows.length + 1)}`
      lines.push(`<c r="${cellRef(i, totalsRow)}"><f>${fn}(${range})</f></c>`)
    })
    lines.push('</row>')
  }

  lines.push('</sheetData>')

  // Auto-filter
  if (autoFilter) {
    const lastCol = colLetter(columns.length - 1)
    const lastRow = rows.length + 1
    lines.push(`<autoFilter ref="A1:${lastCol}${lastRow}"/>`)
  }

  lines.push('</worksheet>')
  return lines.join('\n')
}

// ── Workbook Assembly ───────────────────────────────────────────────────────

function generateContentTypesXml(sheetCount: number): string {
  const sheetTypes = Array.from({ length: sheetCount }, (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('\n')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheetTypes}
</Types>`
}

function generateWorkbookXml(sheets: SheetDefinition[]): string {
  const sheetEntries = sheets.map((s, i) =>
    `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
  ).join('\n')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
${sheetEntries}
</sheets>
</workbook>`
}

function generateWorkbookRelsXml(sheetCount: number): string {
  const sheetRels = Array.from({ length: sheetCount }, (_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
  ).join('\n')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheetRels}
<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
<Relationship Id="rId${sheetCount + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
}

function generateStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2">
  <font><sz val="11"/><name val="Calibri"/></font>
  <font><b/><sz val="11"/><name val="Calibri"/></font>
</fonts>
<fills count="2">
  <fill><patternFill patternType="none"/></fill>
  <fill><patternFill patternType="gray125"/></fill>
</fills>
<borders count="1">
  <border><left/><right/><top/><bottom/><diagonal/></border>
</borders>
<cellStyleXfs count="1">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
</cellStyleXfs>
<cellXfs count="2">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
</styleSheet>`
}

function generateRootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
}

// ── ZIP (PKZIP) Builder ─────────────────────────────────────────────────────

interface ZipEntry { path: string; data: Buffer }

function buildZip(entries: ZipEntry[]): Buffer {
  const centralDirectory: Buffer[] = []
  const fileEntries: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const pathBuf = Buffer.from(entry.path, 'utf8')
    const data = entry.data

    // Local file header
    const local = Buffer.alloc(30 + pathBuf.length)
    local.writeUInt32LE(0x04034b50, 0) // signature
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0, 6) // flags
    local.writeUInt16LE(0, 8) // compression (store)
    local.writeUInt16LE(0, 10) // mod time
    local.writeUInt16LE(0, 12) // mod date
    local.writeUInt32LE(crc32(data), 14) // crc32
    local.writeUInt32LE(data.length, 18) // compressed size
    local.writeUInt32LE(data.length, 22) // uncompressed size
    local.writeUInt16LE(pathBuf.length, 26) // filename length
    local.writeUInt16LE(0, 28) // extra field length
    pathBuf.copy(local, 30)

    // Central directory entry
    const central = Buffer.alloc(46 + pathBuf.length)
    central.writeUInt32LE(0x02014b50, 0) // signature
    central.writeUInt16LE(20, 4) // version made by
    central.writeUInt16LE(20, 6) // version needed
    central.writeUInt16LE(0, 8) // flags
    central.writeUInt16LE(0, 10) // compression
    central.writeUInt16LE(0, 12) // mod time
    central.writeUInt16LE(0, 14) // mod date
    central.writeUInt32LE(crc32(data), 16) // crc32
    central.writeUInt32LE(data.length, 20) // compressed size
    central.writeUInt32LE(data.length, 24) // uncompressed size
    central.writeUInt16LE(pathBuf.length, 28) // filename length
    central.writeUInt16LE(0, 30) // extra field length
    central.writeUInt16LE(0, 32) // file comment length
    central.writeUInt16LE(0, 34) // disk number start
    central.writeUInt16LE(0, 36) // internal file attributes
    central.writeUInt32LE(0, 38) // external file attributes
    central.writeUInt32LE(offset, 42) // relative offset
    pathBuf.copy(central, 46)

    fileEntries.push(local, data)
    centralDirectory.push(central)
    offset += local.length + data.length
  }

  // End of central directory
  const cdSize = centralDirectory.reduce((s, b) => s + b.length, 0)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0) // signature
  eocd.writeUInt16LE(0, 4) // disk number
  eocd.writeUInt16LE(0, 6) // disk with CD
  eocd.writeUInt16LE(entries.length, 8) // entries on disk
  eocd.writeUInt16LE(entries.length, 10) // total entries
  eocd.writeUInt32LE(cdSize, 12) // CD size
  eocd.writeUInt32LE(offset, 16) // CD offset
  eocd.writeUInt16LE(0, 20) // comment length

  return Buffer.concat([...fileEntries, ...centralDirectory, eocd])
}

/** CRC-32 (ISO 3309) */
function crc32(buf: Buffer): number {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0)
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate a complete .xlsx workbook from a definition.
 */
export function generateWorkbook(definition: WorkbookDefinition): ExportResult {
  const sharedStrings = new SharedStrings()
  const sheetXmls = definition.sheets.map((sheet) =>
    generateSheetXml(sheet, sharedStrings),
  )

  const files: ZipEntry[] = [
    { path: '[Content_Types].xml', data: Buffer.from(generateContentTypesXml(definition.sheets.length)) },
    { path: '_rels/.rels', data: Buffer.from(generateRootRelsXml()) },
    { path: 'xl/workbook.xml', data: Buffer.from(generateWorkbookXml(definition.sheets)) },
    { path: 'xl/_rels/workbook.xml.rels', data: Buffer.from(generateWorkbookRelsXml(definition.sheets.length)) },
    { path: 'xl/sharedStrings.xml', data: Buffer.from(sharedStrings.toXml()) },
    { path: 'xl/styles.xml', data: Buffer.from(generateStylesXml()) },
    ...sheetXmls.map((xml, i) => ({
      path: `xl/worksheets/sheet${i + 1}.xml`,
      data: Buffer.from(xml),
    })),
  ]

  const buffer = buildZip(files)
  const totalRows = definition.sheets.reduce((sum, s) => sum + s.rows.length, 0)

  return {
    filename: definition.filename,
    buffer,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sheetCount: definition.sheets.length,
    totalRows,
  }
}

/**
 * Helper: create a trial balance export.
 */
export function trialBalanceWorkbook(
  accounts: { code: string; name: string; debit: number; credit: number }[],
  asOfDate: string,
  orgName: string,
): WorkbookDefinition {
  return {
    filename: `trial-balance-${asOfDate}.xlsx`,
    title: `Trial Balance — ${orgName}`,
    creator: 'Nzila CFO',
    sheets: [{
      name: 'Trial Balance',
      columns: [
        { header: 'Account Code', key: 'code', width: 15, align: 'left' },
        { header: 'Account Name', key: 'name', width: 35, align: 'left' },
        { header: 'Debit', key: 'debit', width: 18, type: 'number', format: '#,##0.00', align: 'right', totalFormula: 'sum' },
        { header: 'Credit', key: 'credit', width: 18, type: 'number', format: '#,##0.00', align: 'right', totalFormula: 'sum' },
      ],
      rows: accounts,
      headerStyle: { bold: true, fillColor: '1F4E79', fontColor: 'FFFFFF' },
      freezePane: { row: 1, col: 0 },
      autoFilter: true,
      showTotals: true,
    }],
  }
}

/**
 * Helper: create a GL detail export.
 */
export function glDetailWorkbook(
  entries: {
    date: string
    journalId: string
    accountCode: string
    accountName: string
    description: string
    debit: number
    credit: number
    balance: number
  }[],
  period: string,
  orgName: string,
): WorkbookDefinition {
  return {
    filename: `gl-detail-${period}.xlsx`,
    title: `General Ledger Detail — ${orgName}`,
    creator: 'Nzila CFO',
    sheets: [{
      name: 'GL Detail',
      columns: [
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Journal ID', key: 'journalId', width: 15 },
        { header: 'Account', key: 'accountCode', width: 12 },
        { header: 'Account Name', key: 'accountName', width: 30 },
        { header: 'Description', key: 'description', width: 40 },
        { header: 'Debit', key: 'debit', width: 15, type: 'number', totalFormula: 'sum' },
        { header: 'Credit', key: 'credit', width: 15, type: 'number', totalFormula: 'sum' },
        { header: 'Balance', key: 'balance', width: 15, type: 'number' },
      ],
      rows: entries,
      headerStyle: { bold: true },
      freezePane: { row: 1, col: 0 },
      autoFilter: true,
      showTotals: true,
    }],
  }
}

/**
 * Helper: create a payroll summary export.
 */
export function payrollSummaryWorkbook(
  employees: {
    name: string
    employeeId: string
    grossPay: number
    cpp: number
    ei: number
    incomeTax: number
    otherDeductions: number
    netPay: number
  }[],
  period: string,
  orgName: string,
): WorkbookDefinition {
  return {
    filename: `payroll-summary-${period}.xlsx`,
    title: `Payroll Summary — ${orgName}`,
    creator: 'Nzila CFO',
    sheets: [{
      name: 'Payroll Summary',
      columns: [
        { header: 'Employee', key: 'name', width: 25 },
        { header: 'ID', key: 'employeeId', width: 12 },
        { header: 'Gross Pay', key: 'grossPay', width: 15, type: 'number', totalFormula: 'sum' },
        { header: 'CPP', key: 'cpp', width: 12, type: 'number', totalFormula: 'sum' },
        { header: 'EI', key: 'ei', width: 12, type: 'number', totalFormula: 'sum' },
        { header: 'Income Tax', key: 'incomeTax', width: 14, type: 'number', totalFormula: 'sum' },
        { header: 'Other', key: 'otherDeductions', width: 12, type: 'number', totalFormula: 'sum' },
        { header: 'Net Pay', key: 'netPay', width: 15, type: 'number', totalFormula: 'sum' },
      ],
      rows: employees,
      headerStyle: { bold: true, fillColor: '2E75B6', fontColor: 'FFFFFF' },
      freezePane: { row: 1, col: 0 },
      autoFilter: true,
      showTotals: true,
    }],
  }
}
