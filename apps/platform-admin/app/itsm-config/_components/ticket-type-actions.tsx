'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'select',
  'multiselect',
  'date',
  'boolean',
] as const
type FieldType = (typeof FIELD_TYPES)[number]

export interface ExistingField {
  id: string
  fieldKey: string
  label: string
  fieldType: FieldType
  options: string[]
  required: boolean
  helpText: string | null
  sortOrder: number
  active: boolean
}

interface ManageFieldsDialogProps {
  orgId: string
  ticketType: string
  ticketTypeLabel: string
  existingFields: ReadonlyArray<ExistingField>
}

function needsOptions(t: FieldType): boolean {
  return t === 'select' || t === 'multiselect'
}

export function ManageFieldsDialog({
  orgId,
  ticketType,
  ticketTypeLabel,
  existingFields,
}: ManageFieldsDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
      >
        Configure ({existingFields.length})
      </button>
      {open && (
        <ManageFieldsModal
          orgId={orgId}
          ticketType={ticketType}
          ticketTypeLabel={ticketTypeLabel}
          existingFields={existingFields}
          onClose={() => {
            setOpen(false)
            router.refresh()
          }}
        />
      )}
    </>
  )
}

interface ManageFieldsModalProps extends ManageFieldsDialogProps {
  onClose: () => void
}

function ManageFieldsModal({
  orgId,
  ticketType,
  ticketTypeLabel,
  existingFields,
  onClose,
}: ManageFieldsModalProps) {
  const router = useRouter()
  const [showNew, setShowNew] = useState(false)

  async function remove(fieldId: string) {
    if (!confirm('Delete this custom field?')) return
    await fetch(
      `/api/itsm-config/ticket-types/${ticketType}/fields/${fieldId}`,
      {
        method: 'DELETE',
        headers: {
          'Idempotency-Key': crypto.randomUUID(),
          'x-org-id': orgId,
        },
      },
    )
    router.refresh()
  }

  async function toggleActive(field: ExistingField) {
    await fetch(
      `/api/itsm-config/ticket-types/${ticketType}/fields/${field.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
          'x-org-id': orgId,
        },
        body: JSON.stringify({ active: !field.active }),
      },
    )
    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Custom fields — {ticketTypeLabel}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            Close
          </button>
        </div>

        <div className="space-y-1">
          {existingFields.length === 0 && !showNew && (
            <p className="text-sm text-gray-400 italic">
              No custom fields defined yet.
            </p>
          )}
          {existingFields.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between rounded border border-gray-200 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {f.label}{' '}
                  <span className="text-xs text-gray-400 font-mono ml-1">
                    {f.fieldKey}
                  </span>
                </p>
                <p className="text-xs text-gray-500">
                  {f.fieldType}
                  {f.required ? ' · required' : ''}
                  {needsOptions(f.fieldType)
                    ? ` · ${f.options.length} options`
                    : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleActive(f)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {f.active ? 'Disable' : 'Enable'}
                </button>
                <button
                  type="button"
                  onClick={() => remove(f.id)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {showNew ? (
          <NewFieldForm
            orgId={orgId}
            ticketType={ticketType}
            onDone={() => {
              setShowNew(false)
              router.refresh()
            }}
            onCancel={() => setShowNew(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="text-sm text-blue-600 hover:underline"
          >
            + Add field
          </button>
        )}
      </div>
    </div>
  )
}

interface NewFieldFormProps {
  orgId: string
  ticketType: string
  onDone: () => void
  onCancel: () => void
}

function NewFieldForm({ orgId, ticketType, onDone, onCancel }: NewFieldFormProps) {
  const [fieldKey, setFieldKey] = useState('')
  const [label, setLabel] = useState('')
  const [fieldType, setFieldType] = useState<FieldType>('text')
  const [optionsText, setOptionsText] = useState('')
  const [required, setRequired] = useState(false)
  const [helpText, setHelpText] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const options = needsOptions(fieldType)
      ? optionsText
          .split('\n')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : []

    if (needsOptions(fieldType) && options.length === 0) {
      setError('At least one option is required for select / multiselect')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/itsm-config/ticket-types/${ticketType}/fields`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': crypto.randomUUID(),
            'x-org-id': orgId,
          },
          body: JSON.stringify({
            fieldKey,
            label,
            fieldType,
            options,
            required,
            helpText: helpText || undefined,
            sortOrder,
            active: true,
          }),
        },
      )
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: { message?: string }
      }
      if (!res.ok || !json.ok) {
        setError(json.error?.message ?? `Failed (${res.status})`)
        return
      }
      onDone()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded border border-blue-200 bg-blue-50/50 p-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600">
            Field key (snake_case)
          </label>
          <input
            value={fieldKey}
            onChange={(e) => setFieldKey(e.target.value)}
            required
            pattern="^[a-z][a-z0-9_]{0,63}$"
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm font-mono"
            placeholder="vip_level"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Label</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
            maxLength={160}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="VIP Level"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Type</label>
          <select
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value as FieldType)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Sort order</label>
          <input
            type="number"
            min={0}
            max={10000}
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {needsOptions(fieldType) && (
        <div>
          <label className="text-xs font-medium text-gray-600">
            Options (one per line)
          </label>
          <textarea
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm font-mono"
            placeholder={'low\nmedium\nhigh\ncritical'}
          />
        </div>
      )}

      <div>
        <label className="text-xs font-medium text-gray-600">
          Help text (optional)
        </label>
        <input
          value={helpText}
          onChange={(e) => setHelpText(e.target.value)}
          maxLength={2000}
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
        />
        Required
      </label>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Adding…' : 'Add field'}
        </button>
      </div>
    </form>
  )
}
