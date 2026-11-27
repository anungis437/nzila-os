import { platformDb } from '@nzila/db/platform'
import { opsClients } from '@nzila/db/schema'
import { createLogger } from '@nzila/os-core/telemetry'
const logger = createLogger('console.itsm.clients')
export interface CreateItsmClientInput {
  companyName: string
  contactName?: string
  contactEmail?: string
  product?: string
  onboardingStage?: string
  contractValue?: string
  renewalDate?: string
  notes?: string
}
export async function createItsmClient(
  orgId: string,
  userId: string,
  input: CreateItsmClientInput,
) {
  const companyName = input.companyName.trim()
  const contactName = input.contactName?.trim() || null
  const contactEmail = input.contactEmail?.trim() || null
  const product = input.product?.trim() || 'other'
  const onboardingStage = input.onboardingStage?.trim() || 'prospect'
  const contractValue = input.contractValue?.trim() || null
  const renewalDate = input.renewalDate?.trim() || null
  const notes = input.notes?.trim() || null
  try {
    const created = await platformDb
      .insert(opsClients)
      .values({
        orgId,
        companyName,
        contactName,
        contactEmail,
        product,
        onboardingStage: onboardingStage as
          | 'prospect'
          | 'contract_signed'
          | 'tenant_created'
          | 'kickoff_booked'
          | 'training_complete'
          | 'live'
          | 'churned',
        health: 'healthy',
        contractValue,
        renewalDate,
        notes,
        accountOwnerId: userId,
      })
      .returning({ id: opsClients.id })
      .then((rows) => rows[0] ?? null)
    if (!created) {
      return {
        status: 500,
        body: { error: 'Failed to create client' },
      }
    }
    return {
      status: 201,
      body: { id: created.id },
    }
  } catch (error) {
    logger.error('itsm.client.create.failed', {
      orgId,
      userId,
      error: error instanceof Error ? error.message : 'unknown_error',
    })
    return {
      status: 500,
      body: { error: 'Failed to create client' },
    }
  }
}
