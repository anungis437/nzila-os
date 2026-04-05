/**
 * CFO — Workflow Instance Execution Page.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect, notFound } from 'next/navigation'
import { CheckCircle2, XCircle, Circle, Clock, ArrowRight } from 'lucide-react'
import { getWorkflowInstance } from '@/lib/actions/workflow-actions'
import { WorkflowStepActions } from '@/components/workflow-step-actions'

export default async function WorkflowInstancePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { id } = await params
  const instance = await getWorkflowInstance(id)
  if (!instance) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-poppins text-2xl font-bold text-foreground">{instance.templateName}</h2>
        <div className="mt-1 flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle(instance.status)}`}>
            {instance.status}
          </span>
          <span className="text-sm text-muted-foreground">
            Started {instance.createdAt ? new Date(instance.createdAt).toLocaleString('en-CA') : ''}
          </span>
        </div>
      </div>

      {/* Step Timeline */}
      <div className="space-y-3">
        {instance.steps.map((step, i) => {
          const isCurrent = i === instance.currentStep && instance.status === 'in-progress'
          return (
            <div
              key={i}
              className={`flex items-start gap-4 rounded-xl border p-4 ${isCurrent ? 'border-electric/30 bg-electric/5' : 'border-border bg-card'} shadow-sm`}
            >
              <div className="mt-0.5">{stepIcon(step.status)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{step.name}</p>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                    {step.assigneeRole}
                  </span>
                  <span className="text-xs text-muted-foreground">({step.actionType})</span>
                </div>
                {step.comment && (
                  <p className="mt-1 text-xs text-muted-foreground italic">&ldquo;{step.comment}&rdquo;</p>
                )}
                {step.completedAt && step.completedBy && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {step.status === 'completed' ? 'Approved' : step.status === 'rejected' ? 'Rejected' : ''} by {step.completedBy} · {new Date(step.completedAt).toLocaleString('en-CA')}
                  </p>
                )}
                {isCurrent && (
                  <div className="mt-3">
                    <WorkflowStepActions instanceId={instance.id} />
                  </div>
                )}
              </div>
              {i < instance.steps.length - 1 && (
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/30" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function statusStyle(s: string) {
  switch (s) {
    case 'completed': return 'bg-emerald-500/10 text-emerald-500'
    case 'rejected': return 'bg-red-500/10 text-red-500'
    default: return 'bg-blue-500/10 text-blue-500'
  }
}

function stepIcon(s: string) {
  switch (s) {
    case 'completed': return <CheckCircle2 className="h-5 w-5 text-emerald-500" />
    case 'rejected': return <XCircle className="h-5 w-5 text-red-500" />
    case 'skipped': return <Circle className="h-5 w-5 text-muted-foreground" />
    default: return <Clock className="h-5 w-5 text-blue-500" />
  }
}
