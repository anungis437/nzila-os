import { NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { getLabelDashboardData, type LabelRangePreset } from '@/lib/actions/label-analytics-actions'

function toCsvRows(data: Awaited<ReturnType<typeof getLabelDashboardData>>): string {
  const lines: string[] = []
  lines.push('metric,value')
  lines.push(`total_streams,${data.totals.totalStreams}`)
  lines.push(`unique_listeners,${data.totals.uniqueListeners}`)
  lines.push(`repeat_listeners,${data.totals.repeatListeners}`)
  lines.push(`saves,${data.totals.saves}`)
  lines.push(`follows,${data.totals.follows}`)
  lines.push(`completion_pct,${data.totals.completionPct.toFixed(2)}`)
  lines.push(`event_campaign_traffic,${data.totals.eventCampaignTraffic}`)

  lines.push('')
  lines.push('top_song,streams')
  for (const row of data.topSongs) lines.push(`"${row.title.replaceAll('"', '""')}",${row.streams}`)

  lines.push('')
  lines.push('top_artist,streams')
  for (const row of data.topArtists) lines.push(`"${row.artist.replaceAll('"', '""')}",${row.streams}`)

  return lines.join('\n')
}

function toPdfSummaryText(data: Awaited<ReturnType<typeof getLabelDashboardData>>): string {
  return [
    'Zonga Label Dashboard — Executive Summary',
    `Range: ${data.range.startIso} to ${data.range.endIso}`,
    '',
    `Total streams: ${data.totals.totalStreams}`,
    `Unique listeners: ${data.totals.uniqueListeners}`,
    `Repeat listeners: ${data.totals.repeatListeners}`,
    `Saves: ${data.totals.saves}`,
    `Follows: ${data.totals.follows}`,
    `Completion: ${data.totals.completionPct.toFixed(1)}%`,
    `Event campaign traffic: ${data.totals.eventCampaignTraffic}`,
    '',
    'Top songs:',
    ...data.topSongs.slice(0, 10).map((row) => `- ${row.title}: ${row.streams}`),
    '',
    'Top artists:',
    ...data.topArtists.slice(0, 10).map((row) => `- ${row.artist}: ${row.streams}`),
    '',
    'Top countries:',
    ...data.topCountries.slice(0, 10).map((row) => `- ${row.country}: ${row.streams}`),
  ].join('\n')
}

function escapePdfText(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')
}

function buildPdfBuffer(text: string): Uint8Array {
  const lines = text.split('\n').slice(0, 55)
  const textOps = lines
    .map((line, idx) => `1 0 0 1 50 ${780 - idx * 14} Tm (${escapePdfText(line)}) Tj`)
    .join('\n')

  const contentStream = `BT\n/F1 10 Tf\n${textOps}\nET`
  const pdfParts: string[] = []
  pdfParts.push('%PDF-1.4\n')

  const offsets: number[] = [0]
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n',
    `5 0 obj << /Length ${contentStream.length} >> stream\n${contentStream}\nendstream endobj\n`,
  ]

  for (const obj of objects) {
    const current = pdfParts.join('').length
    offsets.push(current)
    pdfParts.push(obj)
  }

  const xrefOffset = pdfParts.join('').length
  pdfParts.push('xref\n0 6\n0000000000 65535 f \n')
  for (let i = 1; i <= 5; i += 1) {
    pdfParts.push(`${offsets[i].toString().padStart(10, '0')} 00000 n \n`)
  }
  pdfParts.push(`trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`)

  return new TextEncoder().encode(pdfParts.join(''))
}

export async function GET(request: Request) {
  return withOrgScope(request, () =>
    withSpan('zonga.analytics.label-export.get', { 'http.method': 'GET' }, async () => {
      const url = new URL(request.url)
      const format = (url.searchParams.get('format') ?? 'csv').toLowerCase()
      const preset = (url.searchParams.get('preset') ?? '30d') as LabelRangePreset
      const start = url.searchParams.get('start') ?? undefined
      const end = url.searchParams.get('end') ?? undefined

      const data = await getLabelDashboardData({ preset, start, end })

      if (format === 'csv') {
        const csv = toCsvRows(data)
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="zonga-label-dashboard-${preset}.csv"`,
          },
        })
      }

      const summary = toPdfSummaryText(data)
      const pdfBuffer = buildPdfBuffer(summary)
      return new NextResponse(Buffer.from(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="zonga-label-dashboard-${preset}.pdf"`,
        },
      })
    }),
  )
}
