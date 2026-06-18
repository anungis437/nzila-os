'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowRightIcon } from '@heroicons/react/24/outline'
import { PRODUCT_SCORE_LABELS } from '@nzila/itsm-core'
import type { ProductScoreCategory } from '@nzila/itsm-core'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { PaginationControls } from '@/components/ui/PaginationControls'

export interface PortfolioWidgetProduct {
  name: string
  id?: string
  status: string
  directive: string
  priorityLabel: string
  capitalPriorityScore?: number
  capitalAction?: string
  capitalRationale?: string
  code_presence?: string
  evidence_status?: string
  ga_gate_count?: number
  value_prop?: string
  docs_entrypoint?: string
}

export interface PortfolioOpsProduct {
  key: string
  label: string
  revenueScore: number
  closeabilityScore: number
  supportBurden: number
  founderEnergy: number
  strategicFit: number
  marketPull: number
  buildMaturity: number
  recommendation: ProductScoreCategory
  recommendationNote?: string
}

interface PortfolioWidgetsProps {
  products: PortfolioWidgetProduct[]
  opsProducts: PortfolioOpsProduct[]
}

function directiveStyle(directive: string): string {
  if (directive === 'SELL NOW') return 'bg-emerald-100 text-emerald-700 font-bold'
  if (directive === 'BUILD NEXT') return 'bg-blue-100 text-blue-700 font-semibold'
  if (directive === 'MAINTAIN') return 'bg-gray-100 text-gray-500'
  if (directive === 'HOLD') return 'bg-amber-100 text-amber-600'
  return 'bg-red-100 text-red-600 font-bold'
}

function codeBar(codePresence?: string) {
  if (codePresence === 'full') return <span className="text-emerald-600 font-semibold text-xs">●●●</span>
  if (codePresence === 'partial') return <span className="text-amber-500 font-semibold text-xs">●●○</span>
  if (codePresence === 'scaffold') return <span className="text-gray-400 text-xs">●○○</span>
  return <span className="text-gray-300 text-xs">○○○</span>
}

function evidenceDot(evidenceStatus?: string) {
  if (evidenceStatus === 'complete') return <span className="text-emerald-600 text-xs font-semibold">complete</span>
  if (evidenceStatus === 'partial') return <span className="text-amber-500 text-xs">partial</span>
  return <span className="text-red-400 text-xs">none</span>
}

