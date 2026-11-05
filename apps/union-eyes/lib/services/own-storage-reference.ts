/**
 * A linked file URL is a pointer into this organization's own document storage or it is refused: the request body is not a
 * place to name another host, another tenant's container or a credential-bearing address.
 */
import { ApiError } from '@/lib/api/errors'
import { verifiedLegacyBlobPath } from '@/lib/services/document-blob-integrity-service'

export function assertOwnStorageUrl(fileUrl: string | null | undefined, organizationId: string): void {
  if (fileUrl == null) return
  if (!verifiedLegacyBlobPath(fileUrl, organizationId)) {
    throw ApiError.badRequest("The file URL must point at this organization's document storage")
  }
}
