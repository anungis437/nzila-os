import { sqlTokens } from '../../../../scripts/ue/close-w4t-named-types'
import { ProvisioningError } from './governed-provisioning'
import type { FakeReplayTable } from './replay-fake-catalog'

export interface FakeRetrofitEnvironment {
  publicTable(name: string): FakeReplayTable | null
  resolveTable(name: string): FakeReplayTable
  execute(source: string): void
}

/** Parses source control flow independently; no production procedural contract is consumed. */
export function applyFakeRetrofitSource(source: string, environment: FakeRetrofitEnvironment) {
  const tokens = sqlTokens(source)
  let index = 0
  const fail = (): never => {
    throw new ProvisioningError('FAKE_RETROFIT_SOURCE_UNSUPPORTED')
  }
  const take = (word: string) => {
    const token = tokens[index]
    if (token?.kind === 'WORD' && token.value.toUpperCase() === word) {
      index++
      return true
    }
    return false
  }
  const need = (word: string) => {
    if (!take(word)) fail()
  }
  const symbol = (value: string) => {
    if (tokens[index++]?.value !== value) fail()
  }
  const id = () => {
    const token = tokens[index++]
    if (!token || !['WORD', 'IDENTIFIER'].includes(token.kind)) return fail()
    return token.kind === 'WORD' ? token.value.toLowerCase() : token.value
  }
  const literal = () => {
    const token = tokens[index++]
    if (token?.kind !== 'STRING') return fail()
    return token.value
  }
  const endIf = () => {
    need('END')
    need('IF')
    symbol(';')
  }
  need('DO')
  need('BEGIN')
  need('IF')
  need('TO_REGCLASS')
  symbol('(')
  const guard = /^public\.([a-z_][a-z0-9_]*)$/.exec(literal())
  if (!guard) return fail()
  const table = guard[1]
  symbol(')')
  need('IS')
  need('NULL')
  need('THEN')
  need('RAISE')
  need('NOTICE')
  literal()
  symbol(';')
  need('RETURN')
  symbol(';')
  endIf()
  const branches: { column: string; commands: string[] }[] = []
  while (take('IF')) {
    need('NOT')
    need('EXISTS')
    symbol('(')
    need('SELECT')
    symbol('1')
    need('FROM')
    need('INFORMATION_SCHEMA')
    symbol('.')
    need('COLUMNS')
    need('WHERE')
    need('TABLE_SCHEMA')
    symbol('=')
    if (literal() !== 'public') fail()
    need('AND')
    need('TABLE_NAME')
    symbol('=')
    if (literal() !== table) fail()
    need('AND')
    need('COLUMN_NAME')
    symbol('=')
    const column = literal()
    symbol(')')
    need('THEN')
    need('IF')
    need('EXISTS')
    symbol('(')
    need('SELECT')
    symbol('1')
    need('FROM')
    if (id() !== table) fail()
    need('LIMIT')
    symbol('1')
    symbol(')')
    need('THEN')
    need('RAISE')
    need('EXCEPTION')
    literal()
    symbol(';')
    endIf()
    const commands: string[] = []
    let added = false
    while (tokens[index]?.value.toUpperCase() !== 'END') {
      const start = tokens[index]?.start
      if (start === undefined) fail()
      if (take('ALTER')) {
        need('TABLE')
        if (id() !== table) fail()
        need('ADD')
        if (take('COLUMN')) {
          if (id() !== column || added) fail()
          added = true
        } else {
          need('CONSTRAINT')
          id()
          need('FOREIGN')
          need('KEY')
          symbol('(')
          if (id() !== column) fail()
          symbol(')')
          need('REFERENCES')
        }
      } else {
        need('CREATE')
        need('INDEX')
        id()
        need('ON')
        if (id() !== table) fail()
        need('USING')
        need('BTREE')
        symbol('(')
        if (id() !== column) fail()
        symbol(')')
      }
      while (tokens[index] && tokens[index].value !== ';') {
        if (
          tokens[index].kind === 'WORD' &&
          ['DO', 'BEGIN', 'END', 'IF', 'SELECT', 'UPDATE', 'DROP', 'EXECUTE'].includes(
            tokens[index].value.toUpperCase(),
          )
        )
          fail()
        if (
          tokens[index].value.toUpperCase() === 'DELETE' &&
          tokens[index - 1]?.value.toUpperCase() !== 'ON'
        )
          fail()
        index++
      }
      const terminal = tokens[index]
      symbol(';')
      if (!terminal) fail()
      commands.push(source.slice(start, terminal.end))
    }
    if (!added || !commands.length) fail()
    endIf()
    branches.push({ column, commands })
  }
  need('END')
  symbol(';')
  if (
    index !== tokens.length ||
    !branches.length ||
    new Set(branches.map((branch) => branch.column)).size !== branches.length
  )
    fail()
  const publicTable = environment.publicTable(table)
  if (!publicTable) return
  for (const branch of branches) {
    if (publicTable.columns.some((column) => column.name === branch.column)) continue
    const actual = environment.resolveTable(table)
    if (actual.schema !== 'public')
      throw new ProvisioningError('FAKE_RETROFIT_SEARCH_PATH_UNSUPPORTED')
    if (!actual.rowCountVisible)
      throw new ProvisioningError('FAKE_RETROFIT_ROW_VISIBILITY_REQUIRED')
    if (actual.rows.length) throw new ProvisioningError('FAKE_RETROFIT_NONEMPTY_WITHOUT_AUTHORITY')
    for (const command of branch.commands) environment.execute(command)
  }
}
