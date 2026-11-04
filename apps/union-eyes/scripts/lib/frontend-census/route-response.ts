/**
 * The JSON a route answers with (UE-CONV-H-027), read from the route file the way a person reads it: the shape of a success answer, as far as the syntax says.
 *
 * How a route answers, each read as syntax and nothing else:
 *   - `withApi(options, handler)`: what the handler returns is wrapped by the framework as `{ success, data: <returned>, timestamp }` (lib/api/with-api.ts); a handler that
 *     returns a `NextResponse` instead answers that response as it is;
 *   - any other wrapper or a plain handler (`withRoleAuth`, `export async function GET`): the `NextResponse.json(x)` / `Response.json(x)` it returns is the answer;
 *   - `standardSuccessResponse(x, meta)`: `{ success, data: x, meta, timestamp }`;
 *   - `crudRoutes({ ... })`: the generic writer's own answers, wrapped by `withApi` (a list is `{ data, pagination }` under `data`, an item `{ data }`);
 *   - `cognitionRoute(engine)`: `{ success, data: <the engine's payload>, meta: { explainability }, timestamp }`.
 * An answer with a status of 400 or more, or a call that builds an error, a redirect or a denial, is not a success answer and is not read. What cannot be read (a service result,
 * a call whose name does not say, a spread of something unknown) is `null` or `open`, never guessed: a shape is only used to say a key is NOT there when it is closed.
 */
import ts from 'typescript'
import { propertyName, unwrap } from './request-body'
import type { SchemaFiles } from './route-body'

export interface ObjectShape {
  kind: 'object'
  /** The keys of the object; the shape of a value is kept where it can be read (the `data` of an envelope), else null. */
  keys: Map<string, Shape>
  /** The object may hold keys this map does not have: a spread of something the syntax cannot read. */
  open: boolean
}

export interface ArrayShape {
  kind: 'array'
  element: Shape
  /** An array literal with nothing in it (`clauses: []`): it says nothing of its elements, so the list it is joined with keeps its own. */
  empty?: boolean
}

/** What is known of a JSON value: an object, an array, or null (not known). */
export type Shape = ObjectShape | ArrayShape | null

/** What can say, for a node of the source, which JSON its value becomes: the type checker (type-shapes.ts). Null is "not known". */
export interface TypeOracle {
  shapeOfNode(node: ts.Node): Shape
}

export const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

const MAX_DEPTH = 6
/** A call whose name says it builds something other than a success answer. */
const NOT_SUCCESS = /error|redirect|unauthorized|forbidden|notFound|badRequest|denied|deny|refus|reject|conflict|tooMany|unavailable|fail|blocked|invalid/i
/** The member of a guard's result that holds the answer to give when the guard refuses: `if (!parsed.ok) return parsed.response`. */
const REFUSAL_MEMBER = /^(?:response|error|denied|failure|refusal)$/i
/** A call that builds an HTTP response: whatever it holds is the answer itself, not the handler's data. */
const BUILDS_RESPONSE = /Response|\.json$/i
/** A call that runs its callback in a context of the database and hands back what the callback returns. */
const CONTEXT_WRAPPER = /^(?:with\w*Context|inOrganization)$|(?:^|\.)transaction$/

export const objectOf = (keys: Record<string, Shape>, open = false): ObjectShape => ({ kind: 'object', keys: new Map(Object.entries(keys)), open })

export function union(a: Shape, b: Shape): Shape {
  if (!a || !b) return null
  if (a.kind === 'object' && b.kind === 'object') {
    const keys = new Map(a.keys)
    for (const [key, shape] of b.keys) keys.set(key, keys.has(key) ? union(keys.get(key) ?? null, shape) : shape)
    return { kind: 'object', keys, open: a.open || b.open }
  }
  if (a.kind === 'array' && b.kind === 'array') {
    if (a.empty) return b
    if (b.empty) return a
    return { kind: 'array', element: union(a.element, b.element) }
  }
  return null
}

const isFunction = (node: ts.Node): node is ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration => ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)

/** The `return` expressions of a function, without those of the functions inside it. */
function returnsOf(fn: ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration): ts.Expression[] {
  if (!fn.body) return []
  if (!ts.isBlock(fn.body)) return [fn.body]
  const out: ts.Expression[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isReturnStatement(node)) {
      if (node.expression) out.push(node.expression)
      return
    }
    if (isFunction(node) || ts.isClassLike(node)) return
    ts.forEachChild(node, visit)
  }
  visit(fn.body)
  return out
}

