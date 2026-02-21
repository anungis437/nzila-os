'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  CalendarDaysIcon,
  DocumentCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

interface Entity {
  id: string
  legalName: string
  jurisdiction: string
}

interface TaxYear {
  id: string
  entityId: string
  fiscalYearLabel: string
  startDate: string
  endDate: string
  federalFilingDeadline: string
  federalPaymentDeadline: string
  provincialFilingDeadline: string | null
  status: 'open' | 'filed' | 'assessed' | 'closed'
}

interface TaxProfile {
  id: string
  entityId: string
  federalBn: string | null
  provinceOfRegistration: string | null
  fiscalYearEnd: string | null
}

type DeadlineUrgency = 'green' | 'yellow' | 'red'

function urgencyColor(urgency: DeadlineUrgency) {
  switch (urgency) {
    case 'green':
      return 'text-green-600 bg-green-50 border-green-200'
    case 'yellow':
      return 'text-amber-600 bg-amber-50 border-amber-200'
    case 'red':
      return 'text-red-600 bg-red-50 border-red-200'
  }
}

function statusBadge(status: TaxYear['status']) {
  const styles: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700',
    filed: 'bg-yellow-100 text-yellow-700',
    assessed: 'bg-purple-100 text-purple-700',
    closed: 'bg-green-100 text-green-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? ''}`}>
      {status}
    </span>
  )
}

function computeUrgency(dueDateStr: string): { daysRemaining: number; urgency: DeadlineUrgency } {
  const due = new Date(dueDateStr)
  const now = new Date()
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return {
    daysRemaining: diff,
    urgency: diff < 0 ? 'red' : diff <= 30 ? 'yellow' : 'green',
  }
}

