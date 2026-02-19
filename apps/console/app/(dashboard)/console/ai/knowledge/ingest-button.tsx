'use client'

import { useState } from 'react'

export function IngestButton({
  entityId,
  appKey = 'console',
  profileKey = 'knowledge',
}: {
  entityId: string
  appKey?: string
  profileKey?: string
}) {
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [dataClass, setDataClass] = useState<string>('internal')

  async function handleIngest() {
    if (!title.trim() || !text.trim()) {
      alert('Title and text are required')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/ai/actions/knowledge/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId,
          appKey,
          profileKey,
          source: {
            sourceType: 'manual_text',
            title: title.trim(),
            text: text.trim(),
          },
          ingestion: {
            chunkSize: 900,
            chunkOverlap: 150,
            embeddingBatchSize: 64,
            maxChunks: 5000,
          },
          retention: {
            dataClass,
            retentionDays: 90,
          },
          citations: {
            requireCitations: true,
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        alert(`Error: ${data.error ?? JSON.stringify(data)}`)
      } else {
        alert(`Knowledge ingested! Action: ${data.actionId}, status: ${data.status}`)
        window.location.reload()
      }
    } finally {
      setLoading(false)
    }
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Ingest Source
      </button>
    )
  }

  return (
    <div className="w-full max-w-lg rounded-lg border p-4 space-y-3">
      <h3 className="text-sm font-medium">Ingest Knowledge Source</h3>
      <div>
        <label className="block text-xs font-medium mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border rounded px-3 py-1.5 text-sm"
          placeholder="e.g., Company Policy v2"
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Text Content</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full border rounded px-3 py-1.5 text-sm"
          rows={6}
          placeholder="Paste your text content here..."
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Data Class</label>
        <select
          value={dataClass}
          onChange={(e) => setDataClass(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        >
          <option value="public">Public</option>
          <option value="internal">Internal</option>
          <option value="sensitive">Sensitive</option>
          <option value="regulated">Regulated</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleIngest}
          disabled={loading}
          className="px-4 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? 'Ingesting...' : 'Ingest'}
        </button>
        <button
          onClick={() => setShowForm(false)}
          className="px-4 py-1.5 text-sm border rounded hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