const calleeText = (call: ts.CallExpression): string => call.expression.getText()

/** `x as T`, `<T>x` (through parentheses), except the casts that say nothing (`as const`, `as any`, `as unknown`). */
function isAssertion(expression: ts.Expression): boolean {
  let node: ts.Expression = expression
  while (ts.isParenthesizedExpression(node)) node = node.expression
  if (!ts.isAsExpression(node) && !ts.isTypeAssertionExpression(node)) return false
  const text = node.type.getText()
  return text !== 'const' && text !== 'any' && text !== 'unknown'
}

export class RouteResponseReader {
  private readonly sources = new Map<string, ts.SourceFile | null>()

  constructor(private readonly files: SchemaFiles, private readonly types?: TypeOracle) {}

  /** What the type checker says the node is, where the syntax does not: the keys of what a service returns are not in the handler. */
  private typed(node: ts.Node): Shape {
    return this.types?.shapeOfNode(node) ?? null
  }

  private source(file: string): ts.SourceFile | null {
    if (!this.sources.has(file)) {
      const text = this.files.read(file)
      this.sources.set(file, text === null ? null : ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS))
    }
    return this.sources.get(file) ?? null
  }

  /** A top-level function or `const name = <function>` of the file. */
  private topLevelFunction(source: ts.SourceFile, name: string): ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration | null {
    for (const statement of source.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) return statement
      if (!ts.isVariableStatement(statement)) continue
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === name && declaration.initializer) {
          const value = unwrap(declaration.initializer)
          if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) return value
        }
      }
    }
    return null
  }

  /** The closest `const` of that name in the scopes around the identifier, or null. */
  private localConst(identifier: ts.Identifier): ts.VariableDeclaration | null {
    for (let scope: ts.Node | undefined = identifier.parent; scope; scope = scope.parent) {
      const statements = ts.isBlock(scope) || ts.isSourceFile(scope) || ts.isModuleBlock(scope) ? scope.statements : undefined
      if (!statements) continue
      for (const statement of statements) {
        if (!ts.isVariableStatement(statement) || !(statement.declarationList.flags & ts.NodeFlags.Const)) continue
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name) && declaration.name.text === identifier.text && declaration.initializer) return declaration
        }
      }
    }
    return null
  }

  /** Whether the object a `const` holds is changed after it is made (`x.key = ...`, `x[key] = ...`, `Object.assign(x, ...)`, `delete x.key`): what it holds is then more than its literal says. */
  private isMutated(declaration: ts.VariableDeclaration): boolean {
    if (!ts.isIdentifier(declaration.name)) return false
    const name = declaration.name.text
    let scope: ts.Node = declaration
    while (scope.parent && !ts.isBlock(scope) && !ts.isSourceFile(scope)) scope = scope.parent
    const rootOf = (expression: ts.Expression): string | null => {
      let current: ts.Node = expression
      while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current) || ts.isNonNullExpression(current) || ts.isParenthesizedExpression(current)) current = current.expression
      return ts.isIdentifier(current) ? current.text : null
    }
    let mutated = false
    const visit = (node: ts.Node): void => {
      if (mutated) return
      if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment && (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left)) && rootOf(node.left) === name) mutated = true
      else if (ts.isDeleteExpression(node) && rootOf(node.expression) === name) mutated = true
      else if (ts.isCallExpression(node) && /^Object\.(assign|defineProperty|defineProperties|setPrototypeOf)$/.test(node.expression.getText()) && node.arguments[0] && rootOf(node.arguments[0]) === name) mutated = true
      else ts.forEachChild(node, visit)
    }
    visit(scope)
    return mutated
  }

  /** The functions a call can be followed into: one of the same file, or one the file imports by name. */
  private functionNamed(source: ts.SourceFile, name: string): { fn: ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration; source: ts.SourceFile } | null {
    const local = this.topLevelFunction(source, name)
    return local ? { fn: local, source } : this.importedFunction(source, name)
  }

  /** The shape of the value an expression evaluates to. */
  shapeOf(expression: ts.Expression, source: ts.SourceFile, depth = 0): Shape {
    if (depth > MAX_DEPTH) return null
    // A cast says what the author takes the value to be (`rows as Row[]`): that is the type of it, whatever the declaration of `rows` says.
    if (this.types && isAssertion(expression)) {
      const asserted = this.typed(expression)
      if (asserted) return asserted
    }
    const node = unwrap(expression)
    if (ts.isAwaitExpression(node)) return this.shapeOf(node.expression, source, depth + 1)
    if (ts.isObjectLiteralExpression(node)) {
      const shape = objectOf({})
      for (const property of node.properties) {
        if (ts.isPropertyAssignment(property)) {
          const name = propertyName(property.name)
          if (name === null) shape.open = true
          else shape.keys.set(name, this.shapeOf(property.initializer, source, depth + 1))
        } else if (ts.isShorthandPropertyAssignment(property)) {
          shape.keys.set(property.name.text, this.shapeOf(property.name, source, depth + 1))
        } else if (ts.isSpreadAssignment(property)) {
          const spread = this.shapeOf(property.expression, source, depth + 1)
          if (spread?.kind === 'object') {
            for (const [key, value] of spread.keys) shape.keys.set(key, value)
            if (spread.open) shape.open = true
          } else shape.open = true
        } else shape.open = true
      }
      return shape
    }
    if (ts.isArrayLiteralExpression(node)) {
      if (node.elements.length === 0) return { kind: 'array', element: null, empty: true }
      let element: Shape = null
      let first = true
      for (const item of node.elements) {
        if (ts.isSpreadElement(item)) return { kind: 'array', element: null }
        const shape = this.shapeOf(item, source, depth + 1)
        element = first ? shape : union(element, shape)
        first = false
      }
      return { kind: 'array', element }
    }
    if (ts.isIdentifier(node)) {
      const declaration = this.localConst(node)
      const shape = declaration?.initializer ? this.shapeOf(declaration.initializer, source, depth + 1) : null
      if (!shape) return this.typed(expression)
      // An object that is added to after it is made is open: its literal says what it starts with.
      return shape.kind === 'object' && declaration && this.isMutated(declaration) ? { ...shape, open: true } : shape
    }
    if (ts.isConditionalExpression(node)) return union(this.shapeOf(node.whenTrue, source, depth + 1), this.shapeOf(node.whenFalse, source, depth + 1)) ?? this.typed(expression)
    if (ts.isCallExpression(node)) {
      // `rows.map((row) => ({ ... }))`: an array of what the callback returns.
      if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'map' && node.arguments[0] && isFunction(unwrap(node.arguments[0]))) {
        const callback = unwrap(node.arguments[0]) as ts.ArrowFunction | ts.FunctionExpression
        const returns = returnsOf(callback)
        let element: Shape = null
        returns.forEach((value, index) => {
          const shape = this.shapeOf(value, source, depth + 1)
          element = index === 0 ? shape : union(element, shape)
        })
        return element ? { kind: 'array', element } : (this.typed(expression) ?? { kind: 'array', element })
      }
      // A helper of the same file, or one the file imports by name, that returns things it can be read from: what the call answers is what it returns.
      if (ts.isIdentifier(node.expression)) {
        const found = this.functionNamed(source, node.expression.text)
        const returns = found ? this.expandedReturns(found.fn) : []
        if (found && returns.length > 0) {
          let shape: Shape = null
          returns.forEach((value, index) => {
            const next = this.shapeOf(value, found.source, depth + 1)
            shape = index === 0 ? next : union(shape, next)
          })
          if (shape) return shape
        }
      }
    }
    return this.typed(expression)
  }

  /** The handler function a route's export is built from, with the file it is written in: the function argument of `withApi(options, handler)` or of any other wrapper, the function itself, or a function the file imports. */
  private handlerOf(initializer: ts.Expression, source: ts.SourceFile, depth = 0): { fn: ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration; source: ts.SourceFile } | null {
    if (depth > 3) return null
    const node = unwrap(initializer)
    if (isFunction(node)) return { fn: node, source }
    if (ts.isIdentifier(node)) {
      const local = this.topLevelFunction(source, node.text)
      return local ? { fn: local, source } : this.importedFunction(source, node.text)
    }
    if (ts.isCallExpression(node)) {
      for (const argument of node.arguments) {
        const found = this.handlerOf(argument, source, depth + 1)
        if (found) return found
      }
    }
    return null
  }

  /** A function the file imports by name from another file of the application. */
  private importedFunction(source: ts.SourceFile, name: string): { fn: ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration; source: ts.SourceFile } | null {
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier)) continue
      const bindings = statement.importClause?.namedBindings
      if (!bindings || !ts.isNamedImports(bindings)) continue
      const element = bindings.elements.find((candidate) => candidate.name.text === name)
      if (!element) continue
      const file = this.files.resolve(source.fileName, statement.moduleSpecifier.text)
      const other = file ? this.source(file) : null
      const fn = other ? this.topLevelFunction(other, (element.propertyName ?? element.name).text) : null
      return fn && other ? { fn, source: other } : null
    }
    return null
  }

  /** The `return` expressions of a handler, with those of the callback a context wrapper runs (`return withRLSContext(options, async (tx) => { ... })`) in place of the call. */
  private expandedReturns(fn: ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration, depth = 0): ts.Expression[] {
    const out: ts.Expression[] = []
    for (const value of returnsOf(fn)) {
      const node = unwrap(ts.isAwaitExpression(value) ? value.expression : value)
      if (depth < 3 && ts.isCallExpression(node) && CONTEXT_WRAPPER.test(calleeText(node))) {
        const callback = [...node.arguments].reverse().map(unwrap).find(isFunction)
        if (callback) {
          out.push(...this.expandedReturns(callback as ts.ArrowFunction | ts.FunctionExpression, depth + 1))
          continue
        }
      }
      out.push(value)
    }
    return out
  }

  /** What one `return` of a handler contributes: a plain value, a built answer, or nothing a success answer holds. */
  private classify(expression: ts.Expression, source: ts.SourceFile, depth = 0): { kind: 'plain'; shape: Shape } | { kind: 'answer'; shape: Shape } | { kind: 'skip' } | { kind: 'unknown' } {
    const node = unwrap(expression.kind === ts.SyntaxKind.AwaitExpression ? (expression as ts.AwaitExpression).expression : expression)
    // A name that says it is a refusal, a guard's `.response` / `.error`, or a `const` holding one built answer, is read for what it is.
    if (ts.isIdentifier(node)) {
      if (NOT_SUCCESS.test(node.text)) return { kind: 'skip' }
      const initializer = depth < MAX_DEPTH ? this.localConst(node)?.initializer : null
      if (initializer && ts.isCallExpression(unwrap(initializer)) && /(?:^|\.)(?:NextResponse|Response)\.json$|(?:^|\.)standard\w*Response$/.test(calleeText(unwrap(initializer) as ts.CallExpression))) return this.classify(initializer, source, depth + 1)
    }
    if (ts.isPropertyAccessExpression(node) && REFUSAL_MEMBER.test(node.name.text)) return { kind: 'skip' }
    if (ts.isCallExpression(node)) {
      const callee = calleeText(node)
      if (/^(?:NextResponse|Response)\.json$/.test(callee)) {
        const init = node.arguments[1] ? unwrap(node.arguments[1]) : null
        if (init && ts.isObjectLiteralExpression(init)) {
          const status = init.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && propertyName(p.name) === 'status')
          if (status && ts.isNumericLiteral(unwrap(status.initializer)) && Number((unwrap(status.initializer) as ts.NumericLiteral).text) >= 400) return { kind: 'skip' }
        }
        return { kind: 'answer', shape: node.arguments[0] ? this.shapeOf(node.arguments[0], source) : null }
      }
      if (/(?:^|\.)standardSuccessResponse$/.test(callee)) return { kind: 'answer', shape: objectOf({ success: null, data: node.arguments[0] ? this.shapeOf(node.arguments[0], source) : null, meta: null, timestamp: null }) }
      if (NOT_SUCCESS.test(callee)) return { kind: 'skip' }
      if (BUILDS_RESPONSE.test(callee)) return { kind: 'unknown' }
    }
    if (ts.isNewExpression(node) && /Response$/.test(node.expression.getText())) return { kind: 'unknown' }
    return { kind: 'plain', shape: this.shapeOf(node, source) }
  }

  private shapeOfHandler(fn: ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration, source: ts.SourceFile, enveloped: boolean): Shape {
    let data: Shape = null
    let plains = 0
    let answers: Shape = null
    let answerCount = 0
    for (const value of this.expandedReturns(fn)) {
      const part = this.classify(value, source)
      if (part.kind === 'skip') continue
      if (part.kind === 'unknown') return null
      if (part.kind === 'plain' && enveloped) {
        data = plains === 0 ? part.shape : union(data, part.shape)
        plains += 1
      } else {
        // Without the envelope a plain value is not an answer: only a built response is. An unreadable call that is not a response is the handler's own data.
        const shape = part.kind === 'plain' ? null : part.shape
        answers = answerCount === 0 ? shape : union(answers, shape)
        answerCount += 1
      }
    }
    const envelope: Shape = enveloped && plains > 0 ? objectOf({ success: null, data, timestamp: null }) : null
    if (envelope && answerCount === 0) return envelope
    if (!envelope && answerCount > 0) return answers
    if (envelope && answerCount > 0) return union(envelope, answers)
    return null
  }

  /** The shape of the success answer of each method a route file exports, null where the syntax does not say. */
  shapesOf(file: string): Map<string, Shape> {
    const out = new Map<string, Shape>()
    const source = this.source(file)
    if (!source) return out
    const methods = new Set<string>(METHODS)
    const exported = new Set<string>()
    for (const statement of source.statements) {
      if (ts.isExportDeclaration(statement) && !statement.moduleSpecifier && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) exported.add((element.propertyName ?? element.name).text)
      }
    }
    const isExported = (node: ts.Node, name: string): boolean => (ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) || exported.has(name)

    for (const statement of source.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name && methods.has(statement.name.text) && isExported(statement, statement.name.text)) {
        out.set(statement.name.text, this.shapeOfHandler(statement, source, false))
      } else if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (!declaration.initializer) continue
          const initializer = unwrap(declaration.initializer)
          if (ts.isIdentifier(declaration.name) && methods.has(declaration.name.text) && isExported(statement, declaration.name.text)) {
            out.set(declaration.name.text, this.shapeOfExport(initializer, source))
          } else if (ts.isObjectBindingPattern(declaration.name) && ts.isCallExpression(initializer) && /(?:^|\.)crudRoutes$/.test(calleeText(initializer))) {
            const options = initializer.arguments.map(unwrap).find((argument): argument is ts.ObjectLiteralExpression => ts.isObjectLiteralExpression(argument))
            const item = !!options?.properties.some((p) => ts.isPropertyAssignment(p) && propertyName(p.name) === 'itemRoute' && unwrap(p.initializer).kind === ts.SyntaxKind.TrueKeyword)
            for (const element of declaration.name.elements) {
              const name = ts.isIdentifier(element.name) ? element.name.text : null
              if (name && methods.has(name) && isExported(statement, name)) out.set(name, crudShape(name, item))
            }
          }
        }
      }
    }
    return out
  }

  private shapeOfExport(initializer: ts.Expression, source: ts.SourceFile): Shape {
    if (ts.isCallExpression(initializer) && /(?:^|\.)crudRoutes$/.test(calleeText(initializer))) return null
    if (ts.isCallExpression(initializer) && /(?:^|\.)cognitionRoute$/.test(calleeText(initializer))) return cognitionShape()
    const handler = this.handlerOf(initializer, source)
    if (!handler) return null
    const enveloped = ts.isCallExpression(initializer) && /(?:^|\.)withApi$/.test(calleeText(initializer))
    return this.shapeOfHandler(handler.fn, handler.source, enveloped)
  }
}

const arrayOf = (element: Shape): ArrayShape => ({ kind: 'array', element })

/** What a cognition route answers (lib/api/cognition-route.ts): the engine's payload as `data`, the rest of its envelope in `meta`. The payload is the engine's own type, not read here. */
function cognitionShape(): Shape {
  return objectOf({ success: null, data: null, meta: objectOf({ explainability: null }), timestamp: null })
}

/** What the generic CRUD writer answers, inside the `withApi` envelope (lib/api/crud-factory.ts). */
function crudShape(method: string, item: boolean): Shape {
  const collectionList = objectOf({ data: arrayOf(null), pagination: null })
  const one = objectOf({ data: null })
  const data = !item && method === 'GET' ? collectionList : one
  return objectOf({ success: null, data, timestamp: null })
}
