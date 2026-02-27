/**
 * CFO — CSV Client Import Form (Client Component).
 *
 * Drag-and-drop or click-to-browse CSV file, preview parsed rows,
 * and bulk-import clients.
 */
'use client'

import { useState, useTransition, useRef, useCallback } from 'react'
import { Loader2, CheckCircle2, Upload, FileSpreadsheet, X, AlertCircle } from 'lucide-react'
import { importClientsFromCsv } from '@/lib/actions/import-actions'

export function ClientImportForm() {
  const [isPending, startTransition] = useTransition()
  const [csvText, setCsvText] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [result, setResult] = useState<{
    ok: boolean
    imported: number
    skipped: number
    errors: string[]
  } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      setResult({ ok: false, imported: 0, skipped: 0, errors: ['Please select a .csv file.'] })
      return
    }
    setFileName(file.name)
    setResult(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      setCsvText(e.target?.result as string)
    }
    reader.readAsText(file)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  function handleImport() {
    if (!csvText) return

    startTransition(async () => {
      const res = await importClientsFromCsv(csvText)
      setResult(res)
      if (res.ok) {
        setCsvText(null)
        setFileName(null)
      }
    })
  }

  // Preview: parse first few lines for display
  const previewLines = csvText
    ?.split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(0, 6) ?? []

  return (
    <div className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm">
      <div>
        <h3 className="font-poppins text-base font-semibold text-foreground">Import Clients from CSV</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a CSV with columns: <strong>name</strong> (required), email, jurisdiction/province,
          incorporationNumber/federalBN, fiscalYearEnd, businessType, industry, phone.
        </p>
      </div>

      {/* Result banner */}
      {result && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            result.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-600'
          }`}
        >
          {result.ok ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>
                Imported <strong>{result.imported}</strong> client{result.imported !== 1 ? 's' : ''}
                {result.skipped > 0 && `, ${result.skipped} skipped`}.
              </span>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Import failed</p>
                {result.errors.map((err, i) => (
                  <p key={i} className="mt-0.5 text-xs">{err}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drop zone */}
      {!csvText ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setIsDragging(false)
          }}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-12 text-center transition-colors ${
            isDragging ? 'border-electric bg-electric/5' : 'border-border hover:border-electric/40 hover:bg-muted/30'
          }`}
        >
          <Upload className="mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Drag & drop a CSV file, or click to browse</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {/* File info */}
          <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
            <FileSpreadsheet className="h-5 w-5 text-electric" />
            <span className="flex-1 text-sm font-medium text-foreground">{fileName}</span>
            <button
              type="button"
              onClick={() => {
                setCsvText(null)
                setFileName(null)
                setResult(null)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Preview table */}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50">
                <tr>
                  {previewLines[0]?.split(',').map((h, i) => (
                    <th key={i} className="px-3 py-2 font-medium text-muted-foreground">
                      {h.replace(/"/g, '').trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewLines.slice(1).map((line, i) => (
                  <tr key={i} className="border-t border-border">
                    {line.split(',').map((cell, j) => (
                      <td key={j} className="px-3 py-2 text-foreground">
                        {cell.replace(/"/g, '').trim()}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {previewLines.length > 5 && (
              <p className="bg-muted/30 px-3 py-1.5 text-center text-xs text-muted-foreground">
                Preview showing first {previewLines.length - 1} rows…
              </p>
            )}
          </div>

          {/* Import button */}
          <button
            type="button"
            disabled={isPending}
            onClick={handleImport}
            className="inline-flex items-center gap-2 rounded-lg bg-electric px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-electric/90 disabled:opacity-50"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPending ? 'Importing…' : 'Import Clients'}
          </button>
        </div>
      )}

      {/* Template hint */}
      <p className="text-xs text-muted-foreground">
        Need a template?{' '}
        <a
          href="data:text/csv,name,email,province,federalBN,fiscalYearEnd,businessType,industry,phone%0AAcme%20Corp,info@acme.ca,ON,123456789RC0001,12-31,Corporation%20(CCPC),Technology,(613)%20555-0100"
          download="ledgeriq-import-template.csv"
          className="font-medium text-electric hover:underline"
        >
          Download CSV template
        </a>
      </p>
    </div>
  )
}
