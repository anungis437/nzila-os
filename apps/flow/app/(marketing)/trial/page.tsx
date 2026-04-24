'use client'

import { useState } from 'react'

type WizardStep = 1 | 2 | 3 | 4

type ProductSeed = {
  name: string
  sku: string
  unitPrice: string
}

export default function TrialPage() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [step, setStep] = useState<WizardStep>(1)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    teamSize: '1-5',
    primaryUseCase: 'approvals',
    industry: '',
    website: '',
    brandName: '',
    primaryColor: '#1d4ed8',
    logoUrl: '',
    currency: 'CAD',
    taxRegion: 'CA-QC',
    taxId: '',
    defaultTaxRate: '14.975',
  })
  const [products, setProducts] = useState<ProductSeed[]>([
    { name: 'Starter Package', sku: 'FLOW-STARTER', unitPrice: '499.00' },
  ])

  const totalSteps = 4

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    const res = await fetch('/api/trial', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...form, products }),
    })
    setStatus(res.ok ? 'done' : 'error')
  }

  function nextStep() {
    setStep((prev) => Math.min(totalSteps, prev + 1) as WizardStep)
  }

  function prevStep() {
    setStep((prev) => Math.max(1, prev - 1) as WizardStep)
  }

  function updateProduct(index: number, patch: Partial<ProductSeed>) {
    setProducts((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  function addProduct() {
    setProducts((prev) => [...prev, { name: '', sku: '', unitPrice: '' }])
  }

  function removeProduct(index: number) {
    setProducts((prev) => prev.filter((_, i) => i !== index))
  }

  const canContinue =
    (step === 1 && form.firstName && form.email && form.company) ||
    (step === 2 && form.brandName) ||
    (step === 3 && form.taxRegion && form.defaultTaxRate) ||
    (step === 4 && products.length > 0 && products.every((p) => p.name && p.sku))

  return (
    <main className="min-h-screen bg-white pt-24">
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-bold text-navy">Start your 14-day Flow trial</h1>
        <p className="mt-4 text-gray-600">Complete setup in under 3 minutes. Launch quote-to-cash with business context from day one.</p>

        <div className="mt-8">
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }).map((_, i) => {
              const index = i + 1
              return (
                <div
                  key={index}
                  className={`h-2 flex-1 rounded-full ${index <= step ? 'bg-electric' : 'bg-gray-200'}`}
                />
              )
            })}
          </div>
          <p className="mt-2 text-sm text-gray-500">Step {step} of {totalSteps}</p>
        </div>

        <form onSubmit={submit} className="mt-8 rounded-2xl border border-gray-200 p-6 space-y-4">
          {step === 1 && (
            <>
              <p className="text-sm font-semibold text-navy">Business profile</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <input required placeholder="First name" className="rounded-lg border px-3 py-2" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                <input placeholder="Last name" className="rounded-lg border px-3 py-2" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
              <input required type="email" placeholder="Work email" className="w-full rounded-lg border px-3 py-2" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input required placeholder="Company" className="w-full rounded-lg border px-3 py-2" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              <div className="grid sm:grid-cols-2 gap-3">
                <input placeholder="Industry" className="rounded-lg border px-3 py-2" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
                <input placeholder="Website" className="rounded-lg border px-3 py-2" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
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
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm font-semibold text-navy">Branding setup</p>
              <input required placeholder="Customer-facing brand name" className="w-full rounded-lg border px-3 py-2" value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} />
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="rounded-lg border px-3 py-2 flex items-center gap-3 text-sm text-gray-700">
                  Brand color
                  <input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="ml-auto h-8 w-12" />
                </label>
                <input placeholder="Logo URL (optional)" className="rounded-lg border px-3 py-2" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-sm font-semibold text-navy">Taxes & billing defaults</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <select className="rounded-lg border px-3 py-2" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  <option value="CAD">CAD</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
                <input placeholder="Tax region (e.g., CA-QC)" className="rounded-lg border px-3 py-2" value={form.taxRegion} onChange={(e) => setForm({ ...form, taxRegion: e.target.value })} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <input placeholder="Tax registration ID" className="rounded-lg border px-3 py-2" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
                <input placeholder="Default tax rate (%)" className="rounded-lg border px-3 py-2" value={form.defaultTaxRate} onChange={(e) => setForm({ ...form, defaultTaxRate: e.target.value })} />
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <p className="text-sm font-semibold text-navy">Starter product catalog</p>
              {products.map((product, index) => (
                <div key={`${product.sku}-${index}`} className="rounded-xl border border-gray-200 p-3 space-y-2">
                  <div className="grid sm:grid-cols-3 gap-2">
                    <input
                      placeholder="Product name"
                      className="rounded-lg border px-3 py-2"
                      value={product.name}
                      onChange={(e) => updateProduct(index, { name: e.target.value })}
                    />
                    <input
                      placeholder="SKU"
                      className="rounded-lg border px-3 py-2"
                      value={product.sku}
                      onChange={(e) => updateProduct(index, { sku: e.target.value })}
                    />
                    <input
                      placeholder="Unit price"
                      className="rounded-lg border px-3 py-2"
                      value={product.unitPrice}
                      onChange={(e) => updateProduct(index, { unitPrice: e.target.value })}
                    />
                  </div>
                  {products.length > 1 && (
                    <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => removeProduct(index)}>
                      Remove product
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="text-sm font-semibold text-electric hover:underline" onClick={addProduct}>
                + Add product
              </button>
            </>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={prevStep} disabled={step === 1} className="w-full rounded-xl border border-gray-300 text-gray-700 font-semibold py-3 disabled:opacity-50">
              Back
            </button>
            {step < totalSteps ? (
              <button type="button" disabled={!canContinue} onClick={nextStep} className="w-full rounded-xl bg-electric text-white font-bold py-3 disabled:opacity-60">
                Continue
              </button>
            ) : (
              <button disabled={status === 'sending' || !canContinue} className="w-full rounded-xl bg-electric text-white font-bold py-3 disabled:opacity-60">
                {status === 'sending' ? 'Creating trial...' : 'Create trial org'}
              </button>
            )}
          </div>

          {status === 'done' && <p className="text-sm text-green-700">Trial created. Check your email for activation steps.</p>}
          {status === 'error' && <p className="text-sm text-red-700">Could not create trial. Please retry.</p>}
        </form>
      </section>
    </main>
  )
}
