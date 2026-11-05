/**
 * What a screen reads out of the JSON a route answers with (UE-CONV-H-027). Syntax only, one file at a time, like the rest of the frontend census.
 *
 * For a request the screen makes (`fetch('/api/x')`, `fetch(...).then((r) => r.json())`), this finds the variable the answer is bound to and the keys read from it:
 *   - at the root: `json.items`, `const { items } = json`;
 *   - under `data`, where the framework puts what a handler returns (`json.data.items`, `const rows = json.data; rows.items`, `const { data: { items } } = json`);
 *   - through the idiom that tolerates both (`const payload = json.data ?? json`), whose reads count at either level;
 *   - through the helpers of lib/client/api-envelope.ts, which throw unless the answer is the shape they name (`envelopeRows(json)` needs a list at `data.data`, `envelopeRow(json)` a
 *     record there, `envelopeData(json)` a record at `data`), so a call is itself a read and what is taken out of its result is read at the level it came from;
 *   - into a function of the application the answer is handed to (`readAccount(await res.json())`), in the same file or an imported one: what that function reads off its parameter is
 *     read, at the level the argument stood for.
 * A read written as an alternative (`json.items ?? json.data?.items`, `a.id || a.data?.id`) is ONE read that is satisfied by any of its keys. A binding made where the answer
 * is an error (`if (!res.ok) { const err = await res.json() ... }`) is not read: an error answer has another shape. What the syntax cannot follow (a helper that fetches for the
 * screen, a value returned or stored away, a function it cannot find) is not read, never guessed.
 */
import ts from 'typescript'
import { unwrap } from './request-body'

/** Where in the JSON of an answer a value is: `root` is the whole body, `data` is what the handler returned, and a member of that is written as a path (`data.data`, `data.pagination`). */
export type Level = string

export const ROOT: Level = 'root'
/** The level of a member of the value at `level`: `deeper('root', 'data')` is `data`, `deeper('data', 'data')` is `data.data`. */
export const deeper = (level: Level, ...steps: string[]): Level => [...(level === ROOT ? [] : level.split('.')), ...steps].join('.')

export interface ReadKey {
  level: Level
  key: string
}

export interface ResponseRead {
  /** The keys that satisfy the read: one, or several when the screen wrote alternatives. */
  alternatives: ReadKey[]
  line: number
  text: string
  /** The file the read is in: a function the answer is handed to is read where it is written. */
  file: string
}

/** A name the screen gives (a part of) the answer where it says what it expects of it: the name's declaration, whose type is what the screen believes the answer to be. */
export interface DeclaredAnswer {
  /** The levels of the answer the name stands for; more than one when the screen tolerates either. */
  levels: Level[]
  /** The name in its declaration (`const json`, a parameter, `{ data }` of a query, the value of a state). */
  node: ts.Node
  file: string
  line: number
  text: string
}

/** Where the source of an imported module comes from, so a function the answer is handed to can be read in the file that defines it. */
export interface SourceLoader {
  /** The source file the import specifier names, as seen from the file `from`; null when it is not a file of the application. */
  load(from: string, specifier: string): ts.SourceFile | null
}

/** How many functions an answer is followed through. */
const MAX_FOLLOW = 3

/** What a JSON value has anyway: array and object members a screen uses on a list or a map without reading a key of the answer. */
const BUILT_IN = new Set(['length', 'keys', 'entries', 'values', 'toString', 'hasOwnProperty', 'then', 'catch', 'at', 'toJSON', 'constructor'])
/** Methods only a list has: a screen that calls one on the answer, or on its `data`, expects an array there. */
const ARRAY_METHODS = new Set(['map', 'filter', 'forEach', 'find', 'findIndex', 'some', 'every', 'reduce', 'slice', 'concat', 'join', 'includes', 'indexOf', 'sort', 'flat', 'flatMap', 'push'])
/** The key that stands for "this value is used as a list". */
export const AS_LIST = '[]'
/** The key that stands for "this value is used as a record": an object, not a list. */
export const AS_RECORD = '{}'

/** The helpers of lib/client/api-envelope.ts: what each needs of the answer it is given, where (the path below the level of the argument), and whether what it hands back is read on. */
const ENVELOPE_HELPERS: Record<string, { needs: string[]; as?: typeof AS_LIST | typeof AS_RECORD; key?: string; hands: boolean }> = {
  envelopeData: { needs: ['data'], as: AS_RECORD, hands: true },
  envelopeRow: { needs: ['data', 'data'], as: AS_RECORD, hands: true },
  envelopeRows: { needs: ['data', 'data'], as: AS_LIST, hands: false },
  envelopePages: { needs: ['data', 'pagination'], key: 'totalPages', hands: false },
}

/** What reads the message of a failed answer on the screen's behalf: it is handed the body, and nothing it does with it is a read of the screen's. */
const FAILURE_MESSAGE_HELPERS = new Set(['apiErrorMessage'])

