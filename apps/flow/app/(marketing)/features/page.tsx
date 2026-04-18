import Link from 'next/link'

const templates = [
  'Approval workflows',
  'Service request intake',
  'Finance approvals',
  'HR workflows',
  'Service desk lite',
  'Vendor onboarding',
]

export default function FeaturesPage() {
  return (
    <main className="min-h-screen bg-gray-50 pt-24">
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="text-4xl md:text-5xl font-bold text-navy">Template Gallery</h1>
        <p className="mt-4 text-lg text-gray-600">Launch with proven operational templates and customize per org.</p>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div key={t} className="rounded-xl bg-white border border-gray-200 p-5">
              <h2 className="font-semibold text-navy">{t}</h2>
              <p className="text-sm text-gray-600 mt-2">Production-ready baseline with governance checkpoints.</p>
            </div>
          ))}
        </div>
        <div className="mt-10">
          <Link href="/trial" className="inline-flex items-center rounded-xl bg-electric px-6 py-3 text-white font-bold">Start free trial</Link>
        </div>
      </section>
    </main>
  )
}
