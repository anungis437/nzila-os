'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  DocumentTextIcon,
  ScaleIcon,
  ShieldCheckIcon,
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline'

interface Entity {
  id: string
  legalName: string
  jurisdiction: string
  incorporationNumber: string | null
  fiscalYearEnd: string | null
  status: string
}

const moduleCards = [
  {
    title: 'Minute Book',
    description: 'Meetings, resolutions, approvals & votes',
    href: 'minutebook',
    icon: DocumentTextIcon,
    color: 'blue',
  },
  {
    title: 'Equity / Cap Table',
    description: 'Share classes, shareholders, ledger & certificates',
    href: 'equity',
    icon: ScaleIcon,
    color: 'green',
  },
  {
    title: 'Governance Actions',
    description: 'Policy-evaluated corporate actions',
    href: 'governance',
    icon: ShieldCheckIcon,
    color: 'purple',
  },
  {
    title: 'Audit Trail',
    description: 'Append-only tamper-evident log',
    href: 'audit',
    icon: ClipboardDocumentListIcon,
    color: 'amber',
  },
  {
    title: 'Year-End',
    description: 'Compliance tasks & filing checklist',
    href: 'year-end',
    icon: CalendarDaysIcon,
    color: 'rose',
  },
]

const colorMap: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600 border-blue-200 hover:border-blue-400',
  green: 'bg-green-50 text-green-600 border-green-200 hover:border-green-400',
  purple: 'bg-purple-50 text-purple-600 border-purple-200 hover:border-purple-400',
  amber: 'bg-amber-50 text-amber-600 border-amber-200 hover:border-amber-400',
  rose: 'bg-rose-50 text-rose-600 border-rose-200 hover:border-rose-400',
}

export default function EntityDashboard() {
  const { entityId } = useParams<{ entityId: string }>()
  const [entity, setEntity] = useState<Entity | null>(null)

  useEffect(() => {
    fetch(`/api/entities/${entityId}`)
      .then((r) => r.json())
      .then(setEntity)
      .catch(() => {})
  }, [entityId])

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {entity ? (
        <>
          <div className="mb-8">
            <p className="text-sm text-gray-500 mb-1">
              <Link href="/business/entities" className="hover:underline">Entities</Link> / {entity.legalName}
            </p>
            <h1 className="text-2xl font-bold text-gray-900">{entity.legalName}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {entity.jurisdiction} · {entity.incorporationNumber ?? 'No reg. #'} · FYE {entity.fiscalYearEnd ?? 'N/A'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {moduleCards.map((card) => (
              <Link
                key={card.href}
                href={`/business/entities/${entityId}/${card.href}`}
                className={`p-6 border rounded-xl transition ${colorMap[card.color]}`}
              >
                <card.icon className="h-8 w-8 mb-3" />
                <h3 className="font-semibold text-gray-900">{card.title}</h3>
                <p className="text-xs text-gray-500 mt-1">{card.description}</p>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <p className="text-gray-400 text-sm">Loading entity...</p>
      )}
    </div>
  )
}