interface Binding {
  name: string
  scope: ts.Node
  /** The levels the bound value stands for: the root of the answer, or its `data`, or either (`json.data ?? json`). */
  levels: Level[]
  /** `const { a, b } = await res.json()`: the members are read where the pattern is. */
  pattern?: ts.ObjectBindingPattern
  /** For a name given to `data` (`const rows = json.data`): the node that read `data`, which stands down when something is read out of the name. */
  via?: ts.Node
  /** The answer is a value in an expression, not a name (`readAccount(await res.json())`, `(await res.json()).data`): what that expression is used for is read. */
  value?: ts.Node
  /** How many functions the answer has been handed through to get here. */
  depth?: number
  /** The name in the declaration that gives the answer its name, where there is one: what the screen declares of the answer is the type of it. */
  decl?: ts.Node
}

const isErrorTest = (expression: ts.Expression, positive: boolean): boolean => {
  const text = expression.getText()
  // `!res.ok`, `res.ok === false`, `res.status === 409`, `res.status >= 400` say the answer is a failure; `res.ok`, `res.status === 200`, `res.status < 400` say it is not.
  const failing = /!\s*[\w.]+\.ok\b|\.ok\s*===?\s*false|\.status\s*(?:===?|>=?)\s*[45]\d\d\b/
  const succeeding = /\b[\w.]+\.ok\b|\.status\s*===?\s*2\d\d\b|\.status\s*<\s*[34]\d\d\b/
  return positive ? failing.test(text) : succeeding.test(text) && !/!\s*[\w.]+\.ok\b|\.ok\s*===?\s*false/.test(text)
}

/**
 * Whether the node is inside the branch of an `ok` or `status` test that is taken when the answer is an error. A `catch` counts too unless `catchCounts` is false: it is where a
 * request that threw ends up, which says nothing about the body of an answer.
 */
function inErrorBranch(node: ts.Node, catchCounts = true): boolean {
  for (let current: ts.Node = node; current.parent; current = current.parent) {
    const parent = current.parent
    if (ts.isIfStatement(parent)) {
      if (parent.thenStatement === current && isErrorTest(parent.expression, true)) return true
      if (parent.elseStatement === current && isErrorTest(parent.expression, false)) return true
    }
    if (ts.isConditionalExpression(parent)) {
      if (parent.whenTrue === current && isErrorTest(parent.condition, true)) return true
      if (parent.whenFalse === current && isErrorTest(parent.condition, false)) return true
    }
    // `res.status === 409 && data.tierId`, `res.ok || data.error`: the right side is only reached when the answer is an error.
    if (ts.isBinaryExpression(parent) && parent.right === current) {
      if (parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && isErrorTest(parent.left, true)) return true
      if (parent.operatorToken.kind === ts.SyntaxKind.BarBarToken && isErrorTest(parent.left, false)) return true
    }
    if (catchCounts && ts.isCatchClause(parent)) return true
    if (ts.isFunctionLike(parent) || ts.isSourceFile(parent)) break
  }
  return false
}

const enclosingBlock = (node: ts.Node): ts.Node => {
  for (let current: ts.Node | undefined = node.parent; current; current = current.parent) {
    if (ts.isBlock(current) || ts.isSourceFile(current)) return current
    if (ts.isArrowFunction(current) && !ts.isBlock(current.body)) return current.body
  }
  return node.getSourceFile()
}

const stringKey = (node: ts.Expression | undefined): string | null => (node && ts.isStringLiteralLike(unwrap(node)) ? (unwrap(node) as ts.StringLiteralLike).text : null)

/**
 * Walks up from a promise (or a value) of the answer's JSON to the variable it ends in: through `await`, parentheses, casts, `.catch(...)`, then to a `.then((json) => ...)`
 * callback's parameter or a `const json = ...` declaration.
 */
