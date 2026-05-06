'use client'

/**
 * TrustCore — Onboarding Wizard
 *
 * 6-step guided onboarding wizard.
 * State is auto-saved to localStorage so users can resume if they navigate away.
 * On submit, POSTs to /api/onboarding and redirects to the dashboard.
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheckIcon, CheckCircleIcon, ArrowLeftIcon, ArrowRightIcon, SparklesIcon } from '@heroicons/react/24/outline'
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
} from '@/lib/validation/onboarding'
import { trackEvent } from '@/lib/analytics/track'
import type {
  Step1Input,
  Step2Input,
  Step3Input,
  Step4Input,
  Step5Input,
  DataType,
  KnownVendor,
  OnboardingInput,
} from '@/lib/validation/onboarding'

// ── Types ──────────────────────────────────────────────────────────────────

interface WizardState {
  step: number
  step1: Partial<Step1Input>
  step2: Partial<Step2Input>
  step3: Partial<Step3Input>
  step4: Partial<Step4Input>
  step5: Partial<Step5Input>
}

const DEFAULT_STATE: WizardState = {
  step: 1,
  step1: { province: 'Quebec' },
  step2: {},
  step3: { collectsPersonalData: true, dataTypes: [], storesOutsideCanada: false },
  step4: { usesThirdPartyTools: false, selectedVendors: [], otherVendors: '' },
  step5: { collectsConsent: false, handlesDsrRequests: false, hasIncidentProcedures: false },
}

const TOTAL_STEPS = 6

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance & Banking', 'Legal Services',
  'Education', 'Retail / E-commerce', 'Real Estate', 'Consulting',
  'Non-profit', 'Government / Public Sector', 'Manufacturing', 'Other',
]

const DATA_TYPE_OPTIONS: { value: DataType; label: string; description: string }[] = [
  { value: 'contact', label: 'Contact Information', description: 'Name, email, phone, address' },
  { value: 'financial', label: 'Financial Data', description: 'Payment details, billing records' },
  { value: 'health', label: 'Health Information', description: 'Medical or wellness data' },
  { value: 'employee', label: 'Employee Records', description: 'HR, payroll, performance data' },
  { value: 'children', label: "Children's Data", description: 'Data on individuals under 14' },
  { value: 'other', label: 'Other Personal Data', description: 'Any other personal information' },
]

const KNOWN_VENDOR_OPTIONS: { value: KnownVendor; label: string; sub: string }[] = [
  { value: 'google_workspace', label: 'Google Workspace', sub: 'Gmail, Drive, Meet' },
  { value: 'microsoft_365', label: 'Microsoft 365', sub: 'Outlook, Teams, SharePoint' },
  { value: 'stripe', label: 'Stripe', sub: 'Payment processing' },
  { value: 'shopify', label: 'Shopify', sub: 'E-commerce platform' },
]

// ── Step heading helper ────────────────────────────────────────────────────

const STEP_LABELS = [
  'Organization Basics',
  'Privacy Officer',
  'Data Profile',
  'Vendors',
  'Consent & Practices',
  'Review & Generate',
]

// ── Progress bar ───────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1
          const done = n < current
          const active = n === current
          return (
            <div key={n} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${
                  done
                    ? 'bg-teal-500 text-white'
                    : active
                      ? 'bg-teal-600 text-white ring-2 ring-teal-300'
                      : 'bg-gray-200 text-gray-500'
                }`}
              >
                {done ? <CheckCircleIcon className="h-5 w-5" /> : n}
              </div>
              {n < total && (
                <div
                  className={`h-0.5 flex-1 mx-1 transition-all ${done ? 'bg-teal-400' : 'bg-gray-200'}`}
                  style={{ minWidth: '2rem' }}
                />
              )}
            </div>
          )
        })}
      </div>
      <p className="text-xs text-gray-500 text-center">
        Step {current} of {total} — {STEP_LABELS[current - 1]}
      </p>
    </div>
  )
}

// ── Field components ───────────────────────────────────────────────────────

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  error,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  error?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 ${
        error ? 'border-red-400' : 'border-gray-300'
      }`}
    />
  )
}

function BoolToggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? 'bg-teal-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <span className="text-sm text-gray-700">{label}</span>
    </div>
  )
}

// ── Step components ────────────────────────────────────────────────────────

function Step1({ data, onChange }: { data: Partial<Step1Input>; onChange: (d: Partial<Step1Input>) => void }) {
  const errors = (() => {
    const r = step1Schema.safeParse(data)
    if (r.success) return {}
    return Object.fromEntries(
      Object.entries(r.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? '']),
    )
  })()
  return (
    <div className="space-y-5">
      <Field label="Organization Name" required error={errors.orgName}>
        <TextInput
          value={data.orgName ?? ''}
          onChange={(v) => onChange({ ...data, orgName: v })}
          placeholder="e.g. Acme Inc."
          error={errors.orgName}
        />
      </Field>
      <Field label="Industry" required error={errors.industry}>
        <select
          value={data.industry ?? ''}
          onChange={(e) => onChange({ ...data, industry: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        >
          <option value="">Select industry…</option>
          {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
      </Field>
      <Field label="Province / Jurisdiction" required error={errors.province}>
        <select
          value={data.province ?? 'Quebec'}
          onChange={(e) => onChange({ ...data, province: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        >
          {['Quebec', 'Ontario', 'British Columbia', 'Alberta', 'Other'].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </Field>
      <Field label="Website (optional)">
        <TextInput
          value={data.website ?? ''}
          onChange={(v) => onChange({ ...data, website: v })}
          placeholder="https://example.com"
          type="url"
        />
      </Field>
    </div>
  )
}

function Step2({ data, onChange }: { data: Partial<Step2Input>; onChange: (d: Partial<Step2Input>) => void }) {
  const errors = (() => {
    const r = step2Schema.safeParse(data)
    if (r.success) return {}
    return Object.fromEntries(
      Object.entries(r.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? '']),
    )
  })()
  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600 bg-teal-50 border border-teal-100 rounded-lg px-4 py-3">
        Under Law 25, every organization must designate a Privacy Officer responsible for compliance. This person will be listed in all generated policies.
      </p>
      <Field label="Full Name" required error={errors.officerName}>
        <TextInput
          value={data.officerName ?? ''}
          onChange={(v) => onChange({ ...data, officerName: v })}
          placeholder="e.g. Marie Tremblay"
          error={errors.officerName}
        />
      </Field>
      <Field label="Email Address" required error={errors.officerEmail}>
        <TextInput
          value={data.officerEmail ?? ''}
          onChange={(v) => onChange({ ...data, officerEmail: v })}
          placeholder="privacy@example.com"
          type="email"
          error={errors.officerEmail}
        />
      </Field>
      <Field label="Role / Title" required error={errors.officerTitle}>
        <TextInput
          value={data.officerTitle ?? ''}
          onChange={(v) => onChange({ ...data, officerTitle: v })}
          placeholder="e.g. Chief Privacy Officer"
          error={errors.officerTitle}
        />
      </Field>
    </div>
  )
}

function Step3({ data, onChange }: { data: Partial<Step3Input>; onChange: (d: Partial<Step3Input>) => void }) {
  const collectsPersonalData = data.collectsPersonalData ?? true
  const dataTypes = data.dataTypes ?? []
  const storesOutsideCanada = data.storesOutsideCanada ?? false

  function toggleType(type: DataType) {
    const next = dataTypes.includes(type)
      ? dataTypes.filter((t) => t !== type)
      : [...dataTypes, type]
    onChange({ ...data, dataTypes: next })
  }

  return (
    <div className="space-y-6">
      <BoolToggle
        label="We collect personal information from individuals"
        value={collectsPersonalData}
        onChange={(v) => onChange({ ...data, collectsPersonalData: v })}
      />
      {collectsPersonalData && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">
            What types of personal information do you collect? <span className="text-red-500">*</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DATA_TYPE_OPTIONS.map((opt) => {
              const checked = dataTypes.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleType(opt.value)}
                  className={`text-left p-3 border rounded-lg transition-all ${
                    checked
                      ? 'bg-teal-50 border-teal-400 ring-1 ring-teal-300'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}
      <BoolToggle
        label="We store or process data outside Canada (e.g., US-based cloud services)"
        value={storesOutsideCanada}
        onChange={(v) => onChange({ ...data, storesOutsideCanada: v })}
      />
      {storesOutsideCanada && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          ⚠️ Cross-border transfers require additional safeguards under Law 25. TrustCore will flag this for a PIA review.
        </p>
      )}
    </div>
  )
}

function Step4({ data, onChange }: { data: Partial<Step4Input>; onChange: (d: Partial<Step4Input>) => void }) {
  const usesThirdParty = data.usesThirdPartyTools ?? false
  const selected = data.selectedVendors ?? []
  const otherVendors = data.otherVendors ?? ''

  function toggleVendor(v: KnownVendor) {
    const next = selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]
    onChange({ ...data, selectedVendors: next })
  }

  return (
    <div className="space-y-6">
      <BoolToggle
        label="We use third-party tools or services that process personal data"
        value={usesThirdParty}
        onChange={(v) => onChange({ ...data, usesThirdPartyTools: v })}
      />
      {usesThirdParty && (
        <>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Select the tools you use:</p>
            <div className="space-y-2">
              {KNOWN_VENDOR_OPTIONS.map((opt) => {
                const checked = selected.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleVendor(opt.value)}
                    className={`w-full text-left flex items-center gap-3 p-3 border rounded-lg transition-all ${
                      checked
                        ? 'bg-teal-50 border-teal-400 ring-1 ring-teal-300'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center ${
                        checked ? 'bg-teal-500 border-teal-500' : 'border-gray-400'
                      }`}
                    >
                      {checked && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                      <p className="text-xs text-gray-500">{opt.sub}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Other tools (one per line)
            </label>
            <textarea
              value={otherVendors}
              onChange={(e) => onChange({ ...data, otherVendors: e.target.value })}
              placeholder="e.g. Notion&#10;Slack&#10;HubSpot"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
            />
          </div>
        </>
      )}
    </div>
  )
}

function Step5({ data, onChange }: { data: Partial<Step5Input>; onChange: (d: Partial<Step5Input>) => void }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Tell us about your current privacy practices. You can always update these later.
      </p>
      <BoolToggle
        label="We collect consent before processing personal data"
        value={data.collectsConsent ?? false}
        onChange={(v) => onChange({ ...data, collectsConsent: v })}
      />
      <BoolToggle
        label="We respond to data access and deletion requests from individuals"
        value={data.handlesDsrRequests ?? false}
        onChange={(v) => onChange({ ...data, handlesDsrRequests: v })}
      />
      <BoolToggle
        label="We have a procedure for handling privacy incidents"
        value={data.hasIncidentProcedures ?? false}
        onChange={(v) => onChange({ ...data, hasIncidentProcedures: v })}
      />
      <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
        Tip: Answering &ldquo;No&rdquo; to any of these is fine — TrustCore will highlight them as
        compliance gaps and give you step-by-step guidance to address them.
      </p>
    </div>
  )
}

function Step6({
  state,
  isSubmitting,
  onSubmit,
}: {
  state: WizardState
  isSubmitting: boolean
  onSubmit: () => void
}) {
  const s1 = state.step1
  const s2 = state.step2
  const s3 = state.step3
  const s4 = state.step4
  const s5 = state.step5

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        We&apos;ll set this up for you. Review your answers and click <strong>Generate Compliance Setup</strong> to create your privacy program, data inventory, and policies.
      </p>

      <div className="space-y-4">
        <ReviewCard title="Organization">
          <ReviewRow label="Name" value={s1.orgName ?? '—'} />
          <ReviewRow label="Industry" value={s1.industry ?? '—'} />
          <ReviewRow label="Province" value={s1.province ?? '—'} />
        </ReviewCard>

        <ReviewCard title="Privacy Officer">
          <ReviewRow label="Name" value={s2.officerName ?? '—'} />
          <ReviewRow label="Email" value={s2.officerEmail ?? '—'} />
          <ReviewRow label="Title" value={s2.officerTitle ?? '—'} />
        </ReviewCard>

        <ReviewCard title="Data Profile">
          <ReviewRow
            label="Collects personal data"
            value={s3.collectsPersonalData ? 'Yes' : 'No'}
          />
          {s3.collectsPersonalData && (
            <ReviewRow
              label="Data types"
              value={(s3.dataTypes ?? []).join(', ') || 'None selected'}
            />
          )}
          <ReviewRow
            label="Cross-border transfers"
            value={s3.storesOutsideCanada ? 'Yes (⚠️ PIA required)' : 'No'}
          />
        </ReviewCard>

        <ReviewCard title="Vendors">
          <ReviewRow
            label="Uses third-party tools"
            value={s4.usesThirdPartyTools ? 'Yes' : 'No'}
          />
          {s4.usesThirdPartyTools && (
            <ReviewRow
              label="Vendors"
              value={[...(s4.selectedVendors ?? [])].join(', ') || 'None selected'}
            />
          )}
        </ReviewCard>

        <ReviewCard title="Practices">
          <ReviewRow label="Collects consent" value={s5.collectsConsent ? 'Yes' : 'No'} />
          <ReviewRow label="Handles DSR requests" value={s5.handlesDsrRequests ? 'Yes' : 'No'} />
          <ReviewRow label="Has incident procedures" value={s5.hasIncidentProcedures ? 'Yes' : 'No'} />
        </ReviewCard>
      </div>

      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-teal-800 mb-2">What we&apos;ll create for you:</p>
        <ul className="text-sm text-teal-700 space-y-1">
          <li>✓ Active privacy program (Law 25 framework)</li>
          {(s3.dataTypes ?? []).length > 0 && (
            <li>✓ {(s3.dataTypes ?? []).length} data asset record(s)</li>
          )}
          {s4.usesThirdPartyTools && (
            <li>✓ Vendor register entries</li>
          )}
          <li>✓ Generated Privacy Policy</li>
          <li>✓ Generated Data Governance Policy</li>
          <li>✓ Initial compliance snapshot</li>
        </ul>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting}
        className="w-full py-3 px-6 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Setting up your compliance program…
          </>
        ) : (
          <>
            <ShieldCheckIcon className="h-5 w-5" />
            Generate Compliance Setup
          </>
        )}
      </button>
    </div>
  )
}

function ReviewCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{title}</p>
      </div>
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex px-4 py-2 gap-4">
      <span className="text-xs text-gray-500 w-36 shrink-0">{label}</span>
      <span className="text-sm text-gray-800 font-medium">{value}</span>
    </div>
  )
}

// ── Validation helpers ─────────────────────────────────────────────────────

function isStepValid(state: WizardState, step: number): boolean {
  switch (step) {
    case 1: return step1Schema.safeParse(state.step1).success
    case 2: return step2Schema.safeParse(state.step2).success
    case 3: return step3Schema.safeParse(state.step3).success &&
      (!state.step3.collectsPersonalData || (state.step3.dataTypes ?? []).length > 0)
    case 4: return step4Schema.safeParse(state.step4).success
    case 5: return step5Schema.safeParse(state.step5).success
    default: return true
  }
}

// ── Main wizard ────────────────────────────────────────────────────────────

export function OnboardingWizard({ orgId }: { orgId: string }) {
  const router = useRouter()
  const storageKey = `tc_onboarding_${orgId}`

  const [state, setState] = useState<WizardState>(DEFAULT_STATE)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  // Hydrate from localStorage on mount
  useEffect(() => {
    trackEvent('onboarding_started', { orgId })
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved) as WizardState
        setState(parsed)
      }
    } catch {
      // ignore
    }
  }, [storageKey, orgId])

  // Auto-save to localStorage on every state change
  const persistState = useCallback(
    (next: WizardState) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // ignore
      }
      setState(next)
    },
    [storageKey],
  )

  function goNext() {
    if (state.step < TOTAL_STEPS) persistState({ ...state, step: state.step + 1 })
  }

  function goBack() {
    if (state.step > 1) persistState({ ...state, step: state.step - 1 })
  }

  async function handleSubmit() {
    // Validate all steps before submitting
    const validationErrors: string[] = []
    if (!step1Schema.safeParse(state.step1).success) validationErrors.push('Step 1: Organization Basics')
    if (!step2Schema.safeParse(state.step2).success) validationErrors.push('Step 2: Privacy Officer')
    if (!step3Schema.safeParse(state.step3).success) validationErrors.push('Step 3: Data Profile')
    if (state.step3.collectsPersonalData && (state.step3.dataTypes ?? []).length === 0) {
      validationErrors.push('Step 3: Select at least one data type')
    }
    if (validationErrors.length > 0) {
      setSubmitError(`Please complete: ${validationErrors.join(', ')}`)
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const payload: OnboardingInput = {
        step1: state.step1 as Step1Input,
        step2: state.step2 as Step2Input,
        step3: {
          collectsPersonalData: state.step3.collectsPersonalData ?? true,
          dataTypes: state.step3.dataTypes ?? [],
          storesOutsideCanada: state.step3.storesOutsideCanada ?? false,
        },
        step4: {
          usesThirdPartyTools: state.step4.usesThirdPartyTools ?? false,
          selectedVendors: state.step4.selectedVendors ?? [],
          otherVendors: state.step4.otherVendors ?? '',
        },
        step5: {
          collectsConsent: state.step5.collectsConsent ?? false,
          handlesDsrRequests: state.step5.handlesDsrRequests ?? false,
          hasIncidentProcedures: state.step5.hasIncidentProcedures ?? false,
        },
      }

      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (res.status === 409) {
          // Already onboarded — redirect to dashboard
          localStorage.removeItem(storageKey)
          router.push('/dashboard')
          return
        }
        throw new Error((body as { error?: string }).error ?? `Server error ${res.status}`)
      }

      // Clear saved state on success, show upgrade modal before redirecting
      localStorage.removeItem(storageKey)
      trackEvent('onboarding_completed', { orgId })
      setShowUpgradeModal(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setIsSubmitting(false)
    }
  }

  const canProceed = isStepValid(state, state.step)

  return (
    <>
      {/* Post-onboarding upgrade modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
            <div className="flex justify-center mb-4">
              <CheckCircleIcon className="h-14 w-14 text-teal-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">You&apos;re set up.</h2>
            <p className="text-gray-600 text-sm mb-6 leading-relaxed">
              Your compliance program is live. Unlock your audit report and shareable Trust Center to go from &ldquo;set up&rdquo; to &ldquo;buyer-ready&rdquo;.
            </p>

            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm font-semibold text-teal-800 mb-2 flex items-center gap-2">
                <SparklesIcon className="h-4 w-4 shrink-0" />
                Upgrade to Pro unlocks:
              </p>
              <ul className="text-sm text-teal-700 space-y-1">
                <li>✓ Audit export (JSON + PDF)</li>
                <li>✓ Evidence bundle export</li>
                <li>✓ Shareable public Trust Center</li>
                <li>✓ Unlimited compliance reminders</li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <a
                href="/billing"
                className="w-full py-3 px-6 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition text-sm flex items-center justify-center gap-2"
              >
                <SparklesIcon className="h-4 w-4" />
                Upgrade to Pro
              </a>
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="w-full py-2.5 px-6 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition text-sm"
              >
                Continue with Free — see what to fix next
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-3">
          <ShieldCheckIcon className="h-10 w-10 text-teal-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome to TrustCore</h1>
        <p className="text-gray-600 mt-1 text-sm">
          We&apos;ll set up your Law 25 compliance program in under 15 minutes.
        </p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <ProgressBar current={state.step} total={TOTAL_STEPS} />

        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            {STEP_LABELS[state.step - 1]}
          </h2>
        </div>

        {/* Step content */}
        {state.step === 1 && (
          <Step1
            data={state.step1}
            onChange={(d) => persistState({ ...state, step1: d })}
          />
        )}
        {state.step === 2 && (
          <Step2
            data={state.step2}
            onChange={(d) => persistState({ ...state, step2: d })}
          />
        )}
        {state.step === 3 && (
          <Step3
            data={state.step3}
            onChange={(d) => persistState({ ...state, step3: d })}
          />
        )}
        {state.step === 4 && (
          <Step4
            data={state.step4}
            onChange={(d) => persistState({ ...state, step4: d })}
          />
        )}
        {state.step === 5 && (
          <Step5
            data={state.step5}
            onChange={(d) => persistState({ ...state, step5: d })}
          />
        )}
        {state.step === 6 && (
          <Step6
            state={state}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
          />
        )}

        {/* Error message */}
        {submitError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{submitError}</p>
          </div>
        )}

        {/* Navigation */}
        {state.step < TOTAL_STEPS && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={goBack}
              disabled={state.step === 1}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back
            </button>

            <button
              type="button"
              onClick={goNext}
              disabled={!canProceed}
              className="flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold rounded-lg transition"
            >
              Continue
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <p className="text-center mt-4 text-xs text-gray-400">
        Your progress is saved automatically. You can close this page and resume anytime.
      </p>
    </div>
    </>
  )
}
