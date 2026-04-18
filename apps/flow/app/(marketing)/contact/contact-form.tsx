'use client'

import { useState } from 'react'

type Status = 'idle' | 'sending' | 'success' | 'error'

export function ContactForm() {
  const [status, setStatus] = useState<Status>('idle')
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', company: '', role: '', inquiryType: 'demo', message: '' })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...form, source: 'flow-marketing-contact' }),
    })
    setStatus(res.ok ? 'success' : 'error')
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-gray-200 p-6 bg-gray-50 space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <input required placeholder="First name" className="rounded-lg border px-3 py-2" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        <input placeholder="Last name" className="rounded-lg border px-3 py-2" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
      </div>
      <input required type="email" placeholder="Work email" className="w-full rounded-lg border px-3 py-2" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <input required placeholder="Company" className="w-full rounded-lg border px-3 py-2" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
      <input placeholder="Role" className="w-full rounded-lg border px-3 py-2" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
      <textarea required rows={4} placeholder="What do you need to improve right now?" className="w-full rounded-lg border px-3 py-2" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
      <button disabled={status === 'sending'} className="w-full rounded-xl bg-electric text-white font-bold py-3 disabled:opacity-60">{status === 'sending' ? 'Sending...' : 'Book discovery call'}</button>
      {status === 'success' && <p className="text-sm text-green-700">Thanks - your request is in our pipeline.</p>}
      {status === 'error' && <p className="text-sm text-red-700">Submission failed. Please try again.</p>}
    </form>
  )
}
