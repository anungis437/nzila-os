/**
 * CFO — Create Workflow Template Page.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { WorkflowBuilderForm } from '@/components/workflow-builder-form'

export default async function NewWorkflowPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-poppins text-2xl font-bold text-foreground">Create Workflow</h2>
        <p className="mt-1 text-sm text-muted-foreground">Define a multi-step approval workflow</p>
      </div>
      <WorkflowBuilderForm />
    </div>
  )
}
