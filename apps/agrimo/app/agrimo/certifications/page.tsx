export default async function CertificationsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Certifications</h1>
      <p className="text-gray-600 mb-6">Organic, fair-trade, and other certification artifacts.</p>
      <p className="text-gray-400 italic">
        Select a lot from the <a href="/agrimo/lots" className="underline">Lots</a> page to view its certifications.
      </p>
    </div>
  )
}
