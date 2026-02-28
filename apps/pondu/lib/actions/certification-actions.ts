/**
 * Pondu Server Actions — Certifications.
 *
 * Upload and manage certification artifacts (organic, fair-trade, etc.).
 * Every action calls `resolveOrgContext()` first and emits audit.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { revalidatePath } from 'next/cache'
import {
  certifyLotSchema,
  buildActionAuditEntry,
  type AgriServiceResult,
} from '@nzila/agri-core'

export async function uploadCertification(
  data: unknown,
): Promise<AgriServiceResult<{ certificationId: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = certifyLotSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const id = crypto.randomUUID()

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    orgId: ctx.orgId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'certification',
    targetEntityId: id,
    action: 'certification.uploaded',
    label: `Uploaded ${parsed.data.certificationType} certification`,
    metadata: {
      type: parsed.data.certificationType,
      issuedBy: (parsed.data.metadata as Record<string, unknown>)?.issuedBy ?? 'unknown',
    },
  })

  // TODO: persist via agri-db CertificationRepository

  revalidatePath('/pondu/certifications')

  return { ok: true, data: { certificationId: id }, error: null, auditEntries: [entry] }
}

export async function listCertifications(): Promise<
  AgriServiceResult<{ certifications: unknown[] }>
> {
  const ctx = await resolveOrgContext()

  // TODO: read via agri-db CertificationRepository scoped to ctx.orgId

  return { ok: true, data: { certifications: [] }, error: null, auditEntries: [] }
}
