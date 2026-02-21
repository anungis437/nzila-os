'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  DocumentCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  CalculatorIcon,
  BuildingOffice2Icon,
  ReceiptPercentIcon,
} from '@heroicons/react/24/outline'

interface Entity {
  id: string
  legalName: string
}

interface TaxYear {
  id: string
  fiscalYearLabel: string
  startDate: string
  endDate: string
  status: string
}

interface PackData {
  taxYear: TaxYear
  profile: { provinceOfRegistration: string } | null
  manifest: {
    entityId: string
    fiscalYear: string
    generatedAt: string
    financial: Record<string, string | undefined>
    governance: Record<string, string | string[] | undefined>
    tax: Record<string, string | undefined>
    manifestHash: string
  }
  completeness: {
    percentage: number
    total: number
    present: number
    missing: string[]
  }
  closeGate: {
    canClose: boolean
    blockers: string[]
    warnings: string[]
    artifacts: Record<string, boolean>
  }
  deadlines: Array<{
    label: string
    dueDate: string
    daysRemaining: number
    urgency: 'green' | 'yellow' | 'red'
    type: string
  }>
  basePath: string
  yearClosePeriod: { id: string; status: string } | null
  artifacts: {
    filings: number
    notices: number
    installments: number
    indirectTaxPeriods: number
    governanceLinks: number
  }
}

function urgencyIcon(u: 'green' | 'yellow' | 'red') {
  switch (u) {
    case 'red': return <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
    case 'yellow': return <ClockIcon className="h-4 w-4 text-amber-500" />
    case 'green': return <CheckCircleIcon className="h-4 w-4 text-green-500" />
  }
}

function ArtifactRow({
  label,
  present,
  icon: Icon,
}: {
  label: string
  present: boolean
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-gray-400" />
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      {present ? (
        <CheckCircleIcon className="h-5 w-5 text-green-500" />
      ) : (
        <XCircleIcon className="h-5 w-5 text-gray-300" />
      )}
    </div>
  )
}

