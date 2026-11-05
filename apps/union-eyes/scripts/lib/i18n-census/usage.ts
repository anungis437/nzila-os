/**
 * Where a screen asks for a translated message (UE-CONV-H-024). Pure: the uses come from one file's source text, read syntactically.
 *
 * `const t = useTranslations('billing')` / `await getTranslations({ locale, namespace: 'billing' })` bind a translator to a namespace, and `t('title')` then asks
 * for `billing.title`. A key the catalogs do not carry renders as the key itself ("billing.title") and logs an error, and no unit test sees it: the component
 * is tested with a mocked translator or with a different catalog than the one the application loads. The translator is resolved by scope, so two components in
 * one file that each call their translator `t` for different namespaces are told apart, and a function that merely receives a translator as a parameter (whose
 * namespace this file cannot know) is not judged here.
 */
import ts from 'typescript'

export type CallKind = 'plain' | 'rich' | 'raw' | 'markup' | 'has'

export interface TranslationUse {
  line: number
  /** The namespace the translator was bound to (empty for the root). */
  namespace: string
  /** The key as written, or null when the key is computed. */
  key: string | null
  /** For a computed key written as a template, the literal text before its first substitution ("status." in `status.${state}`). */
  prefix: string | null
  call: CallKind
  /** The names the call passes values for; null when the values are not an object literal (a variable, a spread, an expression). */
  provides: string[] | null
}

export interface UsesInFile {
  uses: TranslationUse[]
  /** Translators whose namespace could not be read (a computed namespace), and so were not judged. */
  unresolved: number
}

const TRANSLATOR_FACTORIES = new Set(['useTranslations', 'getTranslations'])
const METHODS: Record<string, CallKind> = { rich: 'rich', raw: 'raw', markup: 'markup', has: 'has' }

const unwrap = (expression: ts.Expression): ts.Expression => {
  let current = expression
  while (ts.isAwaitExpression(current) || ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isNonNullExpression(current) || ts.isSatisfiesExpression(current)) current = current.expression
  return current
}

/** The namespace a factory call binds: its string argument, or the `namespace` of an options object; '' with no argument; null when it is computed. */
function namespaceOf(call: ts.CallExpression): string | null {
  const argument = call.arguments[0]
  if (!argument) return ''
  if (ts.isStringLiteralLike(argument)) return argument.text
  if (ts.isObjectLiteralExpression(argument)) {
    const property = argument.properties.find((candidate): candidate is ts.PropertyAssignment => ts.isPropertyAssignment(candidate) && (ts.isIdentifier(candidate.name) || ts.isStringLiteralLike(candidate.name)) && candidate.name.text === 'namespace')
    if (!property) return ''
    return ts.isStringLiteralLike(property.initializer) ? property.initializer.text : null
  }
  return null
}

/** The factory names this file imports (`useTranslations as useT`), plus the plain names. */
function factoryNames(source: ts.SourceFile): Set<string> {
  const names = new Set(TRANSLATOR_FACTORIES)
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || !/^(?:next-intl|use-intl)(?:\/|$)/.test(statement.moduleSpecifier.text)) continue
    const bindings = statement.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue
    for (const element of bindings.elements) if (element.propertyName && TRANSLATOR_FACTORIES.has(element.propertyName.text)) names.add(element.name.text)
  }
  return names
}

const isScope = (node: ts.Node): boolean =>
  ts.isSourceFile(node) || ts.isBlock(node) || ts.isModuleBlock(node) || ts.isCaseClause(node) || ts.isDefaultClause(node) || ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node) || ts.isCatchClause(node) || ts.isFunctionLike(node)

export function findTranslationUses(file: string, text: string): UsesInFile {
  if (!/useTranslations|getTranslations|from ['"](?:next-intl|use-intl)/.test(text)) return { uses: [], unresolved: 0 }
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, /\.tsx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const factories = factoryNames(source)

  // What each scope binds a name to: a namespace, or null when the name is a translator whose namespace is not known here (or a parameter that shadows one).
  const bindings = new Map<ts.Node, Map<string, string | null>>()
  const bind = (scope: ts.Node, name: string, namespace: string | null): void => {
    const names = bindings.get(scope) ?? new Map<string, string | null>()
    names.set(name, namespace)
    bindings.set(scope, names)
  }
  const scopeOf = (node: ts.Node): ts.Node => {
    for (let ancestor: ts.Node | undefined = node.parent; ancestor; ancestor = ancestor.parent) if (isScope(ancestor)) return ancestor
    return source
  }
  let unresolved = 0

  const declare = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const initializer = node.initializer ? unwrap(node.initializer) : null
      if (initializer && ts.isCallExpression(initializer) && ts.isIdentifier(initializer.expression) && factories.has(initializer.expression.text)) {
        const namespace = namespaceOf(initializer)
        if (namespace === null) unresolved += 1
        bind(scopeOf(node), node.name.text, namespace)
      } else bind(scopeOf(node), node.name.text, null)
    } else if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
      bind(node.parent, node.name.text, null)
    } else if (ts.isBindingElement(node) && ts.isIdentifier(node.name)) {
      bind(scopeOf(node), node.name.text, null)
    }
    ts.forEachChild(node, declare)
  }
  declare(source)

  const lookup = (from: ts.Node, name: string): string | null | undefined => {
    for (let ancestor: ts.Node | undefined = from.parent; ancestor; ancestor = ancestor.parent) {
      const names = bindings.get(ancestor)
      if (names?.has(name)) return names.get(name)
    }
    return undefined
  }

  const uses: TranslationUse[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      let callee = node.expression
      let call: CallKind = 'plain'
      if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.name.text in METHODS) {
        call = METHODS[callee.name.text]
        callee = callee.expression
      }
      if (ts.isIdentifier(callee)) {
        const namespace = lookup(node, callee.text)
        const argument = node.arguments[0]
        if (typeof namespace === 'string' && argument) {
          let key: string | null = null
          let prefix: string | null = null
          if (ts.isStringLiteralLike(argument)) key = argument.text
          else if (ts.isTemplateExpression(argument)) prefix = argument.head.text
          const values = node.arguments[1]
          const names = (object: ts.ObjectLiteralExpression): string[] => object.properties.map((property) => (property.name && (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) ? property.name.text : '')).filter(Boolean)
          const provides = !values ? [] : ts.isObjectLiteralExpression(values) && !values.properties.some(ts.isSpreadAssignment) ? names(values) : null
          uses.push({ line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, namespace, key, prefix, call, provides })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return { uses, unresolved }
}
