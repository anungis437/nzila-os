export function SyntheticWarning() {
  return (
    <div className="w-full bg-amber-400 text-amber-900 px-6 py-3 text-sm font-semibold flex items-center gap-2 border-b border-amber-500">
      <span className="text-lg">⚠</span>
      <span>
        SYNTHETIC DEMO ENVIRONMENT — All patient data is fabricated for demonstration purposes. No
        real patient records are present.
      </span>
    </div>
  )
}
