'use client'

/**
 * Download a report's markdown as a `.md` file. Client component because the
 * download flow needs `Blob` + `URL.createObjectURL`. No copy is held in
 * React state — the blob is built on click and revoked immediately after.
 */
import { useCallback } from 'react'
import { logReportExport } from './export-actions'

interface Props {
  markdown: string
  filename: string
  label?: string
  /** Audit kind, e.g. 'weekly-ceo-brief'. Derived from filename when absent. */
  kind?: string
}

export function ReportExportButton({ markdown, filename, label = 'Export .md', kind }: Props) {
  const handleClick = useCallback(() => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    // Fire-and-forget audit log; failure never breaks the download.
    void logReportExport({
      kind: kind ?? filename.replace(/-\d{4}-\d{2}-\d{2}\.md$/, ''),
      filename,
      byteCount: blob.size,
    })
  }, [markdown, filename, kind])

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
    >
      {label}
    </button>
  )
}
