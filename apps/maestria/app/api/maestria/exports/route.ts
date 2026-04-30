import { NextRequest, NextResponse } from 'next/server'
import { authorizeRequest } from '@/lib/api-authorization'
import { exportReports } from '@/lib/shopmoica-pilot-data'

export async function GET(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  const auth = authorizeRequest(searchParams, 'export.download', 'export.download', 'report:commerce-operating-pack')
  if (auth.response) return auth.response

  const requestedReport = exportReports.find((report) => report.id === searchParams.report) ?? exportReports[0]
  const requestedFormat = searchParams.format?.toUpperCase()
  const format = requestedFormat === 'CSV' || requestedFormat === 'PDF' ? requestedFormat : requestedReport.format
  const filename = requestedReport.filename.replace(/\.(csv|pdf)$/i, format.toLowerCase())

  return NextResponse.json({
    ok: true,
    requestedBy: auth.actor.displayName,
    role: auth.actor.role,
    export: {
      id: requestedReport.id,
      name: requestedReport.name,
      audience: requestedReport.audience,
      format,
      filename,
      generatedAt: new Date().toISOString(),
      rows: 142,
      redaction: auth.actor.role === 'owner' ? 'none' : 'owner-sensitive fields masked',
      polish: {
        coverTitle: `Shop Moi Ça · ${requestedReport.name}`,
        note: requestedReport.polishNote,
        sections: ['Executive summary', 'Operational snapshot', 'Financial detail', 'Owner handoff actions'],
      },
      downloadUrl: `/api/maestria/exports/download?report=${requestedReport.id}&format=${format.toLowerCase()}&as=${searchParams.as ?? 'lissa'}`,
    },
  })
}
