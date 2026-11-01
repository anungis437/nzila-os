'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { REVIEW_INTAKE_TYPES, type ReviewIntakeType } from '@/lib/authority/review-intake-types'

type OwnReview = {
  id: string
  reviewType: string
  status: 'open' | 'closed'
  openedAt: string
  participation: 'opened' | 'complainant'
}

type OversightReview = {
  id: string
  reviewType: string
  status: 'open' | 'closed'
  openedAt: string
  classification: 'standard' | 'privileged'
  complainantUserId: string | null
}

type IntakeList = {
  own: OwnReview[]
  oversight: OversightReview[]
  notificationDelivered: false
  notificationPolicy: 'not_adopted'
}

type LoadState = 'loading' | 'ready' | 'error' | 'denied'

function reviewLabel(t: ReturnType<typeof useTranslations<'reviewIntake'>>, reviewType: string): string {
  return REVIEW_INTAKE_TYPES.includes(reviewType as ReviewIntakeType) ? t(`types.${reviewType as ReviewIntakeType}`) : reviewType
}

export function ReviewIntake({ audience }: { audience: 'member' | 'oversight' }) {
  const t = useTranslations('reviewIntake')
  const locale = useLocale()
  const [state, setState] = useState<LoadState>('loading')
  const [list, setList] = useState<IntakeList | null>(null)
  const [reviewType, setReviewType] = useState<ReviewIntakeType>('complaint')
  const [adverseText, setAdverseText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formMessage, setFormMessage] = useState<'opened' | 'validation' | 'denied' | 'failed' | null>(null)
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })

  const load = useCallback(async () => {
    setState('loading')
    try {
      const response = await fetch('/api/reviews')
      if (response.status === 403) {
        setList(null)
        setState('denied')
        return
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const body = (await response.json()) as IntakeList
      setList({
        own: body.own ?? [],
        oversight: body.oversight ?? [],
        notificationDelivered: false,
        notificationPolicy: 'not_adopted',
      })
      setState('ready')
    } catch {
      setState('error')
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const adverseUserIds = adverseText.split(/[\s,]+/).map((part) => part.trim()).filter(Boolean)
    if (adverseUserIds.length > 8 || new Set(adverseUserIds).size !== adverseUserIds.length) {
      setFormMessage('validation')
      return
    }
    setSubmitting(true)
    setFormMessage(null)
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reviewType, adverseUserIds }),
      })
      if (response.status === 400) {
        setFormMessage('validation')
        return
      }
      if (response.status === 403) {
        setFormMessage('denied')
        return
      }
      if (!response.ok) {
        setFormMessage('failed')
        return
      }
      const body = await response.json()
      if (body.notificationDelivered !== false || body.notificationPolicy !== 'not_adopted') {
        setFormMessage('failed')
        return
      }
      setAdverseText('')
      setFormMessage('opened')
      await load()
    } catch {
      setFormMessage('failed')
    } finally {
      setSubmitting(false)
    }
  }

  const showOversight = audience === 'oversight' || (list?.oversight.length ?? 0) > 0

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6" data-testid="review-intake">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{audience === 'member' ? t('memberTitle') : t('oversightTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('boundary')}</p>
        <p className="text-sm text-muted-foreground" data-testid="review-notice">{t('noNotice')}</p>
      </div>

      <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-3 rounded-lg border p-4" data-testid="review-form">
        <label className="flex flex-col gap-1 text-sm font-medium" htmlFor="review-type">
          {t('typeLabel')}
          <select
            id="review-type"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={reviewType}
            onChange={(event) => setReviewType(event.target.value as ReviewIntakeType)}
          >
            {REVIEW_INTAKE_TYPES.map((type) => (
              <option key={type} value={type}>{t(`types.${type}`)}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium" htmlFor="review-adverse">
          {t('adverseLabel')}
          <textarea
            id="review-adverse"
            className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={adverseText}
            onChange={(event) => setAdverseText(event.target.value)}
          />
        </label>
        <p className="text-sm text-muted-foreground">{t('adverseHint')}</p>
        <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
          {submitting ? t('submitting') : t('submit')}
        </Button>
        {formMessage === 'opened' && <p role="status" data-testid="review-opened">{t('opened')}<span className="block">{t('noNotice')}</span></p>}
        {formMessage === 'validation' && <p role="alert">{t('validation')}</p>}
        {formMessage === 'denied' && <p role="alert">{t('denied')}</p>}
        {formMessage === 'failed' && <p role="alert">{t('submitError')}</p>}
      </form>

      {state === 'loading' && <Skeleton className="h-24 w-full" role="status" aria-busy="true" />}
      {state === 'error' && (
        <div role="alert" className="text-sm text-destructive">
          {t('loadError')}
          <Button variant="link" size="sm" onClick={() => void load()}>{t('retry')}</Button>
        </div>
      )}
      {state === 'denied' && <p role="alert" data-testid="review-denied">{t('denied')}</p>}
      {state === 'ready' && list && (
        <>
          <section aria-labelledby="own-reviews" className="rounded-lg border p-4">
            <h2 id="own-reviews" className="mb-3 text-lg font-semibold">{t('ownTitle')}</h2>
            {list.own.length === 0 ? (
              <p data-testid="own-reviews-empty">{t('emptyOwn')}</p>
            ) : (
              <ul className="flex flex-col gap-3" data-testid="own-reviews">
                {list.own.map((review) => (
                  <li key={review.id} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">{reviewLabel(t, review.reviewType)}</p>
                    <p>{t(`status.${review.status}`)}</p>
                    <p>{dateFormat.format(new Date(review.openedAt))}</p>
                    <p className="break-all text-muted-foreground">{review.id}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {showOversight && (
            <section aria-labelledby="oversight-reviews" className="rounded-lg border p-4">
              <h2 id="oversight-reviews" className="mb-3 text-lg font-semibold">{t('oversightListTitle')}</h2>
              <p className="mb-3 text-sm text-muted-foreground">{t('noNotice')}</p>
              {list.oversight.length === 0 ? (
                <p data-testid="oversight-reviews-empty">{t('emptyOversight')}</p>
              ) : (
                <ul className="flex flex-col gap-3" data-testid="oversight-reviews">
                  {list.oversight.map((review) => (
                    <li key={review.id} className="rounded-md border p-3 text-sm">
                      <p className="font-medium">{reviewLabel(t, review.reviewType)}</p>
                      <p>{t(`status.${review.status}`)}</p>
                      <p>{review.complainantUserId ? t('complainant', { id: review.complainantUserId }) : t('complainantAbsent')}</p>
                      <p className="break-all text-muted-foreground">{review.id}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
