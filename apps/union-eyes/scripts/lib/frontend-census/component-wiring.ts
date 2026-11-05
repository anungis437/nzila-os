/**
 * How the components of the frontend are wired together (UE-CONV-H-026). Pure: the facts come from one file's source text and the census joins them across files
 * (scripts/runtime/component-wiring-census.ts). Two kinds of component that looks finished and is not:
 *
 *   - UNRENDERED_COMPONENT: a component a file declares and exports that nothing renders, passes as a value or loads dynamically. It is in the tree, it may even have
 *     tests and a barrel export, and a person can never reach it. A file-level reach analysis cannot see it when the file is re-exported through a barrel that something
 *     imports: the barrel is reached, so everything it re-exports counts as reached.
 *   - CALLBACK_NEVER_SUPPLIED: a component that declares `onSave?: () => void` and renders `<Button onClick={onSave}>` (or `onClick={() => onSave?.()}`) is a button that
 *     does nothing when no parent gives it `onSave`. The dead-controls census cannot see it: the handler is there, it just leads nowhere. Read per file: a button,
 *     menu item or form whose handler does nothing but forward to an OPTIONAL prop of its component that the component does not default to something real and does not
 *     hide or disable the control without (`{onSave && <Button .../>}`, `disabled={!onSave}`); joined across files: that no place renders the component with the prop.
 *
 * Syntax only. A prop whose type the file does not declare, or a component rendered through a spread, as a value or by a dynamic import, is not judged, never guessed.
 */
import ts from 'typescript'
import { propertyName, unwrap } from './request-body'

export interface ForwardingControl {
  component: string
  prop: string
  line: number
  text: string
}

export interface JsxUse {
  /** The identifier the element is written with: `<Foo />` is `Foo`. */
  local: string
  props: string[]
  /** The element spreads something (`{...props}`): it may pass any prop. */
  spread: boolean
  line: number
}

export interface ModuleFacts {
  controls: ForwardingControl[]
  /** Components the file declares at the top level: a capitalized function whose body renders JSX. */
  components: Array<{ name: string; line: number }>
  /** Exported name to the local name it stands for (`default` for the default export). */
  exports: Map<string, string>
  /** `export { a as b } from './x'` (name `b`, from `a`) and `export * from './x'` (name and from `*`). */
  reexports: Array<{ specifier: string; name: string; from: string }>
  /** A local binding to where it was imported from: named and default imports. */
  imports: Map<string, { specifier: string; name: string }>
  uses: JsxUse[]
  /** Capitalized local names used as a value, not as a JSX tag: how such a component is rendered is unknown. */
  valueRefs: Set<string>
  dynamicSpecifiers: string[]
}

const CONTROL_TAGS = new Set(['Button', 'button', 'IconButton', 'LoadingButton', 'DropdownMenuItem', 'ContextMenuItem', 'MenubarItem', 'AlertDialogAction', 'CommandItem', 'form'])
const CONTROL_EVENTS = new Set(['onClick', 'onSubmit', 'onSelect', 'onPress'])
const NOISE_CALLS = new Set(['preventDefault', 'stopPropagation'])

export const isCensusModule = (file: string): boolean => /\.tsx?$/.test(file) && !/\.d\.ts$/.test(file) && !/\.(?:test|spec|stories)\./.test(file) && !/(?:^|\/)__tests__\//.test(file)

interface PropTypes {
  optional: Set<string>
}

