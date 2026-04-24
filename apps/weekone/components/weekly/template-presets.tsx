'use client'

const templates = [
  { id: 'solo', title: 'Solo Founder Sprint', summary: 'Protect deep work and ship one meaningful deliverable.' },
  { id: 'agency', title: 'Agency Operator', summary: 'Balance delivery quality, client comms, and margin guardrails.' },
  { id: 'ceo', title: 'Startup CEO', summary: 'Focus on hiring, fundraising rhythm, and weekly GTM velocity.' },
  { id: 'sales', title: 'Sales Week', summary: 'Prioritize pipeline movement, follow-ups, and close actions.' },
  { id: 'fundraising', title: 'Fundraising Mode', summary: 'Coordinate investor updates, data room prep, and outreach.' },
]

export function TemplatePresets() {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">Founder Templates</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Start with a proven weekly operating pattern and adapt as needed.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            className="rounded-lg border border-border px-3 py-3 text-left transition-colors hover:border-electric/50"
          >
            <p className="text-sm font-medium text-foreground">{template.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{template.summary}</p>
          </button>
        ))}
      </div>
    </section>
  )
}
