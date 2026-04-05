/**
 * CFO — Clients List Page (Server Component).
 *
 * Displays paginated client list with search, using listClients action.
 * Links to individual client detail pages.
 */
import Link from 'next/link'
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/rbac'
import { Users, Plus, Search, Building2, ArrowRight } from 'lucide-react'
import { listClients } from '@/lib/actions/client-actions'

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  await requirePermission('clients:view')

  const params = await searchParams
  const page = Number(params.page ?? '1')
  const search = params.search ?? ''
  const status = params.status ?? undefined

  const { clients, total } = await listClients({
    page,
    pageSize: 20,
    search: search || undefined,
    status,
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-poppins text-2xl font-bold text-foreground">Clients</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} client{total !== 1 ? 's' : ''} in your firm
          </p>
        </div>
        <Link
          href="clients/new"
          className="inline-flex items-center gap-2 rounded-lg bg-electric px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-electric/90"
        >
          <Plus className="h-4 w-4" />
          Add Client
        </Link>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <form className="relative flex-1" action="" method="GET">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Search clients by name…"
            className="w-full rounded-lg border border-border bg-card py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-electric/40"
          />
        </form>
        <div className="flex gap-2">
          {['all', 'active', 'inactive'].map((s) => (
            <Link
              key={s}
              href={`?status=${s === 'all' ? '' : s}${search ? `&search=${search}` : ''}`}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                (status ?? '') === (s === 'all' ? '' : s) || (!status && s === 'all')
                  ? 'border-electric bg-electric/10 text-electric'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Link>
          ))}
        </div>
      </div>

      {/* Client List */}
      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Building2 className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="font-poppins text-lg font-semibold text-foreground">
            {search ? 'No matching clients' : 'No clients yet'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {search
              ? 'Try adjusting your search criteria.'
              : 'Add your first client to get started.'}
          </p>
          {!search && (
            <Link
              href="clients/new"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-electric px-4 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              Add Client
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-secondary/50">
              <tr>
                <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Members</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clients.map((client) => (
                <tr key={client.id} className="transition-colors hover:bg-secondary/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-electric/10 text-electric">
                        <Users className="h-4 w-4" />
                      </div>
                      <span className="font-medium text-foreground">{client.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        client.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-amber-500/10 text-amber-500'
                      }`}
                    >
                      {client.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {client.memberCount ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {client.createdAt
                      ? new Date(client.createdAt).toLocaleDateString('en-CA')
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`clients/${client.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-electric hover:underline"
                    >
                      View <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} · Showing {Math.min(20, clients.length)} of {total}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`?page=${page - 1}${search ? `&search=${search}` : ''}${status ? `&status=${status}` : ''}`}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
              >
                Previous
              </Link>
            )}
            {total > page * 20 && (
              <Link
                href={`?page=${page + 1}${search ? `&search=${search}` : ''}${status ? `&status=${status}` : ''}`}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