export default function TaxDashboardPage() {
  const [entities, setEntities] = useState<Entity[]>([])
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [taxYears, setTaxYears] = useState<TaxYear[]>([])
  const [profile, setProfile] = useState<TaxProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [yearLoading, setYearLoading] = useState(false)

  // Load entities on mount
  useEffect(() => {
    fetch('/api/entities')
      .then((r) => r.json())
      .then((data: Entity[]) => {
        setEntities(data)
        if (data.length > 0) setSelectedEntityId(data[0]!.id)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Load tax data when entity changes
  useEffect(() => {
    if (!selectedEntityId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: show spinner immediately before async fetch
    setYearLoading(true)

    Promise.all([
      fetch(`/api/finance/tax/years?entityId=${selectedEntityId}`).then((r) => r.json()),
      fetch(`/api/finance/tax/profiles?entityId=${selectedEntityId}`).then((r) => r.json()),
    ])
      .then(([years, profiles]) => {
        setTaxYears(years)
        setProfile(profiles[0] ?? null)
      })
      .catch(() => {})
      .finally(() => setYearLoading(false))
  }, [selectedEntityId])

  const selectedEntity = entities.find((e) => e.id === selectedEntityId)

  // Compute upcoming deadlines for all open tax years
  const upcomingDeadlines = taxYears
    .filter((ty) => ty.status === 'open' || ty.status === 'filed')
    .flatMap((ty) => {
      const deadlines: Array<{ label: string; date: string; urgency: DeadlineUrgency; daysRemaining: number; yearLabel: string }> = []
      const fed = computeUrgency(ty.federalFilingDeadline)
      deadlines.push({ label: 'Federal Filing', date: ty.federalFilingDeadline, ...fed, yearLabel: ty.fiscalYearLabel })
      const fedPay = computeUrgency(ty.federalPaymentDeadline)
      deadlines.push({ label: 'Federal Payment', date: ty.federalPaymentDeadline, ...fedPay, yearLabel: ty.fiscalYearLabel })
      if (ty.provincialFilingDeadline) {
        const prov = computeUrgency(ty.provincialFilingDeadline)
        deadlines.push({ label: 'Provincial Filing', date: ty.provincialFilingDeadline, ...prov, yearLabel: ty.fiscalYearLabel })
      }
      return deadlines
    })
    .sort((a, b) => a.daysRemaining - b.daysRemaining)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-1">
          <Link href="/business" className="hover:underline">Business OS</Link>
          {' / '}
          <Link href="/business/finance" className="hover:underline">Finance</Link>
          {' / Tax'}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Tax Governance</h1>
        <p className="text-sm text-gray-500 mt-1">
          Corporate tax year tracking, deadlines, filings, and CRA/RQ notice management.
        </p>
      </div>

      {/* Entity selector */}
      {entities.length > 1 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Entity</label>
          <select
            value={selectedEntityId ?? ''}
            onChange={(e) => setSelectedEntityId(e.target.value)}
            className="w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {entities.map((e) => (
              <option key={e.id} value={e.id}>{e.legalName}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading entities...</p>
      ) : (
        <div className="space-y-8">
          {/* Tax Profile Summary */}
          {profile && (
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Tax Profile</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">BN</p>
                  <p className="font-medium">{profile.federalBn ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Province</p>
                  <p className="font-medium">{profile.provinceOfRegistration ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Fiscal Year End</p>
                  <p className="font-medium">{profile.fiscalYearEnd ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Entity</p>
                  <p className="font-medium">{selectedEntity?.legalName}</p>
                </div>
              </div>
            </div>
          )}

          {/* Deadline Timeline */}
          {upcomingDeadlines.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Upcoming Deadlines</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {upcomingDeadlines.slice(0, 6).map((d, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${urgencyColor(d.urgency)}`}
                  >
                    {d.urgency === 'red' ? (
                      <ExclamationTriangleIcon className="h-5 w-5 mt-0.5 shrink-0" />
                    ) : d.urgency === 'yellow' ? (
                      <ClockIcon className="h-5 w-5 mt-0.5 shrink-0" />
                    ) : (
                      <CheckCircleIcon className="h-5 w-5 mt-0.5 shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{d.label} — {d.yearLabel}</p>
                      <p className="text-xs mt-0.5">
                        {new Date(d.date).toLocaleDateString('en-CA')}
                        {d.daysRemaining < 0
                          ? ` — ${Math.abs(d.daysRemaining)}d overdue`
                          : ` — ${d.daysRemaining}d remaining`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action bar */}
          <div className="flex gap-3">
            <Link
              href="/business/finance/indirect-tax"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
            >
              <DocumentCheckIcon className="h-4 w-4" /> Indirect Tax (GST/HST/QST)
            </Link>
          </div>

          {/* Tax Years List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Tax Years</h2>
            </div>

            {yearLoading ? (
              <p className="text-gray-400 text-sm">Loading tax years...</p>
            ) : taxYears.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-white border border-gray-200 rounded-lg">
                <CalendarDaysIcon className="h-12 w-12 mx-auto mb-3" />
                <p className="font-medium">No tax years yet</p>
                <p className="text-xs mt-1">Create a tax year to begin tracking deadlines and filings.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {taxYears.map((ty) => {
                  const fedDeadline = computeUrgency(ty.federalFilingDeadline)
                  return (
                    <Link
                      key={ty.id}
                      href={`/business/finance/tax/${ty.id}`}
                      className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium text-gray-900">{ty.fiscalYearLabel}</p>
                          <p className="text-xs text-gray-500">
                            {ty.startDate} → {ty.endDate}
                          </p>
                        </div>
                        {statusBadge(ty.status)}
                      </div>
                      <div className="text-right text-xs">
                        <span className={`inline-block px-2 py-0.5 rounded ${urgencyColor(fedDeadline.urgency)}`}>
                          Fed. Filing: {fedDeadline.daysRemaining < 0
                            ? `${Math.abs(fedDeadline.daysRemaining)}d overdue`
                            : `${fedDeadline.daysRemaining}d`}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
