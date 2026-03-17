'use client'

import { useState, useTransition } from 'react'
import {
  CogIcon,
  BuildingOffice2Icon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  BellIcon,
  PaintBrushIcon,
} from '@heroicons/react/24/outline'
import type { OrgCommerceConfig } from '@nzila/platform-commerce-org/types'
import {
  saveGeneralSettingsAction,
  saveQuotePolicyAction,
  saveBrandingAction,
} from './settings-actions'

const tabs = [
  { id: 'general', label: 'General', icon: CogIcon },
  { id: 'org', label: 'Organisation', icon: BuildingOffice2Icon },
  { id: 'pricing', label: 'Pricing', icon: CurrencyDollarIcon },
  { id: 'governance', label: 'Governance', icon: ShieldCheckIcon },
  { id: 'notifications', label: 'Notifications', icon: BellIcon },
  { id: 'appearance', label: 'Appearance', icon: PaintBrushIcon },
]

interface SettingsFormProps {
  config: OrgCommerceConfig
}

export function SettingsForm({ config }: SettingsFormProps) {
  const [activeTab, setActiveTab] = useState('general')

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure your commerce workspace.
        </p>
      </div>

      <div className="flex gap-8">
        <nav className="w-48 shrink-0 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition ${
                activeTab === tab.id
                  ? 'bg-purple-50 text-purple-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="flex-1">
          {activeTab === 'general' && <GeneralSettings config={config} />}
          {activeTab === 'org' && <OrgSettings config={config} />}
          {activeTab === 'pricing' && <PricingSettings config={config} />}
          {activeTab === 'governance' && <GovernanceSettings config={config} />}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'appearance' && <AppearanceSettings config={config} />}
        </div>
      </div>
    </div>
  )
}

// ── Shared components ──────────────────────────────────────────────────────

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-gray-500 mb-5">{description}</p>
      {children}
    </div>
  )
}

