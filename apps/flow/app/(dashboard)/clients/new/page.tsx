'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  UserIcon,
  BuildingOffice2Icon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'
import { createCustomerAction } from '@/app/actions/customers'

export default function NewClientPage() {
  const router = useRouter()
  const locale = useLocale()
  const base = `/${locale}/dashboard`
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [province, setProvince] = useState('QC')
  const [postalCode, setPostalCode] = useState('')
  const [notes, setNotes] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await createCustomerAction({
        name,
        email: email || null,
        phone: phone || null,
        company: company || null,
        shippingAddress: street
          ? { street, city, province, postalCode, country: 'CA' }
          : null,
        notes: notes || null,
      })
      router.push(`${base}/clients`)
    } catch {
      setSaving(false)
    }
  }

  const isValid = name.trim().length > 0

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <Link
        href={`${base}/clients`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy transition-colors"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Clients
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-navy">Add Client</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Create a new client record for quoting and order management.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="rounded-lg bg-electric/5 p-1.5">
              <UserIcon className="h-4 w-4 text-electric" />
            </div>
            <h2 className="text-sm font-semibold text-navy uppercase tracking-wider">Basic Info</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Client Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-electric/20 focus:border-electric transition"
                placeholder="Desjardins Assurances"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Company</label>
              <div className="relative">
                <BuildingOffice2Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-electric/20 focus:border-electric transition"
                  placeholder="Parent company (optional)"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="rounded-lg bg-electric/5 p-1.5">
              <EnvelopeIcon className="h-4 w-4 text-electric" />
            </div>
            <h2 className="text-sm font-semibold text-navy uppercase tracking-wider">Contact</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-electric/20 focus:border-electric transition"
                  placeholder="contact@company.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <div className="relative">
                <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-electric/20 focus:border-electric transition"
                  placeholder="514-555-0100"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Address */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="rounded-lg bg-electric/5 p-1.5">
              <MapPinIcon className="h-4 w-4 text-electric" />
            </div>
            <h2 className="text-sm font-semibold text-navy uppercase tracking-wider">Shipping Address</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Street</label>
              <input
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-electric/20 focus:border-electric transition"
                placeholder="1234 Rue Sainte-Catherine"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-electric/20 focus:border-electric transition"
                  placeholder="Montréal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Province</label>
                <select
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-electric/20 focus:border-electric transition"
                >
                  <option value="QC">Québec</option>
                  <option value="ON">Ontario</option>
                  <option value="BC">British Columbia</option>
                  <option value="AB">Alberta</option>
                  <option value="NS">Nova Scotia</option>
                  <option value="NB">New Brunswick</option>
                  <option value="MB">Manitoba</option>
                  <option value="SK">Saskatchewan</option>
                  <option value="PE">PEI</option>
                  <option value="NL">Newfoundland</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Postal Code</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-electric/20 focus:border-electric transition"
                  placeholder="H2X 1L4"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Notes */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="rounded-lg bg-electric/5 p-1.5">
              <DocumentTextIcon className="h-4 w-4 text-electric" />
            </div>
            <h2 className="text-sm font-semibold text-navy uppercase tracking-wider">Notes</h2>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-electric/20 focus:border-electric transition resize-none"
            placeholder="Internal notes about this client..."
          />
        </section>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href={`${base}/clients`}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-navy transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!isValid || saving}
            className="px-6 py-2.5 bg-electric text-white text-sm font-semibold rounded-lg hover:bg-electric-light transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Create Client'}
          </button>
        </div>
      </form>
    </div>
  )
}
