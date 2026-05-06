'use client'

/**
 * TrustCore — Incident Client
 *
 * Renders the incident register table and "Log Incident" modal.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExclamationTriangleIcon, PlusIcon } from '@heroicons/react/24/outline'
import { FormModal } from '@/components/shared/FormModal'
import { FormBuilder, Field, inputCls, selectCls } from '@/components/shared/form-builder'
import { EmptyState } from '@/components/shared/EmptyState'
import { RecordExplorer } from '@/components/shared/RecordExplorer'
import type { TrustcoreIncident } from '@nzila/db/queries/trustcore'
import type { Role } from '@/types/core'

interface Props {
  records: TrustcoreIncident[]
  role: Role
}

type FormValues = {
  title: string
  description: string
  incidentType: string
  severity: string
  dateDetected: string
  harmAssessment: string
  seriousHarmLikely: boolean
}

const EMPTY: FormValues = {
  title: '',
  description: '',
  incidentType: 'unauthorized_access',
  severity: 'medium',
  dateDetected: new Date().toISOString().slice(0, 10),
  harmAssessment: '',
  seriousHarmLikely: false,
}

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  unauthorized_access: 'Unauthorized Access',
  unauthorized_use: 'Unauthorized Use',
  unauthorized_disclosure: 'Unauthorized Disclosure',
  loss: 'Loss',
  other: 'Other',
}

const SEVERITY_STYLES: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  contained: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-blue-100 text-blue-700',
  closed: 'bg-gray-100 text-gray-600',
}

const canCreate = (role: Role) => role !== 'auditor'

export function IncidentClient({ records, role }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<FormValues>(EMPTY)
  const [errors, setErrors] = useState<Partial<FormValues>>({})
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate(): boolean {
    const next: Partial<FormValues> = {}
    if (!values.title.trim()) next.title = 'Title is required'
    if (!values.dateDetected) next.dateDetected = 'Detection date is required'
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
        title: values.title,
        description: values.description || undefined,
        incidentType: values.incidentType,
        severity: values.severity,
        dateDetected: values.dateDetected,
        harmAssessment: values.harmAssessment || undefined,
        seriousHarmLikely: values.seriousHarmLikely,
      }
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data: unknown = await res.json()
        setSubmitError((data as { error?: string })?.error ?? 'Failed to log incident')
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
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
          >
            <PlusIcon className="h-4 w-4" />
            Log Incident
          </button>
        </div>
      )}

      {records.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState
            icon={ExclamationTriangleIcon}
            title="No incidents recorded"
            description={
              canCreate(role)
                ? 'Click "Log Incident" to record a Law 25 confidentiality incident.'
                : 'No incidents have been recorded for this org.'
            }
          />
        </div>
      ) : (
        <RecordExplorer
          records={records}
          rowKey={(r) => r.id}
          searchPlaceholder="Search incidents by title, type, severity, or status..."
          searchText={(r) => `${r.title} ${r.incidentType} ${r.severity} ${r.resolutionStatus}`}
          filters={[
            {
              id: 'severity',
              label: 'Severity',
              options: ['low', 'medium', 'high', 'critical'].map((value) => ({ value, label: value })),
              matches: (r, v) => r.severity === v,
            },
            {
              id: 'status',
              label: 'Status',
              options: Object.keys(STATUS_STYLES).map((value) => ({ value, label: value })),
              matches: (r, v) => r.resolutionStatus === v,
            },
          ]}
          columns={[
            {
              id: 'title',
              label: 'Title',
              sortValue: (r) => r.title,
              render: (r) => <span className="font-medium text-gray-900">{r.title}</span>,
            },
            {
              id: 'type',
              label: 'Type',
              sortValue: (r) => r.incidentType,
              render: (r) => <span className="text-gray-500">{INCIDENT_TYPE_LABELS[r.incidentType] ?? r.incidentType}</span>,
            },
            {
              id: 'severity',
              label: 'Severity',
              sortValue: (r) => r.severity,
              render: (r) => (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_STYLES[r.severity] ?? ''}`}>
                  {r.severity}
                </span>
              ),
            },
            {
              id: 'detected',
              label: 'Detected',
              sortValue: (r) => r.dateDetected,
              render: (r) => <span className="text-gray-500">{r.dateDetected.toLocaleDateString()}</span>,
            },
            {
              id: 'harm',
              label: 'Serious Harm',
              sortValue: (r) => r.seriousHarmLikely,
              render: (r) => <span className="text-gray-500">{r.seriousHarmLikely ? 'Yes' : 'No'}</span>,
            },
            {
              id: 'status',
              label: 'Status',
              sortValue: (r) => r.resolutionStatus,
              render: (r) => (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[r.resolutionStatus] ?? ''}`}>
                  {r.resolutionStatus}
                </span>
              ),
            },
          ]}
          drillDownTitle={(r) => `Incident: ${r.title}`}
          renderDrillDown={(r) => (
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-gray-500">Type</p><p>{INCIDENT_TYPE_LABELS[r.incidentType] ?? r.incidentType}</p></div>
              <div><p className="text-xs text-gray-500">Severity</p><p>{r.severity}</p></div>
              <div><p className="text-xs text-gray-500">Resolution status</p><p>{r.resolutionStatus}</p></div>
              <div><p className="text-xs text-gray-500">Detected</p><p>{r.dateDetected.toLocaleString()}</p></div>
              <div><p className="text-xs text-gray-500">Occurred</p><p>{r.dateOccurred ? r.dateOccurred.toLocaleString() : '—'}</p></div>
              <div><p className="text-xs text-gray-500">CAI reported</p><p>{r.reportedToCai ? 'Yes' : 'No'}</p></div>
              <div><p className="text-xs text-gray-500">Individuals notified</p><p>{r.affectedIndividualsNotified ? 'Yes' : 'No'}</p></div>
              <div><p className="text-xs text-gray-500">Serious harm likely</p><p>{r.seriousHarmLikely ? 'Yes' : 'No'}</p></div>
              <div className="col-span-2"><p className="text-xs text-gray-500">Description</p><p>{r.description ?? '—'}</p></div>
              <div className="col-span-2"><p className="text-xs text-gray-500">Containment actions</p><p>{r.containmentActions ?? '—'}</p></div>
            </div>
          )}
        />
      )}

      <FormModal open={open} onClose={() => { setOpen(false); setSubmitError(null) }} title="Log Incident">
        <FormBuilder onSubmit={handleSubmit} onCancel={() => setOpen(false)} loading={loading} error={submitError} submitLabel="Log Incident">
          <Field label="Title" error={errors.title} required>
            <input type="text" className={inputCls} value={values.title} onChange={(e) => set('title', e.target.value)} placeholder="Brief incident description" />
          </Field>
          <Field label="Description">
            <textarea className={inputCls} rows={2} value={values.description} onChange={(e) => set('description', e.target.value)} placeholder="What happened?" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Incident Type" required>
              <select aria-label="Incident Type" className={selectCls} value={values.incidentType} onChange={(e) => set('incidentType', e.target.value)}>
                {Object.entries(INCIDENT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Severity" required>
              <select aria-label="Severity" className={selectCls} value={values.severity} onChange={(e) => set('severity', e.target.value)}>
                {['low', 'medium', 'high', 'critical'].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Date Detected" error={errors.dateDetected} required>
            <input type="date" aria-label="Date Detected" className={inputCls} value={values.dateDetected} onChange={(e) => set('dateDetected', e.target.value)} />
          </Field>
          <Field label="Harm Assessment">
            <textarea className={inputCls} rows={2} value={values.harmAssessment} onChange={(e) => set('harmAssessment', e.target.value)} placeholder="Describe the potential harm to affected individuals…" />
          </Field>
          <Field label="Serious Harm Likely">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={values.seriousHarmLikely}
                onChange={(e) => set('seriousHarmLikely', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm text-gray-700">Serious harm to affected individuals is likely</span>
            </label>
          </Field>
          {values.seriousHarmLikely && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg p-3 -mt-2 mb-4">
              ⚠ Law 25 requires notification to the Commission d&apos;accès à l&apos;information (CAI) within 72 hours.
            </p>
          )}
        </FormBuilder>
      </FormModal>
    </>
  )
}
