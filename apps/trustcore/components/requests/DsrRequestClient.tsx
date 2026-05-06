'use client'

/**
 * TrustCore — DSR Request Client
 *
 * Renders the DSR request list and "New Request" create modal.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { InboxArrowDownIcon, PlusIcon } from '@heroicons/react/24/outline'
import { FormModal } from '@/components/shared/FormModal'
import { FormBuilder, Field, inputCls, selectCls } from '@/components/shared/form-builder'
import { EmptyState } from '@/components/shared/EmptyState'
import { RecordExplorer } from '@/components/shared/RecordExplorer'
import type { TrustcoreDsrRequest } from '@nzila/db/queries/trustcore'
import type { Role } from '@/types/core'

interface Props {
  records: TrustcoreDsrRequest[]
  role: Role
}

type FormValues = {
  requesterName: string
  requesterEmail: string
  requestType: string
  identityVerified: boolean
}

const EMPTY: FormValues = {
  requesterName: '',
  requesterEmail: '',
  requestType: 'access',
  identityVerified: false,
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  access: 'Access (Right to access)',
  rectification: 'Rectification (Correction)',
  deletion: 'Deletion (Right to erasure)',
  portability: 'Portability',
  consent_withdrawal: 'Consent Withdrawal',
  other: 'Other',
}

const STATUS_STYLES: Record<string, string> = {
  received: 'bg-blue-100 text-blue-700',
  verifying_identity: 'bg-purple-100 text-purple-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  denied: 'bg-red-100 text-red-700',
  overdue: 'bg-red-100 text-red-800 font-semibold',
}

const canCreate = (role: Role) => role !== 'auditor'

export function DsrRequestClient({ records, role }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<FormValues>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({})
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormValues, string>> = {}
    if (!values.requesterName.trim()) next.requesterName = 'Name is required'
    if (!values.requesterEmail.trim()) {
      next.requesterEmail = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.requesterEmail)) {
      next.requesterEmail = 'Invalid email address'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    setSubmitError(null)
    try {
      const body = {
        requesterName: values.requesterName,
        requesterEmail: values.requesterEmail,
        requestType: values.requestType,
        identityVerified: values.identityVerified,
      }
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data: unknown = await res.json()
        setSubmitError((data as { error?: string })?.error ?? 'Failed to create request')
        return
      }
      setOpen(false)
      setValues(EMPTY)
      router.refresh()
    } catch {
      setSubmitError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {canCreate(role) && (
        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition"
          >
            <PlusIcon className="h-4 w-4" />
            New Request
          </button>
        </div>
      )}

      {records.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState
            icon={InboxArrowDownIcon}
            title="No DSR requests yet"
            description={
              canCreate(role)
                ? 'Click "New Request" to register a data subject rights request.'
                : 'No DSR requests have been filed for this org.'
            }
          />
        </div>
      ) : (
        <RecordExplorer
          records={records}
          rowKey={(r) => r.id}
          searchPlaceholder="Search requester, email, or request type..."
          searchText={(r) => `${r.requesterName} ${r.requesterEmail} ${r.requestType} ${r.status}`}
          filters={[
            {
              id: 'type',
              label: 'Type',
              options: Object.entries(REQUEST_TYPE_LABELS).map(([value, label]) => ({ value, label })),
              matches: (r, v) => r.requestType === v,
            },
            {
              id: 'status',
              label: 'Status',
              options: Object.keys(STATUS_STYLES).map((value) => ({ value, label: value.replace(/_/g, ' ') })),
              matches: (r, v) => r.status === v,
            },
          ]}
          columns={[
            {
              id: 'requester',
              label: 'Requester',
              sortValue: (r) => r.requesterName,
              render: (r) => <span className="font-medium text-gray-900">{r.requesterName}</span>,
            },
            {
              id: 'email',
              label: 'Email',
              sortValue: (r) => r.requesterEmail,
              render: (r) => <span className="text-gray-500">{r.requesterEmail}</span>,
            },
            {
              id: 'type',
              label: 'Type',
              sortValue: (r) => r.requestType,
              render: (r) => <span className="text-gray-500">{REQUEST_TYPE_LABELS[r.requestType] ?? r.requestType}</span>,
            },
            {
              id: 'due',
              label: 'Due',
              sortValue: (r) => r.dueAt,
              render: (r) => <span className="text-gray-500">{r.dueAt.toLocaleDateString()}</span>,
            },
            {
              id: 'identity',
              label: 'Identity Verified',
              sortValue: (r) => r.identityVerified,
              render: (r) =>
                r.identityVerified ? <span className="text-green-600">Verified</span> : <span className="text-gray-400">Pending</span>,
            },
            {
              id: 'status',
              label: 'Status',
              sortValue: (r) => r.status,
              render: (r) => (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[r.status] ?? ''}`}>
                  {r.status.replace(/_/g, ' ')}
                </span>
              ),
            },
          ]}
          drillDownTitle={(r) => `DSR Request: ${r.requesterName}`}
          renderDrillDown={(r) => (
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-gray-500">Requester</p><p>{r.requesterName}</p></div>
              <div><p className="text-xs text-gray-500">Email</p><p>{r.requesterEmail}</p></div>
              <div><p className="text-xs text-gray-500">Type</p><p>{REQUEST_TYPE_LABELS[r.requestType] ?? r.requestType}</p></div>
              <div><p className="text-xs text-gray-500">Status</p><p>{r.status.replace(/_/g, ' ')}</p></div>
              <div><p className="text-xs text-gray-500">Received</p><p>{r.receivedAt.toLocaleString()}</p></div>
              <div><p className="text-xs text-gray-500">Due</p><p>{r.dueAt.toLocaleString()}</p></div>
              <div className="col-span-2"><p className="text-xs text-gray-500">Response Summary</p><p>{r.responseSummary ?? '—'}</p></div>
              <div className="col-span-2"><p className="text-xs text-gray-500">Denial Reason</p><p>{r.denialReason ?? '—'}</p></div>
            </div>
          )}
        />
      )}

      <FormModal open={open} onClose={() => { setOpen(false); setSubmitError(null) }} title="New DSR Request">
        <FormBuilder onSubmit={handleSubmit} onCancel={() => setOpen(false)} loading={loading} error={submitError} submitLabel="Register Request">
          <Field label="Requester Name" error={errors.requesterName} required>
            <input type="text" className={inputCls} value={values.requesterName} onChange={(e) => set('requesterName', e.target.value)} placeholder="Full legal name" />
          </Field>
          <Field label="Requester Email" error={errors.requesterEmail} required>
            <input type="email" className={inputCls} value={values.requesterEmail} onChange={(e) => set('requesterEmail', e.target.value)} placeholder="email@example.com" />
          </Field>
          <Field label="Request Type" required>
            <select aria-label="Request type" className={selectCls} value={values.requestType} onChange={(e) => set('requestType', e.target.value)}>
              {Object.entries(REQUEST_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Identity Verification">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={values.identityVerified}
                onChange={(e) => set('identityVerified', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-gray-700">Identity has been verified</span>
            </label>
          </Field>
          <p className="text-xs text-gray-400 -mt-2">
            Law 25: responses are due within 30 days of receipt. The due date will be set automatically.
          </p>
        </FormBuilder>
      </FormModal>
    </>
  )
}
