export interface CreatorAccessInput {
  createdBy: string | null | undefined
  userId: string
  /** Current primary representative of the matter. */
  unionRepId: string | null | undefined
  /** Whether the caller acts as a representative (staff-level mandate) in this organization. */
  callerIsRepresentative: boolean
}

/**
 * Creating a matter is not a standing mandate over it. A member who filed it always keeps their own
 * view. A representative who created it keeps access only while they are still the primary
 * representative or none is assigned; reassignment ends it.
 */
export function creatorRetainsAccess(input: CreatorAccessInput): boolean {
  if (!input.createdBy || input.createdBy !== input.userId) return false
  if (!input.callerIsRepresentative) return true
  return !input.unionRepId || input.unionRepId === input.userId
}