/** The optional members of a props type the file declares (an inline literal, or an interface or alias in the same file); null when the type is not readable here. */
function propTypesOf(type: ts.TypeNode | undefined, source: ts.SourceFile, seen: Set<string> = new Set()): PropTypes | null {
  if (!type) return null
  if (ts.isParenthesizedTypeNode(type)) return propTypesOf(type.type, source, seen)
  const optional = new Set<string>()
  const addMembers = (members: ts.NodeArray<ts.TypeElement>): void => {
    for (const member of members) {
      if (!(ts.isPropertySignature(member) || ts.isMethodSignature(member)) || !member.questionToken) continue
      const name = propertyName(member.name)
      if (name) optional.add(name)
    }
  }
  if (ts.isTypeLiteralNode(type)) {
    addMembers(type.members)
    return { optional }
  }
  if (ts.isIntersectionTypeNode(type)) {
    for (const part of type.types) for (const name of propTypesOf(part, source, seen)?.optional ?? []) optional.add(name)
    return { optional }
  }
  if (ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName) && !seen.has(type.typeName.text)) {
    const wanted = type.typeName.text
    seen.add(wanted)
    for (const statement of source.statements) {
      if (ts.isInterfaceDeclaration(statement) && statement.name.text === wanted) {
        addMembers(statement.members)
        for (const clause of statement.heritageClauses ?? []) for (const base of clause.types) if (ts.isIdentifier(base.expression)) for (const name of propTypesOf(ts.factory.createTypeReferenceNode(base.expression.text), source, seen)?.optional ?? []) optional.add(name)
        return { optional }
      }
      if (ts.isTypeAliasDeclaration(statement) && statement.name.text === wanted) return propTypesOf(statement.type, source, seen)
    }
  }
  return null
}

const isNoopFunction = (node: ts.Expression): boolean => {
  const value = unwrap(node)
  if (ts.isIdentifier(value)) return /^(?:noop|undefined)$/.test(value.text)
  if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) return ts.isBlock(value.body) ? value.body.statements.length === 0 : ts.isIdentifier(unwrap(value.body)) && (unwrap(value.body) as ts.Identifier).text === 'undefined'
  return false
}

const functionOf = (initializer: ts.Expression): ts.ArrowFunction | ts.FunctionExpression | null => {
  const node = unwrap(initializer)
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return node
  if (ts.isCallExpression(node) && /(?:^|\.)memo$/.test(node.expression.getText()) && node.arguments[0]) return functionOf(node.arguments[0])
  return null
}

const rendersJsx = (fn: ts.FunctionLikeDeclaration): boolean => {
  let found = false
  const visit = (node: ts.Node): void => {
    if (found) return
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) found = true
    else ts.forEachChild(node, visit)
  }
  if (fn.body) visit(fn.body)
  return found
}