export function PortfolioWidgets({ products, opsProducts }: PortfolioWidgetsProps) {
  const [opsPage, setOpsPage] = useState(1)
  const opsPageSize = 3
  const opsPageCount = Math.max(1, Math.ceil(opsProducts.length / opsPageSize))
  const pagedOpsProducts = useMemo(() => {
    const start = (opsPage - 1) * opsPageSize
    return opsProducts.slice(start, start + opsPageSize)
  }, [opsPage, opsProducts])

  const columns: Array<DataTableColumn<PortfolioWidgetProduct>> = [
    {
      key: 'rank',
      header: '#',
      width: 'w-14',
      align: 'right',
      render: row => <span className="text-xs font-mono text-gray-400">{products.findIndex(p => p.name === row.name) + 1}</span>,
      sortValue: row => products.findIndex(p => p.name === row.name) + 1,
      toText: row => String(products.findIndex(p => p.name === row.name) + 1),
    },
    {
      key: 'venture',
      header: 'Venture',
      width: 'min-w-[240px]',
      render: row => (
        <div>
          <span className="font-medium text-gray-900 capitalize">{row.name.replace(/-/g, ' ')}</span>
          <span className="ml-2 text-xs text-gray-400">{row.priorityLabel}</span>
          {row.value_prop ? <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{row.value_prop}</p> : null}
        </div>
      ),
      sortValue: row => row.name,
      toText: row => `${row.name} ${row.priorityLabel}`,
    },
    {
      key: 'capitalScore',
      header: 'Capital Score',
      align: 'right',
      render: row => <span className="text-sm font-semibold text-gray-900">{row.capitalPriorityScore ?? 0}</span>,
      sortValue: row => row.capitalPriorityScore ?? 0,
      toText: row => String(row.capitalPriorityScore ?? 0),
    },
    {
      key: 'capitalAction',
      header: 'Capital Action',
      width: 'min-w-[220px]',
      render: row => (
        <div>
          <span className={`text-xs px-2 py-1 rounded-full ${row.capitalAction === 'Double down' ? 'bg-emerald-100 text-emerald-700 font-semibold' : row.capitalAction === 'Maintain' ? 'bg-blue-100 text-blue-700 font-semibold' : row.capitalAction === 'Cut review' ? 'bg-red-100 text-red-700 font-semibold' : 'bg-gray-100 text-gray-600'}`}>
            {row.capitalAction}
          </span>
          {row.capitalRationale ? <p className="text-xs text-gray-400 mt-1 max-w-xs">{row.capitalRationale}</p> : null}
        </div>
      ),
      sortValue: row => row.capitalAction ?? '',
      toText: row => `${row.capitalAction ?? ''} ${row.capitalRationale ?? ''}`,
    },
    {
      key: 'status',
      header: 'Status',
      render: row => <span className="text-xs font-mono text-gray-500 capitalize">{row.status}</span>,
      sortValue: row => row.status,
      toText: row => row.status,
    },
    {
      key: 'directive',
      header: 'Directive',
      render: row => <span className={`text-xs px-2 py-1 rounded-full ${directiveStyle(row.directive)}`}>{row.directive}</span>,
      sortValue: row => row.directive,
      toText: row => row.directive,
    },
    {
      key: 'code',
      header: 'Code',
      align: 'center',
      render: row => codeBar(row.code_presence),
      toText: row => row.code_presence ?? '',
    },
    {
      key: 'evidence',
      header: 'Evidence',
      render: row => evidenceDot(row.evidence_status),
      toText: row => row.evidence_status ?? '',
    },
    {
      key: 'gaGates',
      header: 'GA Gates',
      align: 'right',
      render: row => <span className="text-xs font-mono text-gray-400">{row.ga_gate_count ?? '—'}</span>,
      sortValue: row => row.ga_gate_count ?? 0,
      toText: row => String(row.ga_gate_count ?? ''),
    },
    {
      key: 'open',
      header: '',
      align: 'center',
      render: row =>
        row.docs_entrypoint ? (
          <Link href="/docs" className="text-blue-400 hover:text-blue-600 inline-flex">
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        ) : null,
      toText: () => '',
    },
  ]

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900">All Ventures</h2>
        <p className="text-xs text-gray-400 mt-0.5 mb-4">Unified venture view with shared pagination and search.</p>
        <DataTable
          rows={products}
          columns={columns}
          rowId={row => row.id ?? row.name}
          searchable
          searchPlaceholder="Search ventures, directives, capital actions…"
          storageKey="portfolio-ventures"
          exportFilename="portfolio-ventures"
          density="compact"
          caption="Portfolio ventures"
          pagination={{ pageSize: 8 }}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="mb-4">
          <h2 className="font-semibold text-gray-900 text-sm">Ops Product Allocation — 7-Dimension Scoring</h2>
          <p className="text-xs text-gray-500 mt-0.5">Revenue potential · Closeability · Support burden (↓) · Founder energy (↓) · Strategic fit · Market pull · Build maturity</p>
        </div>
        <div className="space-y-3">
          {pagedOpsProducts.map(product => {
            const recColor: Record<ProductScoreCategory, string> = {
              double_down: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
              maintain: 'bg-blue-100 text-blue-700 border border-blue-200',
              incubate: 'bg-amber-100 text-amber-700 border border-amber-200',
              pause: 'bg-gray-100 text-gray-600 border border-gray-200',
            }
            const dimensions: { key: keyof PortfolioOpsProduct; label: string; invert?: boolean }[] = [
              { key: 'revenueScore', label: 'Revenue' },
              { key: 'closeabilityScore', label: 'Closeable' },
              { key: 'supportBurden', label: 'Support', invert: true },
              { key: 'founderEnergy', label: 'Energy', invert: true },
              { key: 'strategicFit', label: 'Strategic' },
              { key: 'marketPull', label: 'Market' },
              { key: 'buildMaturity', label: 'Build' },
            ]
            return (
              <div key={product.key} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{product.label}</p>
                    {product.recommendationNote ? <p className="text-xs text-gray-500 mt-0.5">{product.recommendationNote}</p> : null}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${recColor[product.recommendation]}`}>
                    {PRODUCT_SCORE_LABELS[product.recommendation]}
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {dimensions.map(dim => {
                    const rawVal = product[dim.key] as number
                    const displayVal = dim.invert ? 100 - rawVal : rawVal
                    const barColor = displayVal >= 70 ? 'bg-emerald-500' : displayVal >= 40 ? 'bg-amber-500' : 'bg-red-500'
                    return (
                      <div key={dim.key} className="flex flex-col items-center gap-1">
                        <div className="h-16 w-full bg-gray-200 rounded flex flex-col justify-end overflow-hidden">
                          <div className={`w-full rounded-sm ${barColor} transition-all`} style={{ height: `${displayVal}%` }} />
                        </div>
                        <p className="text-[10px] text-gray-500 text-center leading-tight">{dim.label}</p>
                        <p className={`text-[10px] font-medium ${barColor.replace('bg-', 'text-')}`}>{rawVal}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        <PaginationControls page={opsPage} pageCount={opsPageCount} onPageChange={setOpsPage} />
      </div>
    </>
  )
}
