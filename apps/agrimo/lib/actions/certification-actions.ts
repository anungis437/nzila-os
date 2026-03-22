/**
 * Agrimo Server Actions — Certifications.
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
import { certificationRepo } from '@nzila/agri-db'

export async function uploadCertification(
  data: unknown,
): Promise<AgriServiceResult<{ certificationId: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = certifyLotSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const dbCtx = { orgId: ctx.orgId, actorId: ctx.actorId }
  const contentForHash = JSON.stringify(parsed.data)
  const cert = await certificationRepo.createCertification(dbCtx, parsed.data, contentForHash)

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    orgId: ctx.orgId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'certification',
    targetEntityId: cert.id,
    action: 'certification.uploaded',
    label: `Uploaded ${parsed.data.certificationType} certification`,
    metadata: {
      type: parsed.data.certificationType,
      issuedBy: (parsed.data.metadata as Record<string, unknown>)?.issuedBy ?? 'unknown',
    },
  })

  revalidatePath('/agrimo/certifications')

  return { ok: true, data: { certificationId: cert.id }, error: null, auditEntries: [entry] }
}

export async function listCertifications(
  lotId: string,
): Promise<AgriServiceResult<{ certifications: unknown[] }>> {
  const ctx = await resolveOrgContext()
  const certifications = await certificationRepo.listCertifications({ orgId: ctx.orgId }, lotId)

  return { ok: true, data: { certifications }, error: null, auditEntries: [] }
}