function controlsOf(name: string, fn: ts.FunctionLikeDeclaration, source: ts.SourceFile): ForwardingControl[] {
  const parameter = fn.parameters[0]
  if (!parameter || !fn.body) return []
  const types = propTypesOf(parameter.type, source)
  if (!types || types.optional.size === 0) return []

  // The names the component's props go by inside it: destructured (with any default) or read off the props object.
  const bindings = new Map<string, string>()
  const noDefault = new Set<string>()
  let propsVar: string | null = null
  if (ts.isObjectBindingPattern(parameter.name)) {
    for (const element of parameter.name.elements) {
      if (element.dotDotDotToken || !ts.isIdentifier(element.name)) continue
      const prop = element.propertyName ? propertyName(element.propertyName) : element.name.text
      if (!prop) continue
      bindings.set(element.name.text, prop)
      if (!element.initializer || isNoopFunction(element.initializer)) noDefault.add(prop)
    }
  } else if (ts.isIdentifier(parameter.name)) propsVar = parameter.name.text

  const calleeProp = (expression: ts.Expression): string | null => {
    const node = unwrap(expression)
    if (ts.isIdentifier(node)) return bindings.get(node.text) ?? null
    if (propsVar && ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === propsVar) return node.name.text
    return null
  }
  const mentions = (node: ts.Node, prop: string): boolean => {
    let found = false
    const visit = (child: ts.Node): void => {
      if (found) return
      if (ts.isExpression(child) && calleeProp(child) === prop) found = true
      else ts.forEachChild(child, visit)
    }
    visit(node)
    return found
  }

  const forwards = (node: ts.Node): string | null => {
    if (ts.isAwaitExpression(node) || ts.isVoidExpression(node) || ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node)) return forwards(node.expression)
    if (ts.isCallExpression(node)) return calleeProp(node.expression)
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      const guard = calleeProp(node.left)
      const rest = forwards(node.right)
      return guard && guard === rest ? rest : null
    }
    return null
  }
  const isNoise = (statement: ts.Statement): boolean =>
    ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) && ts.isPropertyAccessExpression(statement.expression.expression) && NOISE_CALLS.has(statement.expression.expression.name.text)
  const statementForwards = (statement: ts.Statement): string | null => {
    if (ts.isExpressionStatement(statement)) return forwards(statement.expression)
    if (ts.isReturnStatement(statement)) return statement.expression ? forwards(statement.expression) : null
    if (ts.isIfStatement(statement) && !statement.elseStatement) {
      const guard = calleeProp(statement.expression)
      const inner = ts.isBlock(statement.thenStatement) ? sequenceForwards(statement.thenStatement.statements) : statementForwards(statement.thenStatement)
      return guard && guard === inner ? inner : null
    }
    return null
  }
  const sequenceForwards = (statements: readonly ts.Statement[]): string | null => {
    let found: string | null = null
    for (const statement of statements) {
      if (isNoise(statement)) continue
      const forwarded = statementForwards(statement)
      if (!forwarded || (found && forwarded !== found)) return null
      found = forwarded
    }
    return found
  }
  const handlerForwards = (expression: ts.Expression): string | null => {
    const handler = unwrap(expression)
    const direct = calleeProp(handler)
    if (direct) return direct
    if (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) return ts.isBlock(handler.body) ? sequenceForwards(handler.body.statements) : forwards(handler.body)
    return null
  }

  /** The control is not offered without the callback: disabled by its absence, or rendered only when it is there. */
  const guardedBy = (element: ts.JsxOpeningLikeElement, prop: string): boolean => {
    for (const attribute of element.attributes.properties) if (ts.isJsxAttribute(attribute) && attribute.name.getText() === 'disabled' && attribute.initializer && mentions(attribute.initializer, prop)) return true
    const target = ts.isJsxOpeningElement(element) ? element.parent : element
    for (let node: ts.Node = target; node.parent && node !== fn; node = node.parent) {
      const parent: ts.Node = node.parent
      if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && parent.right === node && mentions(parent.left, prop)) return true
      if (ts.isConditionalExpression(parent) && parent.whenTrue === node && mentions(parent.condition, prop)) return true
      if (ts.isIfStatement(parent) && parent.thenStatement === node && mentions(parent.expression, prop)) return true
    }
    return false
  }

  const found: ForwardingControl[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (CONTROL_TAGS.has(node.tagName.getText())) {
        for (const attribute of node.attributes.properties) {
          if (!ts.isJsxAttribute(attribute) || !CONTROL_EVENTS.has(attribute.name.getText()) || !attribute.initializer || !ts.isJsxExpression(attribute.initializer) || !attribute.initializer.expression) continue
          const prop = handlerForwards(attribute.initializer.expression)
          const bound = prop !== null && types.optional.has(prop) && (propsVar !== null || noDefault.has(prop))
          if (prop && bound && !guardedBy(node, prop)) found.push({ component: name, prop, line: source.getLineAndCharacterOfPosition(attribute.getStart()).line + 1, text: attribute.getText().replace(/\s+/g, ' ').slice(0, 110) })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(fn.body)
  return found
}

export function readModule(file: string, text: string): ModuleFacts {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, /\.tsx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const facts: ModuleFacts = { controls: [], components: [], exports: new Map(), reexports: [], imports: new Map(), uses: [], valueRefs: new Set(), dynamicSpecifiers: [] }
  const hasModifier = (node: ts.Node, kind: ts.SyntaxKind): boolean => ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some((modifier) => modifier.kind === kind)

  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.importClause && !statement.importClause.isTypeOnly) {
      const specifier = statement.moduleSpecifier.text
      if (statement.importClause.name) facts.imports.set(statement.importClause.name.text, { specifier, name: 'default' })
      const bindings = statement.importClause.namedBindings
      if (bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements) if (!element.isTypeOnly) facts.imports.set(element.name.text, { specifier, name: (element.propertyName ?? element.name).text })
    } else if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
      const specifier = statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : null
      if (!statement.exportClause) {
        if (specifier) facts.reexports.push({ specifier, name: '*', from: '*' })
      } else if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          const exported = element.name.text
          const local = (element.propertyName ?? element.name).text
          if (specifier) facts.reexports.push({ specifier, name: exported, from: local })
          else facts.exports.set(exported, local)
        }
      }
    } else if (ts.isExportAssignment(statement) && ts.isIdentifier(statement.expression)) facts.exports.set('default', statement.expression.text)
    else if (ts.isFunctionDeclaration(statement) && statement.name && hasModifier(statement, ts.SyntaxKind.ExportKeyword)) facts.exports.set(hasModifier(statement, ts.SyntaxKind.DefaultKeyword) ? 'default' : statement.name.text, statement.name.text)
    else if (ts.isVariableStatement(statement) && hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
      for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name)) facts.exports.set(declaration.name.text, declaration.name.text)
    }
  }

  const components: Array<{ name: string; fn: ts.FunctionLikeDeclaration }> = []
  for (const statement of source.statements) {
    const declared = ts.isVariableStatement(statement) ? statement : null
    if (ts.isFunctionDeclaration(statement) && statement.name && /^[A-Z]/.test(statement.name.text) && statement.body) components.push({ name: statement.name.text, fn: statement })
    else if (declared) {
      for (const declaration of declared.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !/^[A-Z]/.test(declaration.name.text) || !declaration.initializer) continue
        const fn = functionOf(declaration.initializer)
        if (fn) components.push({ name: declaration.name.text, fn })
      }
    }
  }
  for (const { name, fn } of components) {
    if (rendersJsx(fn)) facts.components.push({ name, line: source.getLineAndCharacterOfPosition(fn.getStart()).line + 1 })
    facts.controls.push(...controlsOf(name, fn, source))
  }

  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (ts.isIdentifier(node.tagName) && /^[A-Z]/.test(node.tagName.text)) {
        const props: string[] = []
        let spread = false
        for (const attribute of node.attributes.properties) {
          if (ts.isJsxSpreadAttribute(attribute)) spread = true
          else props.push(attribute.name.getText())
        }
        facts.uses.push({ local: node.tagName.text, props, spread, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1 })
      }
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) facts.dynamicSpecifiers.push(node.arguments[0].text)
    else if (ts.isIdentifier(node) && /^[A-Z]/.test(node.text)) {
      const parent = node.parent
      const notAValue =
        ts.isJsxOpeningElement(parent) || ts.isJsxSelfClosingElement(parent) || ts.isJsxClosingElement(parent) ||
        ts.isImportSpecifier(parent) || ts.isImportClause(parent) || ts.isExportSpecifier(parent) || ts.isExportAssignment(parent) ||
        (ts.isPropertyAccessExpression(parent) && parent.name === node) || (ts.isPropertyAssignment(parent) && parent.name === node) ||
        ((ts.isFunctionDeclaration(parent) || ts.isVariableDeclaration(parent) || ts.isParameter(parent) || ts.isBindingElement(parent) || ts.isClassDeclaration(parent)) && parent.name === node) ||
        ts.isTypeReferenceNode(parent) || ts.isTypeQueryNode(parent) || ts.isQualifiedName(parent) || ts.isExpressionWithTypeArguments(parent) || ts.isInterfaceDeclaration(parent) || ts.isTypeAliasDeclaration(parent)
      if (!notAValue) facts.valueRefs.add(node.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return facts
}

export interface UnwiredFinding {
  file: string
  component: string
  prop: string
  line: number
  text: string
  /** How many places render the component, none of which passes the prop. */
  uses: number
}

export interface Usage {
  uses: number
  supplied: Set<string>
  spread: boolean
  /** Used as a value or loaded dynamically: how it is rendered is not known. */
  unknown: boolean
}

type Resolver = (from: string, specifier: string, known: ReadonlySet<string>) => string | null

/** Where each component is rendered across the files: keyed `file#LocalName`, following imports and re-exports to the file that declares it. */
export function collectUsage(facts: ReadonlyMap<string, ModuleFacts>, known: ReadonlySet<string>, resolve: Resolver): Map<string, Usage> {
  const resolveExport = (file: string, name: string, depth = 0): { file: string; local: string } | null => {
    const fileFacts = facts.get(file)
    if (!fileFacts || depth > 6) return null
    const local = fileFacts.exports.get(name)
    if (local !== undefined) return { file, local }
    for (const reexport of fileFacts.reexports) {
      if (reexport.name !== name && !(reexport.name === '*' && name !== 'default')) continue
      const target = resolve(file, reexport.specifier, known)
      const found = target ? resolveExport(target, reexport.name === '*' ? name : reexport.from, depth + 1) : null
      if (found) return found
    }
    return null
  }
  const target = (file: string, local: string): { file: string; local: string } | null => {
    const fileFacts = facts.get(file)
    const imported = fileFacts?.imports.get(local)
    if (imported) {
      const resolved = resolve(file, imported.specifier, known)
      return resolved ? resolveExport(resolved, imported.name) : null
    }
    return { file, local }
  }

  const usage = new Map<string, Usage>()
  const entry = (key: string): Usage => {
    const existing = usage.get(key)
    if (existing) return existing
    const created: Usage = { uses: 0, supplied: new Set(), spread: false, unknown: false }
    usage.set(key, created)
    return created
  }
  for (const [file, fileFacts] of facts) {
    for (const use of fileFacts.uses) {
      const found = target(file, use.local)
      if (!found) continue
      const record = entry(`${found.file}#${found.local}`)
      record.uses += 1
      record.spread ||= use.spread
      for (const prop of use.props) record.supplied.add(prop)
    }
    for (const name of fileFacts.valueRefs) {
      const found = target(file, name)
      if (found) entry(`${found.file}#${found.local}`).unknown = true
    }
    for (const specifier of fileFacts.dynamicSpecifiers) {
      const resolved = resolve(file, specifier, known)
      const loaded = resolved ? facts.get(resolved) : undefined
      if (resolved && loaded) for (const local of new Set(loaded.exports.values())) entry(`${resolved}#${local}`).unknown = true
    }
  }
  return usage
}

/**
 * Joins the per-file facts: for each control that only forwards to an optional prop, whether any parent passes that prop. A component rendered nowhere is not judged
 * here (see unrenderedComponents); one rendered through a spread, as a value or by a dynamic import is not judged either.
 */
export function judgeUnwired(facts: ReadonlyMap<string, ModuleFacts>, known: ReadonlySet<string>, resolve: Resolver): UnwiredFinding[] {
  const usage = collectUsage(facts, known, resolve)
  const findings: UnwiredFinding[] = []
  for (const [file, fileFacts] of facts) {
    for (const control of fileFacts.controls) {
      const record = usage.get(`${file}#${control.component}`)
      if (!record || record.uses === 0 || record.spread || record.unknown || record.supplied.has(control.prop)) continue
      findings.push({ file, component: control.component, prop: control.prop, line: control.line, text: control.text, uses: record.uses })
    }
  }
  return findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
}

export interface UnrenderedComponent {
  file: string
  component: string
  line: number
}

/**
 * Components a file declares and exports that nothing renders, passes as a value or loads dynamically.
 */
export function unrenderedComponents(facts: ReadonlyMap<string, ModuleFacts>, known: ReadonlySet<string>, resolve: Resolver, isFrameworkFile: (file: string) => boolean): UnrenderedComponent[] {
  const usage = collectUsage(facts, known, resolve)
  const out: UnrenderedComponent[] = []
  for (const [file, fileFacts] of facts) {
    if (isFrameworkFile(file)) continue
    const exported = new Set(fileFacts.exports.values())
    for (const component of fileFacts.components) {
      if (!exported.has(component.name)) continue
      const record = usage.get(`${file}#${component.name}`)
      if (record && (record.uses > 0 || record.unknown)) continue
      out.push({ file, component: component.name, line: component.line })
    }
  }
  return out.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
}
