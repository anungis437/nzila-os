'use client'

/**
 * TrustCore — Form Builder
 *
 * Reusable form wrapper that surfaces loading state, a top-level
 * submit error, and a consistent submit/cancel button row.
 *
 * Usage:
 *   <FormBuilder onSubmit={handleSubmit} onCancel={onClose} loading={loading} error={error}>
 *     <Field label="Name" error={errors.name}>
 *       <input ... />
 *     </Field>
 *   </FormBuilder>
 */

// ── Field wrapper ──────────────────────────────────────────────────────────

interface FieldProps {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}

export function Field({ label, error, required, children }: FieldProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ── Common input styles ────────────────────────────────────────────────────

export const inputCls =
  'block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50'

export const selectCls =
  'block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50 bg-white'

// ── FormBuilder ────────────────────────────────────────────────────────────

interface FormBuilderProps {
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  loading: boolean
  error: string | null
  submitLabel?: string
  children: React.ReactNode
}

export function FormBuilder({
  onSubmit,
  onCancel,
  loading,
  error,
  submitLabel = 'Save',
  children,
}: FormBuilderProps) {
  return (
    <form onSubmit={onSubmit} noValidate>
      {children}

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 mt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition flex items-center gap-2"
        >
          {loading && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {loading ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
