/**
 * Calendar days a screen reads in the reader's time zone (UE-CONV-H-029). Pure: the findings come from one file's source text.
 *
 * A due date, an effective date, an expiry, a pay period is a day somebody recorded. It arrives as "2026-04-01" (a `date` column) or as the UTC-midnight instant a day was stored
 * as, and `new Date(value)` reads both as midnight UTC, so a reader in any Canadian time zone sees the day before: a contract effective on 1 April reads "March 2026", a deadline is
 * shown a day early, and an item is marked overdue the evening before it is due. No unit test sees it: the test machine is in UTC. Three kinds, read from the syntax tree of a UI module:
 *   - DAY_IN_LOCAL_ZONE: a value named like a day (a `date` column of the schema, or any key ending in Date or Deadline) formatted in the reader's zone: `toLocaleDateString`,
 *     `getDate` and the other local getters, date-fns `format` and its siblings, `Intl.DateTimeFormat().format` without `timeZone: 'UTC'`. A format that shows a time of day is an
 *     instant, not a day, and is left alone.
 *   - DAY_VIA_LOCAL_FORMATTER: such a value handed to a function (in the file, or imported from another module of the app) that formats its argument in the reader's zone.
 *   - DAY_COMPARED_TO_NOW: `new Date(day) < new Date()`, or the difference of the two, which makes a day end at midnight UTC: seven in the evening in Toronto.
 * What reads a day as the day it is: `recordedDay`, `formatDay`, `isDayPast` and `daysUntilDay` of @/lib/client/day, a `timeZone: 'UTC'` format, a date written with a local time
 * (`${day}T00:00:00`), and any string operation on the text ("2026-04-01".slice(0, 10)). A finding that has to stay as written is accepted by name, with the reason, in ACCEPTED of
 * scripts/runtime/day-render-census.ts. The server's own formatting (e-mails, PDFs, month grouping in lib/) is not read here: the reader's zone is not its zone. The Node server pins its
 * zone to UTC in instrumentation.ts, where every stored day is anchored, and tooling/contract-tests/ue-server-time-zone.test.ts holds that pin.
 */
import ts from 'typescript'

export type DayRenderKind = 'DAY_IN_LOCAL_ZONE' | 'DAY_VIA_LOCAL_FORMATTER' | 'DAY_COMPARED_TO_NOW'

export interface DayRender {
  kind: DayRenderKind
  line: number
  key: string
  text: string
}

export interface DayContext {
  /** Keys that name a calendar day: the `date` columns of the schema (a key ending in Date or Deadline is one too). */
  dayKeys: ReadonlySet<string>
  /** Names, in this file, of functions imported from other modules of the app that format their first argument in the reader's zone. */
  formatters?: ReadonlySet<string>
}

const DAY_NAME = /(?:Date|Deadline|PeriodStart|PeriodEnd)$|^deadline$/
// The global itself and the functions that work on dates (getDate, formatDate, parseDate...) are named like a day without being one.
const NOT_A_DAY = /^(?:Date|(?:get|set|format|parse|to|is|has|add|sub|compute|calc|calculate|build|make|handle|on|use|fetch|load|validate|normalize|convert)[A-Z]\w*)$/
const SAFE_CONVERTERS = new Set(['recordedDay', 'formatDay', 'isDayPast', 'daysUntilDay'])
const STRING_METHODS = new Set(['slice', 'substring', 'substr', 'split', 'startsWith', 'endsWith', 'includes', 'indexOf', 'replace', 'replaceAll', 'padStart', 'padEnd', 'trim', 'localeCompare', 'charAt', 'match', 'toUpperCase', 'toLowerCase'])
const LOCAL_FIELDS = new Set(['getFullYear', 'getMonth', 'getDate', 'getDay'])
const TIME_OPTIONS = new Set(['hour', 'minute', 'second', 'timeStyle', 'hour12', 'hourCycle', 'fractionalSecondDigits', 'dayPeriod'])
const DATE_FNS_ZONE_FREE = new Set(['isValid', 'toDate', 'compareAsc', 'compareDesc', 'isEqual', 'getTime', 'getUnixTime', 'fromUnixTime', 'min', 'max', 'closestTo', 'isDate', 'parse', 'parseISO'])
const TIME_TOKENS = /[HhmsSaBbpKkxXOzZ]/
const NOW_NAME = /^(?:now|nowMs|currentTime)$/
const LOCAL_TIME_SUFFIX = /^T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/

