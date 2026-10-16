import { sqlTokens } from '../../../../scripts/ue/close-w4t-named-types'
import { ProvisioningError } from './governed-provisioning'
import { replayHash } from './post-w4p-replay'
import type { FakeReplayPolicy, FakeReplayTable } from './replay-fake-catalog'

// This closed oracle interprets only the five preserved, read-only source programs.
const sourcePrograms = new Set([
  'b26b226039cfead245baf6ade72844925bcd7c69828562de03dade10b0f9982b',
  '539739fa496a5090d9d01bb07a19b8f4d49e040ed1b072577966385441444c91',
  '699e9e3997ccc38eba7ed6b135903e7303b081bcce2d2d70a968f90acf7883a8',
  '727b60930ada02d5d23e9d018d2724bf14ce5a0496f68e81a52889ad05a69b74',
  'c76b362e90edc24d33fa6d3a6c4b990f70243111d046b9cae2e106939e7816bf',
])
export function fakeGuardIlike(source: string | null, pattern: string): boolean | null {
  if (source === null) return null
  if ([...source, ...pattern].some((char) => char.charCodeAt(0) > 127) || pattern.includes('\\'))
    throw new ProvisioningError('FAKE_GUARD_COLLATION_OR_ESCAPE_UNSUPPORTED')
  const regex = [...pattern]
    .map((char) =>
      char === '%' ? '.*' : char === '_' ? '.' : char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('')
  return new RegExp(`^${regex}$`, 'is').test(source)
}
export function applyFakeGuardSource(
  source: string,
  environment: {
    publicTable(name: string): FakeReplayTable | null
    policies: readonly FakeReplayPolicy[]
  },
) {
  if (!sourcePrograms.has(replayHash(source)))
    throw new ProvisioningError('FAKE_GUARD_UNFROZEN_SOURCE')
  const tokens = sqlTokens(source)
  const code = tokens
    .map((token) =>
      token.kind === 'STRING' ? JSON.stringify(token.value) : token.value.toUpperCase(),
    )
    .join(' ')
  const literalsUntil = (start: number, close: string) => {
    const values: string[] = []
    let depth = 1
    for (let index = start; index < tokens.length; index++) {
      const token = tokens[index]
      if (token.value === (close === ']' ? '[' : '(')) depth++
      if (token.value === close && --depth === 0) return values
      if (token.value !== close && token.kind === 'STRING') values.push(token.value)
    }
    throw new ProvisioningError('FAKE_GUARD_ARRAY_REQUIRED')
  }
  const array = (name: string) => {
    const declaration = tokens.findIndex(
      (token, index) =>
        token.kind === 'WORD' &&
        token.value.toUpperCase() === name &&
        tokens[index + 1]?.value.toUpperCase() === 'TEXT',
    )
    if (declaration < 0) return []
    const opening = tokens.findIndex(
      (token, index) =>
        index > declaration &&
        token.value === '[' &&
        tokens[index - 1]?.value.toUpperCase() === 'ARRAY',
    )
    if (opening < 0) throw new ProvisioningError('FAKE_GUARD_ARRAY_REQUIRED')
    return literalsUntil(opening + 1, ']')
  }
  const queryList = (name: string) => {
    const start = tokens.findIndex(
      (token, index) =>
        token.value.toUpperCase() === name &&
        (tokens[index + 1]?.value.toUpperCase() === 'IN' || tokens[index + 1]?.value === '='),
    )
    if (start < 0) return []
    const opening = tokens.findIndex(
      (token, index) => index > start && (token.value === '[' || token.value === '('),
    )
    if (opening < 0) throw new ProvisioningError('FAKE_GUARD_ARRAY_REQUIRED')
    return literalsUntil(opening + 1, tokens[opening].value === '[' ? ']' : ')')
  }
  const targets = array('TARGET_TABLES'),
    parents = array('PARENT_TABLES')
  const requireRelations =
    code.includes('RAISE EXCEPTION') &&
    !code.includes('RAISE NOTICE') &&
    code.includes('FOREACH T IN ARRAY TARGET_TABLES')
  if (requireRelations)
    for (const name of [...targets, ...parents])
      if (!environment.publicTable(name))
        throw new ProvisioningError('FAKE_GUARD_REQUIRED_RELATION_ABSENT')
  const columnPairs = array('PRESENT_COLS')
  if (columnPairs.length % 2) throw new ProvisioningError('FAKE_GUARD_COLUMN_PAIRS_REQUIRED')
  for (let index = 0; index < columnPairs.length; index += 2) {
    const table = environment.publicTable(columnPairs[index])
    if (table && !table.columns.some((column) => column.name === columnPairs[index + 1]))
      throw new ProvisioningError('FAKE_GUARD_REQUIRED_COLUMN_ABSENT')
  }
  for (let index = 0; index < tokens.length; index++) {
    if (
      tokens[index].value.toUpperCase() !== 'TABLE_NAME' ||
      tokens[index + 1]?.value !== '=' ||
      tokens[index + 2]?.kind !== 'STRING' ||
      tokens[index + 4]?.value.toUpperCase() !== 'COLUMN_NAME'
    )
      continue
    const name = tokens[index + 2].value,
      column = tokens[index + 6]
    if (column?.kind !== 'STRING') throw new ProvisioningError('FAKE_GUARD_COLUMN_REQUIRED')
    const table = environment.publicTable(name)
    if (table && !table.columns.some((field) => field.name === column.value))
      throw new ProvisioningError('FAKE_GUARD_REQUIRED_COLUMN_ABSENT')
  }
  const patterns = tokens.flatMap((token, index) =>
    token.value.toUpperCase() === 'ILIKE' && tokens[index + 1]?.kind === 'STRING'
      ? [tokens[index + 1].value]
      : [],
  )
  const tables = targets.length ? targets : queryList('TABLENAME')
  const names = queryList('POLICYNAME')
  const commandGuard = code.includes('R . CMD < > EXPECTED_CMD')
  for (const policy of environment.policies) {
    if (!tables.includes(policy.table)) continue
    if (patterns.length) {
      if (patterns.every((pattern) => fakeGuardIlike(policy.using_expression, pattern) === true))
        throw new ProvisioningError('FAKE_GUARD_SOURCE_PROHIBITION')
    } else if (policy.schema === 'public' && names.includes(policy.name)) {
      const role =
        policy.name === 'ue_system_full_access' ? 'union_eyes_system' : 'union_eyes_runtime'
      const commands: Record<string, string> = {
        select: 'r',
        insert: 'a',
        update: 'w',
        delete: 'd',
      }
      const command =
        commands[/^ue_org_isolation_(select|insert|update|delete)$/.exec(policy.name)?.[1] ?? ''] ??
        '*'
      if (
        policy.roles.length !== 1 ||
        policy.roles[0] !== role ||
        (commandGuard && policy.command !== command)
      )
        throw new ProvisioningError('FAKE_GUARD_POLICY_CONFLICT')
    }
  }
}
