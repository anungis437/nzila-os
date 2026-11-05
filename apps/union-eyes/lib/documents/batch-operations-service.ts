/**
 * Batch document helpers.
 *
 * These functions do not authorize documents, read storage addresses, or
 * rewrite privacy labels. Listing and download stay on the canonical
 * repository and per-document download routes. Folder checks in this file
 * are not an authorization grant.
 */

export interface BatchOperationProgress {
  total: number;
  completed: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

export interface BatchOperationResult {
  success: boolean;
  progress: BatchOperationProgress;
  message: string;
}

function refused(action: string, count: number): never {
  throw new Error(
    `${action} is refused for ${count} documents. Authorize each document through the canonical repository and download routes.`,
  );
}

/**
 * Direct storage archives are refused. Each document is authorized through
 * GET /api/documents/[id]/download. This function does not read fileUrl.
 */
export async function downloadMultiple(
  documentIds: string[],
  _organizationId: string,
  _userId: string,
): Promise<never> {
  refused('Direct storage download', documentIds.length);
}

/** Tag writes stay fail-closed until a canonical tag action exists. */
export async function bulkTag(
  documentIds: string[],
  _tagsToAdd: string[],
  _organizationId: string,
  _userId: string,
): Promise<BatchOperationResult> {
  refused('Bulk tag', documentIds.length);
}

/** Role names and uploader identity do not authorize deletion. */
export async function bulkDelete(
  documentIds: string[],
  _organizationId: string,
  _userId: string,
  _userRole: string,
): Promise<BatchOperationResult> {
  refused('Bulk delete', documentIds.length);
}

/** Folder membership is not changed from this helper. */
export async function moveToFolder(
  documentIds: string[],
  _folderId: string | null,
  _organizationId: string,
  _userId: string,
): Promise<BatchOperationResult> {
  refused('Bulk move', documentIds.length);
}

/**
 * Copying by storage address is refused. A canonical copy is a new repository row.
 */
export async function bulkCopy(
  documentIds: string[],
  _destinationFolderId: string | null,
  _organizationId: string,
  _userId: string,
): Promise<BatchOperationResult> {
  refused('Copying storage addresses', documentIds.length);
}

/**
 * Bulk metadata writes are refused. Privacy labels are not a share or export grant.
 */
export async function bulkUpdateMetadata(
  documentIds: string[],
  _metadataUpdates: Record<string, unknown>,
  _organizationId: string,
  _userId: string,
): Promise<BatchOperationResult> {
  throw new Error(
    `Bulk metadata update is refused for ${documentIds.length} documents. Changing a privacy label does not grant access.`,
  );
}

/**
 * Role names do not grant document access. Visibility stays on isDocumentVisibleByPolicy.
 */
export async function validateDocumentPermissions(
  documentIds: string[],
  _organizationId: string,
  _userId: string,
  _userRole: string,
): Promise<{
  hasPermission: boolean;
  deniedDocuments: string[];
}> {
  return {
    hasPermission: false,
    deniedDocuments: [...documentIds],
  };
}
