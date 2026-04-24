'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

type WaitlistRole = 'artist' | 'label' | 'promoter' | 'fan' | 'other'

const interestOptions = ['streaming', 'events', 'artist_tools', 'label_ops', 'diaspora_discovery'] as const

export default function WaitlistSignup() {
  const t = useTranslations('marketing.waitlist')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [form, setForm] = useState({
    firstName: '',
    email: '',
    role: 'artist' as WaitlistRole,
    city: '',
    interests: ['streaming'] as string[],
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    })
    setStatus(res.ok ? 'done' : 'error')
  }

  function toggleInterest(value: string) {
    setForm((prev) => {
      if (prev.interests.includes(value)) {
        const next = prev.interests.filter((entry) => entry !== value)
        return { ...prev, interests: next.length ? next : ['streaming'] }
      }
      return { ...prev, interests: [...prev.interests, value].slice(0, 5) }
    })
  }

  return (
    <section className="py-24 bg-white border-y border-gray-100" id="waitlist">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          <div>
            <p className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
              {t('badge')}
            </p>
            <h2 className="text-3xl md:text-5xl font-bold text-navy mb-4">
              {t('title')} <span className="text-electric">{t('titleAccent')}</span>
            </h2>
            <p className="text-lg text-gray-600 mb-6">{t('description')}</p>
            <ul className="space-y-2 text-sm text-gray-700">
              {(t.raw('benefits') as string[]).map((benefit) => (
                <li key={benefit} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-electric" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          <form onSubmit={submit} className="rounded-2xl border border-gray-200 p-6 space-y-4 bg-gray-50">
            <input
              required
              placeholder={t('form.firstName')}
              className="w-full rounded-lg border px-3 py-2"
              value={form.firstName}
              onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
            />
            <input
              required
              type="email"
              placeholder={t('form.email')}
              className="w-full rounded-lg border px-3 py-2"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
            <div className="grid sm:grid-cols-2 gap-3">
              <select
                className="rounded-lg border px-3 py-2"
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as WaitlistRole }))}
              >
                <option value="artist">{t('roles.artist')}</option>
                <option value="label">{t('roles.label')}</option>
                <option value="promoter">{t('roles.promoter')}</option>
                <option value="fan">{t('roles.fan')}</option>
                <option value="other">{t('roles.other')}</option>
              </select>
              <input
                placeholder={t('form.city')}
                className="rounded-lg border px-3 py-2"
                value={form.city}
                onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('form.interests')}</p>
              <div className="flex flex-wrap gap-2">
                {interestOptions.map((key) => {
                  const selected = form.interests.includes(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleInterest(key)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                        selected ? 'bg-electric text-white border-electric' : 'bg-white text-gray-700 border-gray-300'
                      }`}
                    >
                      {t(`interestOptions.${key}`)}
                    </button>
                  )
                })}
              </div>
            </div>

            <button disabled={status === 'sending'} className="w-full rounded-xl bg-electric text-white font-bold py-3 disabled:opacity-60">
              {status === 'sending' ? t('form.submitting') : t('form.submit')}
            </button>
            {status === 'done' && <p className="text-sm text-green-700">{t('form.success')}</p>}
            {status === 'error' && <p className="text-sm text-red-700">{t('form.error')}</p>}
          </form>
        </div>
      </div>
    </section>
  )
}