function bindingOf(start: ts.Node): Binding | null {
  let node: ts.Node = start
  for (;;) {
    const parent: ts.Node | undefined = node.parent
    if (!parent) return null
    if (ts.isAwaitExpression(parent) || ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent) || ts.isNonNullExpression(parent) || ts.isSatisfiesExpression(parent)) {
      node = parent
      continue
    }
    if (ts.isPropertyAccessExpression(parent) && parent.expression === node && ts.isCallExpression(parent.parent) && parent.parent.expression === parent) {
      const method = parent.name.text
      if (method === 'catch' || method === 'finally') {
        node = parent.parent
        continue
      }
      if (method === 'then') {
        const callback = parent.parent.arguments[0] ? unwrap(parent.parent.arguments[0]) : null
        const first = callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) ? callback.parameters[0] : undefined
        if (callback && first && ts.isIdentifier(first.name) && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) return { name: first.name.text, scope: callback.body, levels: ['root'], decl: first.name }
        return null
      }
      // Any other method called on it (`json.filter(...)`) is a read of it where it stands.
      return { name: '', scope: node, levels: ['root'], value: node }
    }
    if (ts.isVariableDeclaration(parent) && parent.initializer === node && ts.isIdentifier(parent.name)) return { name: parent.name.text, scope: enclosingBlock(parent), levels: ['root'], decl: parent.name }
    if (ts.isVariableDeclaration(parent) && parent.initializer === node && ts.isObjectBindingPattern(parent.name)) return { name: '', scope: parent, levels: ['root'], pattern: parent.name }
    if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && parent.right === node && ts.isIdentifier(parent.left)) return { name: parent.left.text, scope: enclosingBlock(parent), levels: ['root'] }
    // Used where it stands: a member taken off it (`(await res.json()).data`) or handed to a function (`readAccount(await res.json())`).
    if ((ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) && parent.expression === node) return { name: '', scope: node, levels: ['root'], value: node }
    if (ts.isCallExpression(parent) && parent.arguments.some((argument) => argument === node)) return { name: '', scope: node, levels: ['root'], value: node }
    // `const [a, b] = await Promise.all([fetch(...).then((r) => r.json()), ...])`: the slot of the array is a name.
    const slot = promiseAllSlot(node)
    if (slot) return { name: slot.name, scope: enclosingBlock(slot.declaration), levels: ['root'], decl: slot.decl }
    return queryDataBinding(node)
  }
}

/** `const [a, b] = await Promise.all([x, y])`: the name the slot that holds `node` is given, the declaration that gives it, and the name in that declaration. */
function promiseAllSlot(node: ts.Node): { name: string; declaration: ts.VariableDeclaration; decl: ts.Node } | null {
  const slot = outer(node)
  const array = slot.parent
  if (!array || !ts.isArrayLiteralExpression(array)) return null
  const index = array.elements.findIndex((element) => element === slot)
  const argument = outer(array)
  const call = argument.parent
  if (index < 0 || !call || !ts.isCallExpression(call) || call.arguments[0] !== argument) return null
  const callee = call.expression
  if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== 'all' || callee.expression.getText() !== 'Promise') return null
  let top: ts.Node = call
  while (top.parent && (ts.isAwaitExpression(top.parent) || ts.isParenthesizedExpression(top.parent) || ts.isAsExpression(top.parent))) top = top.parent
  const declaration = top.parent
  if (!declaration || !ts.isVariableDeclaration(declaration) || declaration.initializer !== top || !ts.isArrayBindingPattern(declaration.name)) return null
  const element = declaration.name.elements[index]
  if (!element || !ts.isBindingElement(element) || element.dotDotDotToken || !ts.isIdentifier(element.name)) return null
  return { name: element.name.text, declaration, decl: element.name }
}

const QUERY_HOOKS = /^use(Suspense|Infinite)?Query$/

/**
 * `useQuery({ queryFn: () => fetch(...).then((r) => r.json()) })`: a query holds what its function returns, and a screen takes it out as the query's `data`
 * (`const { data } = useQuery(...)`, `const { data: rows } = useQuery(...)`); that is the answer itself, whose own `data` is one member further.
 */
function queryDataBinding(node: ts.Node): Binding | null {
  let fn: ts.Node | undefined = node.parent
  if (fn && ts.isReturnStatement(fn)) {
    fn = fn.parent
    while (fn && !ts.isFunctionLike(fn)) fn = fn.parent
  } else if (!(fn && ts.isArrowFunction(fn) && fn.body === node)) return null
  const property = fn?.parent
  if (!property || !ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name) || property.name.text !== 'queryFn') return null
  const options = property.parent
  const call = options.parent
  if (!ts.isObjectLiteralExpression(options) || !ts.isCallExpression(call) || call.arguments[0] !== options) return null
  const hook = unwrap(call.expression)
  if (!ts.isIdentifier(hook) || !QUERY_HOOKS.test(hook.text)) return null
  const declaration = outer(call).parent
  if (!ts.isVariableDeclaration(declaration) || !ts.isObjectBindingPattern(declaration.name)) return null
  const element = declaration.name.elements.find((candidate) => !candidate.dotDotDotToken && (candidate.propertyName ? ts.isIdentifier(candidate.propertyName) && candidate.propertyName.text === 'data' : ts.isIdentifier(candidate.name) && candidate.name.text === 'data'))
  if (!element || !ts.isIdentifier(element.name)) return null
  return { name: element.name.text, scope: enclosingBlock(declaration), levels: [ROOT], decl: element.name }
}

