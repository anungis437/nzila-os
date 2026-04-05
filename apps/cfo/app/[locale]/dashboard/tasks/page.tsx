/**
 * CFO — Tasks Page.
 */
import Link from 'next/link'
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { requirePermission as _requirePermission } from '@/lib/rbac'
import { CheckCircle2, Circle, Clock, AlertTriangle, Plus } from 'lucide-react'
import { listTasks, type Task } from '@/lib/actions/misc-actions'
import { UpdateTaskStatusSelect } from '@/components/update-task-status'

function priorityStyle(p: Task['priority']) {
  switch (p) {
    case 'urgent': return 'bg-red-500/10 text-red-500'
    case 'high': return 'bg-amber-500/10 text-amber-500'
    case 'medium': return 'bg-blue-500/10 text-blue-500'
    default: return 'bg-secondary text-muted-foreground'
  }
}

function statusIcon(s: Task['status']) {
  switch (s) {
    case 'completed': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    case 'in-progress': return <Clock className="h-4 w-4 text-blue-500" />
    case 'cancelled': return <AlertTriangle className="h-4 w-4 text-muted-foreground" />
    default: return <Circle className="h-4 w-4 text-muted-foreground" />
  }
}

export default async function TasksPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { tasks, total } = await listTasks()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-poppins text-2xl font-bold text-foreground">Tasks</h2>
          <p className="mt-1 text-sm text-muted-foreground">{total} task{total !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="tasks/new"
          className="inline-flex items-center gap-2 rounded-lg bg-electric px-4 py-2 text-sm font-medium text-white hover:bg-electric/90"
        >
          <Plus className="h-4 w-4" /> New Task
        </Link>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border py-16 text-center">
          <CheckCircle2 className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="font-poppins text-lg font-semibold text-foreground">All caught up!</p>
          <p className="mt-1 text-sm text-muted-foreground">No tasks right now.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
              {statusIcon(task.status)}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  {task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString('en-CA')}` : 'No due date'}
                </p>
              </div>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${priorityStyle(task.priority)}`}>
                {task.priority}
              </span>
              <UpdateTaskStatusSelect taskId={task.id} currentStatus={task.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
