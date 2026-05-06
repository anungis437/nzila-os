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
import { RecordExplorer } from '@/components/shared/RecordExplorer'
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
        <RecordExplorer
          records={records}
          rowKey={(r) => r.id}
          searchPlaceholder="Search assets by name, purpose, storage, or owner..."
          searchText={(r) => `${r.name} ${r.processingPurpose ?? ''} ${r.storageLocation ?? ''} ${r.systemOwner ?? ''}`}
          filters={[
            {
              id: 'category',
              label: 'Category',
              options: Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
              matches: (r, v) => r.dataCategory === v,
            },
            {
              id: 'sensitivity',
              label: 'Sensitivity',
              options: ['low', 'medium', 'high', 'critical'].map((value) => ({ value, label: value })),
              matches: (r, v) => r.sensitivityLevel === v,
            },
            {
              id: 'status',
              label: 'Status',
              options: [
                { value: 'active', label: 'Active' },
                { value: 'archived', label: 'Archived' },
                { value: 'needs_review', label: 'Needs review' },
              ],
              matches: (r, v) => r.status === v,
            },
          ]}
          columns={[
            {
              id: 'name',
              label: 'Name',
              sortValue: (r) => r.name,
              render: (r) => <span className="font-medium text-gray-900">{r.name}</span>,
            },
            {
              id: 'category',
              label: 'Category',
              sortValue: (r) => r.dataCategory,
              render: (r) => <span className="text-gray-500">{CATEGORY_LABELS[r.dataCategory] ?? r.dataCategory}</span>,
            },
            {
              id: 'sensitivity',
              label: 'Sensitivity',
              sortValue: (r) => r.sensitivityLevel,
              render: (r) => (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_STYLES[r.sensitivityLevel] ?? ''}`}>
                  {r.sensitivityLevel}
                </span>
              ),
            },
            {
              id: 'storage',
              label: 'Storage',
              sortValue: (r) => r.storageLocation ?? '',
              render: (r) => <span className="text-gray-500 truncate max-w-40 block">{r.storageLocation ?? '—'}</span>,
            },
            {
              id: 'crossBorder',
              label: 'Cross-border',
              sortValue: (r) => r.crossBorderTransfer,
              render: (r) => <span className="text-gray-500">{r.crossBorderTransfer ? 'Yes' : 'No'}</span>,
            },
            {
              id: 'status',
              label: 'Status',
              sortValue: (r) => r.status,
              render: (r) => <span className="text-gray-500">{r.status.replace(/_/g, ' ')}</span>,
            },
          ]}
          drillDownTitle={(r) => `Data Asset: ${r.name}`}
          renderDrillDown={(r) => (
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-gray-500">Category</p><p>{CATEGORY_LABELS[r.dataCategory] ?? r.dataCategory}</p></div>
              <div><p className="text-xs text-gray-500">Sensitivity</p><p>{r.sensitivityLevel}</p></div>
              <div><p className="text-xs text-gray-500">Status</p><p>{r.status.replace(/_/g, ' ')}</p></div>
              <div><p className="text-xs text-gray-500">System owner</p><p>{r.systemOwner ?? '—'}</p></div>
              <div><p className="text-xs text-gray-500">Storage location</p><p>{r.storageLocation ?? '—'}</p></div>
              <div><p className="text-xs text-gray-500">Retention period</p><p>{r.retentionPeriod ?? '—'}</p></div>
              <div><p className="text-xs text-gray-500">Cross-border transfer</p><p>{r.crossBorderTransfer ? `Yes (${r.destinationCountry ?? 'unspecified'})` : 'No'}</p></div>
              <div><p className="text-xs text-gray-500">Created</p><p>{r.createdAt.toLocaleString()}</p></div>
              <div className="col-span-2"><p className="text-xs text-gray-500">Processing purpose</p><p>{r.processingPurpose ?? '—'}</p></div>
              <div className="col-span-2"><p className="text-xs text-gray-500">Description</p><p>{r.description ?? '—'}</p></div>
            </div>
          )}
        />
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
              <select aria-label="Data Category" className={selectCls} value={values.dataCategory} onChange={(e) => set('dataCategory', e.target.value)}>
                {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Sensitivity Level" error={errors.sensitivityLevel} required>
              <select aria-label="Sensitivity Level" className={selectCls} value={values.sensitivityLevel} onChange={(e) => set('sensitivityLevel', e.target.value)}>
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
