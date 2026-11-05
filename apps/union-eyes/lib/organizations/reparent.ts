import { eq, sql } from 'drizzle-orm'
import { organizations } from '@/db/schema-organizations'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { MAX_HIERARCHY_DEPTH } from '@/lib/utils/hierarchy-validation'

/**
 * Moving an organization under another parent.
 *
 * `hierarchy_path` lists an organization's ancestors (root first) and `hierarchy_level` its depth, and the ancestors, descendants and
 * path reads follow them while the children read follows `parent_id`. A parent change that wrote only `parent_id` left the two
 * disagreeing, for the organization and for everything beneath it. The move below recomputes both for the organization (returned for
 * the caller's own update) and rewrites every descendant's path and level, after checking that the new parent exists, is not the
 * organization or one of its descendants, and that no branch would end up deeper than the maximum.
 */
export type ReparentRefusalKind = 'parent-not-found' | 'cycle' | 'too-deep' | 'too-many-descendants'

export class ReparentRefusal extends Error {
  constructor(readonly kind: ReparentRefusalKind, message: string) {
    super(message)
    this.name = 'ReparentRefusal'
  }
}

export const MAX_REPARENTED_DESCENDANTS = 2000

export interface ReparentPlan {
  previousParentId: string | null
  hierarchyPath: string[]
  hierarchyLevel: number
  descendantsRepointed: number
}

export async function repointHierarchy(tx: RLSTx, organizationId: string, newParentId: string | null): Promise<ReparentPlan> {
  const [current] = await tx
    .select({ parentId: organizations.parentId })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1)

  let path: string[] = []
  let level = 0
  if (newParentId) {
    if (newParentId === organizationId) throw new ReparentRefusal('cycle', 'An organization cannot be its own parent')
    const [parent] = await tx
      .select({ id: organizations.id, hierarchyPath: organizations.hierarchyPath, hierarchyLevel: organizations.hierarchyLevel })
      .from(organizations)
      .where(eq(organizations.id, newParentId))
      .limit(1)
    if (!parent) throw new ReparentRefusal('parent-not-found', `Parent organization not found: ${newParentId}`)
    if ((parent.hierarchyPath ?? []).includes(organizationId)) {
      throw new ReparentRefusal('cycle', 'The new parent is a descendant of this organization')
    }
    path = [...(parent.hierarchyPath ?? []), parent.id]
    level = (parent.hierarchyLevel ?? 0) + 1
  }

  const descendants = await tx
    .select({ id: organizations.id, hierarchyPath: organizations.hierarchyPath })
    .from(organizations)
    .where(sql`${organizationId}::text = ANY(${organizations.hierarchyPath}) AND ${organizations.id} <> ${organizationId}`)
    .limit(MAX_REPARENTED_DESCENDANTS + 1)
  if (descendants.length > MAX_REPARENTED_DESCENDANTS) {
    throw new ReparentRefusal('too-many-descendants', `More than ${MAX_REPARENTED_DESCENDANTS} descendants would have to be repointed`)
  }

  const moved = descendants.map((d) => {
    const old = d.hierarchyPath ?? []
    const below = old.slice(old.indexOf(organizationId) + 1)
    const hierarchyPath = [...path, organizationId, ...below]
    return { id: d.id, hierarchyPath, hierarchyLevel: path.length + 1 + below.length }
  })
  const deepest = Math.max(path.length, ...moved.map((m) => m.hierarchyPath.length))
  if (deepest > MAX_HIERARCHY_DEPTH) {
    throw new ReparentRefusal('too-deep', `Hierarchy depth ${deepest} would exceed maximum ${MAX_HIERARCHY_DEPTH}`)
  }

  for (const m of moved) {
    await tx
      .update(organizations)
      .set({ hierarchyPath: m.hierarchyPath, hierarchyLevel: m.hierarchyLevel, updatedAt: new Date() })
      .where(eq(organizations.id, m.id))
  }

  return { previousParentId: current?.parentId ?? null, hierarchyPath: path, hierarchyLevel: level, descendantsRepointed: moved.length }
}
