'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function IngestButton({
  orgId,
  appKey = 'console',
  profileKey = 'knowledge',
}: {
  orgId: string
  appKey?: string
  profileKey?: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [dataClass, setDataClass] = useState<string>('internal')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleIngest() {
    setError(null)
    setSuccess(null)
    if (!title.trim() || !text.trim()) {
      setError('Title and text are required.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/ai/actions/knowledge/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
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
        setError(typeof data?.error === 'string' ? data.error : 'Ingestion request failed.')
      } else {
        const actionId = typeof data?.actionId === 'string' ? data.actionId : 'n/a'
        const status = typeof data?.status === 'string' ? data.status : 'submitted'
        setSuccess(`Knowledge ingestion submitted. Action ${actionId} is ${status}.`)
        setTitle('')
        setText('')
        setShowForm(false)
        router.refresh()
      }
    } catch {
      setError('Could not submit ingestion. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
        >
          Ingest Source
        </button>
      ) : (
        <div className="w-full max-w-2xl rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-medium">Ingest Knowledge Source</h3>

          <div className="mt-3 grid gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded border px-3 py-1.5 text-sm"
                placeholder="e.g., Company Policy v2"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium">Text Content</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full rounded border px-3 py-1.5 text-sm"
                rows={7}
                placeholder="Paste your text content here..."
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium">Data Class</label>
              <select
                value={dataClass}
                onChange={(e) => setDataClass(e.target.value)}
                className="rounded border px-3 py-1.5 text-sm"
              >
                <option value="public">Public</option>
                <option value="internal">Internal</option>
                <option value="sensitive">Sensitive</option>
                <option value="regulated">Regulated</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={handleIngest}
              disabled={loading}
              className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Ingest Action'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
