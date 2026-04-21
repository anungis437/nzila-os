/**
 * Onboard New Client — Nzila Service Operations Layer
 *
 * Client component — intake form for registering a new client account.
 * On submit: POST /itsm/clients (orchestrator-api, TBD)
 */
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { NZILA_PRODUCTS, ONBOARDING_STAGES, ONBOARDING_STAGE_LABELS } from '@nzila/itsm-core'

const PRODUCT_LABELS: Record<string, string> = {
  union_eyes: 'Union Eyes',
  faircase: 'FairCase',
  flow: 'Flow',
  zonga: 'Zonga',
  agrimo: 'Agrimo',
  platform: 'Platform',
  other: 'Other',
}

export default function OnboardClientPage() {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    companyName: '',
    contactName: '',
    contactEmail: '',
    product: 'union_eyes' as string,
    onboardingStage: 'prospect' as string,
    contractValue: '',
    renewalDate: '',
    notes: '',
  })

  function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    // TODO: POST to /api/itsm/clients or orchestrator-api
    await new Promise((r) => setTimeout(r, 600))
    setSaving(false)
    setSaved(true)
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Onboard New Client</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create a client account to track onboarding, health, and support history.
          </p>
        </div>
        <Link href="/itsm/clients" className="text-sm text-gray-500 hover:text-gray-700">
          ← Clients
        </Link>
      </div>

      {saved ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
          <p className="text-green-700 font-medium">Client account created!</p>
          <p className="text-sm text-green-600 mt-1">Redirecting to client accounts...</p>
          <Link href="/itsm/clients" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
            Back to Client Accounts →
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
          {/* Company */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              name="companyName"
              value={form.companyName}
              onChange={onChange}
              required
              placeholder="e.g. COSATU Western Cape"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
              <input
                name="contactName"
                value={form.contactName}
                onChange={onChange}
                placeholder="Primary contact"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
              <input
                name="contactEmail"
                type="email"
                value={form.contactEmail}
                onChange={onChange}
                placeholder="contact@client.org"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Product + Stage */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product <span className="text-red-500">*</span>
              </label>
              <select
                name="product"
                value={form.product}
                onChange={onChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {NZILA_PRODUCTS.map((p) => (
                  <option key={p} value={p}>{PRODUCT_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Onboarding Stage</label>
              <select
                name="onboardingStage"
                value={form.onboardingStage}
                onChange={onChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ONBOARDING_STAGES.map((s) => (
                  <option key={s} value={s}>{ONBOARDING_STAGE_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Contract value + Renewal */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contract Value (ZAR)</label>
              <input
                name="contractValue"
                value={form.contractValue}
                onChange={onChange}
                placeholder="e.g. 120000"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Renewal Date</label>
              <input
                name="renewalDate"
                type="date"
                value={form.renewalDate}
                onChange={onChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={onChange}
              rows={3}
              placeholder="Context, referral source, key requirements..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link href="/itsm/clients" className="text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || !form.companyName}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Creating…' : 'Create Account'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
