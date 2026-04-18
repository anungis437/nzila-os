import { ContactForm } from './contact-form'

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-white pt-24">
      <section className="mx-auto max-w-5xl px-6 py-16 grid lg:grid-cols-2 gap-10">
        <div>
          <h1 className="text-4xl font-bold text-navy">Talk to Flow sales</h1>
          <p className="mt-4 text-gray-700">Tell us your ops bottleneck and we will map the first workflow in under 30 minutes.</p>
          <div className="mt-8 space-y-3 text-sm text-gray-600">
            <p>• Guided pilot setup</p>
            <p>• ROI baseline in week 1</p>
            <p>• Dedicated implementation support</p>
          </div>
        </div>
        <ContactForm />
      </section>
    </main>
  )
}
