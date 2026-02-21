'use client'

import { use } from 'react'
import Link from 'next/link'
import {
  CurrencyDollarIcon,
  ArrowRightIcon,
  DocumentTextIcon,
  ReceiptPercentIcon,
} from '@heroicons/react/24/outline'
import { Card } from '@nzila/ui'

const tiles = [
  {
    title: 'Filings',
    description: 'Annual returns, director changes, and other statutory filings.',
    icon: DocumentTextIcon,
    href: (eid: string) => `/business/entities/${eid}/filings`,
    color: 'text-blue-600',
  },
  {
    title: 'Expenses',
    description: 'Submit and track entity-level expense claims.',
    icon: ReceiptPercentIcon,
    href: (_: string) => '/business/finance/expense',
    color: 'text-green-600',
  },
]

export default function EntityFinancePage({
  params,
}: {
  params: Promise<{ entityId: string }>
}) {
  const { entityId } = use(params)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-1">
          <Link href="/business" className="hover:underline">Business OS</Link>
          {' / '}
          <Link href={`/business/entities/${entityId}`} className="hover:underline">Entity</Link>
          {' / Finance'}
        </p>
        <div className="flex items-center gap-3">
          <CurrencyDollarIcon className="h-7 w-7 text-green-600" />
          <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Financial operations for this entity.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {tiles.map((tile) => (
          <Link key={tile.title} href={tile.href(entityId)} className="block">
            <Card variant="bordered" className="hover:border-green-300 hover:shadow-sm transition-all h-full">
              <Card.Body className="flex items-start gap-4">
                <tile.icon className={`h-6 w-6 ${tile.color} mt-0.5 shrink-0`} />
                <div>
                  <p className="font-medium text-gray-900">{tile.title}</p>
                  <p className="text-sm text-gray-500 mt-1">{tile.description}</p>
                </div>
                <ArrowRightIcon className="h-4 w-4 text-gray-400 ml-auto mt-1" />
              </Card.Body>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
