/**
 * Authority for an external representative depositing a document on a grievance.
 *
 * Upload permission is the live matter grant. It does not let the representative
 * issue their own document grant, copy a download they were not given, or stamp
 * the file with a privilege label. The grantor remains the principal who issued
 * the matter grant.
 */

export const EXTERNAL_UPLOAD_LABELS = ['team_confidential', 'lro_confidential', 'case_restricted'] as const

export type ExternalUploadLabel = (typeof EXTERNAL_UPLOAD_LABELS)[number]

/** Privilege labels classify the file as legal-privilege material. An uploader cannot apply them. */
const REFUSED_PRIVILEGE_LABELS = ['privileged', 'highly_sensitive'] as const

export function externalUploadLabelAllowed(label: string): label is ExternalUploadLabel {
  return (EXTERNAL_UPLOAD_LABELS as readonly string[]).includes(label)
    && !(REFUSED_PRIVILEGE_LABELS as readonly string[]).includes(label)
}

export interface ExternalMatterGrantSnapshot {
  id: string
  authorityId: string
  organizationId: string
  userId: string
  representativeOrganizationId: string
  matterType: string
  matterId: string
  status: string
  revokedAt: Date | string | null
  expiresAt: Date | string | null
  canUploadDocuments: boolean
  canViewDocuments: boolean
  canDownloadDocuments: boolean
  grantedBy: string
}

export interface ExternalUploadGrant {
  grantedBy: string
  canView: boolean
  canDownload: boolean
  canShare: false
}

export type ExternalUploadDenial =
  | 'matter_grant_missing'
  | 'matter_grant_invalid'
  | 'self_issued'
  | 'upload_not_granted'

export function deriveExternalUploadGrant(input: {
  actorUserId: string
  grant: ExternalMatterGrantSnapshot | null | undefined
  authorityId: string
  matterGrantId: string
  organizationId: string
  representativeOrganizationId: string
  matterType: string
  matterId: string
  now?: Date
}): { ok: true; grant: ExternalUploadGrant } | { ok: false; reason: ExternalUploadDenial } {
  const grant = input.grant
  if (!grant) return { ok: false, reason: 'matter_grant_missing' }
  const now = input.now ?? new Date()
  const expiresAt = grant.expiresAt ? new Date(grant.expiresAt) : null
  const matches =
    grant.id === input.matterGrantId &&
    grant.authorityId === input.authorityId &&
    grant.organizationId === input.organizationId &&
    grant.userId === input.actorUserId &&
    grant.representativeOrganizationId === input.representativeOrganizationId &&
    grant.matterType === input.matterType &&
    grant.matterId === input.matterId &&
    grant.status === 'active' &&
    !grant.revokedAt &&
    (!expiresAt || expiresAt.getTime() > now.getTime())
  if (!matches) return { ok: false, reason: 'matter_grant_invalid' }
  const grantedBy = grant.grantedBy.trim()
  if (!grantedBy || grantedBy === input.actorUserId) return { ok: false, reason: 'self_issued' }
  if (!grant.canUploadDocuments) return { ok: false, reason: 'upload_not_granted' }
  return {
    ok: true,
    grant: {
      grantedBy,
      canView: grant.canViewDocuments,
      canDownload: grant.canDownloadDocuments,
      canShare: false,
    },
  }
}
