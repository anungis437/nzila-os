'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, Button } from '@nzila/ui'
import { UNIT_92_CAMPAIGN_KEY, UNIT_92_CAMPAIGN_SEED } from '@nzila/healthcare-surveys'

const PRIVACY_CHECKS = [
  'Does not ask for names',
  'Does not ask for patient data',
  'Does not ask for manager names',
  'Does not ask for formal grievance details',
  'Includes no-identifying-details warning',
  'Anonymous by default',
  'Uses discovery language, not complaint/audit language',
]

export function NewSurveyForm() {
  const router = useRouter()
  const params = useSearchParams()
  const campaignKey = params.get('campaignKey')
  const isUnit92Preset = campaignKey === UNIT_92_CAMPAIGN_KEY

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [privacyChecks, setPrivacyChecks] = useState<boolean[]>(PRIVACY_CHECKS.map(() => false))

  const [form, setForm] = useState({
    title: isUnit92Preset ? UNIT_92_CAMPAIGN_SEED.title : 'Unit Scheduling Experience Survey',
    unitName: isUnit92Preset ? UNIT_92_CAMPAIGN_SEED.unitName : '',
    siteName: isUnit92Preset ? 'Foothills Medical Centre / FMC' : '',
    localName: isUnit92Preset ? UNIT_92_CAMPAIGN_SEED.localName : '',
    championLabel: isUnit92Preset ? UNIT_92_CAMPAIGN_SEED.championLabel : '',
    purposeStatement: isUnit92Preset
      ? UNIT_92_CAMPAIGN_SEED.purposeStatement
      : 'Understand scheduling clarity, communication friction, and documentation gaps on one unit.',
    audience: isUnit92Preset ? UNIT_92_CAMPAIGN_SEED.audience : '',
    closeDate: '',
    campaignName: isUnit92Preset ? UNIT_92_CAMPAIGN_SEED.internalCampaignName : '',
    internalNotes: isUnit92Preset ? UNIT_92_CAMPAIGN_SEED.internalNotes : '',
    distributionMessage: isUnit92Preset ? UNIT_92_CAMPAIGN_SEED.distributionMessage : '',
  })

  const allChecksComplete = useMemo(() => privacyChecks.every(Boolean), [privacyChecks])

  async function launchSurvey() {
    if (!allChecksComplete) return
    setLoading(true)
    const response = await fetch('/api/healthcare/surveys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (!response.ok) {
      setLoading(false)
      return
    }

    const payload = (await response.json()) as { surveyId: string }
    setLoading(false)
    router.push(`/healthcare/discovery/surveys/${payload.surveyId}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 text-xs text-gray-500">
        <span className={step === 1 ? 'font-semibold text-black' : ''}>1 Setup</span>
        <span>•</span>
        <span className={step === 2 ? 'font-semibold text-black' : ''}>2 Template</span>
        <span>•</span>
        <span className={step === 3 ? 'font-semibold text-black' : ''}>3 Privacy Check</span>
        <span>•</span>
        <span className={step === 4 ? 'font-semibold text-black' : ''}>4 Launch</span>
      </div>

      {step === 1 && (
        <Card>
          <Card.Body className="space-y-3">
            <input className="w-full rounded border p-2" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Survey title" />
            <input className="w-full rounded border p-2" value={form.unitName} onChange={(e) => setForm({ ...form, unitName: e.target.value })} placeholder="Unit" />
            <input className="w-full rounded border p-2" value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} placeholder="Site/hospital" />
            <input className="w-full rounded border p-2" value={form.localName} onChange={(e) => setForm({ ...form, localName: e.target.value })} placeholder="Local" />
            <input className="w-full rounded border p-2" value={form.championLabel} onChange={(e) => setForm({ ...form, championLabel: e.target.value })} placeholder="Champion label (internal only)" />
            <input className="w-full rounded border p-2" value={form.closeDate} onChange={(e) => setForm({ ...form, closeDate: e.target.value })} type="date" placeholder="Close date" />
            <textarea className="w-full rounded border p-2" value={form.purposeStatement} onChange={(e) => setForm({ ...form, purposeStatement: e.target.value })} rows={4} />
            <div className="flex justify-end"><Button onClick={() => setStep(2)}>Next</Button></div>
          </Card.Body>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <Card.Body className="space-y-3">
            <h2 className="font-semibold">Template: Unit Scheduling Experience Survey</h2>
            <p className="text-sm text-gray-600">Includes 15 core questions plus optional free-text prompts and Unit 92 context prompt.</p>
            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)}>Next</Button>
            </div>
          </Card.Body>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <Card.Body className="space-y-3">
            <h2 className="font-semibold">Privacy checklist</h2>
            {PRIVACY_CHECKS.map((item, idx) => (
              <label key={item} className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={privacyChecks[idx]}
                  onChange={(e) => {
                    const next = [...privacyChecks]
                    next[idx] = e.target.checked
                    setPrivacyChecks(next)
                  }}
                />
                <span>{item}</span>
              </label>
            ))}
            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={() => setStep(4)} disabled={!allChecksComplete}>Next</Button>
            </div>
          </Card.Body>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <Card.Body className="space-y-3">
            <p className="text-sm text-gray-700">Ready to launch a draft survey with anonymous responses enabled and free-text warning guardrails.</p>
            <p className="text-xs text-gray-500">Respondent copy does not expose champion label unless explicitly enabled later.</p>
            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep(3)}>Back</Button>
              <Button loading={loading} onClick={launchSurvey}>Create Survey</Button>
            </div>
          </Card.Body>
        </Card>
      )}
    </div>
  )
}
