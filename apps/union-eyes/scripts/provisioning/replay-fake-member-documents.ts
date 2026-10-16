import { sqlTokens } from '../../../../scripts/ue/close-w4t-named-types'
import { ProvisioningError } from './governed-provisioning'
import { replayHash } from './post-w4p-replay'
import type { FakeReplayTable } from './replay-fake-catalog'

export function fakeMemberDocumentGroups(documents: FakeReplayTable, members: FakeReplayTable) {
  for (const table of [documents, members])
    if (!table.rowCountVisible) throw new ProvisioningError('FAKE_COMPLETE_ROW_VISIBILITY_REQUIRED')
  for (const [table, names] of [
    [documents, ['id', 'user_id', 'organization_id']],
    [members, ['user_id', 'organization_id']],
  ] as const) {
    for (const name of names) {
      if (!table.columns.some((column) => column.name === name))
        throw new ProvisioningError('FAKE_COLUMN_REQUIRED')
      if (
        table.rows.some(
          (row) =>
            !Object.hasOwn(row, name) || (typeof row[name] !== 'string' && row[name] !== null),
        )
      )
        throw new ProvisioningError('FAKE_ROW_COLUMN_REQUIRED')
    }
  }
  const user = documents.columns.find((column) => column.name === 'user_id')!
  const memberUser = members.columns.find((column) => column.name === 'user_id')!
  if (
    user.type_schema !== 'pg_catalog' ||
    memberUser.type_schema !== 'pg_catalog' ||
    user.type_kind !== 'b' ||
    memberUser.type_kind !== 'b' ||
    user.type_name !== memberUser.type_name ||
    !['uuid', 'text', 'varchar', 'int4', 'int8'].includes(user.type_name)
  )
    throw new ProvisioningError('FAKE_BACKFILL_USER_EQUALITY_UNSUPPORTED')
  const nullRows = documents.rows.filter((row) => row.organization_id === null)
  const groups = new Map<string | null, Set<string>>()
  for (const row of nullRows) {
    const id = typeof row.id === 'string' ? row.id : null
    const organizations = groups.get(id) ?? new Set<string>()
    for (const member of members.rows)
      if (
        row.user_id !== null &&
        member.user_id === row.user_id &&
        typeof member.organization_id === 'string'
      )
        organizations.add(member.organization_id)
    groups.set(id, organizations)
  }
  return {
    nullRows,
    groups,
    zero: [...groups.values()].filter((group) => group.size === 0).length,
    multiple: [...groups.values()].filter((group) => group.size > 1).length,
  }
}
export function applyFakeMemberDocumentSource(
  source: string,
  environment: {
    publicTable(name: string): FakeReplayTable | null
    resolveTable(name: string): FakeReplayTable
    execute(source: string): void
    validateUpdate(table: FakeReplayTable, organization: string): void
  },
) {
  if (replayHash(source) !== '32f8b632fb11db40437bd9d9f063e30a7ff54fe7ecdeb938736697e685d6775b')
    throw new ProvisioningError('FAKE_MEMBER_DOCUMENTS_UNFROZEN_SOURCE')
  if (!environment.publicTable('member_documents')) return
  const tokens = sqlTokens(source)
  for (let index = 0; index < tokens.length; index++) {
    if (!['ALTER', 'CREATE'].includes(tokens[index].value.toUpperCase())) continue
    const end = tokens.findIndex((token, position) => position > index && token.value === ';')
    if (end < 0) throw new ProvisioningError('FAKE_BACKFILL_DDL_REQUIRED')
    environment.execute(source.slice(tokens[index].start, tokens[end].end))
    index = end
  }
  const documents = environment.resolveTable('member_documents'),
    members = environment.resolveTable('organization_members')
  const observed = fakeMemberDocumentGroups(documents, members)
  if (observed.zero || observed.multiple)
    throw new ProvisioningError('FAKE_BACKFILL_SOURCE_INVARIANT_VIOLATED')
  const target = documents.columns.find((column) => column.name === 'organization_id')!,
    input = members.columns.find((column) => column.name === 'organization_id')!
  if (
    target.type_schema === 'pg_catalog' &&
    target.type_kind === 'b' &&
    target.type_name === 'uuid' &&
    input.type_schema === 'pg_catalog' &&
    input.type_kind === 'b' &&
    ['text', 'varchar'].includes(input.type_name)
  )
    throw new ProvisioningError(
      `FAKE_BACKFILL_NATIVE_ASSIGNMENT_TYPE_MISMATCH:pg_catalog.${input.type_name}->pg_catalog.uuid`,
    )
  if (
    target.type_schema !== input.type_schema ||
    target.type_name !== input.type_name ||
    target.type_kind !== input.type_kind
  )
    throw new ProvisioningError('FAKE_BACKFILL_NATIVE_ASSIGNMENT_UNSUPPORTED')
  const updates: { row: FakeReplayTable['rows'][number]; organization: string }[] = []
  for (const row of observed.nullRows) {
    const matches = members.rows.filter(
      (member) => row.user_id !== null && member.user_id === row.user_id,
    )
    if (!matches.length) continue
    const choices = new Set(matches.map((member) => member.organization_id))
    if (choices.size !== 1 || typeof matches[0].organization_id !== 'string')
      throw new ProvisioningError('FAKE_BACKFILL_NONDETERMINISTIC_UPDATE_SOURCE')
    const organization = matches[0].organization_id
    environment.validateUpdate(documents, organization)
    updates.push({ row, organization })
  }
  for (const { row, organization } of updates) row.organization_id = organization
}
