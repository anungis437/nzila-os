'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@nzila/ui'

export function FreeTextReview({
  responseId,
  initialStatus,
  initialNote,
}: {
  responseId: string
  initialStatus: 'unreviewed' | 'reviewed' | 'flagged_for_redaction'
  initialNote: string | null
}) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [note, setNote] = useState(initialNote ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await fetch(`/api/healthcare/responses/${responseId}/review`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reviewStatus: status, redactionNote: note }),
    })
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="space-y-2 rounded border p-3">
      <div className="flex gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="rounded border p-1 text-sm">
          <option value="unreviewed">unreviewed</option>
          <option value="reviewed">reviewed</option>
          <option value="flagged_for_redaction">flagged_for_redaction</option>
        </select>
        <Button size="sm" loading={saving} onClick={save}>Save</Button>
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded border p-2 text-xs" rows={2} placeholder="Reviewer note" />
    </div>
  )
}
