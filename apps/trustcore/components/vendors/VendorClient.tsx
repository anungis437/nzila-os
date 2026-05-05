'use client'

/**
 * TrustCore — Vendor Client
 *
 * Renders the vendor register table and "Add Vendor" create modal.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BuildingStorefrontIcon, PlusIcon } from '@heroicons/react/24/outline'
import { FormModal } from '@/components/shared/FormModal'
import { FormBuilder, Field, inputCls, selectCls } from '@/components/shared/form-builder'
import { EmptyState } from '@/components/shared/EmptyState'
import type { TrustcoreVendor } from '@nzila/db/queries/trustcore'
import type { Role } from '@/types/core'

interface Props {
  records: TrustcoreVendor[]
  role: Role
}

type FormValues = {
  name: string
  serviceDescription: string
  country: string
  dataSharedDescription: string
  riskLevel: string
  crossBorderTransfer: boolean
  piaRequired: boolean
  contractReviewed: boolean
}

const EMPTY: FormValues = {
  name: '',
  serviceDescription: '',
  country: '',
  dataSharedDescription: '',
  riskLevel: 'low',
  crossBorderTransfer: false,
  piaRequired: false,
  contractReviewed: false,
}

const RISK_STYLES: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  pending_review: 'bg-yellow-100 text-yellow-700',
  suspended: 'bg-red-100 text-red-700',
  archived: 'bg-gray-100 text-gray-500',
}

const canCreate = (role: Role) => role !== 'auditor'

export function VendorClient({ records, role }: Props) {
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
    if (!values.name.trim()) next.name = 'Vendor name is required'
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
        name: values.name,
        serviceDescription: values.serviceDescription || undefined,
        country: values.country || undefined,
        dataSharedDescription: values.dataSharedDescription || undefined,
        riskLevel: values.riskLevel,
        crossBorderTransfer: values.crossBorderTransfer,
        piaRequired: values.piaRequired,
        contractReviewed: values.contractReviewed,
      }
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data: unknown = await res.json()
        setSubmitError((data as { error?: string })?.error ?? 'Failed to add vendor')
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
            Add Vendor
          </button>
        </div>
      )}

      {records.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState
            icon={BuildingStorefrontIcon}
            title="No vendors registered"
            description={
              canCreate(role)
                ? 'Click "Add Vendor" to register a vendor or subprocessor.'
                : 'No vendors have been registered for this org.'
            }
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Country', 'Risk Level', 'Cross-border', 'Contract', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-3 text-gray-500">{r.country ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${RISK_STYLES[r.riskLevel] ?? ''}`}>
                      {r.riskLevel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{r.crossBorderTransfer ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3 text-gray-500">{r.contractReviewed ? <span className="text-green-600">✓ Reviewed</span> : <span className="text-gray-400">Pending</span>}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[r.status] ?? ''}`}>
                      {r.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FormModal open={open} onClose={() => { setOpen(false); setSubmitError(null) }} title="Add Vendor">
        <FormBuilder onSubmit={handleSubmit} onCancel={() => setOpen(false)} loading={loading} error={submitError} submitLabel="Add Vendor">
          <Field label="Vendor Name" error={errors.name} required>
            <input type="text" className={inputCls} value={values.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Salesforce" />
          </Field>
          <Field label="Service Description">
            <textarea className={inputCls} rows={2} value={values.serviceDescription} onChange={(e) => set('serviceDescription', e.target.value)} placeholder="What service does this vendor provide?" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Country">
              <input type="text" className={inputCls} value={values.country} onChange={(e) => set('country', e.target.value)} placeholder="e.g. United States" />
            </Field>
            <Field label="Risk Level" required>
              <select className={selectCls} value={values.riskLevel} onChange={(e) => set('riskLevel', e.target.value)}>
                {['low', 'medium', 'high', 'critical'].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Data Shared">
            <textarea className={inputCls} rows={2} value={values.dataSharedDescription} onChange={(e) => set('dataSharedDescription', e.target.value)} placeholder="What data is shared with this vendor?" />
          </Field>
          <div className="space-y-2 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={values.crossBorderTransfer} onChange={(e) => set('crossBorderTransfer', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
              <span className="text-sm text-gray-700">Cross-border data transfer</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={values.piaRequired} onChange={(e) => set('piaRequired', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
              <span className="text-sm text-gray-700">PIA required for this vendor</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={values.contractReviewed} onChange={(e) => set('contractReviewed', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
              <span className="text-sm text-gray-700">Contract / DPA has been reviewed</span>
            </label>
          </div>
        </FormBuilder>
      </FormModal>
    </>
  )
}
