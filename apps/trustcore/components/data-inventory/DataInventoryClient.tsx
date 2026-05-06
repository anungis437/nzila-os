'use client'

/**
 * TrustCore — Data Inventory Client
 *
 * Renders the data-asset list table and the "Add Data Asset" create flow.
 * All writes go through POST /api/data-inventory; router.refresh() re-runs
 * the server component to pull the updated list from the DB.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleStackIcon, PlusIcon } from '@heroicons/react/24/outline'
import { FormModal } from '@/components/shared/FormModal'
import { FormBuilder, Field, inputCls, selectCls } from '@/components/shared/form-builder'
import { EmptyState } from '@/components/shared/EmptyState'
import type { TrustcoreDataAsset } from '@nzila/db/queries/trustcore'
import type { Role } from '@/types/core'

interface Props {
  records: TrustcoreDataAsset[]
  role: Role
}

type FormValues = {
  name: string
  description: string
  dataCategory: string
  sensitivityLevel: string
  processingPurpose: string
  storageLocation: string
  retentionPeriod: string
  crossBorderTransfer: boolean
  destinationCountry: string
  vendorId: string
}

const EMPTY: FormValues = {
  name: '',
  description: '',
  dataCategory: 'other',
  sensitivityLevel: 'low',
  processingPurpose: '',
  storageLocation: '',
  retentionPeriod: '',
  crossBorderTransfer: false,
  destinationCountry: '',
  vendorId: '',
}

const CATEGORY_LABELS: Record<string, string> = {
  identity: 'Identity',
  contact: 'Contact',
  financial: 'Financial',
  health: 'Health',
  employment: 'Employment',
  children: 'Children',
  sensitive: 'Sensitive',
  other: 'Other',
}

const SEVERITY_STYLES: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

const canCreate = (role: Role) => role !== 'auditor'

export function DataInventoryClient({ records, role }: Props) {
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
    if (!values.name.trim()) next.name = 'Name is required'
    if (!values.dataCategory) next.dataCategory = 'Required'
    if (!values.sensitivityLevel) next.sensitivityLevel = 'Required'
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
        description: values.description || undefined,
        dataCategory: values.dataCategory,
        sensitivityLevel: values.sensitivityLevel,
        processingPurpose: values.processingPurpose || undefined,
        storageLocation: values.storageLocation || undefined,
        retentionPeriod: values.retentionPeriod || undefined,
        crossBorderTransfer: values.crossBorderTransfer,
        destinationCountry: values.crossBorderTransfer ? values.destinationCountry || undefined : undefined,
        vendorId: values.vendorId || undefined,
      }
      const res = await fetch('/api/data-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data: unknown = await res.json()
        const msg = (data as { error?: string })?.error ?? 'Failed to create data asset'
        setSubmitError(msg)
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
      {/* Header row */}
      {canCreate(role) && (
        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition"
          >
            <PlusIcon className="h-4 w-4" />
            Add Data Asset
          </button>
        </div>
      )}

      {/* List */}
      {records.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState
            icon={CircleStackIcon}
            title="No data assets yet"
            description={
              canCreate(role)
                ? 'Click "Add Data Asset" to register your first PII asset.'
                : 'No data assets have been registered for this org.'
            }
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Category', 'Sensitivity', 'Storage', 'Cross-border', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-3 text-gray-500">{CATEGORY_LABELS[r.dataCategory] ?? r.dataCategory}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_STYLES[r.sensitivityLevel] ?? ''}`}>
                      {r.sensitivityLevel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 truncate max-w-[160px]">{r.storageLocation ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{r.crossBorderTransfer ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3 text-gray-500">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      <FormModal open={open} onClose={() => { setOpen(false); setSubmitError(null) }} title="Add Data Asset">
        <FormBuilder onSubmit={handleSubmit} onCancel={() => setOpen(false)} loading={loading} error={submitError} submitLabel="Add Asset">
          <Field label="Name" error={errors.name} required>
            <input
              type="text"
              className={inputCls}
              value={values.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Customer email addresses"
            />
          </Field>
          <Field label="Description">
            <textarea
              className={inputCls}
              rows={2}
              value={values.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Brief description of this data asset"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Data Category" error={errors.dataCategory} required>
              <select className={selectCls} value={values.dataCategory} onChange={(e) => set('dataCategory', e.target.value)}>
                {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Sensitivity Level" error={errors.sensitivityLevel} required>
              <select className={selectCls} value={values.sensitivityLevel} onChange={(e) => set('sensitivityLevel', e.target.value)}>
                {['low', 'medium', 'high', 'critical'].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Processing Purpose">
            <input type="text" className={inputCls} value={values.processingPurpose} onChange={(e) => set('processingPurpose', e.target.value)} placeholder="Why is this data processed?" />
          </Field>
          <Field label="Storage Location">
            <input type="text" className={inputCls} value={values.storageLocation} onChange={(e) => set('storageLocation', e.target.value)} placeholder="e.g. AWS S3 us-east-1" />
          </Field>
          <Field label="Retention Period">
            <input type="text" className={inputCls} value={values.retentionPeriod} onChange={(e) => set('retentionPeriod', e.target.value)} placeholder="e.g. 2 years" />
          </Field>
          <Field label="Cross-border Transfer">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={values.crossBorderTransfer}
                onChange={(e) => set('crossBorderTransfer', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-gray-700">Data is transferred outside Canada</span>
            </label>
          </Field>
          {values.crossBorderTransfer && (
            <Field label="Destination Country">
              <input type="text" className={inputCls} value={values.destinationCountry} onChange={(e) => set('destinationCountry', e.target.value)} placeholder="e.g. United States" />
            </Field>
          )}
        </FormBuilder>
      </FormModal>
    </>
  )
}
