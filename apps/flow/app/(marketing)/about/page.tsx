export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white pt-24">
      <section className="mx-auto max-w-4xl px-6 py-20">
        <h1 className="text-4xl md:text-5xl font-bold text-navy">Operational clarity without enterprise complexity</h1>
        <p className="mt-6 text-lg text-gray-700 leading-relaxed">Flow was built for teams that outgrow spreadsheets but cannot afford bloated enterprise tooling. Every workflow is enforced, auditable, and measurable from day one.</p>
        <div className="mt-10 grid sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-200 p-5"><p className="text-2xl font-black text-navy">5 min</p><p className="text-sm text-gray-600">Time to first workflow</p></div>
          <div className="rounded-xl border border-gray-200 p-5"><p className="text-2xl font-black text-navy">3 gates</p><p className="text-sm text-gray-600">Built-in payment controls</p></div>
          <div className="rounded-xl border border-gray-200 p-5"><p className="text-2xl font-black text-navy">44 events</p><p className="text-sm text-gray-600">Auditable lifecycle signals</p></div>
        </div>
      </section>
    </main>
  )
}
