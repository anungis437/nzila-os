/**
 * CFO — Create Client Form (Client Component).
 *
 * Full onboarding form with business details, tax identifiers,
 * and engagement preferences.
 */
'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/actions/client-actions'
import { validateBusinessNumber, validateProgramAccount, formatBusinessNumber } from '@/lib/tax'

const provinces = [
  { value: 'CA-ON', label: 'Ontario' },
  { value: 'CA-QC', label: 'Quebec' },
  { value: 'CA-BC', label: 'British Columbia' },
  { value: 'CA-AB', label: 'Alberta' },
  { value: 'CA-SK', label: 'Saskatchewan' },
  { value: 'CA-MB', label: 'Manitoba' },
  { value: 'CA-NB', label: 'New Brunswick' },
  { value: 'CA-NS', label: 'Nova Scotia' },
  { value: 'CA-PE', label: 'Prince Edward Island' },
  { value: 'CA-NL', label: 'Newfoundland & Labrador' },
  { value: 'CA-YT', label: 'Yukon' },
  { value: 'CA-NT', label: 'Northwest Territories' },
  { value: 'CA-NU', label: 'Nunavut' },
]

const businessTypes = [
  'Corporation (CCPC)',
  'Corporation (Public)',
  'Sole Proprietorship',
  'Partnership',
  'Trust',
  'Non-Profit',
  'Other',
]

const industries = [
  'Professional Services',
  'Technology',
  'Healthcare',
  'Construction',
  'Real Estate',
  'Retail',
  'Manufacturing',
  'Agriculture',
  'Hospitality',
  'Transportation',
  'Education',
  'Financial Services',
  'Other',
]

const serviceOptions = [
  'Virtual CFO',
  'Tax Compliance (T2)',
  'Tax Planning',
  'Bookkeeping',
  'Payroll',
  'GST/HST Filing',
  'Financial Statements',
  'Advisory',
  'Audit Preparation',
  'Year-End Close',
]

const fiscalMonths = [
  { value: '01-31', label: 'January 31' },
  { value: '02-28', label: 'February 28' },
  { value: '03-31', label: 'March 31' },
  { value: '04-30', label: 'April 30' },
  { value: '05-31', label: 'May 31' },
  { value: '06-30', label: 'June 30' },
  { value: '07-31', label: 'July 31' },
  { value: '08-31', label: 'August 31' },
  { value: '09-30', label: 'September 30' },
  { value: '10-31', label: 'October 31' },
  { value: '11-30', label: 'November 30' },
  { value: '12-31', label: 'December 31' },
]

const inputClasses =
  'w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-electric/40'

