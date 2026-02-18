'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Meeting {
  id: string
  kind: string
  meetingDate: string
  location: string | null
  status: string
}

interface Resolution {
  id: string
  kind: string
  title: string
  status: string
  effectiveDate: string | null
  createdAt: string
}

export default function MinuteBookPage() {
  const { entityId } = useParams<{ entityId: string }>()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [resolutions, setResolutions] = useState<Resolution[]>([])
  const [tab, setTab] = useState<'meetings' | 'resolutions'>('meetings')

  useEffect(() => {
    fetch(`/api/entities/${entityId}/meetings`)
      .then((r) => r.json())
      .then(setMeetings)
      .catch(() => {})
    fetch(`/api/entities/${entityId}/resolutions`)
      .then((r) => r.json())
      .then(setResolutions)
      .catch(() => {})
  }, [entityId])

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-1">
          <Link href="/business/entities" className="hover:underline">Entities</Link>
          {' / '}
          <Link href={`/business/entities/${entityId}`} className="hover:underline">Entity</Link>
          {' / Minute Book'}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Minute Book</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 mb-6">
        {(['meetings', 'resolutions'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm font-medium capitalize ${
              tab === t ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'
            }`}
          >
            {t} ({t === 'meetings' ? meetings.length : resolutions.length})
          </button>
        ))}
      </div>

      {tab === 'meetings' && (
        <div className="space-y-3">
          {meetings.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">No meetings recorded yet.</p>
          ) : (
            meetings.map((m) => (
              <div key={m.id} className="p-4 bg-white border border-gray-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 mr-2">
                      {m.kind}
                    </span>
                    <span className="text-sm text-gray-900 font-medium">
                      {new Date(m.meetingDate).toLocaleDateString()}
                    </span>
                    {m.location && <span className="text-xs text-gray-500 ml-2">@ {m.location}</span>}
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    m.status === 'held' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {m.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'resolutions' && (
        <div className="space-y-3">
          {resolutions.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">No resolutions yet.</p>
          ) : (
            resolutions.map((r) => (
              <div key={r.id} className="p-4 bg-white border border-gray-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 mr-2">
                      {r.kind}
                    </span>
                    <span className="text-sm text-gray-900 font-medium">{r.title}</span>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    r.status === 'approved' || r.status === 'signed' ? 'bg-green-100 text-green-700' :
                    r.status === 'draft' ? 'bg-gray-100 text-gray-500' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {r.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
