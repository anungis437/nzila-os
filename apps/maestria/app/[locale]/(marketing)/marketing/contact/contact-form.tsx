'use client'

import { useState } from 'react'
import styles from '../marketing.module.css'

type Status = 'idle' | 'sending' | 'success' | 'error'

type ContactFormProps = {
  locale: string
}

export function ContactForm({ locale }: ContactFormProps) {
  const isFr = locale === 'fr-CA'
  const [status, setStatus] = useState<Status>('idle')
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    role: '',
    message: '',
  })

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setStatus('sending')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, source: 'maestria-marketing-contact', locale }),
        signal: controller.signal,
      })
      setStatus(response.ok ? 'success' : 'error')
    } catch {
      setStatus('error')
    } finally {
      clearTimeout(timeout)
    }
  }

  return (
    <form onSubmit={onSubmit} className={styles.formCard}>
      <div className={styles.formGrid}>
        <input required placeholder={isFr ? 'Prenom' : 'First name'} className={styles.input} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
        <input placeholder={isFr ? 'Nom' : 'Last name'} className={styles.input} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
      </div>
      <input required type="email" placeholder={isFr ? 'Courriel pro' : 'Work email'} className={styles.input} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
      <input required placeholder={isFr ? 'Entreprise' : 'Company'} className={styles.input} value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} />
      <input placeholder={isFr ? 'Role' : 'Role'} className={styles.input} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} />
      <textarea required placeholder={isFr ? 'Quel enjeu voulez-vous regler maintenant ?' : 'What bottleneck should we solve first?'} className={styles.textarea} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} />
      <button disabled={status === 'sending'} className={styles.primary}>
        {status === 'sending' ? (isFr ? 'Envoi...' : 'Sending...') : (isFr ? 'Planifier un appel' : 'Book discovery call')}
      </button>
      {status === 'success' ? <p className={`${styles.notice} ${styles.noticeOk}`}>{isFr ? 'Merci. Votre demande est en file de priorite.' : 'Thanks. Your request is in our pipeline.'}</p> : null}
      {status === 'error' ? <p className={`${styles.notice} ${styles.noticeErr}`}>{isFr ? 'Envoi impossible. Reessayez.' : 'Submission failed. Please retry.'}</p> : null}
    </form>
  )
}
