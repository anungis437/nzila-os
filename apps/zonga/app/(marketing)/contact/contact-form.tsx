'use client'

import { useState } from 'react'

type Status = 'idle' | 'sending' | 'success' | 'error'

export default function ContactForm() {
  const [status, setStatus] = useState<Status>('idle')
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    organization: '',
    role: '',
    inquiryType: 'artist_support',
    message: '',
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...form, source: 'zonga-contact-page' }),
    })
    setStatus(res.ok ? 'success' : 'error')
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-gray-200 p-6 bg-white shadow-sm space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <input required placeholder="First name" className="rounded-lg border px-3 py-2" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        <input placeholder="Last name" className="rounded-lg border px-3 py-2" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
      </div>
      <input required type="email" placeholder="Email" className="w-full rounded-lg border px-3 py-2" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <input placeholder="Organization / Label" className="w-full rounded-lg border px-3 py-2" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} />
      <select className="w-full rounded-lg border px-3 py-2" value={form.inquiryType} onChange={(e) => setForm({ ...form, inquiryType: e.target.value })}>
        <option value="artist_support">Artist support</option>
        <option value="label_partnership">Label partnership</option>
        <option value="event_promoter">Event promoter</option>
        <option value="press">Press</option>
      </select>
      <textarea required rows={4} className="w-full rounded-lg border px-3 py-2" placeholder="Tell us how we can help" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
      <button disabled={status === 'sending'} className="w-full rounded-xl bg-electric text-white font-bold py-3 disabled:opacity-60">{status === 'sending' ? 'Sending...' : 'Send request'}</button>
      {status === 'success' && <p className="text-sm text-green-700">Request received. Our team will reach out shortly.</p>}
      {status === 'error' && <p className="text-sm text-red-700">Submission failed. Please retry.</p>}
    </form>
  )
}
