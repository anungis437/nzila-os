'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card } from '@nzila/ui'

type Question = {
  id: string
  text: string
  helperText?: string
  type: 'single_choice' | 'multiple_choice' | 'rating_1_5' | 'free_text' | 'yes_no_unsure'
  required: boolean
  options?: string[]
  maxSelections?: number
  warningText?: string
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: Question
  value: unknown
  onChange: (value: unknown) => void
}) {
  if (question.type === 'rating_1_5') {
    return (
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="text-sm flex items-center gap-1">
            <input
              type="radio"
              name={question.id}
              checked={value === n}
              onChange={() => onChange(n)}
            />
            {n}
          </label>
        ))}
      </div>
    )
  }

  if (question.type === 'single_choice') {
    return (
      <div className="space-y-1">
        {(question.options ?? []).map((opt) => (
          <label key={opt} className="block text-sm">
            <input
              className="mr-2"
              type="radio"
              name={question.id}
              checked={value === opt}
              onChange={() => onChange(opt)}
            />
            {opt}
          </label>
        ))}
      </div>
    )
  }

  if (question.type === 'multiple_choice') {
    const selected = Array.isArray(value) ? (value as string[]) : []
    return (
      <div className="space-y-1">
        {(question.options ?? []).map((opt) => (
          <label key={opt} className="block text-sm">
            <input
              className="mr-2"
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={(e) => {
                const next = new Set(selected)
                if (e.target.checked) next.add(opt)
                else next.delete(opt)
                const nextList = [...next]
                if (question.maxSelections && nextList.length > question.maxSelections) return
                onChange(nextList)
              }}
            />
            {opt}
          </label>
        ))}
      </div>
    )
  }

  return (
    <textarea
      className="w-full rounded border p-2 text-sm"
      rows={3}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function RespondForm({
  token,
  title,
  introText,
  questions,
}: {
  token: string
  title: string
  introText: string
  questions: Question[]
}) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(false)

  const progress = useMemo(() => {
    const required = questions.filter((q) => q.required)
    const done = required.filter((q) => {
      const v = answers[q.id]
      if (Array.isArray(v)) return v.length > 0
      return v !== undefined && v !== null && v !== ''
    }).length
    return required.length === 0 ? 0 : Math.round((done / required.length) * 100)
  }, [answers, questions])

  async function submit() {
    setLoading(true)
    const response = await fetch('/api/healthcare/surveys/responses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, answers }),
    })

    setLoading(false)
    if (!response.ok) return
    router.push(`/healthcare/respond/${token}/submitted`)
  }

  return (
    <Card>
      <Card.Body className="space-y-4">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm whitespace-pre-line text-gray-700">{introText}</p>
        <p className="text-xs text-amber-700 bg-amber-50 rounded p-2">
          This discovery survey is for workflow discovery only. Do not include patient information, employee names,
          manager names, grievance details, or identifying details.
        </p>

        <p className="text-xs text-gray-500">Progress: {progress}%</p>

        {questions.map((q) => (
          <div key={q.id} className="space-y-1 rounded border p-3">
            <p className="text-sm font-medium">{q.text}{q.required ? ' *' : ''}</p>
            {q.helperText && <p className="text-xs text-gray-500">{q.helperText}</p>}
            {q.warningText && <p className="text-xs text-amber-700">{q.warningText}</p>}
            <QuestionField
              question={q}
              value={answers[q.id]}
              onChange={(value) => setAnswers((prev) => ({ ...prev, [q.id]: value }))}
            />
          </div>
        ))}

        <div className="flex justify-end">
          <Button loading={loading} onClick={submit}>Submit anonymous response</Button>
        </div>
      </Card.Body>
    </Card>
  )
}