export const isDayKey = (name: string, dayKeys: ReadonlySet<string>): boolean => !NOT_A_DAY.test(name) && (dayKeys.has(name) || DAY_NAME.test(name))

export function isUiModule(file: string): boolean {
  return /\.tsx?$/.test(file) && /^(?:app|components|contexts)\//.test(file) && !/^app\/api\//.test(file) && !/\.(?:test|spec|stories)\./.test(file) && !/\.d\.ts$/.test(file)
}

type RefOf = (node: ts.Node) => string | null

interface Env {
  dateFns: ReadonlyMap<string, string>
  intlFormatters: ReadonlyMap<string, readonly ts.Expression[]>
}

const unwrap = (node: ts.Expression): ts.Expression => (ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node) || ts.isAsExpression(node) ? unwrap(node.expression) : node)

const isDateConstructor = (node: ts.Node): node is ts.NewExpression => ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Date'

/** `new Date(`${day}T00:00:00`)`: a date written with a local time is a local date, and reads as the day it names. */
function isLocalTimeDate(node: ts.Node): boolean {
  if (!isDateConstructor(node) || node.arguments?.length !== 1) return false
  const argument = unwrap(node.arguments[0])
  if (ts.isTemplateExpression(argument)) return LOCAL_TIME_SUFFIX.test(argument.templateSpans[argument.templateSpans.length - 1].literal.text)
  return ts.isBinaryExpression(argument) && ts.isStringLiteralLike(argument.right) && LOCAL_TIME_SUFFIX.test(argument.right.text)
}

function isNamePosition(node: ts.Node): boolean {
  const parent = node.parent
  if (!parent) return false
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return true
  if ((ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent) || ts.isPropertyDeclaration(parent) || ts.isMethodDeclaration(parent)) && parent.name === node) return true
  if (ts.isBindingElement(parent) && (parent.propertyName === node || parent.name === node)) return true
  if ((ts.isParameter(parent) || ts.isVariableDeclaration(parent)) && parent.name === node) return true
  return ts.isJsxAttribute(parent) || ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent) || ts.isLabeledStatement(parent)
}

const isStringReceiver = (node: ts.Node): boolean => !!node.parent && ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node && STRING_METHODS.has(node.parent.name.text)

/** The first reference inside `node` that `ref` recognises, not looking inside what reads a day as the day it is. */
function findRef(node: ts.Node, ref: RefOf): string | null {
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && SAFE_CONVERTERS.has(node.expression.text)) return null
  if (isLocalTimeDate(node)) return null
  if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isIdentifier(node)) && !isNamePosition(node)) {
    const hit = ref(node)
    if (hit && !isStringReceiver(node)) return hit
  }
  let found: string | null = null
  ts.forEachChild(node, (child) => {
    if (found === null) found = findRef(child, ref)
  })
  return found
}

const dayRefOf = (dayKeys: ReadonlySet<string>): RefOf => (node) => {
  if (ts.isPropertyAccessExpression(node)) return isDayKey(node.name.text, dayKeys) ? node.name.text : null
  if (ts.isElementAccessExpression(node)) return ts.isStringLiteralLike(node.argumentExpression) && isDayKey(node.argumentExpression.text, dayKeys) ? node.argumentExpression.text : null
  // A bare name is a day only when the schema says the column is one: `selectedDate` and `newDate` are the Date a screen keeps for itself, not a recorded day.
  return ts.isIdentifier(node) && dayKeys.has(node.text) && !NOT_A_DAY.test(node.text) ? node.text : null
}

function objectLiterals(args: readonly ts.Expression[]): ts.ObjectLiteralExpression[] {
  return args.map(unwrap).filter(ts.isObjectLiteralExpression)
}

/** True when the options pin the zone to UTC (the day is then read as the UTC day it was stored as) or show a time of day (an instant, not a day). */
function pinsOrShowsTime(args: readonly ts.Expression[]): boolean {
  for (const options of objectLiterals(args)) {
    for (const property of options.properties) {
      if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) continue
      const name = property.name.getText()
      if (TIME_OPTIONS.has(name)) return true
      if (name === 'timeZone' && ts.isPropertyAssignment(property) && ts.isStringLiteralLike(property.initializer) && /^(?:UTC|Etc\/UTC|GMT)$/.test(property.initializer.text)) return true
    }
  }
  return false
}