/** The state a setter belongs to: `const [rows, setRows] = useState(...)`, found in the file; `decl` is the name of the value, whose type is what the state is declared to hold. */
function stateOf(source: ts.SourceFile, setter: string): { name: string; declaration: ts.VariableDeclaration; decl: ts.Node } | null {
  let found: { name: string; declaration: ts.VariableDeclaration; decl: ts.Node } | null = null
  const visit = (node: ts.Node): void => {
    if (found) return
    if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) && node.initializer && ts.isCallExpression(unwrap(node.initializer))) {
      const [value, set] = node.name.elements
      const hook = unwrap((unwrap(node.initializer) as ts.CallExpression).expression)
      const hookName = ts.isIdentifier(hook) ? hook.text : ts.isPropertyAccessExpression(hook) ? hook.name.text : ''
      if (hookName === 'useState' && value && set && ts.isBindingElement(value) && ts.isBindingElement(set) && ts.isIdentifier(value.name) && ts.isIdentifier(set.name) && set.name.text === setter) found = { name: value.name.text, declaration: node, decl: value.name }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

/** How many times a setter is called with something that is not a plain reset (`null`, `[]`, `{}` literals, a literal): each is a place the state can come from. */
function sourcesOfState(source: ts.SourceFile, setter: string): number {
  let count = 0
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === setter) {
      const argument = node.arguments[0] ? unwrap(node.arguments[0]) : undefined
      const reset = !argument || ts.isLiteralExpression(argument) || ts.isArrayLiteralExpression(argument) || ts.isObjectLiteralExpression(argument) || argument.kind === ts.SyntaxKind.NullKeyword || argument.kind === ts.SyntaxKind.TrueKeyword || argument.kind === ts.SyntaxKind.FalseKeyword || (ts.isIdentifier(argument) && argument.text === 'undefined')
      if (!reset) count += 1
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return count
}

/**
 * The JSON bindings of the answer of the request whose URL is the node: `.json()` called on the response, or the response's own promise chain. Those taken where the answer is a failure
 * are left out, unless `failure`: reading a failure's body is then what is asked for, and every `.json()` is a binding whose reads are judged one by one.
 */
function bindingsOfRequest(url: ts.Node, failure = false): Binding[] {
  let child: ts.Node = url
  let parent = url.parent
  while (parent && (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent) || ts.isNonNullExpression(parent))) {
    child = parent
    parent = parent.parent
  }
  if (!parent || !ts.isCallExpression(parent) || parent.arguments[0] !== child) return []
  const fetchCall = parent
  const out: Binding[] = []
  const add = (binding: Binding | null): void => {
    if (binding) out.push(binding)
  }
  const wanted = (call: ts.Node): boolean => failure || !inErrorBranch(call)

  // Up from `fetch(...)`: `await`, then either a variable holding the response, or `.json()` / `.then(...)` straight on it.
  let top: ts.Node = fetchCall
  while (top.parent && (ts.isAwaitExpression(top.parent) || ts.isParenthesizedExpression(top.parent) || ts.isAsExpression(top.parent) || ts.isNonNullExpression(top.parent))) top = top.parent
  const holder = top.parent
  if (holder && ts.isPropertyAccessExpression(holder) && holder.expression === top && ts.isCallExpression(holder.parent) && holder.parent.expression === holder) {
    const method = holder.name.text
    if (method === 'json') {
      if (wanted(holder.parent)) add(bindingOf(holder.parent))
    } else if (method === 'then') {
      const callback = holder.parent.arguments[0] ? unwrap(holder.parent.arguments[0]) : null
      if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
        const param = callback.parameters[0]
        const returned = ts.isBlock(callback.body) ? null : callback.body
        // `(r) => r.json()`, `(r) => (r.ok ? r.json() : null)`: what this `then` hands on is the JSON.
        if (param && ts.isIdentifier(param.name) && returned) {
          const paramName = param.name.text
          const handsOnJson = (expression: ts.Expression): boolean => {
            const value = unwrap(expression)
            if (ts.isConditionalExpression(value)) return handsOnJson(value.whenTrue) || handsOnJson(value.whenFalse)
            return ts.isCallExpression(value) && ts.isPropertyAccessExpression(value.expression) && value.expression.name.text === 'json' && value.expression.expression.getText() === paramName
          }
          if (handsOnJson(returned)) add(bindingOf(holder.parent))
        }
      }
    }
    return out
  }
  if (holder && ts.isVariableDeclaration(holder) && holder.initializer === top && ts.isIdentifier(holder.name)) {
    const response = holder.name.text
    const scope = enclosingBlock(holder)
    jsonOf(response, scope)
    return out
  }
  // `const [a, b] = await Promise.all([fetch(...), fetch(...)])`: the response is the name its slot is given.
  const slot = holder && ts.isArrayLiteralExpression(holder) ? promiseAllSlot(top) : null
  if (slot) jsonOf(slot.name, enclosingBlock(slot.declaration))
  return out

  /** Every `.json()` called on the named response in the scope. */
  function jsonOf(response: string, scope: ts.Node): void {
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'json' && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === response && wanted(node)) add(bindingOf(node))
      ts.forEachChild(node, visit)
    }
    visit(scope)
  }
}

