/**
 * Every place the application writes SQL, with the statement text assembled as far as the source allows (UE-CONV-H-013).
 *
 * A statement is not always one literal. A drizzle `sql` template substitutes values, columns, tables and other fragments; a pg `client.query` takes a
 * string that may be a constant elsewhere in the program; a template may choose between two branches. This reads the program with the TypeScript
 * checker and resolves each part: a value becomes `$n`, a drizzle column becomes `"table"."column"` (the checker carries both names as literal types),
 * a constant is followed to its initializer, a conditional yields both branches. What cannot be resolved (a call that builds SQL at run time, a value
 * interpolated into SQL text) becomes a named hole, so nothing is silently dropped: the judge reports a statement with holes as partial and says why.
 */
import path from 'node:path'
import ts from 'typescript'
import { declarationKeyOf } from './liveness'

export type SiteOrigin = 'prod' | 'script' | 'e2e' | 'native-test'
export type SiteForm = 'sql-template' | 'string-argument' | 'string-literal'

export interface Variant {
  /** The statement as the server would receive it: `$n` for each bound value. */
  text: string
  /** Why part of it is not known (empty when the text is complete). Each becomes the identifier `__hole__` in `text`. */
  holes: string[]
  parameters: number
}

export interface SqlSite {
  id: string
  /** Relative to the application root, with forward slashes. */
  file: string
  line: number
  /** The top-level declaration the site sits in (`file#name`): what liveness is keyed by. */
  declaration: string
  origin: SiteOrigin
  form: SiteForm
  /** `sql` is drizzle's tag (arrays expand to `($1, $2)`); otherwise bound values travel as they are. */
  drizzle: boolean
  /** The receiver of the `execute`/`query` call that runs it, when it is the direct argument of one: `db`, `tx`, `client`, `platformDb`. */
  executor: string | null
  /** The method this site is an argument of when it is not executed directly: `where`, `orderBy`, `select`, `set`. */
  context: string | null
  /** Drizzle tables named by `.from()`/`.innerJoin()`/`.update()`/... of the builder chain the site is part of: where an unqualified column of a fragment lives. */
  chainTables: string[]
  /** `number` in sql<number>`...`. */
  typeArgument: string | null
  variants: Variant[]
  /** A value was spliced into the SQL text of an untagged template (not bound): the injection surface. */
  interpolated: string[]
  /** The file builds its own schema in an embedded database (PGlite): its statements are judged against that, not against ours. */
  localSchema: boolean
  /** Written for another database engine: the site sits in a branch that tests for it (`if (dbType === 'mssql')`). */
  dialect: string | null
}

export interface ExtractionResult {
  files: number
  sites: SqlSite[]
  skipped: Record<string, number>
}

const MAX_VARIANTS = 8
const MAX_DEPTH = 8
const PARAM = '\u0000'
const HOLE = '__hole__'

