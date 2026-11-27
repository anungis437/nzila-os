import { and, eq } from 'drizzle-orm'
import { recognitionPrograms, recognitionAwardTypes } from '@/db/schema'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { assertOrgActionContext, type OrgActionContext } from '@/lib/resolve-org'
import { isUuid } from '@/lib/authority/store/executor'
import { UserFacingError } from '@/lib/errors/user-facing-error'

/** Metadata for the existing peer-text form. Credit amounts, rules, currency,
 * approval and automation do not form part of this supported projection. */
export async function listPeerPrograms(context: OrgActionContext) {
  assertOrgActionContext(context)
  return withRLSContext({ organizationId: context.organizationId }, (tx) =>
    tx
      .select({
        id: recognitionPrograms.id,
        orgId: recognitionPrograms.orgId,
        name: recognitionPrograms.name,
        description: recognitionPrograms.description,
        status: recognitionPrograms.status,
        createdAt: recognitionPrograms.createdAt,
        updatedAt: recognitionPrograms.updatedAt,
      })
      .from(recognitionPrograms)
      .where(
        and(
          eq(recognitionPrograms.orgId, context.organizationId),
          eq(recognitionPrograms.status, 'active'),
        ),
      ),
  )
}

export async function listPeerTypes(context: OrgActionContext, programId: string) {
  assertOrgActionContext(context)
  if (!isUuid(programId)) throw new UserFacingError('Program not found')
  return withRLSContext({ organizationId: context.organizationId }, async (tx) => {
    const [program] = await tx
      .select({ id: recognitionPrograms.id })
      .from(recognitionPrograms)
      .where(
        and(
          eq(recognitionPrograms.id, programId),
          eq(recognitionPrograms.orgId, context.organizationId),
          eq(recognitionPrograms.status, 'active'),
        ),
      )
      .limit(1)
    if (!program) throw new UserFacingError('Program not found')
    return tx
      .select({
        id: recognitionAwardTypes.id,
        orgId: recognitionAwardTypes.orgId,
        programId: recognitionAwardTypes.programId,
        name: recognitionAwardTypes.name,
        kind: recognitionAwardTypes.kind,
        createdAt: recognitionAwardTypes.createdAt,
        updatedAt: recognitionAwardTypes.updatedAt,
      })
      .from(recognitionAwardTypes)
      .where(
        and(
          eq(recognitionAwardTypes.orgId, context.organizationId),
          eq(recognitionAwardTypes.programId, program.id),
          eq(recognitionAwardTypes.kind, 'peer'),
        ),
      )
  })
}
