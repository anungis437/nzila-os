/**
 * CFO — Workflows Page.
 */
import Link from 'next/link'
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/rbac'
import { Workflow, Play, Pause, CheckCircle2, XCircle, Plus } from 'lucide-react'
import { listWorkflows, type Workflow as WF } from '@/lib/actions/misc-actions'
import { listWorkflowInstances } from '@/lib/actions/workflow-actions'
import { StartWorkflowButton } from '@/components/start-workflow-button'

function statusBadge(s: WF['status']) {
  switch (s) {
    case 'active': return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-500"><Play className="h-3 w-3" /> Active</span>
    case 'paused': return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-500"><Pause className="h-3 w-3" /> Paused</span>
    case 'completed': return <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-500"><CheckCircle2 className="h-3 w-3" /> Completed</span>
    default: return <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500"><XCircle className="h-3 w-3" /> Failed</span>
  }
}

export default async function WorkflowsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  await requirePermission('workflows:view')

  const workflows = await listWorkflows()
  const instances = await listWorkflowInstances()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-poppins text-2xl font-bold text-foreground">Workflows</h2>
          <p className="mt-1 text-sm text-muted-foreground">Automated financial processes and triggers</p>
        </div>
        <Link
          href="workflows/new"
          className="inline-flex items-center gap-2 rounded-lg bg-electric px-4 py-2 text-sm font-medium text-white hover:bg-electric/90"
        >
          <Plus className="h-4 w-4" /> New Workflow
        </Link>
      </div>

      {workflows.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border py-16 text-center">
          <Workflow className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="font-poppins text-lg font-semibold text-foreground">No workflows configured</p>
          <p className="mt-1 text-sm text-muted-foreground">Set up automated reconciliations, report generation, and more.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-secondary/50">
              <tr>
                <th className="px-4 py-3 font-medium text-muted-foreground">Workflow</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Trigger</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Runs</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Last Run</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {workflows.map((w) => (
                <tr key={w.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-3 font-medium text-foreground">{w.name}</td>
                  <td className="px-4 py-3">{statusBadge(w.status)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{w.trigger}</td>
                  <td className="px-4 py-3 text-muted-foreground">{w.runCount}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {w.lastRun ? new Date(w.lastRun).toLocaleString('en-CA') : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <StartWorkflowButton templateId={w.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Running Instances */}
      {instances.length > 0 && (
        <section>
          <h3 className="mb-3 font-poppins text-lg font-semibold text-foreground">Running Instances</h3>
          <div className="space-y-2">
            {instances.map((inst) => (
              <Link
                key={inst.id}
                href={`workflows/${inst.id}`}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-sm hover:bg-secondary/30 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{inst.templateName}</p>
                  <p className="text-xs text-muted-foreground">
                    Step {inst.currentStep + 1} of {inst.steps.length} · {inst.createdAt ? new Date(inst.createdAt).toLocaleString('en-CA') : ''}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${inst.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : inst.status === 'rejected' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                  {inst.status}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