const QUERY_METHODS = new Set(['query', 'execute', 'unsafe', 'queryRaw', 'executeRaw', '$queryRaw', '$executeRaw', 'exec', 'queryArray', 'queryObject'])
const TABLE_METHODS = new Set(['from', 'innerJoin', 'leftJoin', 'rightJoin', 'fullJoin', 'crossJoin', 'update', 'delete', 'insert', 'into'])
const DECORATORS = new Set(['mapWith', 'as', 'append', 'inlineParams', 'getSQL', 'if'])
const SQL_START = /^\s*(?:\/\*[\s\S]*?\*\/\s*|--[^\n]*\n\s*)*(?:WITH\b|SELECT\b|INSERT\s+INTO\b|UPDATE\s+[\w".]+\s+SET\b|DELETE\s+FROM\b|MERGE\s+INTO\b)/i
/** A bare string literal is SQL only when it has a statement's structure: English that begins with "Select" ("Select worksite (optional)") must not count. */
const STRUCTURED_START = /^\s*(?:\/\*[\s\S]*?\*\/\s*|--[^\n]*\n\s*)*(?:WITH\s+[\w"]+\s+AS\s*\(|SELECT\b[\s\S]*\bFROM\b|INSERT\s+INTO\b|UPDATE\s+[\w".]+\s+SET\b|DELETE\s+FROM\b|MERGE\s+INTO\b)/i
const FOREIGN_DIALECT = /\b(mssql|azure-sql|sqlserver|mysql|sqlite|oracle)\b/i
const UTILITY_START = /^\s*(?:CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COMMENT\s+ON|COPY|DO|CALL|SET|RESET|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|ANALYZE|VACUUM|LOCK|LISTEN|NOTIFY)\b/i

interface Piece {
  text: string
  holes: string[]
}

interface Context {
  drizzle: boolean
  depth: number
  seen: Set<ts.Node>
  interpolated: string[]
}

const unwrap = (expression: ts.Expression): ts.Expression => {
  let current = expression
  for (;;) {
    if (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isNonNullExpression(current) || ts.isSatisfiesExpression(current) || ts.isTypeAssertionExpression(current)) current = current.expression
    else return current
  }
}

const hole = (reason: string): Piece => ({ text: HOLE, holes: [reason] })
const text = (value: string): Piece => ({ text: value, holes: [] })

function product(left: Piece[], right: Piece[]): Piece[] {
  const out: Piece[] = []
  for (const a of left) {
    for (const b of right) {
      out.push({ text: a.text + b.text, holes: [...a.holes, ...b.holes] })
      if (out.length >= MAX_VARIANTS) return out
    }
  }
  return out
}

function dedupe(pieces: Piece[]): Piece[] {
  const seen = new Set<string>()
  return pieces.filter((piece) => {
    const id = `${piece.text}\u0001${piece.holes.join('|')}`
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

export function finalize(piece: Piece): Variant {
  let parameters = 0
  const rendered = piece.text.replace(/\u0000/g, () => `$${++parameters}`)
  return { text: rendered, holes: [...new Set(piece.holes)], parameters }
}

class Resolver {
  constructor(private readonly checker: ts.TypeChecker) {}

  // ---- symbols ----------------------------------------------------------------------------------------------------------------------------------

  private declarationOf(node: ts.Node): ts.Declaration | undefined {
    let symbol = this.checker.getSymbolAtLocation(node)
    if (!symbol) return undefined
    if (symbol.flags & ts.SymbolFlags.Alias) symbol = this.checker.getAliasedSymbol(symbol)
    return symbol.valueDeclaration ?? symbol.declarations?.[0]
  }

  private constInitializer(node: ts.Node): ts.Expression | undefined {
    const declaration = this.declarationOf(node)
    if (!declaration) return undefined
    if (ts.isVariableDeclaration(declaration) && declaration.initializer && (ts.getCombinedNodeFlags(declaration) & ts.NodeFlags.Const) !== 0) return declaration.initializer
    if (ts.isPropertyAssignment(declaration)) return declaration.initializer
    return undefined
  }

  /** The initializer of the constant an identifier or property access names: where a SQL string held in a variable is actually written. */
  initializerOf(node: ts.Node): ts.Expression | undefined {
    return this.constInitializer(node)
  }

  isDrizzleTag(tag: ts.Expression): boolean {
    const declaration = ts.isIdentifier(tag) ? this.declarationOf(tag) : undefined
    return !!declaration && /[\\/]drizzle-orm[\\/]/.test(declaration.getSourceFile().fileName)
  }

  private literalName(symbol: ts.Symbol | undefined, anchor: ts.Node): string | undefined {
    if (!symbol) return undefined
    const type = this.checker.getTypeOfSymbolAtLocation(symbol, anchor)
    return type.isStringLiteral() ? type.value : undefined
  }

  /** A drizzle column or table: its phantom `_` property carries `name` and `tableName` as literal types. */
  drizzleObject(expression: ts.Expression): { kind: 'column'; table: string; name: string } | { kind: 'table'; name: string; schema?: string } | null {
    const type = this.checker.getNonNullableType(this.checker.getTypeAtLocation(expression))
    const marker = this.checker.getPropertyOfType(type, '_')
    if (!marker) return null
    const inner = this.checker.getTypeOfSymbolAtLocation(marker, expression)
    const name = this.literalName(this.checker.getPropertyOfType(inner, 'name'), expression)
    const tableName = this.literalName(this.checker.getPropertyOfType(inner, 'tableName'), expression)
    if (name && tableName) return { kind: 'column', table: tableName, name }
    if (name && this.checker.getPropertyOfType(inner, 'columns')) return { kind: 'table', name, schema: this.literalName(this.checker.getPropertyOfType(inner, 'schema'), expression) }
    return null
  }

  private isSqlType(expression: ts.Expression): boolean {
    const type = this.checker.getNonNullableType(this.checker.getTypeAtLocation(expression))
    const name = type.symbol?.name ?? ''
    return name === 'SQL' || name === 'Aliased' || !!this.checker.getPropertyOfType(type, 'queryChunks')
  }

  /** A value that travels as a bound parameter, and whether it is an array (drizzle spreads an array into `($1, $2)`). */
  private valueKind(expression: ts.Expression): 'value' | 'array' | null {
    const type = this.checker.getTypeAtLocation(expression)
    const flags = ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike | ts.TypeFlags.BigIntLike | ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never
    const scalar = (candidate: ts.Type, depth = 0): boolean => {
      if (depth > 4) return false
      if (candidate.flags & flags) return true
      if (candidate.isUnion() || candidate.isIntersection()) return candidate.types.every((member) => scalar(member, depth + 1))
      return candidate.symbol?.name === 'Date'
    }
    const isArray = (candidate: ts.Type): boolean => this.checker.isArrayType(candidate) || this.checker.isTupleType(candidate)
    const nonNull = this.checker.getNonNullableType(type)
    if (isArray(nonNull) && this.checker.getTypeArguments(nonNull as ts.TypeReference).every((member) => scalar(member))) return 'array'
    if (nonNull.isUnion() && nonNull.types.every((member) => isArray(member) || scalar(member))) return nonNull.types.some(isArray) ? 'array' : 'value'
    if (scalar(type)) return 'value'
    return null
  }

  // ---- SQL as text ------------------------------------------------------------------------------------------------------------------------------

  /** An expression that is SQL text: a literal, a template, a concatenation, a constant, a conditional. */
  stringOf(expression: ts.Expression, ctx: Context): Piece[] {
    if (ctx.depth > MAX_DEPTH) return [hole('too-deep')]
    const next: Context = { ...ctx, depth: ctx.depth + 1 }
    const e = unwrap(expression)
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return [text(e.text)]
    if (ts.isTemplateExpression(e)) {
      let pieces: Piece[] = [text(e.head.text)]
      for (const span of e.templateSpans) pieces = product(product(pieces, this.interpolate(span.expression, next)), [text(span.literal.text)])
      return pieces
    }
    if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) return product(this.stringOf(e.left, next), this.stringOf(e.right, next))
    if (ts.isConditionalExpression(e)) return dedupe([...this.stringOf(e.whenTrue, next), ...this.stringOf(e.whenFalse, next)])
    if (ts.isTaggedTemplateExpression(e)) return this.tagged(e, next)
    if (ts.isCallExpression(e)) {
      const callee = e.expression
      if (ts.isPropertyAccessExpression(callee)) {
        const name = callee.name.text
        if (name === 'trim' || name === 'trimStart' || name === 'trimEnd') return this.stringOf(callee.expression, next)
        if (name === 'join' && ts.isArrayLiteralExpression(unwrap(callee.expression))) {
          const separator = e.arguments[0] ? this.stringOf(e.arguments[0], next) : [text(',')]
          const items = (unwrap(callee.expression) as ts.ArrayLiteralExpression).elements.map((element) => this.stringOf(element, next)[0] ?? hole('empty'))
          return [items.reduce((accumulated, item, index) => ({ text: accumulated.text + (index ? separator[0].text : '') + item.text, holes: [...accumulated.holes, ...item.holes, ...(index ? separator[0].holes : [])] }), text(''))]
        }
        if (ts.isIdentifier(callee.expression) && callee.expression.text === 'sql' && name === 'raw' && e.arguments[0]) return this.stringOf(e.arguments[0], next)
        if (ts.isIdentifier(callee.expression) && callee.expression.text === 'String' && name === 'raw') return [hole('String.raw')]
      }
      return [hole(`call:${callee.getText().slice(0, 40)}`)]
    }
    if (ts.isIdentifier(e) || ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e)) {
      const initializer = this.constInitializer(ts.isElementAccessExpression(e) ? e.expression : e)
      if (initializer && !ctx.seen.has(initializer)) {
        ctx.seen.add(initializer)
        const resolved = this.stringOf(initializer, next)
        ctx.seen.delete(initializer)
        return resolved
      }
      const type = this.checker.getTypeAtLocation(e)
      if (type.isStringLiteral()) return [text(type.value)]
      if (type.isUnion() && type.types.every((member) => member.isStringLiteral())) return type.types.map((member) => text((member as ts.StringLiteralType).value))
      return [hole(`dynamic:${e.getText().slice(0, 40)}`)]
    }
    return [hole(`expression:${ts.SyntaxKind[e.kind]}`)]
  }

  /** A `${value}` inside an untagged template: spliced into the SQL text, not bound. */
  private interpolate(expression: ts.Expression, ctx: Context): Piece[] {
    const e = unwrap(expression)
    const resolved = this.stringOf(e, ctx)
    if (resolved.every((piece) => piece.holes.length === 0)) return resolved
    const type = this.checker.getNonNullableType(this.checker.getTypeAtLocation(e))
    if (type.flags & ts.TypeFlags.NumberLike) return [text('1')]
    if (type.flags & ts.TypeFlags.BooleanLike) return [text('true')]
    ctx.interpolated.push(e.getText().slice(0, 60))
    return [hole(`interpolated:${e.getText().slice(0, 40)}`)]
  }

  // ---- drizzle's sql tag ------------------------------------------------------------------------------------------------------------------------

  tagged(node: ts.TaggedTemplateExpression, ctx: Context): Piece[] {
    const drizzle = ts.isIdentifier(node.tag) ? this.isDrizzleTag(node.tag) : false
    const inner: Context = { ...ctx, drizzle, depth: ctx.depth + 1 }
    if (inner.depth > MAX_DEPTH) return [hole('too-deep')]
    const template = node.template
    if (ts.isNoSubstitutionTemplateLiteral(template)) return [text(template.text)]
    let pieces: Piece[] = [text(template.head.text)]
    for (const span of template.templateSpans) pieces = product(product(pieces, this.substitution(span.expression, inner)), [text(span.literal.text)])
    return dedupe(pieces)
  }

  /** What one `${...}` of a `sql` template contributes. */
  private substitution(expression: ts.Expression, ctx: Context): Piece[] {
    if (ctx.depth > MAX_DEPTH) return [hole('too-deep')]
    const next: Context = { ...ctx, depth: ctx.depth + 1 }
    const e = unwrap(expression)
    if (ts.isTaggedTemplateExpression(e)) return this.tagged(e, next)
    if (ts.isConditionalExpression(e)) return dedupe([...this.substitution(e.whenTrue, next), ...this.substitution(e.whenFalse, next)])
    if (ts.isBinaryExpression(e)) {
      const operator = e.operatorToken.kind
      if (operator === ts.SyntaxKind.AmpersandAmpersandToken) return dedupe([...this.substitution(e.right, next), text('')])
      if (operator === ts.SyntaxKind.QuestionQuestionToken || operator === ts.SyntaxKind.BarBarToken) return dedupe([...this.substitution(e.left, next), ...this.substitution(e.right, next)])
    }
    if (e.kind === ts.SyntaxKind.UndefinedKeyword || (ts.isIdentifier(e) && e.text === 'undefined')) return [text('')]
    if (ts.isCallExpression(e)) {
      const callee = e.expression
      if (ts.isPropertyAccessExpression(callee)) {
        const name = callee.name.text
        const owner = callee.expression
        if (ts.isIdentifier(owner) && owner.text === 'sql') {
          if (name === 'raw' && e.arguments[0]) return this.stringOf(e.arguments[0], next)
          if (name === 'empty') return [text('')]
          if (name === 'identifier' && e.arguments[0]) return this.stringOf(e.arguments[0], next).map((piece) => ({ text: `"${piece.text}"`, holes: piece.holes }))
          if (name === 'join' && e.arguments[0]) return this.join(e, next)
          if (name === 'placeholder') return [text(PARAM)]
        }
        if (DECORATORS.has(name)) return this.substitution(owner, next)
      }
      if (ts.isIdentifier(callee)) {
        const rendered = this.operator(callee.text, e, next)
        if (rendered) return rendered
      }
    }
    if (ts.isIdentifier(e) || ts.isPropertyAccessExpression(e)) {
      const drizzle = this.drizzleObject(e)
      if (drizzle) return [text(this.render(drizzle))]
      const initializer = this.constInitializer(e)
      if (initializer && this.isSqlType(e) && !ctx.seen.has(initializer)) {
        ctx.seen.add(initializer)
        const resolved = this.substitution(initializer, next)
        ctx.seen.delete(initializer)
        return resolved
      }
    }
    const drizzle = this.drizzleObject(e)
    if (drizzle) return [text(this.render(drizzle))]
    if (this.isSqlType(e)) return [hole(`sql:${e.getText().slice(0, 40)}`)]
    const kind = this.valueKind(e)
    // A function parameter typed `any` or `unknown` may be a column as easily as a value: nothing says which.
    if (kind && ts.isIdentifier(e) && this.isUntypedParameter(e)) return [hole(`untyped-parameter:${e.text}`)]
    if (kind === 'array' && ctx.drizzle) return [text(`(${PARAM}, ${PARAM})`)]
    if (kind) return [text(PARAM)]
    return [hole(`substitution:${e.getText().slice(0, 40)}`)]
  }

  private isUntypedParameter(identifier: ts.Identifier): boolean {
    const declaration = this.declarationOf(identifier)
    if (!declaration || !ts.isParameter(declaration)) return false
    const type = this.checker.getTypeAtLocation(identifier)
    return (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0
  }

  private render(object: { kind: 'column'; table: string; name: string } | { kind: 'table'; name: string; schema?: string }): string {
    if (object.kind === 'column') return `"${object.table}"."${object.name}"`
    return object.schema ? `"${object.schema}"."${object.name}"` : `"${object.name}"`
  }

  private join(call: ts.CallExpression, ctx: Context): Piece[] {
    const list = unwrap(call.arguments[0])
    const separator = call.arguments[1] ? (this.substitution(call.arguments[1], ctx)[0] ?? text('')) : text(', ')
    if (!ts.isArrayLiteralExpression(list)) return [hole('sql.join:dynamic-list')]
    const parts = list.elements.map((element) => this.substitution(element, ctx)[0] ?? text(''))
    return [parts.reduce((accumulated, part, index) => ({ text: accumulated.text + (index ? separator.text : '') + part.text, holes: [...accumulated.holes, ...part.holes, ...(index ? separator.holes : [])] }), text(''))]
  }

  /** The drizzle comparison helpers, rendered as the SQL they produce. */
  private operator(name: string, call: ts.CallExpression, ctx: Context): Piece[] | null {
    const declaration = this.declarationOf(call.expression)
    if (!declaration || !/[\\/]drizzle-orm[\\/]/.test(declaration.getSourceFile().fileName)) return null
    const operand = (argument: ts.Expression | undefined): Piece => (argument ? (this.substitution(argument, ctx)[0] ?? text('')) : text(''))
    const binary: Record<string, string> = { eq: '=', ne: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'LIKE', ilike: 'ILIKE', notLike: 'NOT LIKE', notIlike: 'NOT ILIKE' }
    const join = (left: Piece, middle: string, right: Piece): Piece[] => [{ text: `${left.text} ${middle} ${right.text}`, holes: [...left.holes, ...right.holes] }]
    if (binary[name]) return join(operand(call.arguments[0]), binary[name], operand(call.arguments[1]))
    if (name === 'isNull') return join(operand(call.arguments[0]), 'IS NULL', text(''))
    if (name === 'isNotNull') return join(operand(call.arguments[0]), 'IS NOT NULL', text(''))
    if (name === 'inArray' || name === 'notInArray') return join(operand(call.arguments[0]), name === 'inArray' ? 'IN' : 'NOT IN', { text: `(${PARAM}, ${PARAM})`, holes: [] })
    if (name === 'between') return join(operand(call.arguments[0]), 'BETWEEN', { text: `${operand(call.arguments[1]).text} AND ${operand(call.arguments[2]).text}`, holes: [] })
    if (name === 'and' || name === 'or') {
      const parts = call.arguments.map((argument) => operand(argument)).filter((part) => part.text !== '')
      if (!parts.length) return [text('')]
      return [{ text: `(${parts.map((part) => part.text).join(name === 'and' ? ' AND ' : ' OR ')})`, holes: parts.flatMap((part) => part.holes) }]
    }
    if (name === 'not') return [{ text: `NOT ${operand(call.arguments[0]).text}`, holes: operand(call.arguments[0]).holes }]
    if (name === 'asc' || name === 'desc') return [{ text: `${operand(call.arguments[0]).text} ${name.toUpperCase()}`, holes: operand(call.arguments[0]).holes }]
    return null
  }

  // ---- the builder chain a fragment belongs to ---------------------------------------------------------------------------------------------------

  chainTables(site: ts.Node): string[] {
    let call: ts.Node | undefined = site.parent
    while (call && !ts.isCallExpression(call)) {
      if (ts.isSourceFile(call) || ts.isBlock(call) || ts.isFunctionLike(call)) return []
      call = call.parent
    }
    if (!call || !ts.isCallExpression(call)) return []
    let root: ts.CallExpression = call
    while (ts.isPropertyAccessExpression(root.parent) && root.parent.expression === root && ts.isCallExpression(root.parent.parent)) root = root.parent.parent
    const tables: string[] = []
    let current: ts.Expression = root
    while (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
      if (TABLE_METHODS.has(current.expression.name.text) && current.arguments[0]) {
        const object = this.drizzleObject(current.arguments[0])
        if (object?.kind === 'table') tables.push(object.name)
      }
      current = current.expression.expression
    }
    return [...new Set(tables)].reverse()
  }
}

function originOf(relative: string): SiteOrigin | null {
  if (/^db\/migrations/.test(relative)) return null
  if (/^services\/financial-service\//.test(relative)) return null
  if (/^(nzila-scripts-book-template|mobile|archive|backups|infra|backend)\//.test(relative)) return null
  if (/^(e2e|tests\/e2e)\//.test(relative)) return 'e2e'
  if (/\.postgres\.test\.tsx?$/.test(relative)) return 'native-test'
  if (/(\/__tests__\/|\.test\.|\.spec\.|\/__mocks__\/|^__mocks__\/|\.d\.ts$)/.test(relative)) return null
  if (/^scripts\//.test(relative)) return 'script'
  return 'prod'
}

/** Every `.ts`/`.tsx` file under the application root, not only the ones the application's tsconfig compiles: db/queries, services, workers and e2e are excluded from it. */
export function createAppProgram(appRoot: string): ts.Program {
  const configPath = ts.findConfigFile(appRoot, ts.sys.fileExists, 'tsconfig.json')
  if (!configPath) throw new Error(`no tsconfig.json under ${appRoot}`)
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath))
  const everything = ts.sys.readDirectory(appRoot, ['.ts', '.tsx', '.mts'], ['**/node_modules/**', '**/.next/**', '**/.turbo/**', '**/dist/**', '**/db/migrations/**', '**/backend/**', '**/mobile/**', '**/archive/**', '**/backups/**', '**/nzila-scripts-book-template/**'])
  return ts.createProgram(everything, { ...parsed.options, noEmit: true, skipLibCheck: true, incremental: false })
}

export function extractSites(program: ts.Program, appRoot: string): ExtractionResult {
  const checker = program.getTypeChecker()
  const resolver = new Resolver(checker)
  const root = appRoot.replace(/\\/g, '/')
  const sites: SqlSite[] = []
  const skipped: Record<string, number> = {}
  const skip = (reason: string): void => {
    skipped[reason] = (skipped[reason] ?? 0) + 1
  }
  let files = 0

  // A SQL string held in a constant is judged where it is used; the constant itself is not a second site.
  const consumed = new Set<ts.Node>()
  for (const source of program.getSourceFiles()) {
    const name = source.fileName.replace(/\\/g, '/')
    if (source.isDeclarationFile || name.includes('/node_modules/') || !name.startsWith(`${root}/`)) continue
    const collect = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && QUERY_METHODS.has(node.expression.name.text) && node.arguments.length) {
        const first = unwrap(node.arguments[0])
        if (ts.isIdentifier(first) || ts.isPropertyAccessExpression(first)) {
          const initializer = resolver.initializerOf(first)
          if (initializer) consumed.add(initializer)
        }
      }
      ts.forEachChild(node, collect)
    }
    collect(source)
  }

  for (const source of program.getSourceFiles()) {
    const name = source.fileName.replace(/\\/g, '/')
    // The program also holds the JSON it imports (translation catalogs): prose, not SQL.
    if (source.isDeclarationFile || name.includes('/node_modules/') || !name.startsWith(`${root}/`) || !/\.(m?tsx?)$/.test(name)) continue
    const relative = name.slice(root.length + 1)
    const origin = originOf(relative)
    if (!origin) {
      skip(/(__tests__|\.test\.|\.spec\.|__mocks__)/.test(relative) ? 'unit-test-file' : 'out-of-scope-file')
      continue
    }
    files += 1
    const localSchema = /@electric-sql\/pglite|new PGlite\(/.test(source.text)

    const executorOf = (node: ts.Node): { executor: string | null; context: string | null } => {
      let child: ts.Node = node
      let parent = node.parent
      while (parent && (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent) || ts.isNonNullExpression(parent) || (ts.isPropertyAccessExpression(parent) && parent.expression === child && DECORATORS.has(parent.name.text)) || (ts.isCallExpression(parent) && parent.expression === child))) {
        child = parent
        parent = parent.parent
      }
      if (parent && ts.isCallExpression(parent) && parent.arguments.includes(child as ts.Expression) && ts.isPropertyAccessExpression(parent.expression)) {
        const method = parent.expression.name.text
        return QUERY_METHODS.has(method) ? { executor: parent.expression.expression.getText().slice(0, 40), context: method } : { executor: null, context: method }
      }
      if (parent && ts.isPropertyAssignment(parent)) {
        let object: ts.Node | undefined = parent.parent
        while (object && !ts.isCallExpression(object)) object = object.parent
        if (object && ts.isCallExpression(object) && ts.isPropertyAccessExpression(object.expression)) return { executor: null, context: `${object.expression.name.text}-field` }
      }
      return { executor: null, context: null }
    }

    const add = (node: ts.Node, form: SiteForm, pieces: Piece[], drizzle: boolean, interpolated: string[], typeArgument: string | null, receiver?: string): void => {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart())
      const found = executorOf(node)
      // For `client.query('...')` the site is the call itself, so the executor is its receiver.
      const executor = receiver ?? found.executor
      const context = receiver ? null : found.context
      sites.push({
        id: `${relative}:${line + 1}`,
        file: relative,
        line: line + 1,
        declaration: declarationKeyOf(node, relative),
        origin,
        form,
        drizzle,
        executor,
        context,
        chainTables: form === 'sql-template' ? resolver.chainTables(node) : [],
        typeArgument,
        variants: dedupe(pieces).map(finalize),
        interpolated,
        localSchema,
        dialect: dialectOf(node),
      })
    }

    /** `if (dbType === 'mssql') { ...site... }`: the branch is for that engine, whatever the program's default. */
    const dialectOf = (node: ts.Node): string | null => {
      let child: ts.Node = node
      for (let parent = node.parent; parent && !ts.isSourceFile(parent); child = parent, parent = parent.parent) {
        let condition: ts.Node | undefined
        if (ts.isIfStatement(parent) && parent.thenStatement === child) condition = parent.expression
        else if (ts.isConditionalExpression(parent) && parent.whenTrue === child) condition = parent.condition
        else if (ts.isCaseClause(parent)) condition = parent.expression
        const found = condition ? FOREIGN_DIALECT.exec(condition.getText()) : null
        if (found && !/postgres/i.test(condition!.getText())) return found[1].toLowerCase()
      }
      return null
    }

    const roots = (node: ts.Node): void => {
      if (ts.isTaggedTemplateExpression(node) && ts.isIdentifier(node.tag) && node.tag.text === 'sql') {
        const interpolated: string[] = []
        const pieces = resolver.tagged(node, { drizzle: false, depth: 0, seen: new Set(), interpolated })
        add(node, 'sql-template', pieces, resolver.isDrizzleTag(node.tag), interpolated, node.typeArguments?.[0]?.getText() ?? null)
        return
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && QUERY_METHODS.has(node.expression.name.text) && node.arguments.length) {
        const first = unwrap(node.arguments[0])
        const isRaw = ts.isCallExpression(first) && ts.isPropertyAccessExpression(first.expression) && ts.isIdentifier(first.expression.expression) && first.expression.expression.text === 'sql' && first.expression.name.text === 'raw'
        const object = ts.isObjectLiteralExpression(first) ? first.properties.find((property): property is ts.PropertyAssignment => ts.isPropertyAssignment(property) && property.name.getText() === 'text') : undefined
        const candidate = object ? object.initializer : isRaw ? (first as ts.CallExpression).arguments[0] : first
        if (candidate && !(ts.isTaggedTemplateExpression(candidate))) {
          const type = checker.getTypeAtLocation(candidate)
          const stringLike = ts.isStringLiteral(candidate) || ts.isNoSubstitutionTemplateLiteral(candidate) || ts.isTemplateExpression(candidate) || ts.isBinaryExpression(candidate) || ts.isIdentifier(candidate) || ts.isPropertyAccessExpression(candidate) || ts.isConditionalExpression(candidate) || ts.isCallExpression(candidate)
          if (stringLike && (type.flags & ts.TypeFlags.StringLike || type.flags & ts.TypeFlags.Any || type.isUnion() || type.isStringLiteral())) {
            const interpolated: string[] = []
            const pieces = resolver.stringOf(candidate, { drizzle: false, depth: 0, seen: new Set(), interpolated })
            if (pieces.some((piece) => SQL_START.test(piece.text) || (UTILITY_START.test(piece.text) && piece.holes.length === 0))) {
              if (pieces.every((piece) => !SQL_START.test(piece.text))) skip('utility-statement')
              else {
                add(node, 'string-argument', pieces, false, interpolated, null, node.expression.expression.getText().slice(0, 40))
                for (const argument of node.arguments.slice(1)) ts.forEachChild(argument, roots)
                return
              }
            } else skip('not-sql')
          }
        }
      }
      if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) && !consumed.has(node)) {
        const head = ts.isTemplateExpression(node) ? node.head.text : node.text
        if (head.length > 24 && STRUCTURED_START.test(head) && !/^\s*(?:import|export)\b/.test(head)) {
          const interpolated: string[] = []
          const pieces = resolver.stringOf(node, { drizzle: false, depth: 0, seen: new Set(), interpolated })
          add(node, 'string-literal', pieces, false, interpolated, null)
          return
        }
      }
      ts.forEachChild(node, roots)
    }
    roots(source)
  }
  return { files, sites, skipped }
}

export { SQL_START, UTILITY_START, HOLE }