export function CreateClientForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [bnError, setBnError] = useState<string | null>(null)
  const [bnFormatted, setBnFormatted] = useState<string | null>(null)

  const validateBn = useCallback((raw: string) => {
    if (!raw.trim()) {
      setBnError(null)
      setBnFormatted(null)
      return
    }
    // Try as program account first (e.g. "123456789 RC0001")
    const pa = validateProgramAccount(raw.trim())
    if (pa.valid) {
      setBnError(null)
      setBnFormatted(formatBusinessNumber(pa.bn9!, pa.programId, pa.referenceNumber))
      return
    }
    // Try as raw 9-digit BN
    const bn = validateBusinessNumber(raw.trim())
    if (bn.valid) {
      setBnError(null)
      setBnFormatted(formatBusinessNumber(bn.bn9!))
      return
    }
    setBnError(bn.errors[0] ?? 'Invalid Business Number')
    setBnFormatted(null)
  }, [])

  function toggleService(svc: string) {
    setSelectedServices((prev) =>
      prev.includes(svc) ? prev.filter((s) => s !== svc) : [...prev, svc],
    )
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    const name = fd.get('name') as string

    if (!name.trim()) {
      setError('Client name is required.')
      return
    }

    startTransition(async () => {
      const result = await createClient({
        name: name.trim(),
        contactEmail: (fd.get('contactEmail') as string)?.trim() || undefined,
        jurisdiction: (fd.get('jurisdiction') as string) || undefined,
        incorporationNumber: (fd.get('incorporationNumber') as string)?.trim() || undefined,
        fiscalYearEnd: (fd.get('fiscalYearEnd') as string) || undefined,
        businessType: (fd.get('businessType') as string) || undefined,
        industry: (fd.get('industry') as string) || undefined,
        phone: (fd.get('phone') as string)?.trim() || undefined,
        servicesNeeded: selectedServices.length > 0 ? selectedServices : undefined,
        notes: (fd.get('notes') as string)?.trim() || undefined,
      })

      if (result.ok) {
        setSuccess(true)
        setTimeout(() => router.push('../clients'), 1200)
      } else {
        setError(result.error ?? 'Failed to create client.')
      }
    })
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 py-12 text-center">
        <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-500" />
        <p className="font-poppins text-lg font-semibold text-foreground">
          Client created
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Redirecting to clients list…
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* ── Section: Basic Information ── */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Basic Information</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">
              Legal Name *
            </label>
            <input id="name" name="name" type="text" required placeholder="e.g. Acme Corp" className={inputClasses} />
          </div>
          <div>
            <label htmlFor="contactEmail" className="mb-1.5 block text-sm font-medium text-foreground">
              Contact Email
            </label>
            <input id="contactEmail" name="contactEmail" type="email" placeholder="contact@example.com" className={inputClasses} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-foreground">
              Phone
            </label>
            <input id="phone" name="phone" type="tel" placeholder="(613) 555-0100" className={inputClasses} />
          </div>
          <div>
            <label htmlFor="businessType" className="mb-1.5 block text-sm font-medium text-foreground">
              Business Type
            </label>
            <select id="businessType" name="businessType" className={inputClasses}>
              <option value="">Select…</option>
              {businessTypes.map((bt) => (
                <option key={bt} value={bt}>{bt}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="industry" className="mb-1.5 block text-sm font-medium text-foreground">
            Industry
          </label>
          <select id="industry" name="industry" className={inputClasses}>
            <option value="">Select…</option>
            {industries.map((ind) => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>
        </div>
      </fieldset>

      {/* ── Section: Tax & Registration ── */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Tax & Registration</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="jurisdiction" className="mb-1.5 block text-sm font-medium text-foreground">
              Province / Territory
            </label>
            <select id="jurisdiction" name="jurisdiction" defaultValue="CA-ON" className={inputClasses}>
              {provinces.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="incorporationNumber" className="mb-1.5 block text-sm font-medium text-foreground">
              Federal BN / Corporation #
            </label>
            <input
              id="incorporationNumber"
              name="incorporationNumber"
              type="text"
              placeholder="123456789 RC0001"
              onChange={(e) => validateBn(e.target.value)}
              className={`${inputClasses} ${bnError ? 'border-red-400 focus:ring-red-400/40' : bnFormatted ? 'border-emerald-400 focus:ring-emerald-400/40' : ''}`}
            />
            {bnError && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="h-3 w-3" /> {bnError}
              </p>
            )}
            {bnFormatted && !bnError && (
              <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="h-3 w-3" /> {bnFormatted}
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="fiscalYearEnd" className="mb-1.5 block text-sm font-medium text-foreground">
            Fiscal Year End
          </label>
          <select id="fiscalYearEnd" name="fiscalYearEnd" className={inputClasses}>
            <option value="">Select…</option>
            {fiscalMonths.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </fieldset>

      {/* ── Section: Services Needed ── */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-foreground">Services Needed</legend>
        <div className="flex flex-wrap gap-2">
          {serviceOptions.map((svc) => (
            <button
              key={svc}
              type="button"
              onClick={() => toggleService(svc)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedServices.includes(svc)
                  ? 'border-electric bg-electric/10 text-electric'
                  : 'border-border text-muted-foreground hover:border-electric/40 hover:text-foreground'
              }`}
            >
              {svc}
            </button>
          ))}
        </div>
      </fieldset>

      {/* ── Section: Notes ── */}
      <div>
        <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-foreground">
          Internal Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Any engagement context, special requirements…"
          className={inputClasses}
        />
      </div>

      {/* ── Submit ── */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-electric px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-electric/90 disabled:opacity-50"
      >
        {isPending ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating…
          </span>
        ) : (
          'Create Client'
        )}
      </button>
    </form>
  )
}
