/**
 * The JSON body a route accepts (UE-CONV-H-025), read from the route file the way a person reads it.
 *
 * Four ways a route says what it takes, each read as syntax and nothing else:
 *   - `withApi({ body: schema }, handler)`: the keys of the Zod object `schema` names, in the file or in the module it is imported from;
 *   - a handler that calls `schema.safeParse(...)` / `schema.parse(...)` on a Zod object it can resolve;
 *   - `crudRoutes({ writableFields: [...] })`: the keys the generic writer accepts (any other key is refused);
 *   - a handler that destructures `await request.json()`: the names it takes out of the body.
 * A Zod object is read through the methods that change its keys (`extend`, `merge`, `partial`, `pick`, `omit`, `passthrough`, `and`) and the ones that do not
 * (`strict`, `refine`, `transform`, `describe`). A route whose body the syntax cannot read yields `null`, never a guess; a route that takes none yields `undefined`.
 */
import ts from 'typescript'
import { propertyName, unwrap } from './request-body'

export type Requirement = 'required' | 'optional' | 'unknown'

export interface BodyContract {
  keys: Map<string, Requirement>
  /** The route accepts keys this list does not have (`passthrough`, a loose object, a spread the syntax cannot read). */
  open: boolean
  /** Where the keys were read: `body: createLetterSchema`, `writableFields`, `request.json() destructuring`. */
  via: string
}

export interface SchemaFiles {
  /** The text of a file relative to the application root, or null. */
  read(file: string): string | null
  /** The file an import specifier names, relative to the application root, or null (a package, an unknown path). */
  resolve(from: string, specifier: string): string | null
}

export const BODY_METHODS = ['POST', 'PUT', 'PATCH'] as const

/**
 * A guard a route calls before it reads its body takes keys out of the body itself, so the route's own schema never lists them: `guardPublicIntake` verifies
 * the bot challenge from `turnstileToken` and strips it (lib/public-intake/guard.ts).
 */
const GUARD_KEYS: Readonly<Record<string, readonly string[]>> = { guardPublicIntake: ['turnstileToken'] }

interface Shape {
  keys: Map<string, Requirement>
  open: boolean
}

const MAX_DEPTH = 8
const ZOD = new Set(['z', 'zod'])
const KEEPS_KEYS = new Set(['strict', 'strip', 'refine', 'superRefine', 'transform', 'describe', 'brand', 'readonly', 'check', 'meta', 'catchall', 'pipe'])
const MAKES_OPTIONAL = new Set(['optional', 'nullish', 'default', 'prefault', 'catch'])
const UNKNOWN_KINDS = new Set(['unknown', 'any', 'custom', 'lazy', 'union', 'xor', 'preprocess', 'pipe', 'transform', 'nullable', 'null', 'undefined', 'never', 'file', 'instanceof'])

const isExported = (node: ts.Node): boolean => ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)

function requirementOf(expression: ts.Expression): Requirement {
  let current = unwrap(expression)
  const methods = new Set<string>()
  const optional = (): boolean => [...methods].some((method) => MAKES_OPTIONAL.has(method))
  // Walk the chain of methods back to the call on the Zod namespace that starts it: `z.string().min(1).optional()` starts at `z.string()`.
  while (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
    const receiver = unwrap(current.expression.expression)
    const kind = current.expression.name.text
    const namespace = ts.isIdentifier(receiver) ? receiver.text : ts.isPropertyAccessExpression(receiver) && ts.isIdentifier(receiver.expression) ? receiver.expression.text : null
    if (namespace && ZOD.has(namespace)) {
      if (optional()) return 'optional'
      return UNKNOWN_KINDS.has(kind) ? 'unknown' : 'required'
    }
    methods.add(kind)
    current = receiver
  }
  return optional() ? 'optional' : 'unknown'
}

export class RouteBodyReader {
  private readonly sources = new Map<string, ts.SourceFile | null>()

  constructor(private readonly files: SchemaFiles) {}