/** The constructor arguments when `expression` is an `Intl.DateTimeFormat`, or a variable holding one. */
function intlArguments(expression: ts.Expression, env: Env): readonly ts.Expression[] | undefined {
  const inner = unwrap(expression)
  if (ts.isIdentifier(inner)) return env.intlFormatters.get(inner.text)
  if ((ts.isNewExpression(inner) || ts.isCallExpression(inner)) && ts.isPropertyAccessExpression(inner.expression) && ts.isIdentifier(inner.expression.expression) && inner.expression.expression.text === 'Intl' && inner.expression.name.text === 'DateTimeFormat') return inner.arguments ?? []
  return undefined
}

const patternShowsTime = (pattern: ts.Expression | undefined): boolean => !!pattern && ts.isStringLiteralLike(pattern) && TIME_TOKENS.test(pattern.text)

/** The operands of a call that formats or reads fields of a date in the reader's zone; null for any other call. */
function sinkOperands(call: ts.CallExpression, env: Env): readonly ts.Node[] | null {
  const callee = call.expression
  if (ts.isPropertyAccessExpression(callee)) {
    const name = callee.name.text
    if (name === 'toLocaleDateString') return pinsOrShowsTime(call.arguments) ? null : [callee.expression]
    if (LOCAL_FIELDS.has(name)) return [callee.expression]
    if (name === 'format') {
      const options = intlArguments(callee.expression, env)
      if (options) return pinsOrShowsTime(options) ? null : call.arguments
    }
    return null
  }
  if (ts.isIdentifier(callee)) {
    const imported = env.dateFns.get(callee.text)
    if (imported && !DATE_FNS_ZONE_FREE.has(imported) && !(imported === 'format' && patternShowsTime(call.arguments[1]))) return call.arguments
  }
  return null
}

function buildEnv(source: ts.SourceFile): Env {
  const dateFns = new Map<string, string>()
  const intlFormatters = new Map<string, readonly ts.Expression[]>()
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && /^date-fns(?:\/|$)/.test(node.moduleSpecifier.text)) {
      const bindings = node.importClause?.namedBindings
      if (bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements) dateFns.set(element.name.text, (element.propertyName ?? element.name).text)
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const options = intlArguments(node.initializer, { dateFns, intlFormatters })
      if (options && !ts.isIdentifier(unwrap(node.initializer))) intlFormatters.set(node.name.text, options)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return { dateFns, intlFormatters }
}

type FunctionLike = ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression

function functionsOf(source: ts.SourceFile): Array<{ name: string; fn: FunctionLike }> {
  const found: Array<{ name: string; fn: FunctionLike }> = []
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) found.push({ name: node.name.text, fn: node })
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const init = unwrap(node.initializer)
      if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) found.push({ name: node.name.text, fn: init })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

function containsSink(root: ts.Node, ref: RefOf, env: Env): boolean {
  let hit = false
  const visit = (node: ts.Node): void => {
    if (hit) return
    if (ts.isCallExpression(node)) {
      const operands = sinkOperands(node, env)
      if (operands && operands.some((operand) => findRef(operand, ref) !== null)) {
        hit = true
        return
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(root)
  return hit
}

/** True when the function takes a date as its first argument and formats it in the reader's zone. */
function formatsFirstArgumentLocally(fn: FunctionLike, env: Env): boolean {
  const first = fn.parameters[0]
  if (!first || !ts.isIdentifier(first.name) || !fn.body) return false
  const tainted = new Set([first.name.text])
  const mentionsTainted = (node: ts.Node): boolean => findRef(node, (candidate) => (ts.isIdentifier(candidate) && tainted.has(candidate.text) ? candidate.text : null)) !== null
  for (let pass = 0; pass < 3; pass += 1) {
    const visit = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && mentionsTainted(node.initializer)) tainted.add(node.name.text)
      ts.forEachChild(node, visit)
    }
    visit(fn.body)
  }
  return containsSink(fn.body, (candidate) => (ts.isIdentifier(candidate) && tainted.has(candidate.text) ? candidate.text : null), env)
}

/** The functions of a module that format their first argument in the reader's zone: `local` is every one by name, `exported` the names other modules import. */
export function zoneFormatters(file: string, text: string): { local: Set<string>; exported: Set<string> } {
  const local = new Set<string>()
  const exported = new Set<string>()
  if (!/\.tsx?$/.test(file) || !/toLocaleDateString|DateTimeFormat|date-fns|getFullYear|getMonth|getDate|getDay/.test(text)) return { local, exported }
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const env = buildEnv(source)
  for (const { name, fn } of functionsOf(source)) if (!SAFE_CONVERTERS.has(name) && formatsFirstArgumentLocally(fn, env)) local.add(name)
  for (const statement of source.statements) {
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined
    const isExported = !!modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    if (isExported && ts.isFunctionDeclaration(statement) && statement.name && local.has(statement.name.text)) exported.add(statement.name.text)
    if (isExported && ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name) && local.has(declaration.name.text)) exported.add(declaration.name.text)
    if (ts.isExportDeclaration(statement) && !statement.moduleSpecifier && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) if (local.has((element.propertyName ?? element.name).text)) exported.add(element.name.text)
    }
  }
  return { local, exported }
}

