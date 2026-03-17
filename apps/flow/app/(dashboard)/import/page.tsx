'use client'

import { useState } from 'react'
import {
  ArrowUpTrayIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import {
  validateLegacyDataAction,
  importLegacyRecordsAction,
} from '@/lib/actions'

type ImportStatus = 'idle' | 'validating' | 'importing' | 'done'

interface ImportResult {
  totalRecords: number
  successCount: number
  failureCount: number
  warningCount: number
  failures: { legacyId: string; error: string }[]
  warnings: { legacyId: string; message: string }[]
  durationMs: number
}

export default function ImportPage() {
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [jsonInput, setJsonInput] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  async function handleValidate() {
    setValidationErrors([])
    setStatus('validating')

    try {
      const data = JSON.parse(jsonInput)
      if (!Array.isArray(data)) {
        setValidationErrors(['Input must be a JSON array of legacy request objects'])
        setStatus('idle')
        return
      }

      const result = await validateLegacyDataAction(data)
      if (result.ok && result.data) {
        if (result.data.valid) {
          setValidationErrors([])
          setStatus('idle')
          alert(`Validation passed: ${data.length} record(s) ready to import.`)
        } else {
          setValidationErrors(result.data.errors)
          setStatus('idle')
        }
      } else {
        setValidationErrors([result.error ?? 'Validation failed'])
        setStatus('idle')
      }
    } catch {
      setValidationErrors(['Invalid JSON. Please check your input.'])
      setStatus('idle')
    }
  }

  async function handleImport() {
    setStatus('importing')
    setResult(null)

    try {
      const data = JSON.parse(jsonInput)
      const response = await importLegacyRecordsAction(data)

      if (response.ok && response.data) {
        setResult(response.data)
        setStatus('done')
      } else {
        setValidationErrors([response.error ?? 'Import failed'])
        setStatus('idle')
      }
    } catch {
      setValidationErrors(['Import failed. Check console for details.'])
      setStatus('idle')
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Legacy Import</h1>
      <p className="text-sm text-gray-500 mb-8">
        Migrate data from ShopMoiÇa V1 into the NzilaOS commerce engine. Paste legacy JSON records below.
      </p>

      {/* Instructions */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-amber-800 mb-2">How it works</h2>
        <ol className="text-sm text-amber-700 space-y-1 list-decimal list-inside">
          <li>Export records from Supabase as JSON (requests table)</li>
          <li>Paste the JSON array below</li>
          <li>Validate to check data integrity</li>
          <li>Import to create NzilaOS quotes with full audit trail</li>
        </ol>
        <p className="text-xs text-amber-600 mt-3">
          Each record is validated against Zod schemas, mapped via the adapter, and creates a hash-chained audit entry.
        </p>
      </div>

      {/* JSON Input */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Legacy Records (JSON Array)
        </label>
        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          rows={12}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
          placeholder={`[\n  {\n    "id": "abc-123",\n    "client_id": "client-001",\n    "title": "Holiday Gift Boxes",\n    "box_count": 50,\n    "budget_range": "premium",\n    "theme": "holiday",\n    "notes": null,\n    "status": "quoted",\n    "created_by": "user-1",\n    "created_at": "2025-11-01T10:00:00Z",\n    "updated_at": "2025-11-15T14:30:00Z"\n  }\n]`}
        />

        {/* Validation errors */}
        {validationErrors.length > 0 && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm font-semibold text-red-800 mb-1">Validation Errors</p>
            <ul className="text-sm text-red-700 space-y-0.5 list-disc list-inside">
              {validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleValidate}
            disabled={!jsonInput.trim() || status === 'importing'}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ExclamationTriangleIcon className="h-4 w-4" />
            Validate
          </button>
          <button
            onClick={handleImport}
            disabled={!jsonInput.trim() || status === 'importing'}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'importing' ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUpTrayIcon className="h-4 w-4" />
            )}
            {status === 'importing' ? 'Importing...' : 'Import'}
          </button>
        </div>
      </section>

      {/* Results */}
      {result && (
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Import Results</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{result.totalRecords}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{result.successCount}</p>
              <p className="text-xs text-green-600">Success</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{result.failureCount}</p>
              <p className="text-xs text-red-600">Failed</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">{result.warningCount}</p>
              <p className="text-xs text-amber-600">Warnings</p>
            </div>
          </div>

          <p className="text-sm text-gray-500">
            Completed in {result.durationMs}ms.
          </p>

          {result.failures.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-red-800 mb-2">Failures</h3>
              <div className="space-y-1">
                {result.failures.map((f, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <XCircleIcon className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <span className="text-gray-700">
                      <code className="text-xs bg-gray-100 px-1 rounded">{f.legacyId}</code>{' '}
                      {f.error}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.warnings.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-amber-800 mb-2">Warnings</h3>
              <div className="space-y-1">
                {result.warnings.map((w, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <ExclamationTriangleIcon className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <span className="text-gray-700">
                      <code className="text-xs bg-gray-100 px-1 rounded">{w.legacyId}</code>{' '}
                      {w.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
