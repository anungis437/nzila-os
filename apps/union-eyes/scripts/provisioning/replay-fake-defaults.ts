import { sqlTokens } from '../../../../scripts/ue/close-w4t-named-types'
import { ProvisioningError } from './governed-provisioning'
import { replayHash } from './post-w4p-replay'
import type { FakeReplayTable } from './replay-fake-catalog'

const programs = new Set([
  '67d342cb6f20172649acc7a5fbfd82a3efa6268d0ba2c2a1c19e7709c83d8125',
  'a4079e84e41b51569bfce93e57b1567d8b501b42d44519cf5b3ce138088d3be0',
  '07d0bbe6f1e8bb9eef1e4912fa239b59ab156024699ac0a6829531f488a356ae',
])
export function applyFakeDefaultSource(
  source: string,
  environment: {
    actor: string
    publicTable(name: string): FakeReplayTable | null
    resolveTable(name: string): FakeReplayTable
    nativeGenerator(): void
    enumMembers(schema: string, name: string): readonly string[] | null
    updateCategory(table: FakeReplayTable): void
  },
) {
  if (!programs.has(replayHash(source))) throw new ProvisioningError('FAKE_DEFAULT_UNFROZEN_SOURCE')
  const tokens = sqlTokens(source)
  const guarded = tokens.some((token) => token.value.toUpperCase() === 'COLUMN_DEFAULT')
  if (guarded) {
    const table = environment.publicTable('organization_members')
    const column = table?.columns.find((column) => column.name === 'id')
    if (!column || column.default_expression !== null) return
  }
  for (let index = 0; index < tokens.length; index++) {
    if (
      tokens[index].value.toUpperCase() !== 'ALTER' ||
      tokens[index + 1]?.value.toUpperCase() !== 'TABLE'
    )
      continue
    const name = tokens[index + 2].value,
      columnName = tokens[index + 5].value
    const value = tokens[index + 8]
    const terminal = tokens.findIndex((token, position) => position > index && token.value === ';')
    const end = tokens.findIndex(
      (token, position) => position > terminal && token.value.toUpperCase() === 'END',
    )
    const catches = tokens
      .slice(
        guarded
          ? tokens.findIndex((token) => token.value.toUpperCase() === 'EXCEPTION')
          : terminal + 1,
        guarded ? tokens.length : end,
      )
      .filter((token) => token.kind === 'WORD')
      .map((token) => token.value.toLowerCase())
    const table = environment.resolveTable(name)
    if (table.schema !== 'public')
      throw new ProvisioningError('FAKE_DEFAULT_SEARCH_PATH_UNSUPPORTED')
    if (table.owner !== environment.actor)
      throw new ProvisioningError('FAKE_DEFAULT_OWNER_REQUIRED')
    const column = table.columns.find((column) => column.name === columnName)
    if (!column) {
      if (catches.includes('undefined_column')) continue
      throw new ProvisioningError('FAKE_DEFAULT_UNCAUGHT_UNDEFINED_COLUMN')
    }
    if (column.identity !== '' || column.generated !== '')
      throw new ProvisioningError('FAKE_DEFAULT_GENERATED_COLUMN_UNSUPPORTED')
    let expression: string
    if (value.kind === 'WORD' && value.value.toLowerCase() === 'gen_random_uuid') {
      environment.nativeGenerator()
      if (
        column.type_schema !== 'pg_catalog' ||
        !['uuid', 'text', 'varchar'].includes(column.type_name)
      ) {
        if (catches.includes('datatype_mismatch')) continue
        throw new ProvisioningError('FAKE_DEFAULT_UNCAUGHT_DATATYPE_MISMATCH')
      }
      expression =
        column.type_name === 'uuid'
          ? 'gen_random_uuid()'
          : `(gen_random_uuid())::${column.postgres_type}`
    } else {
      if (value.kind !== 'STRING' || value.value !== 'full_member')
        throw new ProvisioningError('FAKE_DEFAULT_LITERAL_UNSUPPORTED')
      if (
        !(column.type_schema === 'pg_catalog' && ['text', 'varchar'].includes(column.type_name)) &&
        !(
          column.type_kind === 'e' &&
          environment.enumMembers(column.type_schema, column.type_name)?.includes(value.value)
        )
      )
        throw new ProvisioningError('FAKE_DEFAULT_UNCAUGHT_INVALID_TEXT_REPRESENTATION')
      expression = "'full_member'"
    }
    const width = /^character varying\((\d+)\)$/.exec(column.postgres_type)
    if (width && Number(width[1]) < (value.kind === 'STRING' ? 11 : 36))
      throw new ProvisioningError('FAKE_DEFAULT_UNCAUGHT_STRING_DATA_RIGHT_TRUNCATION')
    column.default_expression = expression
  }
  if (tokens.some((token) => token.kind === 'WORD' && token.value.toUpperCase() === 'UPDATE')) {
    const table = environment.resolveTable('organization_members')
    if (table.owner !== environment.actor)
      throw new ProvisioningError('FAKE_DEFAULT_OWNER_REQUIRED')
    if (table.columns.some((column) => column.name === 'member_category'))
      environment.updateCategory(table)
  }
}
