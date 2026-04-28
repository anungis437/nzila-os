'use client'

/**
 * Board export pack — Phase 12.
 *
 * Bundles every executive report into a single .md download. Useful for
 * board prep, investor updates, and offline review. Pure client component:
 * the parent server page passes the markdown bodies in already-rendered.
 */
import { useCallback } from 'react'
import { logReportExport } from './export-actions'

interface Section {
  title: string
  markdown: string
}

interface Props {
  sections: Section[]
  filename: string
  title: string
}

export function BoardPackExport({ sections, filename, title }: Props) {
  const handleClick = useCallback(() => {
    const stamp = new Date().toISOString().slice(0, 10)
    const lines: string[] = [`# ${title}`, '', `_Generated ${stamp}_`, '', '---', '']
    for (const s of sections) {
      lines.push(`# ${s.title}`, '', s.markdown.trim(), '', '---', '')
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    void logReportExport({ kind: 'board-pack', filename, byteCount: blob.size })
  }, [sections, filename, title])

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
    >
      Download board pack ({sections.length} reports)
    </button>
  )
}
