/**
 * CFO — New Task Page.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { CreateTaskForm } from '@/components/create-task-form'

export default async function NewTaskPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link
        href="../tasks"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Tasks
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-electric/10 text-electric">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div>
          <h2 className="font-poppins text-2xl font-bold text-foreground">New Task</h2>
          <p className="text-sm text-muted-foreground">Create a task for your team</p>
        </div>
      </div>

      <CreateTaskForm />
    </div>
  )
}
