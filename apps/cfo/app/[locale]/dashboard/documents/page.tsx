/**
 * CFO — Documents Page.
 */
import Link from 'next/link'
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { requirePermission as _requirePermission } from '@/lib/rbac'
import { FileText, Upload, File, Download } from 'lucide-react'
import { listDocuments } from '@/lib/actions/misc-actions'

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const params = await searchParams
  const { documents, total } = await listDocuments({ page: Number(params.page ?? '1') })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-poppins text-2xl font-bold text-foreground">Documents</h2>
          <p className="mt-1 text-sm text-muted-foreground">{total} document{total !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="documents/upload"
          className="inline-flex items-center gap-2 rounded-lg bg-electric px-4 py-2 text-sm font-medium text-white hover:bg-electric/90"
        >
          <Upload className="h-4 w-4" /> Upload
        </Link>
      </div>

      {documents.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border py-16 text-center">
          <FileText className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="font-poppins text-lg font-semibold text-foreground">No documents yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Upload invoices, receipts, or contracts to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <div key={doc.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-electric/10 text-electric">
                  <File className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">{doc.type} · {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('en-CA') : '—'}</p>
                </div>
                {doc.url && (
                  <a href={doc.url} className="text-electric hover:text-electric/80"><Download className="h-4 w-4" /></a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