export default function YearEndPackPage() {
  const [entities, setEntities] = useState<Entity[]>([])
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [taxYears, setTaxYears] = useState<TaxYear[]>([])
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string | null>(null)
  const [data, setData] = useState<PackData | null>(null)
  const [loading, setLoading] = useState(true)
  const [packLoading, setPackLoading] = useState(false)

  useEffect(() => {
    fetch('/api/entities')
      .then((r) => r.json())
      .then((d: Entity[]) => {
        setEntities(d)
        if (d.length > 0) setSelectedEntityId(d[0]!.id)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedEntityId) return
    fetch(`/api/finance/tax/years?entityId=${selectedEntityId}`)
      .then((r) => r.json())
      .then((years: TaxYear[]) => {
        setTaxYears(years)
        if (years.length > 0) setSelectedFiscalYear(years[0]!.fiscalYearLabel)
      })
      .catch(() => {})
  }, [selectedEntityId])

  useEffect(() => {
    if (!selectedEntityId || !selectedFiscalYear) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: show spinner immediately before async fetch
    setPackLoading(true)
    fetch(
      `/api/finance/year-end-pack?entityId=${selectedEntityId}&fiscalYear=${encodeURIComponent(selectedFiscalYear)}`,
    )
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setPackLoading(false))
  }, [selectedEntityId, selectedFiscalYear])

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-1">
          <Link href="/business" className="hover:underline">Business OS</Link>
          {' / '}
          <Link href="/business/finance" className="hover:underline">Finance</Link>
          {' / Year-End Pack'}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Year-End Accountant Pack</h1>
        <p className="text-sm text-gray-500 mt-1">
          Complete evidence pack for fiscal year close — financial, governance, and tax artifacts.
        </p>
      </div>

      {/* Selectors */}
      <div className="flex gap-4 mb-6">
        {entities.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Entity</label>
            <select
              value={selectedEntityId ?? ''}
              onChange={(e) => {
                setSelectedEntityId(e.target.value)
                setSelectedFiscalYear(null)
                setData(null)
              }}
              className="w-56 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              {entities.map((e) => (
                <option key={e.id} value={e.id}>{e.legalName}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal Year</label>
          <select
            value={selectedFiscalYear ?? ''}
            onChange={(e) => setSelectedFiscalYear(e.target.value)}
            className="w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            {taxYears.map((y) => (
              <option key={y.id} value={y.fiscalYearLabel}>{y.fiscalYearLabel}</option>
            ))}
          </select>
        </div>
      </div>

      {loading || packLoading ? (
        <div className="text-gray-400 text-sm flex items-center gap-2">
          <ArrowPathIcon className="h-4 w-4 animate-spin" />
          Loading pack status...
        </div>
      ) : !data ? (
        <div className="text-center py-16 text-gray-400">
          <DocumentCheckIcon className="h-16 w-16 mx-auto mb-4" />
          <p className="text-lg font-medium">No data available</p>
          <p className="text-sm mt-1">Select an entity and fiscal year to view the year-end pack.</p>
        </div>
      ) : (
        <>
          {/* Completeness Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
            <div className="bg-white border border-gray-200 rounded-lg p-5 col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Pack Completeness</h2>
                <span className={`text-2xl font-bold ${
                  data.completeness.percentage === 100
                    ? 'text-green-600'
                    : data.completeness.percentage >= 70
                      ? 'text-amber-600'
                      : 'text-red-600'
                }`}>
                  {data.completeness.percentage}%
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all ${
                    data.completeness.percentage === 100
                      ? 'bg-green-500'
                      : data.completeness.percentage >= 70
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                  }`}
                  style={{ width: `${data.completeness.percentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">
                {data.completeness.present} of {data.completeness.total} artifacts present
              </p>
              {data.completeness.missing.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-medium text-red-600 mb-1">Missing:</p>
                  <ul className="text-xs text-gray-500 space-y-0.5">
                    {data.completeness.missing.map((m) => (
                      <li key={m} className="flex items-center gap-1">
                        <XCircleIcon className="h-3 w-3 text-red-400" />
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Close Gate</h2>
              <div className="flex items-center gap-2 mb-2">
                {data.closeGate.canClose ? (
                  <>
                    <CheckCircleIcon className="h-6 w-6 text-green-500" />
                    <span className="text-sm font-medium text-green-700">Ready to close</span>
                  </>
                ) : (
                  <>
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />
                    <span className="text-sm font-medium text-red-700">Blocked</span>
                  </>
                )}
              </div>
              {data.closeGate.blockers.length > 0 && (
                <ul className="text-xs text-red-600 space-y-0.5 mt-2">
                  {data.closeGate.blockers.map((b, i) => (
                    <li key={i}>• {b}</li>
                  ))}
                </ul>
              )}
              {data.closeGate.warnings.length > 0 && (
                <ul className="text-xs text-amber-600 space-y-0.5 mt-1">
                  {data.closeGate.warnings.map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Artifact Counts</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Filings</span>
                  <span className="font-medium">{data.artifacts.filings}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Notices</span>
                  <span className="font-medium">{data.artifacts.notices}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Installments</span>
                  <span className="font-medium">{data.artifacts.installments}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Indirect Tax</span>
                  <span className="font-medium">{data.artifacts.indirectTaxPeriods}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Gov. Links</span>
                  <span className="font-medium">{data.artifacts.governanceLinks}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Artifact Checklist */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Financial */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <CalculatorIcon className="h-5 w-5 text-blue-500" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Financial</h3>
              </div>
              <ArtifactRow label="Trial Balance" present={!!data.manifest.financial.trialBalance} icon={DocumentCheckIcon} />
              <ArtifactRow label="Profit & Loss" present={!!data.manifest.financial.profitAndLoss} icon={DocumentCheckIcon} />
              <ArtifactRow label="Balance Sheet" present={!!data.manifest.financial.balanceSheet} icon={DocumentCheckIcon} />
              <ArtifactRow label="GL Export" present={!!data.manifest.financial.glExport} icon={DocumentCheckIcon} />
              <ArtifactRow label="Cash Flow" present={!!data.manifest.financial.cashFlow} icon={DocumentCheckIcon} />
            </div>

            {/* Governance */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheckIcon className="h-5 w-5 text-purple-500" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Governance</h3>
              </div>
              <ArtifactRow label="FS Approval Resolution" present={!!data.manifest.governance.fsApprovalResolution} icon={BuildingOffice2Icon} />
              <ArtifactRow label="Share Ledger Snapshot" present={!!data.manifest.governance.shareLedgerSnapshot} icon={BuildingOffice2Icon} />
              <ArtifactRow
                label="Dividend Resolutions"
                present={
                  Array.isArray(data.manifest.governance.dividendResolutions) &&
                  data.manifest.governance.dividendResolutions.length > 0
                }
                icon={BuildingOffice2Icon}
              />
            </div>

            {/* Tax */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <ReceiptPercentIcon className="h-5 w-5 text-green-500" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Tax</h3>
              </div>
              <ArtifactRow label="T2 Filing" present={!!data.manifest.tax.t2Filing} icon={DocumentCheckIcon} />
              <ArtifactRow label="CO-17 Filing (QC)" present={!!data.manifest.tax.co17Filing} icon={DocumentCheckIcon} />
              <ArtifactRow label="Schedule 50" present={!!data.manifest.tax.schedule50} icon={DocumentCheckIcon} />
              <ArtifactRow label="Installment Summary" present={!!data.manifest.tax.installmentSummary} icon={DocumentCheckIcon} />
              <ArtifactRow label="Notice of Assessment" present={!!data.manifest.tax.noticeOfAssessment} icon={DocumentCheckIcon} />
              <ArtifactRow label="GST/HST Summary" present={!!data.manifest.tax.gstHstAnnualSummary} icon={DocumentCheckIcon} />
              <ArtifactRow label="QST Summary" present={!!data.manifest.tax.qstAnnualSummary} icon={DocumentCheckIcon} />
            </div>
          </div>

          {/* Deadlines */}
          {data.deadlines.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-5 mb-8">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Filing Deadlines
              </h2>
              <div className="space-y-2">
                {data.deadlines.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {urgencyIcon(d.urgency)}
                    <span className="font-medium">{d.label}</span>
                    <span className="text-gray-500">
                      {new Date(d.dueDate).toLocaleDateString('en-CA')}
                      {d.daysRemaining < 0
                        ? ` (${Math.abs(d.daysRemaining)}d overdue)`
                        : ` (${d.daysRemaining}d)`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manifest Hash */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-500">
            <p>
              <span className="font-medium">Manifest hash:</span>{' '}
              <span className="font-mono">{data.manifest.manifestHash}</span>
            </p>
            <p className="mt-1">
              <span className="font-medium">Blob path:</span>{' '}
              <span className="font-mono">{data.basePath}</span>
            </p>
            <p className="mt-1">
              <span className="font-medium">Generated:</span>{' '}
              {new Date(data.manifest.generatedAt).toLocaleString('en-CA')}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
