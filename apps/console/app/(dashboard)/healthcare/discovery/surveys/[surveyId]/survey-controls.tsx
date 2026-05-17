'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@nzila/ui'

export function SurveyControls({ surveyId, currentStatus }: { surveyId: string; currentStatus: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function updateStatus(status: 'active' | 'closed') {
    setLoading(true)
    await fetch(`/api/healthcare/surveys/${surveyId}/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="flex gap-2">
      {currentStatus !== 'active' && (
        <Button loading={loading} onClick={() => updateStatus('active')}>Launch Survey</Button>
      )}
      {currentStatus !== 'closed' && (
        <Button variant="secondary" loading={loading} onClick={() => updateStatus('closed')}>Close Survey</Button>
      )}
    </div>
  )
}
