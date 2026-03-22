export default async function QualityPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Quality</h1>
      <p className="text-gray-600 mb-6">Inspections, grading, and quality FSM transitions.</p>
      <p className="text-gray-400 italic">
        Select a lot from the <a href="/agrimo/lots" className="underline">Lots</a> page to view its quality inspections.
      </p>
    </div>
  )
}
