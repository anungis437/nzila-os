import { z } from 'zod'
import { orgs, auditLog } from '@nzila/db/schema'
import { assertCfoContextPermission, CfoScopeError, type CfoActionContext } from '@/lib/resolve-org'
import { appendCfoPrimaryAudit } from './cfo-records'
export const clientInput = z
  .object({
    name: z.string().trim().min(1),
    contactEmail: z.union([z.email(), z.literal('')]).optional(),
    jurisdiction: z.string().optional(),
    incorporationNumber: z.string().optional(),
    fiscalYearEnd: z.string().optional(),
    industry: z.string().optional(),
    businessType: z.string().optional(),
    phone: z.string().optional(),
    servicesNeeded: z.array(z.string()).optional(),
    notes: z.string().optional(),
  })
  .strict()

export async function createCfoClient(
  context: CfoActionContext,
  data: z.input<typeof clientInput>,
  operation: 'createClient' | 'importClientsFromCsv' = 'createClient',
) {
  assertCfoContextPermission(context, 'clients:create')
  if (context.purpose !== 'platform') throw new CfoScopeError()
  const input = clientInput.parse(data)
  const [created] = await context.db
    .insert(orgs)
    .values({
      legalName: input.name,
      jurisdiction: input.jurisdiction || 'CA-ON',
      incorporationNumber: input.incorporationNumber || null,
      fiscalYearEnd: input.fiscalYearEnd || null,
      status: 'active',
      policyConfig: {
        contactEmail: input.contactEmail || null,
        industry: input.industry || null,
        businessType: input.businessType || null,
        phone: input.phone || null,
        servicesNeeded: input.servicesNeeded || [],
        notes: input.notes || null,
        ...(operation === 'importClientsFromCsv' ? { importedFrom: 'csv' } : {}),
      },
    })
    .returning({ id: orgs.id })
  if (!created) throw new Error('Client was not stored')
  await context.db.insert(auditLog).values({
    action: 'client.created',
    actorId: context.userId,
    entityType: 'org',
    orgId: created.id,
    metadata: { clientId: created.id, source: 'cfo', authority: 'platform' },
  })
  await appendCfoPrimaryAudit(context, {
    organizationId: created.id,
    action: 'cfo.client.created',
    targetType: 'org',
    targetId: created.id,
    afterJson: {
      source: 'cfo.clients',
      operation,
      clientId: created.id,
    },
  })
  return created
}
