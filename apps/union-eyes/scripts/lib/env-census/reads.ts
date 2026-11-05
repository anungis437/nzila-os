/**
 * Which environment variables the code reads (UE-CONV-H-024). Pure: the reads come from the source text of one file, read as syntax, never matched as text.
 *
 * A variable is read when code names it: `process.env.X`, `process.env['X']`, `const { X } = process.env`, `'X' in process.env`; through an alias of the
 * environment (`const env = process.env`, a parameter that defaults to it or is typed `NodeJS.ProcessEnv`, the validated `env` object of
 * `lib/config/env-validation`); through a key the source computes from a constant, a table or a loop (`for (const name of NAMES) process.env[name]`,
 * `CONTRACTS.map((def) => process.env[def.envVar])`); and through the application's own helpers, a function that reads `process.env[name]` for the name
 * it is given, whose callers name the variable (`readEnv('X')`).
 *
 * What it will not guess it reports: a key it cannot resolve is an `unresolved` site, never silently dropped, so a variable cannot hide behind
 * indirection. Writes (`process.env.X = ...`, `delete process.env.X`) are recorded apart: assigning a variable is not reading it.
 */
import ts from 'typescript'

export interface EnvSite {
  name: string
  line: number
  /** How it is read: property, element, destructure, in, hasOwn, alias, param, validated, helper:<name>, declared. */
  via: string
}

export interface UnresolvedSite {
  line: number
  via: string
  /** The key expression as written. */
  text: string
}

/** A function that reads `process.env[<its parameter>]`: the variable it reads is named by its callers. */
export interface HelperDef {
  file: string
  name: string
  /** Which parameter carries the variable name. */
  index: number
  line: number
  /** A method or a member of an object: only calls in its own file are attributed to it. */
  method: boolean
}

export interface WholeUse {
  line: number
  via: string
}

export interface FileFacts {
  file: string
  reads: EnvSite[]
  writes: EnvSite[]
  unresolved: UnresolvedSite[]
  helpers: HelperDef[]
  /** The whole environment handed on (`Object.keys(process.env)`, `schema.parse(process.env)`, a spread): no variable is named. */
  whole: WholeUse[]
  /** local name -> where it is imported from. */
  imports: Record<string, { module: string; imported: string }>
  /** Modules this one re-exports from. */
  reexports: string[]
}

export interface ScanOptions {
  /** True for an import specifier whose `env` export is the validated environment object (reading `env.X` reads the variable X). */
  envObjectModule?: (specifier: string) => boolean
}

/** A property whose array of strings names the variables an integration needs: the application's own declaration of them. */
const DECLARATIVE_PROPERTIES = new Set(['requiredEnvVars', 'optionalEnvVars'])
const ARRAY_METHODS = new Set(['filter', 'map', 'some', 'every', 'forEach', 'find', 'findIndex', 'flatMap', 'reduce'])
/** Methods that give back some of the elements they were called on, so what they iterate is what the receiver holds. */
const PASSTHROUGH_METHODS = new Set(['filter', 'slice', 'concat', 'sort', 'toSorted', 'reverse', 'toReversed'])
const MAX_DEPTH = 8
const MAX_COMBINATIONS = 64
const ENV_TYPE = /(^|\.)ProcessEnv$|^typeof process\.env$/

type Key = { names: string[] } | { param: { fn: ts.SignatureDeclaration; index: number } } | { unresolved: string }

type Binding =
  | { kind: 'param'; fn: ts.SignatureDeclaration; index: number; param: ts.ParameterDeclaration }
  | { kind: 'var'; init: ts.Expression | undefined; declaration: ts.VariableDeclaration }
  | { kind: 'iter'; over: ts.Expression }
  | { kind: 'import'; module: string; imported: string }
  | { kind: 'unknown' }

const unwrap = (node: ts.Expression): ts.Expression => {
  let current = node
  for (;;) {
    if (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isNonNullExpression(current) || ts.isSatisfiesExpression(current) || ts.isTypeAssertionExpression(current)) current = current.expression
    else return current
  }
}

