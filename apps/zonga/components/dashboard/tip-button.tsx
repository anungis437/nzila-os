/** No successful tip is advertised without a verified payment execution source. */
'use client'
export function TipButton({
  creatorId: _creatorId,
  creatorName,
}: {
  creatorId: string
  creatorName: string
}) {
  return (
    <button
      type="button"
      disabled
      title={`Tipping ${creatorName} requires a verified payment source`}
      className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground opacity-60"
    >
      Tipping unavailable
    </button>
  )
}
