/**
 * Pondu Server Actions — Producers.
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

export async function createProducer(
  data: unknown,
): Promise<AgriServiceResult<{ producerId: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = createProducerSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const id = crypto.randomUUID()

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    orgId: ctx.orgId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'producer',
    targetEntityId: id,
    action: 'producer.created',
    label: `Registered producer ${parsed.data.name}`,
    metadata: { name: parsed.data.name },
  })

  // TODO: persist via agri-db ProducerRepository

  revalidatePath('/pondu/producers')

  return { ok: true, data: { producerId: id }, error: null, auditEntries: [entry] }
}

export async function listProducers(): Promise<
  AgriServiceResult<{ producers: unknown[] }>
> {
  const ctx = await resolveOrgContext()

  // TODO: read via agri-db ProducerRepository scoped to ctx.orgId

  return { ok: true, data: { producers: [] }, error: null, auditEntries: [] }
}
