/**
 * @nzila/org — Canonical organisation context & identity types
 *
 * The single source of truth for org-scoped context shapes.
 * Every domain vertical must extend or implement these types.
 *
 * @module @nzila/org
 */

export {
  type OrgContext,
  type DbContext,
  isOrgContext,
  isDbContext,
  toDbContext,
  fromEntityId,
  fromEntityIdDb,
} from './context/types'