interface Collected {
  reads: Array<{ node: ts.Node; keys: ReadKey[] }>
  /** Variables that stand for a level of the answer, to be read in turn. */
  aliases: Binding[]
  /** A value that stands for the levels is handed to the call as its `index`th argument. */
  follow: (call: ts.CallExpression, index: number, levels: Level[]) => boolean
}

/** True when the expression is, ignoring parentheses and `?.`, an identifier of that name. */
const isName = (node: ts.Node, name: string): boolean => {
  const value = ts.isExpression(node) ? unwrap(node) : node
  return ts.isIdentifier(value) && value.text === name
}

/** A value a screen falls back on: `[]`, `{}`, `null`, `undefined`, a literal. */
function isDefaultValue(expression: ts.Expression): boolean {
  const value = unwrap(expression)
  if (ts.isArrayLiteralExpression(value)) return value.elements.length === 0
  if (ts.isObjectLiteralExpression(value)) return value.properties.length === 0
  return ts.isLiteralExpression(value) || value.kind === ts.SyntaxKind.NullKeyword || value.kind === ts.SyntaxKind.TrueKeyword || value.kind === ts.SyntaxKind.FalseKeyword || (ts.isIdentifier(value) && value.text === 'undefined')
}

/** The node with what only dresses it around it (parentheses, casts, `!`, a fallback such as `?? []`): where the value is used is outside them. */
function outer(node: ts.Node): ts.Node {
  let target: ts.Node = node
  for (;;) {
    const parent: ts.Node | undefined = target.parent
    if (!parent) return target
    if (ts.isParenthesizedExpression(parent) || ts.isNonNullExpression(parent) || ts.isAsExpression(parent) || ts.isSatisfiesExpression(parent)) target = parent
    else if (ts.isBinaryExpression(parent) && isChainOperator(parent) && parent.left === target && isDefaultValue(parent.right)) target = parent
    else return target
  }
}

type FunctionNode = ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression

/** The call a value is an argument of, and which argument it is: `readAccount(json)`, `envelopeRows(json as unknown)`. */
function handedTo(node: ts.Node): { call: ts.CallExpression; index: number } | null {
  const target = outer(node)
  const parent = target.parent
  if (parent && ts.isCallExpression(parent)) {
    const index = parent.arguments.findIndex((argument) => argument === target)
    if (index >= 0) return { call: parent, index }
  }
  return null
}

