// ─── @nzila/sage-core — export package storage reference ─────────────────────
// Package bytes are committed transactionally with package metadata by the
// repository (`commitExportPackage`), so there is no separate object-store port.
// This module only derives the deterministic, content-addressed PRIVATE storage
// reference. Content-addressing (the reference embeds the content hash) makes an
// overwrite with different bytes structurally impossible.

/**
 * Deterministic, content-addressed private storage reference for a package. The
 * `sage-internal://` scheme is a private internal locator — never a public URL.
 */
export function sageExportPackageStorageReference(input: {
  orgId: string
  workspaceId: string
  exportRequestId: string
  contentHash: string
}): string {
  return `sage-internal://sage/exports/${input.orgId}/${input.workspaceId}/${input.exportRequestId}/${input.contentHash}.json`
}