const isProcessObject = (node: ts.Expression): boolean => {
  const inner = unwrap(node)
  if (ts.isIdentifier(inner)) return inner.text === 'process'
  return ts.isPropertyAccessExpression(inner) && inner.name.text === 'process' && ts.isIdentifier(inner.expression) && (inner.expression.text === 'globalThis' || inner.expression.text === 'global')
}

/** `process.env`, `globalThis.process.env`, `process['env']`, `import.meta.env`. */
export const isProcessEnvExpression = (node: ts.Expression): boolean => {
  const inner = unwrap(node)
  if (ts.isPropertyAccessExpression(inner) && inner.name.text === 'env') return isProcessObject(inner.expression) || (ts.isMetaProperty(inner.expression) && inner.expression.keywordToken === ts.SyntaxKind.ImportKeyword)
  return ts.isElementAccessExpression(inner) && ts.isStringLiteralLike(inner.argumentExpression) && inner.argumentExpression.text === 'env' && isProcessObject(inner.expression)
}

const isProcessModule = (module: string): boolean => module === 'node:process' || module === 'process'
const propertyKey = (name: ts.PropertyName | ts.BindingName): string | null => (ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : null)

/** How an expression that is the environment is used as a value, when it is: handed to a call, spread, returned, stored. */
function valueUse(parent: ts.Node, outer: ts.Node): string | null {
  if (ts.isCallExpression(parent) || ts.isNewExpression(parent)) return parent.arguments?.some((argument) => argument === outer) ? 'argument' : null
  if (ts.isSpreadAssignment(parent) || ts.isSpreadElement(parent)) return 'spread'
  if (ts.isReturnStatement(parent) || (ts.isArrowFunction(parent) && parent.body === outer)) return 'return'
  if (ts.isPropertyAssignment(parent) && parent.initializer === outer) return 'value'
  if (ts.isShorthandPropertyAssignment(parent) && parent.name === outer) return 'value'
  if (ts.isArrayLiteralExpression(parent)) return 'value'
  if (ts.isForOfStatement(parent) && parent.expression === outer) return 'iterate'
  if (ts.isConditionalExpression(parent) && parent.condition !== outer) return 'value'
  if (ts.isBinaryExpression(parent) && parent.right === outer) {
    const operator = parent.operatorToken.kind
    if (operator === ts.SyntaxKind.EqualsToken || operator === ts.SyntaxKind.BarBarToken || operator === ts.SyntaxKind.QuestionQuestionToken) return 'value'
  }
  return null
}

class FileScan {
  readonly facts: FileFacts
  private readonly source: ts.SourceFile
  /** Names that may stand for the environment in this file; each use is confirmed against its binding. */
  private readonly aliasNames = new Set<string>()