/** The function a name stands for in a file: declared in it, or imported (or re-exported) from another file of the application. */
function functionNamed(source: ts.SourceFile, name: string, loader: SourceLoader | undefined, hops = 0): FunctionNode | null {
  let found: FunctionNode | null = null
  const visit = (node: ts.Node): void => {
    if (found) return
    if (ts.isFunctionDeclaration(node) && node.name?.text === name && node.body) {
      found = node
      return
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer) {
      const value = unwrap(node.initializer)
      if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) {
        found = value
        return
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (found || !loader || hops >= 3) return found
  for (const statement of source.statements) {
    const specifier = ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement) ? statement.moduleSpecifier : undefined
    if (!specifier || !ts.isStringLiteralLike(specifier)) continue
    const clause = ts.isImportDeclaration(statement) ? statement.importClause?.namedBindings : ts.isExportDeclaration(statement) ? statement.exportClause : undefined
    if (!clause || !(ts.isNamedImports(clause) || ts.isNamedExports(clause))) continue
    const element = clause.elements.find((candidate) => candidate.name.text === name)
    if (!element) continue
    const other = loader.load(source.fileName, specifier.text)
    return other ? functionNamed(other, (element.propertyName ?? element.name).text, loader, hops + 1) : null
  }
  return null
}

/** A nested function that declares the name itself reads something else under it. */
function shadows(scope: ts.Node, name: string): ts.Node[] {
  const out: ts.Node[] = []
  const visit = (node: ts.Node): void => {
    if (node !== scope && ts.isFunctionLike(node)) {
      const body = (node as ts.FunctionLikeDeclaration).body
      const declares = node.parameters.some((parameter) => ts.isIdentifier(parameter.name) && parameter.name.text === name) || (body ? declaresConst(body, name) : false)
      if (declares) {
        out.push(node)
        return
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(scope)
  return out
}

function declaresConst(body: ts.Node, name: string): boolean {
  let found = false
  const visit = (node: ts.Node): void => {
    if (found || (ts.isFunctionLike(node) && node !== body)) return
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) found = true
    else ts.forEachChild(node, visit)
  }
  visit(body)
  return found
}

function collect(binding: Binding, loader: SourceLoader | undefined): Collected {
  const reads: Collected['reads'] = []
  const aliases: Binding[] = []
  const skip = shadows(binding.scope, binding.name)
  const inSkipped = (node: ts.Node): boolean => skip.some((fn) => node.pos >= fn.pos && node.end <= fn.end)

  const addRead = (node: ts.Node, key: string, levels: Level[] = binding.levels): void => {
    if (BUILT_IN.has(key)) return
    reads.push({ node, keys: levels.map((level) => ({ level, key: ARRAY_METHODS.has(key) ? AS_LIST : key })) })
  }

  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && node.text === binding.name && !inSkipped(node)) {
      const parent = node.parent
      // The declaration itself, and a property that merely has the name, are not references.
      const isDeclaration = (ts.isVariableDeclaration(parent) && parent.name === node) || (ts.isParameter(parent) && parent.name === node) || (ts.isBindingElement(parent) && parent.name === node)
      const isMember = (ts.isPropertyAccessExpression(parent) && parent.name === node) || (ts.isPropertyAssignment(parent) && parent.name === node)
      if (!isDeclaration && !isMember) reference(node)
    }
    ts.forEachChild(node, visit)
  }

  /** The member of a node (`x.k`, `x?.k`, `x['k']`): the key, and the member expression itself. */
  const memberOf = (node: ts.Node): { key: string; member: ts.Node } | null => {
    const target = outer(node)
    const parent = target.parent
    if (parent && ts.isPropertyAccessExpression(parent) && parent.expression === target) return { key: parent.name.text, member: parent }
    if (parent && ts.isElementAccessExpression(parent) && parent.expression === target) {
      const key = stringKey(parent.argumentExpression)
      return key ? { key, member: parent } : null
    }
    return null
  }

  /**
   * A value is the `index`th argument of a call. An envelope helper reads it (it throws unless the answer is the shape it names) and hands back what it names, which is read in turn; a function
   * of the application is read on its parameter, at the levels the argument stood for. False when the callee is not a function the syntax can find.
   */
  const follow = (call: ts.CallExpression, index: number, levels: Level[], via: ts.Node | undefined): boolean => {
    const callee = unwrap(call.expression)
    if (!ts.isIdentifier(callee)) return false
    if (FAILURE_MESSAGE_HELPERS.has(callee.text)) return true
    const helper = ENVELOPE_HELPERS[callee.text]
    if (helper) {
      if (index !== 0) return true
      const needed = levels.map((level) => deeper(level, ...helper.needs))
      reads.push({ node: call, keys: needed.map((level) => ({ level, key: helper.key ?? helper.as ?? AS_RECORD })) })
      if (helper.hands) reference(call, needed)
      return true
    }
    const depth = (binding.depth ?? 0) + 1
    if (depth > MAX_FOLLOW) return false
    const source = call.getSourceFile()
    const target = functionNamed(source, callee.text, loader)
    if (!target) {
      // `setRows(json.data)`: the state holds the answer, and what is read of it is read where the state is used. A state set from more than one place is not followed: which answer a member belongs to is not known.
      const state = index === 0 ? stateOf(source, callee.text) : null
      if (!state || sourcesOfState(source, callee.text) !== 1) return false
      aliases.push({ name: state.name, scope: enclosingBlock(state.declaration), levels, via, depth, decl: state.decl })
      return true
    }
    const parameter = target.parameters[index]
    if (!target.body || !parameter || parameter.dotDotDotToken) return false
    if (ts.isIdentifier(parameter.name)) aliases.push({ name: parameter.name.text, scope: target.body, levels, via, depth, decl: parameter.name })
    else if (ts.isObjectBindingPattern(parameter.name)) aliases.push({ name: '', scope: target.body, levels, pattern: parameter.name, via, depth })
    else return false
    return true
  }

  const reference = (identifier: ts.Node, levels: Level[] = binding.levels): void => {
    const parent = identifier.parent
    const wrapped = outer(identifier)
    const holder = wrapped.parent
    // `const { a, b: c, data } = json`
    if (ts.isVariableDeclaration(holder) && holder.initializer === wrapped && ts.isObjectBindingPattern(holder.name)) {
      destructure(holder.name, levels)
      return
    }
    // `const data = envelopeData(json)`, `const copy = json`: the name stands for the same value, to be read in turn.
    if (ts.isVariableDeclaration(holder) && holder.initializer === wrapped && ts.isIdentifier(holder.name)) {
      aliases.push({ name: holder.name.text, scope: enclosingBlock(holder), levels, depth: binding.depth, decl: holder.name })
      return
    }
    // `'k' in json`
    if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.InKeyword && parent.right === identifier) {
      const key = stringKey(parent.left)
      if (key) addRead(parent, key, levels)
      return
    }
    const handed = handedTo(identifier)
    if (handed && follow(handed.call, handed.index, levels, undefined)) return
    const member = memberOf(identifier)
    if (!member) return
    // `json.data` is the object a handler returned: its own members are read at the `data` level, through whatever it is named or destructured to. A member read straight
    // off it (`json.data.k`) already says `data` has to be there, so it stands for the read; `data` used as a whole is a read of `data` itself, which lets
    // `json.data || json.items` be one read with two alternatives.
    if (member.key === 'data' && levels.includes(ROOT) && dataAccess(member.member)) return
    addRead(member.member, member.key, levels)
  }

  /** `json.data` was reached: `json.data.k`, `const d = json.data`, `const { k } = json.data`, `readAccount(json.data)`. True when a member read straight off it took over. */
  const dataAccess = (access: ts.Node): boolean => {
    const next = memberOf(access)
    if (next) {
      if (!BUILT_IN.has(next.key)) reads.push({ node: next.member, keys: [{ level: 'data', key: ARRAY_METHODS.has(next.key) ? AS_LIST : next.key }] })
      return true
    }
    const handed = handedTo(access)
    if (handed) {
      follow(handed.call, handed.index, ['data'], access)
      return false
    }
    const target = outer(access)
    const holder = target.parent
    if (holder && ts.isVariableDeclaration(holder) && holder.initializer === target) {
      if (ts.isIdentifier(holder.name)) aliases.push({ name: holder.name.text, scope: enclosingBlock(holder), levels: ['data'], via: access, depth: binding.depth, decl: holder.name })
      else if (ts.isObjectBindingPattern(holder.name)) return destructure(holder.name, ['data'])
    }
    return false
  }

  /** The members a destructuring takes, at the levels the destructured value stands for. True when it took at least one. */
  const destructure = (pattern: ts.ObjectBindingPattern, levels: Level[]): boolean => {
    let took = false
    for (const element of pattern.elements) {
      if (element.dotDotDotToken) continue
      const key = element.propertyName ? (ts.isIdentifier(element.propertyName) || ts.isStringLiteralLike(element.propertyName) ? element.propertyName.text : null) : ts.isIdentifier(element.name) ? element.name.text : null
      if (key === null) continue
      if (key === 'data' && levels.includes('root')) {
        // `data` is read as a whole unless something is taken out of it right here (`{ data: { items } }`); a name given to it stands down later, if something is read from the name.
        const through = ts.isObjectBindingPattern(element.name) ? destructure(element.name, ['data']) : false
        if (ts.isIdentifier(element.name)) aliases.push({ name: element.name.text, scope: enclosingBlock(element), levels: ['data'], via: element, decl: element.name })
        if (!through) reads.push({ node: element, keys: [{ level: 'root', key }] })
        took = true
        continue
      }
      if (!BUILT_IN.has(key)) {
        reads.push({ node: element, keys: levels.map((level) => ({ level, key: ARRAY_METHODS.has(key) ? AS_LIST : key })) })
        took = true
      }
    }
    return took
  }

  if (binding.value) reference(binding.value)
  else if (binding.pattern) destructure(binding.pattern, binding.levels)
  else visit(binding.scope)
  return { reads, aliases, follow: (call, index, levels) => follow(call, index, levels, undefined) }
}

