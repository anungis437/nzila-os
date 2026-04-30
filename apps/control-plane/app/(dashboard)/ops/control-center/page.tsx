import { PageHeader } from '@/components/ui/page-header'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Ops Control Center — Nzila OS Control Plane',
  description: 'Role-gated operational controls for restart, reprocessing, and failure simulation with mandatory audit records.',
}

const actions = [
  { action: 'restart_service', description: 'Restart a service after runtime instability.' },
  { action: 'trigger_reprocessing', description: 'Replay failed payloads for deterministic recovery.' },
  { action: 'simulate_failure', description: 'Execute controlled failure simulation for game-day readiness.' },
] as const

export default function OpsControlCenterPage() {
  return (
    <>
      <PageHeader
        title="Ops Control Center"
        description="Operational independence surface: restart services, trigger reprocessing, and run failure simulations with strict RBAC and audit traces."
      />
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Available actions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Actions execute through `/api/control-plane/ops/control-center` and require `x-operator-role` set to `platform_admin` or `ops`.
        </p>
        <ul className="mt-4 space-y-3">
          {actions.map((item) => (
            <li key={item.action} className="rounded border border-border p-3">
              <p className="font-mono text-xs text-foreground">{item.action}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
