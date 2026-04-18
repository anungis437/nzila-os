'use client'

import { useState } from 'react'

export default function TrialPage() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', company: '', teamSize: '1-5', primaryUseCase: 'approvals' })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    const res = await fetch('/api/trial', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    })
    setStatus(res.ok ? 'done' : 'error')
  }

  return (
    <main className="min-h-screen bg-white pt-24">
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-bold text-navy">Start your 14-day Flow trial</h1>
        <p className="mt-4 text-gray-600">Create your org in minutes. Launch your first governed workflow today.</p>

        <form onSubmit={submit} className="mt-8 rounded-2xl border border-gray-200 p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <input required placeholder="First name" className="rounded-lg border px-3 py-2" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            <input placeholder="Last name" className="rounded-lg border px-3 py-2" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <input required type="email" placeholder="Work email" className="w-full rounded-lg border px-3 py-2" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input required placeholder="Company" className="w-full rounded-lg border px-3 py-2" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <select className="w-full rounded-lg border px-3 py-2" value={form.teamSize} onChange={(e) => setForm({ ...form, teamSize: e.target.value })}>
            <option>1-5</option>
            <option>6-20</option>
            <option>21-100</option>
            <option>100+</option>
          </select>
          <select className="w-full rounded-lg border px-3 py-2" value={form.primaryUseCase} onChange={(e) => setForm({ ...form, primaryUseCase: e.target.value })}>
            <option value="approvals">Approvals</option>
            <option value="service-desk">Service desk</option>
            <option value="finance">Finance workflows</option>
            <option value="hr">HR workflows</option>
          </select>
          <button disabled={status === 'sending'} className="w-full rounded-xl bg-electric text-white font-bold py-3 disabled:opacity-60">{status === 'sending' ? 'Creating trial...' : 'Create trial org'}</button>
          {status === 'done' && <p className="text-sm text-green-700">Trial created. Check your email for activation steps.</p>}
          {status === 'error' && <p className="text-sm text-red-700">Could not create trial. Please retry.</p>}
        </form>
      </section>
    </main>
  )
}