const isChainOperator = (node: ts.BinaryExpression): boolean => node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || node.operatorToken.kind === ts.SyntaxKind.BarBarToken

/** The operands of a `??` / `||` chain, in order. */
function flattenChain(expression: ts.Expression): ts.Expression[] {
  const operands: ts.Expression[] = []
  const flatten = (value: ts.Expression): void => {
    const inner = unwrap(value)
    if (ts.isBinaryExpression(inner) && isChainOperator(inner)) {
      flatten(inner.left)
      flatten(inner.right)
    } else operands.push(inner)
  }
  flatten(expression)
  return operands
}

/** `json.data ?? json`, `json?.data || json`: the value stands for the `data` of the answer or for the answer itself, whether it is given a name or handed to a function. */
function normalizingAlias(binding: Binding, collected: Collected): void {
  const visit = (node: ts.Node): void => {
    const chain = ts.isBinaryExpression(node) && isChainOperator(node) && !(ts.isBinaryExpression(outer(node).parent) && isChainOperator(outer(node).parent as ts.BinaryExpression)) ? node : null
    if (chain) {
      const operands = flattenChain(chain)
      const hasRoot = operands.some((operand) => isName(operand, binding.name))
      const hasData = operands.some((operand) => (ts.isPropertyAccessExpression(operand) && operand.name.text === 'data' && isName(operand.expression, binding.name)) || (ts.isElementAccessExpression(operand) && stringKey(operand.argumentExpression) === 'data' && isName(operand.expression, binding.name)))
      if (hasRoot && hasData) {
        const holder = outer(chain).parent
        const handed = handedTo(chain)
        if (ts.isVariableDeclaration(holder) && ts.isIdentifier(holder.name) && holder.initializer && outer(chain) === outer(holder.initializer)) collected.aliases.push({ name: holder.name.text, scope: enclosingBlock(holder), levels: ['data', ROOT], depth: binding.depth })
        else if (handed) collected.follow(handed.call, handed.index, ['data', ROOT])
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(binding.scope)
}

/**
 * Every read of the answer a request's screen makes, with alternatives grouped into one read. A function the answer is handed to is read through `loader` when it is in another file.
 * With `failure`, it is the reads made where the answer is known to be a failure (`if (!res.ok) { ... data.error ... }`) that are returned, and only those, made by the screen itself.
 * The names the screen gives the answer or a part of it are added to `declared` when it is given: a name whose type the screen declares says what it expects of the answer.
 */
export function readsOfRequest(url: ts.Node, loader?: SourceLoader, failure = false, declared?: DeclaredAnswer[]): ResponseRead[] {
  const out: Found[] = []
  const done = new Set<string>()
  const superseded = new Set<ts.Node>()
  const queue = [...bindingsOfRequest(url, failure)]
  while (queue.length) {
    const binding = queue.shift()!
    const key = `${binding.scope.getSourceFile().fileName}:${binding.name}@${binding.scope.pos}:${binding.levels.join(',')}`
    if (done.has(key)) continue
    done.add(key)
    if (declared && !failure && binding.decl) {
      const where = binding.decl.getSourceFile()
      declared.push({ levels: [...binding.levels], node: binding.decl, file: where.fileName, line: where.getLineAndCharacterOfPosition(binding.decl.getStart()).line + 1, text: (binding.decl.parent ?? binding.decl).getText().replace(/\s+/g, ' ').slice(0, 90) })
    }
    const collected = collect(binding, loader)
    // What is read out of a name given to `data` says `data` has to be there; the read of `data` itself would only repeat it.
    if (binding.via && collected.reads.length > 0) superseded.add(binding.via)
    if (binding.levels.length === 1 && binding.levels[0] === ROOT) normalizingAlias(binding, collected)
    queue.push(...collected.aliases)
    // Reads that are operands of one `??` / `||` chain are alternatives of one read.
    const chainOf = (node: ts.Node): ts.Node => {
      const topOf = (start: ts.Node): ts.Node => {
        let top: ts.Node = start
        while (top.parent && ts.isBinaryExpression(top.parent) && isChainOperator(top.parent)) top = top.parent
        return top
      }
      // A read inside what a chain falls back on (`row.sector ?? (Array.isArray(row.sectors) ? row.sectors[0] : undefined)`) is an alternative of that chain: the screen tolerates either.
      for (let child: ts.Node = node, up: ts.Node | undefined = node.parent; up && !ts.isFunctionLike(up) && !ts.isBlock(up) && !ts.isSourceFile(up); child = up, up = up.parent) {
        if (ts.isBinaryExpression(up) && isChainOperator(up) && up.right === child) return topOf(up)
      }
      return topOf(outer(node))
    }
    for (const read of collected.reads) {
      // A read made where the answer is known to be a failure (`if (res.status === 409 && data.tierId)`) reads the failure's own shape: not a read of a success answer.
      // For the failure reads themselves only the screen's own count, not what a function it handed the body to does with it, and a `catch` is not a failure answer.
      if (failure ? !inErrorBranch(read.node, false) || (binding.depth ?? 0) > 0 : inErrorBranch(read.node)) continue
      const chain = chainOf(read.node)
      // `json.data ?? json`, `json.items || json`: a chain that falls back on the answer itself tolerates either shape, so none of its reads is judged.
      if (binding.name && ts.isBinaryExpression(chain) && flattenChain(chain).some((operand) => isName(operand, binding.name))) continue
      const where = read.node.getSourceFile()
      out.push({ node: read.node, alternatives: [...read.keys], line: where.getLineAndCharacterOfPosition(read.node.getStart()).line + 1, text: read.node.getText().replace(/\s+/g, ' ').slice(0, 90), file: where.fileName, chain })
    }
  }
  return groupAlternatives(out.filter((found) => !superseded.has(found.node)))
}

interface Found extends ResponseRead {
  /** The node the read was made at. */
  node: ts.Node
  /** The outermost `??` / `||` chain the read is an operand of, or the read itself. */
  chain: ts.Node
}

/** Reads that share a `??` / `||` chain become one read whose alternatives are all their keys; the rest stay as they are. */
function groupAlternatives(reads: Found[]): ResponseRead[] {
  const groups = new Map<ts.Node, ResponseRead>()
  const out: ResponseRead[] = []
  for (const found of reads) {
    const existing = groups.get(found.chain)
    if (existing) {
      for (const alternative of found.alternatives) if (!existing.alternatives.some((a) => a.level === alternative.level && a.key === alternative.key)) existing.alternatives.push(alternative)
      continue
    }
    const read: ResponseRead = { alternatives: [...found.alternatives], line: found.line, text: found.text, file: found.file }
    groups.set(found.chain, read)
    out.push(read)
  }
  return out
}
