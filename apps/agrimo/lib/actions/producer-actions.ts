/**
 * Agrimo Server Actions — Producers.
 *
 * Register and manage smallholder / cooperative profiles.
 * Every action calls `resolveOrgContext()` first and emits audit.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { revalidatePath } from 'next/cache'
import {
  createProducerSchema,
  buildActionAuditEntry,
  type AgriServiceResult,
} from '@nzila/agri-core'
import { producerRepo } from '@nzila/agri-db'

export async function createProducer(
  data: unknown,
): Promise<AgriServiceResult<{ producerId: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = createProducerSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const dbCtx = { orgId: ctx.orgId, actorId: ctx.actorId }
  const producer = await producerRepo.createProducer(dbCtx, parsed.data)

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    orgId: ctx.orgId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'producer',
    targetEntityId: producer.id,
    action: 'producer.created',
    label: `Registered producer ${parsed.data.name}`,
    metadata: { name: parsed.data.name },
  })

  revalidatePath('/agrimo/producers')

  return { ok: true, data: { producerId: producer.id }, error: null, auditEntries: [entry] }
}

export async function listProducers(): Promise<
  AgriServiceResult<{ producers: unknown[] }>
> {
  const ctx = await resolveOrgContext()
  const result = await producerRepo.listProducers({ orgId: ctx.orgId })

  return { ok: true, data: { producers: result.rows }, error: null, auditEntries: [] }
}
