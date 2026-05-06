'use client'

/**
 * TrustCore — PIA Client
 *
 * Renders the PIA list table and "Create PIA" modal.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DocumentMagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline'
import { FormModal } from '@/components/shared/FormModal'
import { FormBuilder, Field, inputCls, selectCls } from '@/components/shared/form-builder'
import { EmptyState } from '@/components/shared/EmptyState'
import type { TrustcorePia } from '@nzila/db/queries/trustcore'
import type { Role } from '@/types/core'

interface Props {
  records: TrustcorePia[]
  role: Role
}

type FormValues = {
  title: string
  triggerType: string
  description: string
  riskScore: string
  mitigationPlan: string
  reviewerName: string
}

const EMPTY: FormValues = {
  title: '',
  triggerType: 'new_system',
  description: '',
  riskScore: '',
  mitigationPlan: '',
  reviewerName: '',
}

const TRIGGER_LABELS: Record<string, string> = {
  new_system: 'New System',
  sensitive_data: 'Sensitive Data',
  cross_border: 'Cross-border Transfer',
  ai_or_automated_decision: 'AI / Automated Decision',
  vendor_change: 'Vendor Change',
  major_change: 'Major Change',
  other: 'Other',
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  in_review: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  mitigation_required: 'bg-yellow-100 text-yellow-700',
}

const canCreate = (role: Role) => role !== 'auditor'

export function PiaClient({ records, role }: Props) {
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
    if (!values.triggerType) next.triggerType = 'Required'
    if (values.riskScore && (isNaN(Number(values.riskScore)) || Number(values.riskScore) < 0 || Number(values.riskScore) > 100)) {
      next.riskScore = 'Must be between 0 and 100'
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
        title: values.title,
        triggerType: values.triggerType,
        description: values.description || undefined,
        riskScore: values.riskScore ? Number(values.riskScore) : undefined,
        mitigationPlan: values.mitigationPlan || undefined,
        reviewerName: values.reviewerName || undefined,
      }
      const res = await fetch('/api/pia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data: unknown = await res.json()
        setSubmitError((data as { error?: string })?.error ?? 'Failed to create PIA')
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
            Create PIA
          </button>
        </div>
      )}

      {records.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState
            icon={DocumentMagnifyingGlassIcon}
            title="No PIAs yet"
            description={
              canCreate(role)
                ? 'Click "Create PIA" to start your first Privacy Impact Assessment.'
                : 'No PIAs have been created for this org.'
            }
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Title', 'Trigger', 'Risk Score', 'Status', 'Reviewer', 'Created'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.title}</td>
                  <td className="px-4 py-3 text-gray-500">{TRIGGER_LABELS[r.triggerType] ?? r.triggerType}</td>
                  <td className="px-4 py-3 text-gray-500">{r.riskScore ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[r.status] ?? ''}`}>
                      {r.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{r.reviewerName ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{r.createdAt.toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FormModal open={open} onClose={() => { setOpen(false); setSubmitError(null) }} title="Create PIA">
        <FormBuilder onSubmit={handleSubmit} onCancel={() => setOpen(false)} loading={loading} error={submitError} submitLabel="Create PIA">
          <Field label="Title" error={errors.title} required>
            <input type="text" className={inputCls} value={values.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. New CRM System PIA" />
          </Field>
          <Field label="Trigger Type" error={errors.triggerType} required>
            <select className={selectCls} value={values.triggerType} onChange={(e) => set('triggerType', e.target.value)}>
              {Object.entries(TRIGGER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Description">
            <textarea className={inputCls} rows={3} value={values.description} onChange={(e) => set('description', e.target.value)} placeholder="Describe the scope and context…" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Risk Score (0–100)" error={errors.riskScore}>
              <input type="number" min={0} max={100} className={inputCls} value={values.riskScore} onChange={(e) => set('riskScore', e.target.value)} placeholder="e.g. 65" />
            </Field>
            <Field label="Reviewer Name">
              <input type="text" className={inputCls} value={values.reviewerName} onChange={(e) => set('reviewerName', e.target.value)} placeholder="Full name" />
            </Field>
          </div>
          <Field label="Mitigation Plan">
            <textarea className={inputCls} rows={3} value={values.mitigationPlan} onChange={(e) => set('mitigationPlan', e.target.value)} placeholder="How will identified risks be mitigated?" />
          </Field>
        </FormBuilder>
      </FormModal>
    </>
  )
}