const isNowExpression = (node: ts.Expression): boolean => {
  const inner = unwrap(node)
  if (isDateConstructor(inner)) return !inner.arguments?.length
  if (ts.isCallExpression(inner) && ts.isPropertyAccessExpression(inner.expression)) return (ts.isIdentifier(inner.expression.expression) && inner.expression.expression.text === 'Date' && inner.expression.name.text === 'now') || (inner.expression.name.text === 'getTime' && isNowExpression(inner.expression.expression))
  return false
}

/** `new Date()`, `Date.now()`, a variable the file sets to one of them, or a parameter named `now`. A `today` that holds a day as text (`todayDay()`) is not the current instant. */
const isNowLike = (node: ts.Expression, nowVars: ReadonlySet<string>): boolean => {
  const inner = unwrap(node)
  return isNowExpression(inner) || (ts.isIdentifier(inner) && (NOW_NAME.test(inner.text) || nowVars.has(inner.text)))
}

function nowVariables(source: ts.SourceFile): Set<string> {
  const names = new Set<string>()
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && isNowExpression(node.initializer)) names.add(node.name.text)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return names
}

/** The day key of what a comparison reads as an instant: `new Date(<day>)`, or a day the screen already holds as a Date or as text, each optionally through `.getTime()`. */
function dateOfDay(node: ts.Expression, ref: RefOf): string | null {
  const inner = unwrap(node)
  if (ts.isCallExpression(inner) && ts.isPropertyAccessExpression(inner.expression) && (inner.expression.name.text === 'getTime' || inner.expression.name.text === 'valueOf')) return dateOfDay(inner.expression.expression, ref)
  if (isDateConstructor(inner)) {
    if (isLocalTimeDate(inner)) return null
    for (const argument of inner.arguments ?? []) {
      const key = findRef(argument, ref)
      if (key !== null) return key
    }
    return null
  }
  return ts.isPropertyAccessExpression(inner) || ts.isElementAccessExpression(inner) || ts.isIdentifier(inner) ? ref(inner) : null
}

const COMPARISONS = new Set<ts.SyntaxKind>([ts.SyntaxKind.LessThanToken, ts.SyntaxKind.LessThanEqualsToken, ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.GreaterThanEqualsToken, ts.SyntaxKind.MinusToken])

export function findDayRenders(file: string, text: string, context: DayContext): DayRender[] {
  if (!isUiModule(file)) return []
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const env = buildEnv(source)
  const formatters = new Set<string>([...zoneFormatters(file, text).local, ...(context.formatters ?? [])])
  const ref = dayRefOf(context.dayKeys)
  const nowVars = nowVariables(source)
  const found: DayRender[] = []
  const add = (node: ts.Node, kind: DayRenderKind, key: string): void => {
    found.push({ kind, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, key, text: node.getText().replace(/\s+/g, ' ').trim().slice(0, 110) })
  }
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const operands = sinkOperands(node, env)
      const sinkKey = operands ? operands.map((operand) => findRef(operand, ref)).find((key) => key !== null) ?? null : null
      if (sinkKey !== null) add(node, 'DAY_IN_LOCAL_ZONE', sinkKey)
      else if (ts.isIdentifier(node.expression) && formatters.has(node.expression.text)) {
        const key = node.arguments.map((argument) => findRef(argument, ref)).find((candidate) => candidate !== null) ?? null
        if (key !== null) add(node, 'DAY_VIA_LOCAL_FORMATTER', key)
      }
    }
    if (ts.isBinaryExpression(node) && COMPARISONS.has(node.operatorToken.kind)) {
      const left = dateOfDay(node.left, ref)
      const right = dateOfDay(node.right, ref)
      const key = left !== null && isNowLike(node.right, nowVars) ? left : right !== null && isNowLike(node.left, nowVars) ? right : null
      if (key !== null) add(node, 'DAY_COMPARED_TO_NOW', key)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}
