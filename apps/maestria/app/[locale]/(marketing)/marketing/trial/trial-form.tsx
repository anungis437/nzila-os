'use client'

import { useState } from 'react'
import styles from '../marketing.module.css'

type WizardStep = 1 | 2 | 3

type TrialFormProps = {
  locale: string
}

export function TrialForm({ locale }: TrialFormProps) {
  const isFr = locale === 'fr-CA'
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [step, setStep] = useState<WizardStep>(1)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    teamSize: '1-5',
    industry: '',
    website: '',
    brandName: '',
    currency: 'CAD',
    taxRegion: 'CA-QC',
  })

  const canContinue =
    (step === 1 && form.firstName && form.email && form.company) ||
    (step === 2 && form.brandName) ||
    (step === 3 && form.taxRegion)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (step < 3) {
      setStep((prev) => Math.min(3, prev + 1) as WizardStep)
      return
    }

    setStatus('sending')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)

    try {
      const response = await fetch('/api/trial', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, source: 'maestria-marketing-trial', locale }),
        signal: controller.signal,
      })
      setStatus(response.ok ? 'done' : 'error')
    } catch {
      setStatus('error')
    } finally {
      clearTimeout(timeout)
    }
  }

  return (
    <form className={styles.formCard} onSubmit={submit}>
      <p className={styles.notice}>{isFr ? `Etape ${step} sur 3` : `Step ${step} of 3`}</p>

      {step === 1 ? (
        <>
          <div className={styles.formGrid}>
            <input required placeholder={isFr ? 'Prenom' : 'First name'} className={styles.input} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
            <input placeholder={isFr ? 'Nom' : 'Last name'} className={styles.input} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
          </div>
          <input required type="email" placeholder={isFr ? 'Courriel pro' : 'Work email'} className={styles.input} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <input required placeholder={isFr ? 'Entreprise' : 'Company'} className={styles.input} value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} />
          <select aria-label={isFr ? 'Taille equipe' : 'Team size'} className={styles.select} value={form.teamSize} onChange={(event) => setForm({ ...form, teamSize: event.target.value })}>
            <option>1-5</option>
            <option>6-20</option>
            <option>21-100</option>
            <option>100+</option>
          </select>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <input required placeholder={isFr ? 'Nom de marque client' : 'Customer-facing brand name'} className={styles.input} value={form.brandName} onChange={(event) => setForm({ ...form, brandName: event.target.value })} />
          <div className={styles.formGrid}>
            <input placeholder={isFr ? 'Industrie' : 'Industry'} className={styles.input} value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })} />
            <input placeholder={isFr ? 'Site web' : 'Website'} className={styles.input} value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} />
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <div className={styles.formGrid}>
          <select aria-label={isFr ? 'Devise' : 'Currency'} className={styles.select} value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}>
            <option value="CAD">CAD</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
          <input required placeholder={isFr ? 'Region taxe (ex: CA-QC)' : 'Tax region (e.g. CA-QC)'} className={styles.input} value={form.taxRegion} onChange={(event) => setForm({ ...form, taxRegion: event.target.value })} />
        </div>
      ) : null}

      <div className={styles.row}>
        {step > 1 ? (
          <button type="button" className={styles.secondary} onClick={() => setStep((prev) => Math.max(1, prev - 1) as WizardStep)}>
            {isFr ? 'Retour' : 'Back'}
          </button>
        ) : null}
        <button disabled={!canContinue || status === 'sending'} className={styles.primary}>
          {step < 3
            ? (isFr ? 'Continuer' : 'Continue')
            : status === 'sending'
              ? (isFr ? 'Creation...' : 'Creating...')
              : (isFr ? 'Creer essai' : 'Create trial')}
        </button>
      </div>

      {status === 'done' ? <p className={`${styles.notice} ${styles.noticeOk}`}>{isFr ? 'Essai cree. Verifiez votre courriel.' : 'Trial created. Check your email for next steps.'}</p> : null}
      {status === 'error' ? <p className={`${styles.notice} ${styles.noticeErr}`}>{isFr ? 'Impossible de creer l essai.' : 'Could not create trial.'}</p> : null}
    </form>
  )
}
