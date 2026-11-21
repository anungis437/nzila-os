import { requireRewardsInstitutionalAuthority } from '@/lib/rewards/credit-authority'
/**
 * Recognition Program Service
 * Handles CRUD operations for recognition programs and award types
 */

import { db } from '@/db'
import {
  recognitionPrograms,
  recognitionAwardTypes,
  type NewRecognitionProgram,
  type NewRecognitionAwardType,
  type RecognitionProgram,
  type RecognitionAwardType,
} from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'

/**
 * Create a new recognition program
 */
export async function createProgram(data: NewRecognitionProgram): Promise<RecognitionProgram> {
  requireRewardsInstitutionalAuthority()
  const [program] = await db
    .insert(recognitionPrograms)
    .values({
      ...data,
      updatedAt: new Date(),
    })
    .returning()

  return program
}

/**
 * Get program by ID
 */
export async function getProgramById(
  programId: string,
  orgId: string,
): Promise<RecognitionProgram | null> {
  requireRewardsInstitutionalAuthority()
  const program = await db.query.recognitionPrograms.findFirst({
    where: and(eq(recognitionPrograms.id, programId), eq(recognitionPrograms.orgId, orgId)),
  })

  return program || null
}

/**
 * List all programs for an organization
 */
export async function listPrograms(orgId: string): Promise<RecognitionProgram[]> {
  requireRewardsInstitutionalAuthority()
  const programs = await db.query.recognitionPrograms.findMany({
    where: eq(recognitionPrograms.orgId, orgId),
    orderBy: [desc(recognitionPrograms.createdAt)],
  })

  return programs
}

/**
 * Update program
 */
export async function updateProgram(
  programId: string,
  orgId: string,
  data: Partial<NewRecognitionProgram>,
): Promise<RecognitionProgram> {
  requireRewardsInstitutionalAuthority()
  const [updated] = await db
    .update(recognitionPrograms)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(recognitionPrograms.id, programId), eq(recognitionPrograms.orgId, orgId)))
    .returning()

  return updated
}

/**
 * Archive program (soft delete)
 */
export async function archiveProgram(
  programId: string,
  orgId: string,
): Promise<RecognitionProgram> {
  requireRewardsInstitutionalAuthority()
  return updateProgram(programId, orgId, { status: 'archived' })
}

// =====================================================
// Award Types
// =====================================================

/**
 * Create a new award type
 */
export async function createAwardType(
  data: NewRecognitionAwardType,
): Promise<RecognitionAwardType> {
  requireRewardsInstitutionalAuthority()
  const [awardType] = await db
    .insert(recognitionAwardTypes)
    .values({
      ...data,
      updatedAt: new Date(),
    })
    .returning()

  return awardType
}

/**
 * Get award type by ID
 */
export async function getAwardTypeById(
  awardTypeId: string,
  orgId: string,
): Promise<RecognitionAwardType | null> {
  requireRewardsInstitutionalAuthority()
  const awardType = await db.query.recognitionAwardTypes.findFirst({
    where: and(eq(recognitionAwardTypes.id, awardTypeId), eq(recognitionAwardTypes.orgId, orgId)),
  })

  return awardType || null
}

/**
 * List award types for a program
 */
export async function listAwardTypes(
  programId: string,
  orgId: string,
): Promise<RecognitionAwardType[]> {
  requireRewardsInstitutionalAuthority()
  const awardTypes = await db.query.recognitionAwardTypes.findMany({
    where: and(
      eq(recognitionAwardTypes.programId, programId),
      eq(recognitionAwardTypes.orgId, orgId),
    ),
    orderBy: [desc(recognitionAwardTypes.createdAt)],
  })

  return awardTypes
}

/**
 * Update award type
 */
export async function updateAwardType(
  awardTypeId: string,
  orgId: string,
  data: Partial<NewRecognitionAwardType>,
): Promise<RecognitionAwardType> {
  requireRewardsInstitutionalAuthority()
  const [updated] = await db
    .update(recognitionAwardTypes)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(recognitionAwardTypes.id, awardTypeId), eq(recognitionAwardTypes.orgId, orgId)))
    .returning()

  return updated
}