  constructor(
    readonly file: string,
    text: string,
    private readonly options: ScanOptions,
  ) {
    this.source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, /\.[mc]?[jt]sx$/.test(file) ? ts.ScriptKind.TSX : /\.[mc]?js$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS)
    this.facts = { file, reads: [], writes: [], unresolved: [], helpers: [], whole: [], imports: {}, reexports: [] }
    this.prepare()
  }

  private lineOf(node: ts.Node): number {
    return this.source.getLineAndCharacterOfPosition(node.getStart(this.source)).line + 1
  }

  private isEnvObjectImport(module: string, imported: string): boolean {
    return imported === 'env' && (isProcessModule(module) || (this.options.envObjectModule?.(module) ?? false))
  }

  /** The imports and re-exports, and the names a variable declaration or a parameter could make an alias of the environment. */
  private prepare(): void {
    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const module = node.moduleSpecifier.text
        const clause = node.importClause
        if (clause?.name) this.facts.imports[clause.name.text] = { module, imported: 'default' }
        const bindings = clause?.namedBindings
        if (bindings && ts.isNamespaceImport(bindings)) this.facts.imports[bindings.name.text] = { module, imported: '*' }
        else if (bindings && ts.isNamedImports(bindings)) {
          for (const element of bindings.elements) {
            const imported = (element.propertyName ?? element.name).text
            this.facts.imports[element.name.text] = { module, imported }
            if (this.isEnvObjectImport(module, imported)) this.aliasNames.add(element.name.text)
          }
        }
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        this.facts.reexports.push(node.moduleSpecifier.text)
      } else if (ts.isVariableDeclaration(node) && node.initializer) {
        if (ts.isIdentifier(node.name) && isProcessEnvExpression(node.initializer)) this.aliasNames.add(node.name.text)
        else if (ts.isObjectBindingPattern(node.name) && isProcessObject(node.initializer)) {
          for (const element of node.name.elements) if (ts.isIdentifier(element.name) && (element.propertyName ?? element.name).getText(this.source) === 'env') this.aliasNames.add(element.name.text)
        }
      } else if (ts.isParameter(node) && ts.isIdentifier(node.name) && ((node.initializer && isProcessEnvExpression(node.initializer)) || (node.type && ENV_TYPE.test(node.type.getText(this.source).trim())))) {
        this.aliasNames.add(node.name.text)
      }
      ts.forEachChild(node, visit)
    }
    visit(this.source)
  }

  /** What an identifier stands for at its use: found by climbing the scopes that enclose it. */
  private bindingOf(identifier: ts.Identifier): Binding | undefined {
    const name = identifier.text
    for (let node: ts.Node | undefined = identifier.parent; node; node = node.parent) {
      if (ts.isFunctionLike(node)) {
        const index = node.parameters.findIndex((parameter) => ts.isIdentifier(parameter.name) && parameter.name.text === name)
        if (index >= 0) {
          const iterated = this.iteratedByCallback(node, index)
          return iterated ? { kind: 'iter', over: iterated } : { kind: 'param', fn: node, index, param: node.parameters[index] }
        }
        if (node.parameters.some((parameter) => !ts.isIdentifier(parameter.name) && parameter.name.getText(this.source).includes(name))) return { kind: 'unknown' }
      }
      if (ts.isForOfStatement(node) && ts.isVariableDeclarationList(node.initializer)) {
        const declaration = node.initializer.declarations[0]
        if (declaration && ts.isIdentifier(declaration.name) && declaration.name.text === name) return { kind: 'iter', over: node.expression }
      }
      if (ts.isBlock(node) || ts.isSourceFile(node) || ts.isModuleBlock(node)) {
        for (const statement of node.statements) {
          if (ts.isVariableStatement(statement)) {
            for (const declaration of statement.declarationList.declarations) {
              if (ts.isIdentifier(declaration.name) && declaration.name.text === name) return { kind: 'var', init: declaration.initializer, declaration }
              if (ts.isObjectBindingPattern(declaration.name) && declaration.name.elements.some((element) => ts.isIdentifier(element.name) && element.name.text === name)) return { kind: 'unknown' }
            }
          } else if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name?.text === name) return { kind: 'unknown' }
        }
        if (ts.isSourceFile(node)) {
          const imported = this.facts.imports[name]
          if (imported) return { kind: 'import', ...imported }
        }
      }
    }
    return undefined
  }

  /** The array a callback walks, when the function is the callback of an array method (`LIST.map((name) => ...)`) and the parameter is the element. */
  private iteratedByCallback(fn: ts.SignatureDeclaration, index: number): ts.Expression | undefined {
    if (!ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn)) return undefined
    const call = fn.parent
    if (!ts.isCallExpression(call) || call.arguments[0] !== fn || !ts.isPropertyAccessExpression(call.expression)) return undefined
    const method = call.expression.name.text
    if (!ARRAY_METHODS.has(method)) return undefined
    return (method === 'reduce' ? index === 1 : index === 0) ? call.expression.expression : undefined
  }

  private isEnvIdentifier(identifier: ts.Identifier): boolean {
    if (!this.aliasNames.has(identifier.text)) return false
    const binding = this.bindingOf(identifier)
    if (!binding) return false
    if (binding.kind === 'param') return Boolean((binding.param.initializer && isProcessEnvExpression(binding.param.initializer)) || (binding.param.type && ENV_TYPE.test(binding.param.type.getText(this.source).trim())))
    if (binding.kind === 'var') return Boolean(binding.init && isProcessEnvExpression(binding.init))
    if (binding.kind === 'import') return this.isEnvObjectImport(binding.module, binding.imported)
    return false
  }

  /** What kind of environment object an expression is, or null when it is not one. */
  private envKind(node: ts.Expression): 'property' | 'alias' | 'param' | 'validated' | null {
    const inner = unwrap(node)
    if (isProcessEnvExpression(inner)) return 'property'
    if (ts.isIdentifier(inner) && this.isEnvIdentifier(inner)) {
      const binding = this.bindingOf(inner)
      if (binding?.kind === 'param') return 'param'
      if (binding?.kind === 'import') return isProcessModule(binding.module) ? 'alias' : 'validated'
      return 'alias'
    }
    return null
  }

  private elementsOf(node: ts.Expression, depth: number): ts.Expression[] | null {
    const inner = unwrap(node)
    if (depth > MAX_DEPTH) return null
    if (ts.isArrayLiteralExpression(inner)) {
      const out: ts.Expression[] = []
      for (const element of inner.elements) {
        if (ts.isSpreadElement(element)) {
          const spread = this.elementsOf(element.expression, depth + 1)
          if (!spread) return null
          out.push(...spread)
        } else out.push(element)
      }
      return out
    }
    if (ts.isIdentifier(inner)) {
      const binding = this.bindingOf(inner)
      return binding?.kind === 'var' && binding.init ? this.elementsOf(binding.init, depth + 1) : null
    }
    if (ts.isCallExpression(inner) && ts.isPropertyAccessExpression(inner.expression)) {
      const method = inner.expression.name.text
      if (PASSTHROUGH_METHODS.has(method)) {
        const receiver = this.elementsOf(inner.expression.expression, depth + 1)
        if (!receiver) return null
        if (method !== 'concat') return receiver
        const rest = inner.arguments.map((argument) => this.elementsOf(argument, depth + 1))
        return rest.some((part) => !part) ? null : [...receiver, ...rest.flatMap((part) => part ?? [])]
      }
      if ((method === 'values' || method === 'keys') && ts.isIdentifier(inner.expression.expression) && inner.expression.expression.text === 'Object' && inner.arguments[0]) {
        const object = this.objectLiteralOf(inner.arguments[0], depth + 1)
        if (!object) return null
        return object.properties.flatMap((property): ts.Expression[] => {
          if (method === 'values') return ts.isPropertyAssignment(property) ? [property.initializer] : []
          const key = property.name ? propertyKey(property.name) : null
          return key === null ? [] : [ts.factory.createStringLiteral(key)]
        })
      }
    }
    return null
  }

  private objectLiteralOf(node: ts.Expression, depth: number): ts.ObjectLiteralExpression | null {
    const inner = unwrap(node)
    if (depth > MAX_DEPTH) return null
    if (ts.isObjectLiteralExpression(inner)) return inner
    if (ts.isIdentifier(inner)) {
      const binding = this.bindingOf(inner)
      return binding?.kind === 'var' && binding.init ? this.objectLiteralOf(binding.init, depth + 1) : null
    }
    return null
  }

  private propertyOf(object: ts.ObjectLiteralExpression, property: string): ts.Expression | undefined {
    for (const candidate of object.properties) if (ts.isPropertyAssignment(candidate) && propertyKey(candidate.name) === property) return candidate.initializer
    return undefined
  }

  private classOf(node: ts.Node): ts.ClassLikeDeclaration | undefined {
    for (let current: ts.Node | undefined = node.parent; current; current = current.parent) if (ts.isClassLike(current)) return current
    return undefined
  }

  private findClass(name: string): ts.ClassLikeDeclaration | undefined {
    let found: ts.ClassLikeDeclaration | undefined
    const visit = (node: ts.Node): void => {
      if (found) return
      if (ts.isClassLike(node) && node.name?.text === name) found = node
      else ts.forEachChild(node, visit)
    }
    visit(this.source)
    return found
  }

  /** What `owner.property` holds when `owner` is a constant object, a class (`this.X`, `Class.X`) or the element of a table a loop walks. */
  private memberInitializers(owner: ts.Expression, property: string, depth: number): ts.Expression[] | null {
    const inner = unwrap(owner)
    const unbound = ts.isIdentifier(inner) && !this.bindingOf(inner)
    if (inner.kind === ts.SyntaxKind.ThisKeyword || unbound) {
      const declaring = inner.kind === ts.SyntaxKind.ThisKeyword ? this.classOf(inner) : this.findClass((inner as ts.Identifier).text)
      const member = declaring?.members.find((candidate): candidate is ts.PropertyDeclaration => ts.isPropertyDeclaration(candidate) && candidate.name.getText(this.source) === property && candidate.initializer !== undefined)
      return member?.initializer ? [member.initializer] : null
    }
    if (!ts.isIdentifier(inner)) return null
    const binding = this.bindingOf(inner)
    if (binding?.kind === 'var' && binding.init) {
      const object = this.objectLiteralOf(binding.init, depth + 1)
      const found = object ? this.propertyOf(object, property) : undefined
      return found ? [found] : null
    }
    if (binding?.kind === 'iter') {
      const elements = this.elementsOf(binding.over, depth + 1)
      if (!elements) return null
      const out: ts.Expression[] = []
      for (const element of elements) {
        const object = this.objectLiteralOf(element, depth + 1)
        const found = object ? this.propertyOf(object, property) : undefined
        if (found) out.push(found)
      }
      return out.length ? out : null
    }
    return null
  }

  /** The names an expression can evaluate to, the parameter it passes on, or why it cannot be resolved. */
  private evalKey(node: ts.Expression, depth = 0): Key {
    const inner = unwrap(node)
    const unresolved: Key = { unresolved: inner.getText(this.source) }
    if (depth > MAX_DEPTH) return unresolved
    if (ts.isStringLiteralLike(inner)) return { names: [inner.text] }
    if (ts.isTemplateExpression(inner)) {
      let combined = [inner.head.text]
      for (const span of inner.templateSpans) {
        const part = this.evalKey(span.expression, depth + 1)
        if (!('names' in part)) return unresolved
        combined = combined.flatMap((prefix) => part.names.map((name) => `${prefix}${name}${span.literal.text}`))
        if (combined.length > MAX_COMBINATIONS) return unresolved
      }
      return { names: combined }
    }
    if (ts.isConditionalExpression(inner)) return this.union([this.evalKey(inner.whenTrue, depth + 1), this.evalKey(inner.whenFalse, depth + 1)], unresolved)
    if (ts.isBinaryExpression(inner)) {
      const operator = inner.operatorToken.kind
      if (operator === ts.SyntaxKind.BarBarToken || operator === ts.SyntaxKind.QuestionQuestionToken) return this.union([this.evalKey(inner.left, depth + 1), this.evalKey(inner.right, depth + 1)], unresolved)
      if (operator === ts.SyntaxKind.PlusToken) {
        const left = this.evalKey(inner.left, depth + 1)
        const right = this.evalKey(inner.right, depth + 1)
        if ('names' in left && 'names' in right) {
          const names = left.names.flatMap((a) => right.names.map((b) => `${a}${b}`))
          return names.length > MAX_COMBINATIONS ? unresolved : { names }
        }
      }
      return unresolved
    }
    if (ts.isIdentifier(inner)) {
      const binding = this.bindingOf(inner)
      if (binding?.kind === 'param') return { param: { fn: binding.fn, index: binding.index } }
      if (binding?.kind === 'var' && binding.init && ts.isVariableDeclarationList(binding.declaration.parent) && (binding.declaration.parent.flags & ts.NodeFlags.Const) !== 0) return this.evalKey(binding.init, depth + 1)
      if (binding?.kind === 'iter') {
        const elements = this.elementsOf(binding.over, depth + 1)
        return elements
          ? this.union(
              elements.map((element) => this.evalKey(element, depth + 1)),
              unresolved,
            )
          : unresolved
      }
      return unresolved
    }
    if (ts.isPropertyAccessExpression(inner) || (ts.isElementAccessExpression(inner) && ts.isStringLiteralLike(inner.argumentExpression))) {
      const property = ts.isPropertyAccessExpression(inner) ? inner.name.text : (inner.argumentExpression as ts.StringLiteralLike).text
      const targets = this.memberInitializers(inner.expression, property, depth + 1)
      return targets
        ? this.union(
            targets.map((target) => this.evalKey(target, depth + 1)),
            unresolved,
          )
        : unresolved
    }
    return unresolved
  }

  /** The union of several keys when every one names variables; a parameter or an unresolved part makes the whole unresolved. */
  private union(keys: Key[], unresolved: Key): Key {
    const names = new Set<string>()
    for (const key of keys) {
      if (!('names' in key)) return unresolved
      for (const name of key.names) names.add(name)
    }
    return names.size ? { names: [...names] } : unresolved
  }

  /** What to call a function so its callers can be found: its declared name, the variable it is assigned to, or the property it is the value of. */
  private helperName(fn: ts.SignatureDeclaration): { name: string; method: boolean } | null {
    if ((ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn)) && fn.name) return { name: fn.name.getText(this.source), method: ts.isMethodDeclaration(fn) }
    const parent = fn.parent
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return { name: parent.name.text, method: false }
    if (ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent)) return { name: parent.name.getText(this.source), method: true }
    return null
  }

  private addKey(key: Key, node: ts.Node, via: string, write: boolean): void {
    const line = this.lineOf(node)
    if ('names' in key) {
      for (const name of key.names) (write ? this.facts.writes : this.facts.reads).push({ name, line, via })
      return
    }
    if (write) return
    if ('param' in key) {
      const helper = this.helperName(key.param.fn)
      if (helper) this.facts.helpers.push({ file: this.file, name: helper.name, index: key.param.index, line, method: helper.method })
      else this.facts.unresolved.push({ line, via, text: node.getText(this.source) })
      return
    }
    this.facts.unresolved.push({ line, via, text: key.unresolved })
  }

  private accessOf(node: ts.Node): 'read' | 'write' | 'readwrite' {
    const parent = node.parent
    if (ts.isBinaryExpression(parent) && parent.left === node) {
      const operator = parent.operatorToken.kind
      if (operator === ts.SyntaxKind.EqualsToken) return 'write'
      if (operator >= ts.SyntaxKind.FirstCompoundAssignment && operator <= ts.SyntaxKind.LastCompoundAssignment) return 'readwrite'
    }
    return ts.isDeleteExpression(parent) ? 'write' : 'read'
  }

  scanDirect(): void {
    const visit = (node: ts.Node): void => {
      if (ts.isPropertyAccessExpression(node)) {
        const kind = this.envKind(node.expression)
        if (kind) {
          const parent = node.parent
          const called = ts.isCallExpression(parent) && parent.expression === node
          // `process.env.hasOwnProperty('X')` names the variable in its argument; any other method of the object names none.
          if (called && node.name.text === 'hasOwnProperty' && parent.arguments[0]) this.addKey(this.evalKey(parent.arguments[0]), parent, 'hasOwn', false)
          else if (!called) {
            const access = this.accessOf(node)
            if (access !== 'write') this.facts.reads.push({ name: node.name.text, line: this.lineOf(node), via: kind })
            if (access !== 'read') this.facts.writes.push({ name: node.name.text, line: this.lineOf(node), via: kind })
          }
        }
      } else if (ts.isElementAccessExpression(node)) {
        const kind = this.envKind(node.expression)
        if (kind) {
          const access = this.accessOf(node)
          const key = this.evalKey(node.argumentExpression)
          const via = kind === 'property' ? 'element' : kind
          if (access !== 'write') this.addKey(key, node, via, false)
          if (access !== 'read') this.addKey(key, node, via, true)
        }
      } else if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer) {
        if (this.envKind(node.initializer)) {
          for (const element of node.name.elements) {
            if (element.dotDotDotToken) this.facts.whole.push({ line: this.lineOf(element), via: 'rest' })
            else if (element.propertyName && ts.isComputedPropertyName(element.propertyName)) this.addKey(this.evalKey(element.propertyName.expression), element, 'destructure', false)
            else {
              const name = propertyKey(element.propertyName ?? element.name)
              if (name !== null) this.facts.reads.push({ name, line: this.lineOf(element), via: 'destructure' })
            }
          }
        }
      } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.InKeyword && this.envKind(node.right)) {
        this.addKey(this.evalKey(node.left), node, 'in', false)
      } else if (ts.isCallExpression(node)) {
        // Object.hasOwn(process.env, 'X') and Object.prototype.hasOwnProperty.call(process.env, 'X')
        const callee = unwrap(node.expression)
        if (ts.isPropertyAccessExpression(callee) && node.arguments.length >= 2 && this.envKind(node.arguments[0])) {
          const owner = callee.expression.getText(this.source)
          if ((owner === 'Object' && callee.name.text === 'hasOwn') || (/hasOwnProperty$/.test(owner) && callee.name.text === 'call')) this.addKey(this.evalKey(node.arguments[1]), node, 'hasOwn', false)
        }
      } else if (ts.isPropertyAssignment(node) && DECLARATIVE_PROPERTIES.has(node.name.getText(this.source))) {
        const elements = this.elementsOf(node.initializer, 0)
        if (elements) for (const element of elements) if (ts.isStringLiteralLike(element)) this.facts.reads.push({ name: element.text, line: this.lineOf(element), via: 'declared' })
      }
      if (ts.isExpression(node)) this.noteWhole(node)
      ts.forEachChild(node, visit)
    }
    visit(this.source)
  }

  /** The environment itself used as a value: handed to a function, spread, returned. */
  private noteWhole(node: ts.Expression): void {
    if (!this.envKind(node)) return
    let outer: ts.Node = node
    while (outer.parent && (ts.isParenthesizedExpression(outer.parent) || ts.isAsExpression(outer.parent) || ts.isNonNullExpression(outer.parent) || ts.isSatisfiesExpression(outer.parent))) outer = outer.parent
    const via = valueUse(outer.parent, outer)
    if (via) this.facts.whole.push({ line: this.lineOf(node), via })
  }

  /** The calls to the helpers whose variable the argument names (pass two: the helpers are known once every file has been read). */
  scanHelperCalls(helpers: readonly HelperDef[], resolves: (module: string, helper: HelperDef) => boolean): void {
    const byName = new Map<string, HelperDef[]>()
    for (const helper of helpers) byName.set(helper.name, [...(byName.get(helper.name) ?? []), helper])
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const callee = unwrap(node.expression)
        const candidates = ts.isIdentifier(callee) ? byName.get(callee.text) : ts.isPropertyAccessExpression(callee) ? byName.get(callee.name.text) : undefined
        for (const helper of candidates ?? []) {
          const sameFile = helper.file === this.file
          if (helper.method && !sameFile) continue
          if (!sameFile) {
            const identifier = ts.isIdentifier(callee) ? callee : ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) ? callee.expression : null
            const imported = identifier ? this.facts.imports[identifier.text] : undefined
            if (!imported || !resolves(imported.module, helper)) continue
          }
          const argument = node.arguments[helper.index]
          if (argument) this.addKey(this.evalKey(argument), node, `helper:${helper.name}`, false)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(this.source)
  }
}

/** Every environment read of one file: what it names, what it only passes on, and what it could not resolve. */
export function extractEnvFacts(file: string, text: string, options: ScanOptions = {}): FileFacts {
  const scan = new FileScan(file, text, options)
  scan.scanDirect()
  return scan.facts
}

/** The helper calls of one file, given the helpers found across the program: the reads, the helpers they forward to, and the keys it could not resolve. */
export function extractHelperCalls(file: string, text: string, helpers: readonly HelperDef[], resolves: (module: string, helper: HelperDef) => boolean, options: ScanOptions = {}): Pick<FileFacts, 'reads' | 'helpers' | 'unresolved'> {
  const scan = new FileScan(file, text, options)
  scan.scanHelperCalls(helpers, resolves)
  return { reads: scan.facts.reads, helpers: scan.facts.helpers, unresolved: scan.facts.unresolved }
}
