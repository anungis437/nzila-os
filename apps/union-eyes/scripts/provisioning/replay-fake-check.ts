import { sqlTokens } from '../../../../scripts/ue/close-w4t-named-types'
import { ProvisioningError } from './governed-provisioning'
import type { FakeReplayColumn } from './replay-fake-catalog'
export function parseFakeCheckSource(
  source: string,
  columns: readonly FakeReplayColumn[],
  enumMembers: (schema: string, name: string) => readonly string[] | null,
) {
  const tokens = sqlTokens(source)
  let index = 0
  const used = new Set<string>()
  const fail = (): never => {
    throw new ProvisioningError('FAKE_CHECK_SOURCE_UNSUPPORTED')
  }
  const take = (value: string) => {
    const token = tokens[index]
    if (token?.kind === 'WORD' && token.value.toUpperCase() === value) {
      index++
      return true
    }
    return false
  }
  const symbol = (value: string) => {
    if (tokens[index++]?.value !== value) fail()
  }
  const id = () => {
    const token = tokens[index++]
    if (!token || !['WORD', 'IDENTIFIER'].includes(token.kind)) return fail()
    return token.kind === 'WORD' ? token.value.toLowerCase() : token.value
  }
  const operand = (): { column: FakeReplayColumn } | { literal: string } => {
    if (tokens[index]?.value === '(') {
      symbol('(')
      const result = operand()
      symbol(')')
      return result
    }
    if (tokens[index]?.kind === 'STRING') return { literal: tokens[index++].value }
    const name = id(),
      column = columns.find((column) => column.name === name)
    if (!column) fail()
    used.add(name)
    return { column: column! }
  }
  const atom = (): void => {
    if (tokens[index]?.value === '(') {
      symbol('(')
      expression()
      symbol(')')
      return
    }
    const left = operand()
    if (!('column' in left)) return fail()
    if (take('IS')) {
      take('NOT')
      if (!take('NULL')) fail()
      return
    }
    let operator: string
    if (tokens[index]?.value === '>') {
      symbol('>')
      operator = '>'
    } else {
      symbol('<')
      symbol('>')
      operator = '<>'
    }
    const right = operand(),
      column = left.column
    if ('column' in right) {
      if (
        column.type_schema !== right.column.type_schema ||
        column.type_name !== right.column.type_name ||
        column.type_kind !== right.column.type_kind
      )
        fail()
      if (
        operator !== '>' ||
        column.type_schema !== 'pg_catalog' ||
        !['timestamp', 'timestamptz', 'int4', 'int8', 'numeric'].includes(column.type_name)
      )
        fail()
    } else {
      if (
        operator !== '<>' ||
        column.type_kind !== 'e' ||
        !enumMembers(column.type_schema, column.type_name)?.includes(right.literal)
      )
        fail()
    }
  }
  const and = () => {
    atom()
    while (take('AND')) atom()
  }
  const expression = () => {
    and()
    while (take('OR')) and()
  }
  let name: string | null = null
  if (take('CONSTRAINT')) name = id()
  if (!take('CHECK')) fail()
  const opening = tokens[index]
  symbol('(')
  expression()
  const closing = tokens[index]
  symbol(')')
  if (index !== tokens.length || !opening || !closing) fail()
  return { name, expression: source.slice(opening.end, closing.start).trim(), columns: [...used] }
}
