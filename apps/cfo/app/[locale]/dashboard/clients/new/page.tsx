/**
 * CFO — Create Client Page (Server Component + Client Island).
 *
 * Form to create a new client entity via `createClient` server action.
 */
import { CfoScopeError, resolveOrgContext } from '@/lib/resolve-org'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2 } from 'lucide-react'
import { CreateClientForm } from '@/components/create-client-form'

export default async function NewClientPage() {
  const permitted = await resolveOrgContext(
    'platform',
    { permission: 'clients:create' },
    async () => true,
  ).catch((error) => {
    if (error instanceof CfoScopeError && error.message === 'Unauthorized') redirect('/sign-in')
    if (error instanceof CfoScopeError) return false
    throw error
  })

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link
        href="../clients"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Clients
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-electric/10 text-electric">
          <Building2 className="h-6 w-6" />
        </div>
        <div>
          <h2 className="font-poppins text-2xl font-bold text-foreground">New Client</h2>
          <p className="text-sm text-muted-foreground">
            Create a new client entity in your workspace
          </p>
        </div>
      </div>

      {permitted ? (
        <CreateClientForm />
      ) : (
        <p role="status">Creating a client organization requires platform administration access.</p>
      )}
    </div>
  )
}