function SaveButton({ pending, onClick }: { pending: boolean; onClick: () => void }) {
  return (
    <div className="mt-4 flex justify-end">
      <button
        onClick={onClick}
        disabled={pending}
        className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}

function StatusMessage({ status }: { status: { ok: boolean; error?: string } | null }) {
  if (!status) return null
  return (
    <p className={`text-sm mt-2 ${status.ok ? 'text-green-600' : 'text-red-600'}`}>
      {status.ok ? 'Saved successfully.' : `Error: ${status.error}`}
    </p>
  )
}

// ── General ────────────────────────────────────────────────────────────────

function GeneralSettings({ config }: { config: OrgCommerceConfig }) {
  const { settings } = config
  const [currency, setCurrency] = useState(settings.currency)
  const [quoteValidityDays, setQuoteValidityDays] = useState(settings.quoteValidityDays)
  const [quotePrefix, setQuotePrefix] = useState(settings.quotePrefix)
  const [invoicePrefix, setInvoicePrefix] = useState(settings.invoicePrefix)
  const [poPrefix, setPoPrefix] = useState(settings.poPrefix)
  const [orderPrefix, setOrderPrefix] = useState(settings.orderPrefix)
  const [shareLinkExpiryDays, setShareLinkExpiryDays] = useState(settings.shareLinkExpiryDays)
  const [locale, setLocale] = useState(settings.locale)
  const [defaultShippingPolicy, setDefaultShippingPolicy] = useState(settings.defaultShippingPolicy)
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<{ ok: boolean; error?: string } | null>(null)

  function handleSave() {
    startTransition(async () => {
      const result = await saveGeneralSettingsAction({
        currency,
        locale,
        quotePrefix,
        invoicePrefix,
        poPrefix,
        orderPrefix,
        quoteValidityDays,
        shareLinkExpiryDays,
        taxConfig: settings.taxConfig,
        defaultShippingPolicy,
      })
      setStatus(result)
    })
  }

  return (
    <>
      <SettingsCard title="Workspace" description="Basic workspace configuration.">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="CAD">CAD — Canadian Dollar</option>
              <option value="USD">USD — US Dollar</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Locale</label>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="en-CA">en-CA</option>
              <option value="en-US">en-US</option>
              <option value="fr-CA">fr-CA</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quote Validity (days)</label>
            <input
              type="number"
              value={quoteValidityDays}
              onChange={(e) => setQuoteValidityDays(Number(e.target.value))}
              min={7}
              max={90}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Share Link Expiry (days)</label>
            <input
              type="number"
              value={shareLinkExpiryDays}
              onChange={(e) => setShareLinkExpiryDays(Number(e.target.value))}
              min={1}
              max={90}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Shipping Policy</label>
            <input
              type="text"
              value={defaultShippingPolicy}
              onChange={(e) => setDefaultShippingPolicy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
        <SaveButton pending={isPending} onClick={handleSave} />
        <StatusMessage status={status} />
      </SettingsCard>

      <SettingsCard title="Reference Format" description="Configure how reference numbers are generated.">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quote Prefix</label>
            <input
              type="text"
              value={quotePrefix}
              onChange={(e) => setQuotePrefix(e.target.value)}
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
            />
            <span className="text-sm text-gray-500 ml-3">Preview: {quotePrefix}-2026-001</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Prefix</label>
            <input
              type="text"
              value={invoicePrefix}
              onChange={(e) => setInvoicePrefix(e.target.value)}
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PO Prefix</label>
            <input
              type="text"
              value={poPrefix}
              onChange={(e) => setPoPrefix(e.target.value)}
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Order Prefix</label>
            <input
              type="text"
              value={orderPrefix}
              onChange={(e) => setOrderPrefix(e.target.value)}
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
            />
          </div>
        </div>
      </SettingsCard>
    </>
  )
}

// ── Organisation ───────────────────────────────────────────────────────────

function OrgSettings({ config }: { config: OrgCommerceConfig }) {
  const { branding } = config
  const [companyName, setCompanyName] = useState(branding.companyName)
  const [companyLegalName, setCompanyLegalName] = useState(branding.companyLegalName)
  const [address, setAddress] = useState(branding.address)
  const [supportEmail, setSupportEmail] = useState(branding.supportEmail ?? '')
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<{ ok: boolean; error?: string } | null>(null)

  function handleSave() {
    startTransition(async () => {
      const { orgId: _, ...rest } = branding
      const result = await saveBrandingAction({
        ...rest,
        companyName,
        companyLegalName,
        address,
        supportEmail: supportEmail || undefined,
      })
      setStatus(result)
    })
  }

  return (
    <SettingsCard title="Organisation" description="Your business details for quote letterheads.">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Legal Name</label>
          <input
            type="text"
            value={companyLegalName}
            onChange={(e) => setCompanyLegalName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Support Email</label>
          <input
            type="email"
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
            placeholder="support@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <textarea
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
          />
        </div>
      </div>
      <SaveButton pending={isPending} onClick={handleSave} />
      <StatusMessage status={status} />
    </SettingsCard>
  )
}

// ── Pricing ────────────────────────────────────────────────────────────────

function PricingSettings({ config }: { config: OrgCommerceConfig }) {
  const { settings, quotePolicy } = config
  const gst = settings.taxConfig.taxes[0]?.rate ? settings.taxConfig.taxes[0].rate * 100 : 5
  const qst = settings.taxConfig.taxes[1]?.rate ? settings.taxConfig.taxes[1].rate * 100 : 9.975
  const [budget, setBudget] = useState(quotePolicy.marginFloors.budget)
  const [standard, setStandard] = useState(quotePolicy.marginFloors.standard)
  const [premium, setPremium] = useState(quotePolicy.marginFloors.premium)
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<{ ok: boolean; error?: string } | null>(null)

  function handleSave() {
    startTransition(async () => {
      const { orgId: _, ...rest } = quotePolicy
      const result = await saveQuotePolicyAction({
        ...rest,
        marginFloors: { budget, standard, premium },
      })
      setStatus(result)
    })
  }

  return (
    <SettingsCard title="Pricing Configuration" description="Configure tax rates and margin thresholds.">
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">GST Rate (%)</label>
          <input
            type="number"
            defaultValue={gst}
            step={0.001}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            disabled
          />
          <p className="text-xs text-gray-400 mt-1">Federal rate — automatically applied.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">QST Rate (%)</label>
          <input
            type="number"
            defaultValue={qst}
            step={0.001}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            disabled
          />
          <p className="text-xs text-gray-400 mt-1">Quebec rate — calculated on base + GST.</p>
        </div>
      </div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Margin Floors</h3>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Budget Tier</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <span className="text-sm text-gray-500">%</span>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Standard Tier</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={standard}
              onChange={(e) => setStandard(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <span className="text-sm text-gray-500">%</span>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Premium Tier</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={premium}
              onChange={(e) => setPremium(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <span className="text-sm text-gray-500">%</span>
          </div>
        </div>
      </div>
      <SaveButton pending={isPending} onClick={handleSave} />
      <StatusMessage status={status} />
    </SettingsCard>
  )
}

// ── Governance ─────────────────────────────────────────────────────────────

function GovernanceSettings({ config }: { config: OrgCommerceConfig }) {
  const { quotePolicy } = config
  return (
    <SettingsCard title="Governance Gates" description="Configure quote approval gates and governance rules.">
      <div className="space-y-4">
        <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <input type="checkbox" defaultChecked={quotePolicy.approvalRequiredBelowMargin} className="rounded" />
          <div>
            <p className="text-sm font-medium text-gray-900">Margin Floor Gate</p>
            <p className="text-xs text-gray-500">
              Block quotes below the configured margin threshold (min {quotePolicy.minMarginPercent}%).
            </p>
          </div>
        </label>
        <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <input type="checkbox" defaultChecked={quotePolicy.approvalThreshold > 0} className="rounded" />
          <div>
            <p className="text-sm font-medium text-gray-900">Approval Required Gate</p>
            <p className="text-xs text-gray-500">
              Require manager approval for quotes above ${quotePolicy.approvalThreshold.toLocaleString()}.
            </p>
          </div>
        </label>
        <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <input type="checkbox" className="rounded" />
          <div>
            <p className="text-sm font-medium text-gray-900">Dual Sign-off Gate</p>
            <p className="text-xs text-gray-500">Require two approvers for high-value quotes.</p>
          </div>
        </label>
        <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <input type="checkbox" defaultChecked={quotePolicy.requireEvidenceForInvoice} className="rounded" />
          <div>
            <p className="text-sm font-medium text-gray-900">Audit Trail Enforcement</p>
            <p className="text-xs text-gray-500">Every status transition produces a hash-chained audit entry.</p>
          </div>
        </label>
      </div>
    </SettingsCard>
  )
}

// ── Notifications ──────────────────────────────────────────────────────────

function NotificationSettings() {
  return (
    <SettingsCard title="Notifications" description="Configure email and in-app notification preferences.">
      <div className="space-y-4">
        <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <input type="checkbox" defaultChecked className="rounded" />
          <div>
            <p className="text-sm font-medium text-gray-900">Quote accepted</p>
            <p className="text-xs text-gray-500">Notify when a client accepts a quote.</p>
          </div>
        </label>
        <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <input type="checkbox" defaultChecked className="rounded" />
          <div>
            <p className="text-sm font-medium text-gray-900">Quote expiring soon</p>
            <p className="text-xs text-gray-500">Notify 3 days before a quote expires.</p>
          </div>
        </label>
        <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <input type="checkbox" className="rounded" />
          <div>
            <p className="text-sm font-medium text-gray-900">Import completed</p>
            <p className="text-xs text-gray-500">Notify when a legacy import batch finishes.</p>
          </div>
        </label>
      </div>
    </SettingsCard>
  )
}

// ── Appearance ─────────────────────────────────────────────────────────────

function AppearanceSettings({ config }: { config: OrgCommerceConfig }) {
  const { branding } = config
  return (
    <SettingsCard title="Appearance" description="Customise the look and feel of your workspace.">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Theme</label>
          <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="light">Light</option>
            <option value="dark">Dark (coming soon)</option>
            <option value="system">System</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Accent Colour</label>
          <div className="flex items-center gap-2">
            <div
              className="h-8 w-8 rounded-lg border-2"
              style={{ backgroundColor: branding.primaryColor, borderColor: branding.secondaryColor }}
            />
            <span className="text-sm text-gray-500">{branding.primaryColor}</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
          <input
            type="text"
            defaultValue={branding.displayName}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            disabled
          />
          <p className="text-xs text-gray-400 mt-1">Change via Organisation tab.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Customer Portal Label</label>
          <input
            type="text"
            defaultValue={branding.customerPortalLabel}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            disabled
          />
        </div>
      </div>
    </SettingsCard>
  )
}