  private source(file: string): ts.SourceFile | null {
    if (!this.sources.has(file)) {
      const text = this.files.read(file)
      this.sources.set(file, text === null ? null : ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, /\.tsx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS))
    }
    return this.sources.get(file) ?? null
  }

  /** A top-level `const name = ...` of the file, following a named import into the module it comes from. */
  private declaration(file: string, name: string, depth = 0): { file: string; expression: ts.Expression } | null {
    if (depth > MAX_DEPTH) return null
    const source = this.source(file)
    if (!source) return null
    for (const statement of source.statements) {
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name) && declaration.name.text === name && declaration.initializer) return { file, expression: declaration.initializer }
        }
      } else if (ts.isImportDeclaration(statement) && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings) && ts.isStringLiteral(statement.moduleSpecifier)) {
        for (const element of statement.importClause.namedBindings.elements) {
          if (element.name.text !== name) continue
          const target = this.files.resolve(file, statement.moduleSpecifier.text)
          return target ? this.declaration(target, (element.propertyName ?? element.name).text, depth + 1) : null
        }
      }
    }
    return null
  }

  private literalShape(file: string, literal: ts.ObjectLiteralExpression, depth: number): Shape {
    const shape: Shape = { keys: new Map(), open: false }
    for (const property of literal.properties) {
      if (ts.isPropertyAssignment(property)) {
        const name = propertyName(property.name)
        if (name === null) shape.open = true
        else shape.keys.set(name, requirementOf(property.initializer))
      } else if (ts.isShorthandPropertyAssignment(property)) {
        const found = this.declaration(file, property.name.text)
        shape.keys.set(property.name.text, found ? requirementOf(found.expression) : 'unknown')
      } else if (ts.isSpreadAssignment(property)) {
        // `...base.shape` or `...base.shape.field`: the keys of another object schema.
        const spread = unwrap(property.expression)
        const target = ts.isPropertyAccessExpression(spread) && spread.name.text === 'shape' ? spread.expression : null
        const inner = target ? this.shapeOf(file, target, depth + 1) : null
        if (inner) for (const [key, requirement] of inner.keys) shape.keys.set(key, requirement)
        else shape.open = true
        if (inner?.open) shape.open = true
      }
    }
    return shape
  }

  /** The keys a Zod object expression accepts, or null when it is not an object schema the syntax can follow. */
  shapeOf(file: string, expression: ts.Expression, depth = 0): Shape | null {
    if (depth > MAX_DEPTH) return null
    const node = unwrap(expression)
    if (ts.isIdentifier(node)) {
      const found = this.declaration(file, node.text, depth)
      return found ? this.shapeOf(found.file, found.expression, depth + 1) : null
    }
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return null
    const callee = node.expression
    const method = callee.name.text
    const target = unwrap(callee.expression)
    if (ts.isIdentifier(target) && ZOD.has(target.text)) {
      const [first, second] = node.arguments
      switch (method) {
        case 'object':
        case 'strictObject':
        case 'looseObject': {
          const literal = first ? unwrap(first) : null
          if (!literal || !ts.isObjectLiteralExpression(literal)) return null
          const shape = this.literalShape(file, literal, depth)
          if (method === 'looseObject') shape.open = true
          return shape
        }
        case 'discriminatedUnion':
        case 'union': {
          const list = unwrap(method === 'union' ? first : second)
          if (!list || !ts.isArrayLiteralExpression(list)) return null
          return this.unionShape(file, list.elements, depth)
        }
        case 'intersection': {
          const left = first ? this.shapeOf(file, first, depth + 1) : null
          const right = second ? this.shapeOf(file, second, depth + 1) : null
          return left && right ? this.merge(left, right) : null
        }
        default:
          return null
      }
    }
    const base = this.shapeOf(file, target, depth + 1)
    if (!base) return null
    const [argument] = node.arguments
    if (KEEPS_KEYS.has(method)) return base
    switch (method) {
      case 'passthrough':
      case 'loose':
        return { keys: base.keys, open: true }
      case 'extend':
      case 'safeExtend': {
        const literal = argument ? unwrap(argument) : null
        return literal && ts.isObjectLiteralExpression(literal) ? this.merge(base, this.literalShape(file, literal, depth)) : null
      }
      case 'merge':
      case 'and': {
        const other = argument ? this.shapeOf(file, argument, depth + 1) : null
        return other ? this.merge(base, other) : null
      }
      case 'partial':
        return { keys: new Map([...base.keys.keys()].map((key) => [key, 'optional' as Requirement])), open: base.open }
      case 'required':
        return { keys: new Map([...base.keys.keys()].map((key) => [key, 'required' as Requirement])), open: base.open }
      case 'pick':
      case 'omit': {
        const literal = argument ? unwrap(argument) : null
        if (!literal || !ts.isObjectLiteralExpression(literal)) return null
        const named = new Set(literal.properties.flatMap((property) => (ts.isPropertyAssignment(property) ? [propertyName(property.name)] : ts.isShorthandPropertyAssignment(property) ? [property.name.text] : [])).filter((name): name is string => name !== null))
        const keys = new Map([...base.keys].filter(([key]) => (method === 'pick' ? named.has(key) : !named.has(key))))
        return { keys, open: base.open }
      }
      case 'optional':
      case 'nullish':
      case 'default':
      case 'prefault':
      case 'catch':
        // The body itself may be absent: nothing in it is required.
        return { keys: new Map([...base.keys.keys()].map((key) => [key, 'optional' as Requirement])), open: base.open }
      default:
        return null
    }
  }

  private merge(left: Shape, right: Shape): Shape {
    return { keys: new Map([...left.keys, ...right.keys]), open: left.open || right.open }
  }

  /** The keys of a union of object schemas: every key any member takes, none of them required (which member the caller meets is not readable). */
  private unionShape(file: string, members: readonly ts.Expression[], depth: number): Shape | null {
    const shape: Shape = { keys: new Map(), open: false }
    for (const member of members) {
      const inner = this.shapeOf(file, member, depth + 1)
      if (!inner) return null
      for (const key of inner.keys.keys()) shape.keys.set(key, 'optional')
      if (inner.open) shape.open = true
    }
    return shape
  }

  private contractOfSchema(file: string, expression: ts.Expression, via: string): BodyContract | null {
    const shape = this.shapeOf(file, expression)
    return shape ? { keys: shape.keys, open: shape.open, via } : null
  }

  private contractOfWritableFields(file: string, options: ts.ObjectLiteralExpression): BodyContract | null | undefined {
    const property = options.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && propertyName(p.name) === 'writableFields')
    if (!property) return undefined
    const list = unwrap(property.initializer)
    if (!ts.isArrayLiteralExpression(list)) return null
    const contract: BodyContract = { keys: new Map(), open: false, via: 'writableFields' }
    for (const element of list.elements) {
      const item = unwrap(element)
      if (ts.isStringLiteralLike(item)) contract.keys.set(item.text, 'unknown')
      else if (ts.isSpreadElement(element)) {
        const resolved = this.arrayOf(file, element.expression)
        if (resolved) for (const key of resolved) contract.keys.set(key, 'unknown')
        else contract.open = true
      } else contract.open = true
    }
    return contract
  }

  /** The string items of an array expression the syntax can follow (`NAME.writableFields`, `NAME`, an array literal). */
  private arrayOf(file: string, expression: ts.Expression, depth = 0): string[] | null {
    if (depth > MAX_DEPTH) return null
    const node = unwrap(expression)
    if (ts.isArrayLiteralExpression(node)) {
      const items: string[] = []
      for (const element of node.elements) {
        const item = unwrap(element)
        if (ts.isStringLiteralLike(item)) items.push(item.text)
        else if (ts.isSpreadElement(element)) {
          const inner = this.arrayOf(file, element.expression, depth + 1)
          if (!inner) return null
          items.push(...inner)
        } else return null
      }
      return items
    }
    if (ts.isIdentifier(node)) {
      const found = this.declaration(file, node.text)
      return found ? this.arrayOf(found.file, found.expression, depth + 1) : null
    }
    if (ts.isPropertyAccessExpression(node)) {
      const owner = unwrap(node.expression)
      if (!ts.isIdentifier(owner)) return null
      const found = this.declaration(file, owner.text)
      const literal = found ? unwrap(found.expression) : null
      if (!found || !literal || !ts.isObjectLiteralExpression(literal)) return null
      const member = literal.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && propertyName(p.name) === node.name.text)
      return member ? this.arrayOf(found.file, member.initializer, depth + 1) : null
    }
    return null
  }

  /** What a handler function reads from the body: the one schema it parses, or the names it destructures from `request.json()`. */
  private contractOfHandler(file: string, handler: ts.Node): BodyContract | null | undefined {
    const parsed = new Map<string, ts.Identifier>()
    const destructured: ts.ObjectBindingPattern[] = []
    let jsonReads = 0
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && (node.expression.name.text === 'safeParse' || node.expression.name.text === 'parse' || node.expression.name.text === 'safeParseAsync' || node.expression.name.text === 'parseAsync')) {
        const owner = unwrap(node.expression.expression)
        if (ts.isIdentifier(owner) && !parsed.has(owner.text)) parsed.set(owner.text, owner)
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'json' && /^(request|req)$/.test(node.expression.expression.getText())) {
        jsonReads += 1
        const awaited = ts.isAwaitExpression(node.parent) ? node.parent : node
        const declaration = awaited.parent
        if (ts.isVariableDeclaration(declaration) && ts.isObjectBindingPattern(declaration.name)) destructured.push(declaration.name)
      }
      ts.forEachChild(node, visit)
    }
    visit(handler)
    const schemas = [...parsed.values()].map((owner) => ({ name: owner.text, shape: this.shapeOf(file, owner) })).filter((entry) => entry.shape)
    if (schemas.length === 1) return { keys: schemas[0].shape!.keys, open: schemas[0].shape!.open, via: `${schemas[0].name}.safeParse` }
    if (schemas.length > 1) return null
    if (destructured.length === 1 && jsonReads === 1) {
      const contract: BodyContract = { keys: new Map(), open: false, via: 'request.json() destructuring' }
      for (const element of destructured[0].elements) {
        if (element.dotDotDotToken) contract.open = true
        else {
          const name = element.propertyName ? propertyName(element.propertyName) : ts.isIdentifier(element.name) ? element.name.text : null
          if (name === null) contract.open = true
          else contract.keys.set(name, 'unknown')
        }
      }
      return contract
    }
    return jsonReads > 0 ? null : undefined
  }

  private contractOfExport(file: string, initializer: ts.Expression): BodyContract | null | undefined {
    const node = unwrap(initializer)
    if (ts.isCallExpression(node)) {
      const options = node.arguments.map(unwrap).find((argument): argument is ts.ObjectLiteralExpression => ts.isObjectLiteralExpression(argument) && argument.properties.some((p) => ts.isPropertyAssignment(p) && propertyName(p.name) === 'body'))
      if (options) {
        const property = options.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && propertyName(p.name) === 'body')!
        return this.contractOfSchema(file, property.initializer, `body: ${property.initializer.getText().slice(0, 60)}`)
      }
      return this.contractOfHandler(file, node)
    }
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return this.contractOfHandler(file, node)
    return undefined
  }

  /** The body contract of each body-carrying method a route file exports: undefined (takes none), null (takes one the syntax cannot read) or its keys. */
  contractsOf(file: string): Map<string, BodyContract | null | undefined> {
    const out = new Map<string, BodyContract | null | undefined>()
    const source = this.source(file)
    if (!source) return out
    const guardKeys = new Set<string>()
    const findGuards = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text in GUARD_KEYS) for (const key of GUARD_KEYS[node.expression.text]) guardKeys.add(key)
      ts.forEachChild(node, findGuards)
    }
    findGuards(source)
    const methods = new Set<string>(BODY_METHODS)
    // `export { GET, POST }` made after the declarations counts as exporting them.
    const listed = new Set<string>()
    for (const statement of source.statements) {
      if (ts.isExportDeclaration(statement) && !statement.moduleSpecifier && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) listed.add((element.propertyName ?? element.name).text)
      }
    }
    for (const statement of source.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name && methods.has(statement.name.text) && (isExported(statement) || listed.has(statement.name.text))) {
        out.set(statement.name.text, this.contractOfHandler(file, statement))
      } else if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (!declaration.initializer) continue
          if (ts.isIdentifier(declaration.name)) {
            if (methods.has(declaration.name.text) && (isExported(statement) || listed.has(declaration.name.text))) out.set(declaration.name.text, this.contractOfExport(file, declaration.initializer))
          } else if (ts.isObjectBindingPattern(declaration.name)) {
            // `export const { GET, POST } = crudRoutes({ ..., writableFields: [...] })`: the generic writer takes the listed fields and refuses any other.
            const call = unwrap(declaration.initializer)
            const options = ts.isCallExpression(call) ? call.arguments.map(unwrap).find((argument): argument is ts.ObjectLiteralExpression => ts.isObjectLiteralExpression(argument)) : undefined
            const contract = options ? this.contractOfWritableFields(file, options) : undefined
            for (const element of declaration.name.elements) {
              const name = ts.isIdentifier(element.name) ? element.name.text : null
              if (name && methods.has(name) && (isExported(statement) || listed.has(name))) out.set(name, contract)
            }
          }
        }
      }
    }
    // A guard the route calls takes its keys out of the body before the route's schema sees it.
    for (const contract of out.values()) if (contract) for (const key of guardKeys) if (!contract.keys.has(key)) contract.keys.set(key, 'optional')
    return out
  }
}
