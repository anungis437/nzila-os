/**
 * CFO — Bulk BN / NEQ Validator (Client Component).
 *
 * Allows accountants to paste or upload a list of Business Numbers,
 * validates them in bulk using @nzila/tax, and shows results with
 * audit-trail export capabilities.
 */
'use client'

import { useState, useCallback, useTransition } from 'react'
import {
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Loader2,
  Copy,
  FileText,
} from 'lucide-react'
import {
  validateBusinessNumbers,
  validateNeqs,
  buildValidationAuditEntry,
  type BulkValidationResult,
  type BulkValidationItem,
} from '@nzila/tax'

/* ── Types ────────────────────────────────────────────────────────────────── */

type InputMode = 'paste' | 'upload'

/* ── Component ────────────────────────────────────────────────────────────── */

export function BnValidator() {
  const [mode, setMode] = useState<InputMode>('paste')
  const [rawInput, setRawInput] = useState('')
  const [results, setResults] = useState<BulkValidationResult | null>(null)
  const [isNeq, setIsNeq] = useState(false)
  const [isPending, startTransition] = useTransition()

  /* ── Parse input ─────────────────────────────────────────────────────── */

  const parseItems = useCallback((text: string): string[] => {
    return text
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }, [])

  /* ── Validate ────────────────────────────────────────────────────────── */

  const handleValidate = useCallback(() => {
    const items = parseItems(rawInput)
    if (items.length === 0) return

    startTransition(() => {
      const validationResults = isNeq
        ? validateNeqs(items)
        : validateBusinessNumbers(items)

      setResults(validationResults)
    })
  }, [rawInput, isNeq, parseItems])

  /* ── CSV upload handler ──────────────────────────────────────────────── */

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setRawInput(text)
    }
    reader.readAsText(file)
  }, [])

  /* ── Export audit trail ──────────────────────────────────────────────── */

  const handleExportAudit = useCallback(() => {
    if (!results) return
    const entries = results.items.map((item) =>
      buildValidationAuditEntry(
        item.input,
        isNeq ? 'neq' : 'bn9',
        item.result,
        'cfo-user',
      ),
    )
    const csv = [
      'Input,Valid,Errors,Timestamp',
      ...entries.map(
        (e) => `"${e.input}",${e.valid},"${e.errors?.join('; ') ?? ''}","${e.timestamp}"`,
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bn-validation-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [results, isNeq])

  /* ── Stats ────────────────────────────────────────────────────────────── */

  const validCount = results?.items.filter((item) => item.result.valid).length ?? 0
  const invalidCount = results?.items.filter((item) => !item.result.valid).length ?? 0

  return (
    <div className="space-y-6">
      {/* Mode selector + NEQ toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setMode('paste')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'paste'
                ? 'bg-electric text-white'
                : 'bg-background text-foreground hover:bg-secondary'
            }`}
          >
            <Copy className="mr-1.5 inline h-4 w-4" />
            Paste
          </button>
          <button
            onClick={() => setMode('upload')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'upload'
                ? 'bg-electric text-white'
                : 'bg-background text-foreground hover:bg-secondary'
            }`}
          >
            <Upload className="mr-1.5 inline h-4 w-4" />
            Upload CSV
          </button>
        </div>

        <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={isNeq}
            onChange={(e) => setIsNeq(e.target.checked)}
            className="rounded border-border accent-electric"
          />
          NEQ (Québec) mode
        </label>
      </div>

      {/* Input area */}
      {mode === 'paste' ? (
        <textarea
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder="Paste BN numbers (one per line, or comma/semicolon separated)…"
          rows={6}
          className="w-full rounded-lg border border-border bg-background px-4 py-3 font-mono text-sm
                     text-foreground placeholder:text-muted-foreground
                     focus:outline-none focus:ring-2 focus:ring-electric/40 resize-y"
        />
      ) : (
        <label className="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed
                          border-border bg-background px-6 py-10 text-sm text-muted-foreground
                          transition-colors hover:border-electric/40 hover:bg-secondary/50">
          <FileText className="mr-2 h-5 w-5" />
          {rawInput ? `${parseItems(rawInput).length} items loaded` : 'Click or drop a CSV file'}
          <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
        </label>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleValidate}
          disabled={isPending || parseItems(rawInput).length === 0}
          className="rounded-lg bg-electric px-5 py-2.5 text-sm font-medium text-white
                     shadow-sm transition-colors hover:bg-electric/90
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-1.5 inline h-4 w-4" />
          )}
          Validate {parseItems(rawInput).length} {isNeq ? 'NEQs' : 'BNs'}
        </button>

        {results && (
          <button
            onClick={handleExportAudit}
            className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium
                       text-foreground transition-colors hover:bg-secondary"
          >
            <Download className="mr-1.5 inline h-4 w-4" />
            Export Audit Trail
          </button>
        )}
      </div>

      {/* Results */}
      {results && (
        <>
          {/* Summary badges */}
          <div className="flex gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1
                             text-sm font-medium text-green-600">
              <CheckCircle2 className="h-4 w-4" /> {validCount} valid
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1
                             text-sm font-medium text-red-600">
              <XCircle className="h-4 w-4" /> {invalidCount} invalid
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Input</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {results.items.map((item, i) => (
                  <tr key={i} className="hover:bg-secondary/50">
                    <td className="px-4 py-3 font-mono text-foreground">{item.input}</td>
                    <td className="px-4 py-3">
                      {item.result.valid ? (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Valid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600">
                          <XCircle className="h-3.5 w-3.5" /> Invalid
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.result.errors?.join('; ') ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
