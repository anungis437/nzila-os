import type { CatalogReader } from './platform-baseline-promotion'
import type { compileColumnDefinition } from './replay-create-inspection'
import { replayDigest } from './post-w4p-replay'
import { originalRelationQueries } from './replay-original-relation'

export const resolvedDdlTypeQuery =
  'SELECT n.nspname AS schema,t.typname AS name,t.oid::text AS oid FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace WHERE t.oid=pg_catalog.to_regtype($1)'

export async function inspectSourceDdlType(
  reader: CatalogReader,
  type: ReturnType<typeof compileColumnDefinition>['type'],
) {
  const rows = await reader.query(originalRelationQueries.type, [type.schema, type.name])
  const row = rows[0]
  if (
    rows.length !== 1 ||
    row === null ||
    typeof row !== 'object' ||
    !('kind' in row) ||
    row.kind !== (type.enum ? 'e' : 'b') ||
    !('oid' in row) ||
    typeof row.oid !== 'string' ||
    !/^[1-9]\d*$/.test(row.oid) ||
    (type.enum &&
      (!('members' in row) || replayDigest(row.members) !== replayDigest(type.enum.members)))
  )
    return {
      state: 'PRECONDITION_MISSING' as const,
      denial: 'SOURCE_TYPE_SHAPE_NOT_PROVEN',
      type,
      rows,
    }
  const resolution = await reader.query(resolvedDdlTypeQuery, [type.display])
  if (
    replayDigest(resolution) !==
    replayDigest([{ schema: type.schema, name: type.name, oid: row.oid }])
  )
    return {
      state: 'PRECONDITION_MISSING' as const,
      denial: 'SOURCE_TYPE_RESOLUTION_NOT_PROVEN',
      type,
      rows,
      resolution,
    }
  return { state: 'QUALIFIED' as const, denial: null, type, rows, resolution }
}
