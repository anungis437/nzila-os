/**
 * Which database handle each statement runs on (UE-CONV-H-019).
 *
 * `db` (db/db.ts) is an ambient handle: inside withRLSContext / withSystemContext it resolves to that transaction, and anywhere else it is the pooled
 * connection with no organization set, on which row-level security shows a tenant table as empty and a system table as forbidden. A route that reads a
 * tenant table through it outside a transaction therefore answers with nothing (or, where a role bypasses row-level security, with every organization's
 * rows), and no unit test notices, because the unit test replaces the database. The route-coverage and code-to-database censuses cannot see it either:
 * the SQL is valid, only the handle is wrong.
 *
 * This reads the program with the TypeScript checker and answers the question where it is asked. A statement is "ambient" when it names the ambient handle
 * and is not lexically inside a callback handed to a context wrapper (or to `withApi({ rlsOrgContext: true })`, which runs its handler in one). It is a
 * finding when something that runs can reach it with no wrapper on the way: the entry points (route handlers, pages, server actions) start with no context,
 * and an edge (a reference from one top-level declaration to another) carries the context only if the reference sits inside a wrapper callback. What the
 * statement touches is read from the builder chain (`.from(table)`, `.insert(table)`...) or the SQL text, and judged against the storage-authority manifest:
 * a tenant table needs a tenant transaction, a system table the system context, reference data neither.
 *
 * Over-approximate by design, as liveness is: any reference to a declaration counts as an edge. A finding is "something may reach it", and carries one
 * witness path so it can be checked.
 */
import path from 'node:path'
import ts from 'typescript'

export type Needs = 'TENANT' | 'SYSTEM' | 'OPEN' | 'UNCLASSIFIED'

export interface TableAuthority {
  classification: string
  principal: string
}

export interface AmbientSite {
  file: string
  line: number
  /** `relative/file.ts#name`: the top-level declaration the statement is in. */
  declaration: string
  /** The method called on the handle (`select`, `insert`, `update`, `delete`, `execute`, `transaction`, `query`), or `passed` when the handle itself is handed on. */
  method: string
  /** Physical tables the statement names; empty when none could be resolved. */
  tables: string[]
  needs: Needs
}

export interface AmbientFinding extends AmbientSite {
  /** One entry point that reaches the statement with no context, then each declaration on the way. */
  witness: string[]
}

export interface AmbientReport {
  declarations: number
  edges: number
  entries: number
  sites: number
  findings: AmbientFinding[]
  /** Statements on a database handle that something runs, judged against the privileges of the role they run as (0 unless the caller supplied them). */
  statements: number
  /** Of those, the ones whose tables could not all be resolved to a table the manifest knows, so no privilege could be judged. */
  unjudged: number
  privilegeFindings: PrivilegeFinding[]
}

export type Operation = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'

/** What each database role may do to a table: the storage-authority manifest's `requiredRuntimePrivileges` and `requiredSystemPrivileges`. */
export interface TablePrivileges {
  runtime: ReadonlySet<string>
  system: ReadonlySet<string>
}

/** A statement some entry point runs as a role that has not been granted what the statement does: the database answers it "permission denied". */
export interface PrivilegeFinding {
  file: string
  line: number
  /** `relative/file.ts#name`: the top-level declaration the statement is in. */
  declaration: string
  /** The role it runs as: the runtime role (a tenant transaction, or the ambient handle outside any) or the system role. */
  principal: 'RUNTIME' | 'SYSTEM'
  table: string
  operation: Operation
  /** What else the statement needs on the table for this one to run (a WHERE or RETURNING reads columns: SELECT). */
  reason: string
  /** `lexical`: the statement is inside the wrapper that decides its role. `reached`: it is in a helper that an entry point reaches in that role. */
  via: 'lexical' | 'reached'
  /** One entry point that reaches the statement in that role, then each declaration on the way. */
  witness: string[]
}

type Kind = 'none' | 'tenant' | 'system'

const WRAPPERS = new Set(['withRLSContext', 'withExplicitUserContext', 'withSystemContext', 'withSystemRLSContext', 'withPlatformAdminRLSContext', 'createSecureServerAction', 'withRLS'])
// These three run the callback on the system role's own connection; every other wrapper (and withApi when it opens a transaction) runs it as the runtime role.
const SYSTEM_WRAPPERS = new Set(['withSystemContext', 'withSystemRLSContext', 'withPlatformAdminRLSContext'])
// A wrapper that opens a tenant transaction for one kind of caller and a system one for another, so its callback is judged as both roles.
const DUAL_ROLE_WRAPPERS = new Set(['withClaimedWorkbookAccess'])
const STATEMENT_METHODS = new Set(['select', 'selectDistinct', 'insert', 'update', 'delete', 'execute'])
const DB_METHODS = new Set(['select', 'selectDistinct', 'insert', 'update', 'delete', 'execute', 'transaction', 'query', 'with', '$count'])
const TABLE_ARGUMENT_METHODS = new Set(['from', 'innerJoin', 'leftJoin', 'rightJoin', 'fullJoin', 'crossJoin', 'insert', 'update', 'delete'])
const MODULE = '<module>'
const NEXT_ENTRY = /^(?:.*\/)?(?:route|page|layout|template|default)\.(?:ts|tsx)$/
// The context wrappers are what establishes a context, so their own use of the ambient handle (opening the transaction, reading its settings) is not a statement run outside one.
const CONTEXT_PRIMITIVES = /^(?:lib\/db\/with-rls-context|db\/db|db\/tenant-context-storage|db\/system-context-storage)\.ts$/
const SKIPPED = /^(?:db\/migrations|backend|mobile|archive|backups|nzila-scripts-book-template|scripts|e2e|tests|services\/financial-service)\/|(?:\/__tests__\/|\.test\.|\.spec\.|\/__mocks__\/)/

const keyOf = (file: string, name: string): string => `${file}#${name}`

function declaredNames(statement: ts.Statement): string[] {
  if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)) {
    const isDefault = statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)
    return [statement.name?.text ?? (isDefault ? 'default' : MODULE)]
  }
  if (ts.isVariableStatement(statement)) {
    const names: string[] = []
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text)
      else for (const element of declaration.name.elements) if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) names.push(element.name.text)
    }
    return names.length ? names : [MODULE]
  }
  if (ts.isExportAssignment(statement)) return ['default']
  return [MODULE]
}

type ClassMember = ts.MethodDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration | ts.ConstructorDeclaration | ts.PropertyDeclaration | ts.ClassStaticBlockDeclaration

const isClassMember = (node: ts.Node): node is ClassMember =>
  ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node) || ts.isConstructorDeclaration(node) || ts.isPropertyDeclaration(node) || ts.isClassStaticBlockDeclaration(node)

/**
 * A member that holds a value or only describes one, so reading it runs nothing: a property written in an object literal (`{ passed: ok }`, `{ organizationId }`) and a member of an anonymous type
 * (`Promise<{ rows: Row[] }>`). However deep inside a function either sits (the literal in its body, the type in its return annotation), the function is reached by a call, not by what is read
 * from what it returned. A method, or a property whose value is a function, is code and still reaches its declaration.
 */
const isDataMember = (declaration: ts.Declaration): boolean =>
  // A module (the source file `export * as inner` stands for) has no parent and is not a member.
  !!declaration.parent &&
  (((ts.isPropertySignature(declaration) || ts.isMethodSignature(declaration)) && ts.isTypeLiteralNode(declaration.parent)) ||
    (ts.isObjectLiteralExpression(declaration.parent) &&
      ((ts.isPropertyAssignment(declaration) && !ts.isArrowFunction(declaration.initializer) && !ts.isFunctionExpression(declaration.initializer)) || ts.isShorthandPropertyAssignment(declaration))))

/** A class written at the top of a file. Its members are declarations of their own: a call reaches the method it names, not every statement the class holds. */
const isTopLevelClass = (node: ts.Node): node is ts.ClassDeclaration => ts.isClassDeclaration(node) && ts.isSourceFile(node.parent)

const memberNameOf = (member: ClassMember): string => {
  if (ts.isConstructorDeclaration(member)) return 'constructor'
  if (ts.isClassStaticBlockDeclaration(member)) return `static@${member.pos}`
  return ts.isIdentifier(member.name) || ts.isStringLiteralLike(member.name) || ts.isPrivateIdentifier(member.name) ? member.name.text : member.name.getText()
}

/** What runs when a class is constructed or defined: its constructor, the fields it initialises with something other than a function, and its static blocks. */
const runsWithClass = (member: ClassMember): boolean =>
  ts.isConstructorDeclaration(member) || ts.isClassStaticBlockDeclaration(member) || (ts.isPropertyDeclaration(member) && !!member.initializer && !ts.isArrowFunction(member.initializer) && !ts.isFunctionExpression(member.initializer))

export function needsOf(authority: TableAuthority | undefined): Needs {
  if (!authority) return 'UNCLASSIFIED'
  if (authority.classification === 'SYSTEM_ONLY') return 'SYSTEM'
  if (authority.classification === 'GLOBAL_REFERENCE_DATA' || authority.principal === 'NONE') return 'OPEN'
  if (/^(TENANT_RLS_REQUIRED|PARENT_OWNED_RLS_REQUIRED|MIXED_GLOBAL_TENANT_RLS_REQUIRED)$/.test(authority.classification)) return 'TENANT'
  return 'UNCLASSIFIED'
}

/**
 * The wrapper runs the handler in a tenant transaction: always when the route asks (`rlsOrgContext: true`), and, in the canonical (V2) state, for every
 * authenticated route that requires an organization (with-api.ts: `currentStateContextEnabled() && requireAuth && requireOrg`).
 */
function runsInTenantTransaction(call: ts.CallExpression, mode: Mode): boolean {
  if (!ts.isIdentifier(call.expression) || call.expression.text !== 'withApi') return false
  const config = call.arguments[0]
  if (config && !ts.isObjectLiteralExpression(config)) return mode === 'v2'
  const properties = config && ts.isObjectLiteralExpression(config) ? config.properties.filter(ts.isPropertyAssignment) : []
  const property = (properties0: readonly ts.PropertyAssignment[], name: string) => properties0.find((candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === name)
  if (property(properties, 'rlsOrgContext')?.initializer.kind === ts.SyntaxKind.TrueKeyword) return true
  if (mode === 'legacy') return false
  const auth = property(properties, 'auth')?.initializer
  const authProperties = auth && ts.isObjectLiteralExpression(auth) ? auth.properties.filter(ts.isPropertyAssignment) : []
  const unauthenticated = property(authProperties, 'required')?.initializer.kind === ts.SyntaxKind.FalseKeyword || !!property(authProperties, 'cron') || !!property(authProperties, 'machine')
  const orgNotRequired = property(properties, 'requireOrg')?.initializer.kind === ts.SyntaxKind.FalseKeyword
  return !unauthenticated && !orgNotRequired
}

/** `legacy`: only a route that asks for a tenant transaction gets one. `v2`: every authenticated route that requires an organization does (the canonical state). */
export type Mode = 'legacy' | 'v2'

export function analyzeAmbientHandle(
  program: ts.Program,
  appRoot: string,
  authorityOf: (table: string) => TableAuthority | undefined,
  mode: Mode = 'v2',
  privilegesOf?: (table: string) => TablePrivileges | undefined,
): AmbientReport {
  const checker = program.getTypeChecker()
  const root = appRoot.replace(/\\/g, '/')
  const relativeOf = (file: ts.SourceFile): string | null => {
    const name = file.fileName.replace(/\\/g, '/')
    if (file.isDeclarationFile || name.includes('/node_modules/') || !name.startsWith(`${root}/`) || !/\.(m?tsx?)$/.test(name)) return null
    return name.slice(root.length + 1)
  }

  // The ambient handle is the `db` that db/db.ts exports; every import of it, through any re-export, resolves to that one symbol.
  const dbModule = program.getSourceFile(path.join(appRoot, 'db', 'db.ts'))
  const moduleSymbol = dbModule ? checker.getSymbolAtLocation(dbModule) : undefined
  const ambient = moduleSymbol ? checker.getExportsOfModule(moduleSymbol).find((symbol) => symbol.name === 'db') : undefined
  if (!ambient) throw new Error('db/db.ts does not export `db`: the ambient handle cannot be identified')
  const resolveAlias = (symbol: ts.Symbol | undefined): ts.Symbol | undefined => (symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol)

  const memberKeyOf = (relative: string, member: ClassMember): string => keyOf(relative, `${declaredNames(member.parent as ts.ClassDeclaration)[0]}.${memberNameOf(member)}`)

  // Who implements or extends what, and which classes have a member of a given name: read once, when a call goes through an interface, a base class or a value typed `any`.
  const heritageChildren = new Map<ts.Symbol, Array<ts.ClassDeclaration | ts.InterfaceDeclaration>>()
  const classMembersNamed = new Map<string, string[]>()
  let classIndexBuilt = false
  const buildClassIndex = (): void => {
    classIndexBuilt = true
    for (const source of program.getSourceFiles()) {
      const relative = relativeOf(source)
      if (!relative) continue
      for (const statement of source.statements) {
        if (isTopLevelClass(statement)) {
          for (const member of statement.members) {
            if (!isClassMember(member) || ts.isConstructorDeclaration(member) || ts.isClassStaticBlockDeclaration(member)) continue
            const name = memberNameOf(member)
            classMembersNamed.set(name, [...(classMembersNamed.get(name) ?? []), memberKeyOf(relative, member)])
          }
        }
        if (!isTopLevelClass(statement) && !ts.isInterfaceDeclaration(statement)) continue
        for (const clause of statement.heritageClauses ?? []) {
          for (const type of clause.types) {
            const parent = resolveAlias(checker.getSymbolAtLocation(type.expression))
            if (parent) heritageChildren.set(parent, [...(heritageChildren.get(parent) ?? []), statement])
          }
        }
      }
    }
  }

  /** The members named `name` that a call on a value typed as `container` can dispatch to: the ones the classes that implement or extend it declare, or inherit. */
  const overridesOf = (container: ts.ClassDeclaration | ts.InterfaceDeclaration, name: string): string[] => {
    if (!classIndexBuilt) buildClassIndex()
    const keys: string[] = []
    const seen = new Set<ts.Symbol>()
    const start = container.name ? checker.getSymbolAtLocation(container.name) : undefined
    const queue: ts.Symbol[] = start ? [start] : []
    for (let head = 0; head < queue.length; head += 1) {
      const symbol = queue[head]
      if (seen.has(symbol)) continue
      seen.add(symbol)
      for (const child of heritageChildren.get(symbol) ?? []) {
        const childSymbol = child.name ? checker.getSymbolAtLocation(child.name) : undefined
        if (!childSymbol) continue
        queue.push(childSymbol)
        if (!ts.isClassDeclaration(child)) continue
        for (const declaration of checker.getPropertyOfType(checker.getDeclaredTypeOfSymbol(childSymbol), name)?.declarations ?? []) {
          const relative = relativeOf(declaration.getSourceFile())
          if (relative && isClassMember(declaration) && isTopLevelClass(declaration.parent)) keys.push(memberKeyOf(relative, declaration))
        }
      }
    }
    return keys
  }

  /** The declarations a symbol stands for, resolved through imports and re-exports to where they are written. */
  const targetsOf = (resolved: ts.Symbol | undefined): string[] => {
    if (!resolved) return []
    const keys: string[] = []
    for (const declaration of resolved.declarations ?? []) {
      const relative = relativeOf(declaration.getSourceFile())
      if (!relative) continue
      if (ts.isSourceFile(declaration)) {
        keys.push(keyOf(relative, '*'))
        continue
      }
      if (isClassMember(declaration) && isTopLevelClass(declaration.parent)) {
        keys.push(memberKeyOf(relative, declaration), ...overridesOf(declaration.parent, memberNameOf(declaration)))
        continue
      }
      if ((ts.isMethodSignature(declaration) || ts.isPropertySignature(declaration)) && ts.isInterfaceDeclaration(declaration.parent)) {
        keys.push(...overridesOf(declaration.parent, declaration.name.getText()))
        continue
      }
      let node: ts.Node = declaration
      let named: string | null = null
      while (node.parent && !ts.isSourceFile(node.parent)) {
        if ((ts.isVariableDeclaration(node) || ts.isBindingElement(node)) && ts.isIdentifier(node.name) && !named) named = node.name.text
        node = node.parent
      }
      if (!node.parent || !ts.isSourceFile(node.parent)) continue
      if (ts.isVariableStatement(node)) keys.push(...(named ? [keyOf(relative, named)] : declaredNames(node).map((name) => keyOf(relative, name))))
      else keys.push(...declaredNames(node as ts.Statement).map((name) => keyOf(relative, name)))
      // Naming a class runs what runs with it, not its methods: they are reached by the call that names them.
      if (isTopLevelClass(node)) for (const member of node.members) if (isClassMember(member) && runsWithClass(member)) keys.push(memberKeyOf(relative, member))
    }
    return keys
  }

  /** What `file#*` (a namespace or dynamic import of the module) stands for: everything the module exports, through any re-export, and the statements that run when it loads. */
  const starTargets = new Map<string, string[]>()
  const exportsOf = (star: string): string[] => {
    const known = starTargets.get(star)
    if (known) return known
    const file = star.slice(0, -2)
    const source = program.getSourceFile(path.join(appRoot, file))
    const moduleSymbol = source ? checker.getSymbolAtLocation(source) : undefined
    const keys = new Set<string>([keyOf(file, MODULE)])
    if (moduleSymbol) for (const exported of checker.getExportsOfModule(moduleSymbol)) for (const target of targetsOf(resolveAlias(exported))) keys.add(target)
    for (const member of byFile.get(file) ?? []) if (exportedDeclarations.has(member) || member.endsWith(`#${MODULE}`)) keys.add(member)
    starTargets.set(star, [...keys])
    return [...keys]
  }

  /** The physical table a drizzle table object stands for: its phantom `_` property carries the name as a literal type. A table of another schema (`pgSchema('user_management').table('users')`) is a different relation from the public one of the same name. */
  const tableNameOfType = (type: ts.Type, location: ts.Node): string | null => {
    const marker = checker.getPropertyOfType(checker.getNonNullableType(type), '_')
    if (!marker) return null
    const inner = checker.getTypeOfSymbolAtLocation(marker, location)
    const name = checker.getPropertyOfType(inner, 'name')
    if (!name || !checker.getPropertyOfType(inner, 'columns')) return null
    const literal = checker.getTypeOfSymbolAtLocation(name, location)
    if (!literal.isStringLiteral()) return null
    const schemaProperty = checker.getPropertyOfType(inner, 'schema')
    const schemaType = schemaProperty ? checker.getTypeOfSymbolAtLocation(schemaProperty, location) : undefined
    const schema = schemaType?.isStringLiteral() ? schemaType.value : undefined
    return schema && schema !== 'public' ? `${schema}.${literal.value}` : literal.value
  }
  const tableName = (expression: ts.Expression): string | null => tableNameOfType(checker.getTypeAtLocation(expression), expression)

  // `db.query.<key>` names a table by its export from the schema the handle was built with.
  const tableByExport = new Map<string, string>()
  const schemaModule = program.getSourceFile(path.join(appRoot, 'db', 'schema', 'index.ts')) ?? program.getSourceFile(path.join(appRoot, 'db', 'schema.ts'))
  const schemaSymbol = schemaModule ? checker.getSymbolAtLocation(schemaModule) : undefined
  if (schemaModule && schemaSymbol) {
    for (const symbol of checker.getExportsOfModule(schemaSymbol)) {
      const name = tableNameOfType(checker.getTypeOfSymbolAtLocation(resolveAlias(symbol) ?? symbol, schemaModule), schemaModule)
      if (name) tableByExport.set(symbol.name, name)
    }
  }

  /** A value a statement binds as a parameter, as opposed to a fragment of SQL or a table that is part of the statement. */
  const isParameter = (type: ts.Type): boolean => {
    if (type.isUnion()) return type.types.every(isParameter)
    return !!(type.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike | ts.TypeFlags.BigIntLike | ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void)) || checker.typeToString(type) === 'Date'
  }

  /** The tables a statement rooted at `db.<method>(...)` names: each `.from(t)`/`.innerJoin(t)`/... of the chain it begins, or the relations its SQL text names. `unresolved` when part of the statement cannot be read. */
  const tablesOfChain = (call: ts.CallExpression): { tables: string[]; unresolved: boolean; chain: ReadonlySet<string>; operations: Array<{ table: string; operation: Operation }> } => {
    const tables = new Set<string>()
    const chain = new Set<string>()
    const operations: Array<{ table: string; operation: Operation }> = []
    let unresolved = false
    const method = (call.expression as ts.PropertyAccessExpression).name.text
    if (method === 'execute') {
      // A statement kept in a named constant (`export const reminderQuery = sql\`...\``) is read where it is written, not left unjudged because its text is behind a name.
      const written = (argument: ts.Expression): ts.Expression => {
        if (!ts.isIdentifier(argument)) return argument
        const initializer = resolveAlias(checker.getSymbolAtLocation(argument))?.declarations?.find(ts.isVariableDeclaration)?.initializer
        return initializer && (ts.isTaggedTemplateExpression(initializer) || ts.isStringLiteralLike(initializer)) ? initializer : argument
      }
      for (const named of call.arguments) {
        const argument = written(named)
        let text = ''
        if (ts.isTaggedTemplateExpression(argument)) {
          if (ts.isNoSubstitutionTemplateLiteral(argument.template)) text = argument.template.text
          else {
            text = [argument.template.head.text, ...argument.template.templateSpans.map((span) => span.literal.text)].join(' ')
            // A substitution is a bound parameter, a table of the statement, or SQL spliced in whose text is not read here.
            for (const span of argument.template.templateSpans) {
              const name = tableName(span.expression)
              if (name) tables.add(name)
              else if (!isParameter(checker.getTypeAtLocation(span.expression))) unresolved = true
            }
          }
        } else if (ts.isStringLiteralLike(argument)) text = argument.text
        else unresolved = true
        // The verb decides the privilege: `insert into t` writes, `delete from t` deletes, `update t` updates, `from t` and `join t` read. (`do update set` is not a table.)
        for (const found of text.matchAll(/\b(insert\s+into|update|delete\s+from|from|join)\s+(?:only\s+)?(?:"?public"?\.)?"?(?!set\b)([a-z_][a-z0-9_]*)"?/gi)) {
          const verb = found[1].toLowerCase().replace(/\s+/g, ' ')
          const table = found[2].toLowerCase()
          tables.add(table)
          operations.push({ table, operation: verb === 'insert into' ? 'INSERT' : verb === 'update' ? 'UPDATE' : verb === 'delete from' ? 'DELETE' : 'SELECT' })
        }
      }
      return { tables: [...tables], unresolved, chain, operations }
    }
    // Climb the chain: db.select().from(a).innerJoin(b, ...).where(...).
    let link: ts.Node = call
    while (link.parent) {
      const parent: ts.Node = link.parent
      if (ts.isPropertyAccessExpression(parent) && parent.expression === link && parent.parent && ts.isCallExpression(parent.parent) && parent.parent.expression === parent) {
        const next = parent.parent
        chain.add(parent.name.text)
        if (TABLE_ARGUMENT_METHODS.has(parent.name.text) && next.arguments[0]) {
          const name = tableName(next.arguments[0])
          if (name) tables.add(name)
          else unresolved = true
        }
        link = next
      } else if (ts.isParenthesizedExpression(parent) || ts.isAwaitExpression(parent) || ts.isNonNullExpression(parent) || ts.isAsExpression(parent)) link = parent
      else break
    }
    if (TABLE_ARGUMENT_METHODS.has(method) && call.arguments[0]) {
      const name = tableName(call.arguments[0])
      if (name) tables.add(name)
      else unresolved = true
    }
    return { tables: [...tables], unresolved, chain, operations }
  }

  const inTypePosition = (node: ts.Node): boolean => {
    for (let ancestor: ts.Node | undefined = node.parent; ancestor && !ts.isSourceFile(ancestor); ancestor = ancestor.parent) if (ts.isTypeNode(ancestor)) return true
    return false
  }

  const edges = new Map<string, Map<string, boolean>>()
  const declarations = new Set<string>()
  // Handles that stand for the ambient one: the parameter of a transaction opened on it.
  const ambientAliases = new Set<ts.Symbol>()
  // `file#*` (a namespace or dynamic import of a module) stands for what the module exports; a declaration it does not export cannot be named from outside.
  const exportedDeclarations = new Set<string>()
  const entries = new Set<string>()
  const sitesByDeclaration = new Map<string, AmbientSite[]>()
  let siteCount = 0
  // The role each reference runs as: an edge made inside a wrapper runs as that wrapper's role, and one made outside inherits the caller's.
  const edgeKinds = new Map<string, Map<string, Set<Kind>>>()
  const addEdge = (from: string, to: string, inContext: boolean, kind: Kind = inContext ? 'tenant' : 'none'): void => {
    if (from === to) return
    const targets = edges.get(from) ?? new Map<string, boolean>()
    // An edge made both inside and outside a wrapper is an edge that can arrive with no context.
    targets.set(to, (targets.get(to) ?? true) && inContext)
    edges.set(from, targets)
    const kindTargets = edgeKinds.get(from) ?? new Map<string, Set<Kind>>()
    const kinds = kindTargets.get(to) ?? new Set<Kind>()
    kinds.add(kind)
    kindTargets.set(to, kinds)
    edgeKinds.set(from, kindTargets)
  }

  /** Whether an expression is a drizzle database handle: the ambient `db`, a transaction opened on it, or anything typed as one (the parameter a context wrapper hands its callback). */
  const isHandle = (expression: ts.Expression): boolean => {
    const symbol = resolveAlias(checker.getSymbolAtLocation(expression))
    if (symbol && (symbol === ambient || ambientAliases.has(symbol))) return true
    const type = checker.getTypeAtLocation(expression)
    return ['select', 'insert', 'update', 'delete'].every((name) => checker.getPropertyOfType(type, name) !== undefined)
  }

  interface StatementFacts {
    /** What the statement does to each table it names. */
    operations: Array<{ table: string; operation: Operation; reason: string }>
    unresolved: boolean
  }

  /**
   * What a call on a database handle asks of the database: which operation on which table, and what else that needs. A WHERE or a RETURNING reads the table's
   * columns, so an UPDATE, a DELETE or an INSERT ... RETURNING needs SELECT as well; an INSERT ... ON CONFLICT DO UPDATE needs UPDATE (and the conflict target's SELECT).
   * Null when the call is not a statement on a handle.
   */
  const statementOf = (call: ts.CallExpression): StatementFacts | null => {
    const callee = call.expression
    if (!ts.isPropertyAccessExpression(callee)) return null
    // db.query.<export>.findMany(...): a read of the table the schema export names.
    if (ts.isPropertyAccessExpression(callee.expression) && ts.isPropertyAccessExpression(callee.expression.expression) && callee.expression.expression.name.text === 'query' && isHandle(callee.expression.expression.expression)) {
      const table = tableByExport.get(callee.expression.name.text)
      return table ? { operations: [{ table, operation: 'SELECT', reason: 'a relational query reads the table' }], unresolved: false } : { operations: [], unresolved: true }
    }
    const method = callee.name.text
    if (!STATEMENT_METHODS.has(method) || !isHandle(callee.expression)) return null
    const { tables, unresolved, chain, operations: sqlOperations } = tablesOfChain(call)
    const operations: StatementFacts['operations'] = []
    const add = (table: string, operation: Operation, reason: string): void => {
      if (!operations.some((entry) => entry.table === table && entry.operation === operation)) operations.push({ table, operation, reason })
    }
    if (method === 'execute') {
      for (const entry of sqlOperations) {
        add(entry.table, entry.operation, 'the statement says so')
        if (entry.operation === 'UPDATE' || entry.operation === 'DELETE') add(entry.table, 'SELECT', 'an UPDATE or DELETE reads the columns of its WHERE')
      }
      for (const table of tables) if (!sqlOperations.some((entry) => entry.table === table)) add(table, 'SELECT', 'a table the statement splices in is read')
      return { operations, unresolved }
    }
    const root = method === 'insert' || method === 'update' || method === 'delete' ? (call.arguments[0] ? tableName(call.arguments[0]) : null) : null
    if (method === 'insert' && root) {
      add(root, 'INSERT', 'the statement inserts')
      if (chain.has('returning')) add(root, 'SELECT', 'RETURNING reads the inserted columns')
      if (chain.has('onConflictDoUpdate')) {
        add(root, 'UPDATE', 'ON CONFLICT DO UPDATE updates the existing row')
        add(root, 'SELECT', 'ON CONFLICT DO UPDATE reads the conflicting row')
      }
    } else if (method === 'update' && root) {
      add(root, 'UPDATE', 'the statement updates')
      if (chain.has('where') || chain.has('returning')) add(root, 'SELECT', 'an UPDATE reads the columns of its WHERE or RETURNING')
    } else if (method === 'delete' && root) {
      add(root, 'DELETE', 'the statement deletes')
      if (chain.has('where') || chain.has('returning')) add(root, 'SELECT', 'a DELETE reads the columns of its WHERE or RETURNING')
    }
    for (const table of tables) if (table !== root || method === 'select' || method === 'selectDistinct') add(table, 'SELECT', method === 'select' || method === 'selectDistinct' ? 'the statement reads the table' : 'a joined table is read')
    return { operations, unresolved }
  }

  interface StatementSite {
    file: string
    line: number
    declaration: string
    /** The role of the innermost wrapper around the statement in its own declaration; `none` when the declaration's caller decides. */
    lexical: Kind
    facts: StatementFacts
  }
  const statementSites: StatementSite[] = []

  // A helper that hands its own callback on to a context wrapper (`const inTenant = (organizationId, work) => withRLSContext({ organizationId }, work)`) is a wrapper too: what a call
  // passes in that position runs in the role of the wrapper behind it. Found by reading each function that calls a wrapper with one of its own parameters, to a fixed point.
  const forwarders = new Map<ts.Symbol, Map<number, Set<Kind>>>()
  const functionSymbol = (fn: ts.Node): ts.Symbol | undefined => {
    if ((ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn)) && fn.name) return checker.getSymbolAtLocation(fn.name)
    if ((ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && ts.isVariableDeclaration(fn.parent) && ts.isIdentifier(fn.parent.name)) return checker.getSymbolAtLocation(fn.parent.name)
    return undefined
  }
  const calleeSymbolOf = (call: ts.CallExpression): ts.Symbol | undefined => resolveAlias(checker.getSymbolAtLocation(ts.isPropertyAccessExpression(call.expression) ? call.expression.name : call.expression))
  const rolesOfWrapperCall = (call: ts.CallExpression): Kind[] => {
    const callee = call.expression
    const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : null
    if (name && WRAPPERS.has(name)) return [SYSTEM_WRAPPERS.has(name) ? 'system' : 'tenant']
    if (name && DUAL_ROLE_WRAPPERS.has(name)) return ['tenant', 'system']
    const symbol = calleeSymbolOf(call)
    return [...new Set([...(symbol ? forwarders.get(symbol)?.values() ?? [] : [])].flatMap((kinds) => [...kinds]))]
  }
  const referencesSymbol = (node: ts.Node, symbol: ts.Symbol): boolean => {
    let found = false
    const look = (child: ts.Node): void => {
      if (found) return
      if (ts.isIdentifier(child) && checker.getSymbolAtLocation(child) === symbol) {
        found = true
        return
      }
      ts.forEachChild(child, look)
    }
    look(node)
    return found
  }
  const discoverForwarders = (): void => {
    let pattern = /with(?:RLS|System|PlatformAdmin|Explicit|Claimed)|createSecureServerAction/
    for (let round = 0; round < 4; round += 1) {
      let added = false
      for (const source of program.getSourceFiles()) {
        const relative = relativeOf(source)
        if (!relative || SKIPPED.test(relative) || !pattern.test(source.text)) continue
        const scan = (node: ts.Node): void => {
          if (ts.isCallExpression(node)) {
            const roles = rolesOfWrapperCall(node)
            if (roles.length) {
              for (let ancestor: ts.Node | undefined = node.parent; ancestor; ancestor = ancestor.parent) {
                if (!ts.isFunctionLike(ancestor)) continue
                const owner = functionSymbol(ancestor)
                if (!owner) continue
                ancestor.parameters.forEach((parameter, index) => {
                  if (!ts.isIdentifier(parameter.name)) return
                  const symbol = checker.getSymbolAtLocation(parameter.name)
                  if (!symbol) return
                  // Only a parameter that is itself a function can be the work a wrapper runs.
                  const parameterType = checker.getTypeOfSymbolAtLocation(symbol, parameter)
                  if (!(parameterType.isUnion() ? parameterType.types : [parameterType]).some((member) => member.getCallSignatures().length > 0)) return
                  const handedOn = node.arguments.some((argument) => (ts.isIdentifier(argument) && checker.getSymbolAtLocation(argument) === symbol) || ((ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) && referencesSymbol(argument, symbol)))
                  if (!handedOn) return
                  const byIndex = forwarders.get(owner) ?? new Map<number, Set<Kind>>()
                  const kinds = byIndex.get(index) ?? new Set<Kind>()
                  for (const role of roles) {
                    if (!kinds.has(role)) added = true
                    kinds.add(role)
                  }
                  byIndex.set(index, kinds)
                  forwarders.set(owner, byIndex)
                })
              }
            }
          }
          ts.forEachChild(node, scan)
        }
        scan(source)
      }
      if (!added) break
      const names = [...forwarders.keys()].map((symbol) => symbol.name.replace(/[^A-Za-z0-9_$]/g, ''))
      pattern = new RegExp(`\\b(?:${names.join('|')})\\b`)
    }
  }
  discoverForwarders()
  for (const source of program.getSourceFiles()) {
    const relative = relativeOf(source)
    if (!relative || SKIPPED.test(relative)) continue
    const isContextPrimitive = CONTEXT_PRIMITIVES.test(relative)
    const nextEntry = NEXT_ENTRY.test(relative)
    const useServer = source.statements.some((statement) => ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression) && statement.expression.text === 'use server')

    for (const statement of source.statements) {
      // `export { a, b }` exports local declarations by name.
      if (ts.isExportDeclaration(statement) && !statement.moduleSpecifier && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) exportedDeclarations.add(keyOf(relative, (element.propertyName ?? element.name).text))
      }
      if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) continue
      const ownKeys = declaredNames(statement).map((name) => keyOf(relative, name))
      for (const key of ownKeys) declarations.add(key)
      if (isTopLevelClass(statement)) for (const member of statement.members) if (isClassMember(member)) declarations.add(memberKeyOf(relative, member))
      const exported = ts.canHaveModifiers(statement) && ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword || modifier.kind === ts.SyntaxKind.DefaultKeyword)
      if (exported || ts.isExportAssignment(statement)) for (const key of ownKeys) exportedDeclarations.add(key)
      if ((nextEntry || useServer) && (exported || ts.isExportAssignment(statement))) for (const key of ownKeys) if (!key.endsWith(`#${MODULE}`)) entries.add(key)

      const visit = (node: ts.Node, owners: string[], inContext: boolean, kind: Kind): void => {
        let ownersHere = owners
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && ts.isVariableDeclarationList(node.parent) && ts.isVariableStatement(node.parent.parent) && node.parent.parent === statement) ownersHere = [keyOf(relative, node.name.text)]
        if (isClassMember(node) && node.parent === statement && isTopLevelClass(statement)) ownersHere = [memberKeyOf(relative, node)]

        if (ts.isCallExpression(node)) {
          const callee = node.expression
          const wrapperName = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : null
          const calleeSymbol = calleeSymbolOf(node)
          const forwarded = calleeSymbol ? forwarders.get(calleeSymbol) : undefined
          if (forwarded && !(wrapperName && (WRAPPERS.has(wrapperName) || DUAL_ROLE_WRAPPERS.has(wrapperName)))) {
            visit(callee, ownersHere, inContext, kind)
            node.arguments.forEach((argument, index) => {
              const roles = forwarded.get(index)
              if (roles) for (const role of roles) visit(argument, ownersHere, true, role)
              else visit(argument, ownersHere, inContext, kind)
            })
            return
          }
          if ((wrapperName && WRAPPERS.has(wrapperName)) || runsInTenantTransaction(node, mode)) {
            const inner: Kind = wrapperName && SYSTEM_WRAPPERS.has(wrapperName) ? 'system' : 'tenant'
            visit(callee, ownersHere, inContext, kind)
            for (const argument of node.arguments) visit(argument, ownersHere, true, inner)
            return
          }
          if (wrapperName && DUAL_ROLE_WRAPPERS.has(wrapperName)) {
            visit(callee, ownersHere, inContext, kind)
            for (const argument of node.arguments) for (const role of ['tenant', 'system'] as const) visit(argument, ownersHere, true, role)
            return
          }
          // A dynamic import names a module, not which export is used: all of them are.
          if (callee.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
            const target = checker.getSymbolAtLocation(node.arguments[0])?.declarations?.find(ts.isSourceFile)
            const targetRelative = target ? relativeOf(target) : null
            if (targetRelative && targetRelative !== relative) for (const owner of ownersHere) addEdge(owner, keyOf(targetRelative, '*'), inContext, kind)
          }
          if (privilegesOf && !isContextPrimitive) {
            const facts = statementOf(node)
            if (facts) for (const owner of ownersHere) statementSites.push({ file: relative, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, declaration: owner, lexical: kind, facts })
          }
        }

        if (ts.isIdentifier(node)) {
          const isDeclarationName = ((ts.isVariableDeclaration(node.parent) || ts.isFunctionDeclaration(node.parent) || ts.isClassDeclaration(node.parent) || ts.isParameter(node.parent)) && (node.parent as ts.NamedDeclaration).name === node) || (isClassMember(node.parent) && !ts.isConstructorDeclaration(node.parent) && !ts.isClassStaticBlockDeclaration(node.parent) && node.parent.name === node)
          const isMemberName = ts.isPropertyAccessExpression(node.parent) && node.parent.name === node
          if (isMemberName && !inTypePosition(node)) {
            // `receiver.name` reaches the member the type checker resolves it to: the method of one class, not every statement of the class. A value typed `any` resolves to nothing, so a call
            // (or a callback) on it reaches every member of that name; a property that is merely read (`body.search || ''`) is data, not a call of a method that happens to share its name.
            const symbol = resolveAlias(checker.getSymbolAtLocation(node))
            // What is read from a value (`result.passed`, `result.redemptions`) is data when the member is declared in an object literal or an anonymous type: reading it does not run the function whose
            // body or return type holds that declaration, which a call already reached on its own terms.
            const declared = symbol?.declarations ?? []
            let targets = declared.length > 0 && declared.every(isDataMember) ? [] : targetsOf(symbol)
            const access = node.parent as ts.PropertyAccessExpression
            const invoked = ts.isCallExpression(access.parent) && (access.parent.expression === access || access.parent.arguments.includes(access))
            if (!symbol && invoked && checker.getTypeAtLocation(access.expression).flags & ts.TypeFlags.Any) {
              if (!classIndexBuilt) buildClassIndex()
              targets = classMembersNamed.get(node.text) ?? []
            }
            for (const target of targets) for (const owner of ownersHere) addEdge(owner, target, inContext, kind)
          }
          if (!isDeclarationName && !isMemberName && !inTypePosition(node)) {
            const symbol = resolveAlias(ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node ? checker.getShorthandAssignmentValueSymbol(node.parent) : checker.getSymbolAtLocation(node))
            // `namespace.name` names one export of the module, which the member branch reaches; the namespace used as a value is all of them.
            const namesOneExport = !!symbol && (symbol.flags & ts.SymbolFlags.Module) !== 0 && ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node
            if (!namesOneExport) for (const target of targetsOf(symbol)) for (const owner of ownersHere) addEdge(owner, target, inContext, kind)
            if (!inContext && !isContextPrimitive && symbol && (symbol === ambient || ambientAliases.has(symbol))) {
              const { line } = source.getLineAndCharacterOfPosition(node.getStart())
              const parent = node.parent
              let method = 'passed'
              let tables: string[] = []
              let unresolved = true
              let statement = true
              if (ts.isPropertyAccessExpression(parent) && parent.expression === node && DB_METHODS.has(parent.name.text)) {
                method = parent.name.text
                const called = ts.isCallExpression(parent.parent) && parent.parent.expression === parent ? parent.parent : null
                if (method === 'query') {
                  // db.query.<export>.findMany(...): the table is the schema export the property names.
                  const named = ts.isPropertyAccessExpression(parent.parent) && parent.parent.expression === parent ? tableByExport.get(parent.parent.name.text) : undefined
                  if (named) {
                    tables = [named]
                    unresolved = false
                  }
                } else if (called && method === 'transaction') {
                  // A transaction opened here is a handle like `db`: the statements run on its parameter are the ones judged.
                  const callback = called.arguments[0]
                  const parameter = callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) ? callback.parameters[0] : undefined
                  const parameterSymbol = parameter && ts.isIdentifier(parameter.name) ? checker.getSymbolAtLocation(parameter.name) : undefined
                  if (parameterSymbol) {
                    ambientAliases.add(parameterSymbol)
                    statement = false
                  }
                } else if (called) ({ tables, unresolved } = tablesOfChain(called))
              }
              if (statement) {
                const needsAll = tables.map((table) => needsOf(authorityOf(table)))
                const needs: Needs = needsAll.includes('TENANT') ? 'TENANT' : needsAll.includes('SYSTEM') ? 'SYSTEM' : unresolved || needsAll.includes('UNCLASSIFIED') ? 'UNCLASSIFIED' : 'OPEN'
                for (const owner of ownersHere) {
                  const sites = sitesByDeclaration.get(owner) ?? []
                  sites.push({ file: relative, line: line + 1, declaration: owner, method, tables, needs })
                  sitesByDeclaration.set(owner, sites)
                  siteCount += 1
                }
              }
            }
          }
        }
        ts.forEachChild(node, (child) => visit(child, ownersHere, inContext, kind))
      }
      visit(statement, ownKeys.length ? ownKeys : [keyOf(relative, MODULE)], false, 'none')
    }
  }

  const byFile = new Map<string, string[]>()
  for (const key of declarations) {
    const file = key.slice(0, key.indexOf('#'))
    const list = byFile.get(file) ?? []
    list.push(key)
    byFile.set(file, list)
  }

  // Walk what is reachable with no context. A state is (declaration, in a context); every entry starts without one.
  const outParent = new Map<string, string | null>()
  const reached = new Set<string>()
  const queue: Array<{ key: string; context: boolean; from: string | null }> = [...entries].map((key) => ({ key, context: false, from: null }))
  for (let head = 0; head < queue.length; head += 1) {
    const { key, context, from } = queue[head]
    const state = `${key}|${context ? 'in' : 'out'}`
    if (reached.has(state)) continue
    reached.add(state)
    if (!context && !outParent.has(key)) outParent.set(key, from)
    if (key.endsWith('#*')) for (const member of exportsOf(key)) queue.push({ key: member, context, from: key })
    for (const [next, inWrapper] of edges.get(key) ?? []) queue.push({ key: next, context: context || inWrapper, from: key })
  }

  const findings: AmbientFinding[] = []
  for (const [declaration, sites] of sitesByDeclaration) {
    if (!outParent.has(declaration)) continue
    const witness: string[] = []
    for (let step: string | null = declaration; step !== null && witness.length < 12; step = outParent.get(step) ?? null) witness.unshift(step)
    for (const site of sites) if (site.needs !== 'OPEN') findings.push({ ...site, witness })
  }
  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)

  // The privilege census: which role can run each statement, and has it been granted what the statement does. A state is (declaration, role): every entry starts on the
  // ambient handle (the runtime role, no organization), a reference inside a wrapper runs as that wrapper's role, and one outside inherits its caller's.
  const privilegeFindings: PrivilegeFinding[] = []
  let statements = 0
  let unjudged = 0
  if (privilegesOf) {
    const roleParent = new Map<string, string | null>()
    const roles = new Map<string, Set<Kind>>()
    const seen = new Set<string>()
    const roleQueue: Array<{ key: string; kind: Kind; fromState: string | null }> = [...entries].map((key) => ({ key, kind: 'none', fromState: null }))
    for (let head = 0; head < roleQueue.length; head += 1) {
      const { key, kind, fromState } = roleQueue[head]
      const state = `${key}|${kind}`
      if (seen.has(state)) continue
      seen.add(state)
      roleParent.set(state, fromState)
      roles.set(key, (roles.get(key) ?? new Set<Kind>()).add(kind))
      if (key.endsWith('#*')) for (const member of exportsOf(key)) roleQueue.push({ key: member, kind, fromState: state })
      for (const [next, referenced] of edgeKinds.get(key) ?? []) for (const role of referenced) roleQueue.push({ key: next, kind: role === 'none' ? kind : role, fromState: state })
    }
    const witnessOf = (state: string): string[] => {
      const witness: string[] = []
      for (let step: string | null = state; step !== null && witness.length < 12; step = roleParent.get(step) ?? null) witness.unshift(step.slice(0, step.lastIndexOf('|')))
      return witness
    }
    const reported = new Set<string>()
    for (const site of statementSites) {
      const reachedAs = roles.get(site.declaration)
      if (!reachedAs) continue
      statements += 1
      const known = site.facts.operations.filter((entry) => privilegesOf(entry.table))
      if (site.facts.unresolved || known.length === 0 || known.length < site.facts.operations.length) unjudged += 1
      const kinds: Kind[] = site.lexical !== 'none' ? [site.lexical] : [...reachedAs]
      for (const kind of kinds) {
        const principal = kind === 'system' ? 'SYSTEM' : 'RUNTIME'
        for (const entry of known) {
          const granted = privilegesOf(entry.table)!
          if ((principal === 'SYSTEM' ? granted.system : granted.runtime).has(entry.operation)) continue
          const identity = `${site.file}:${site.line}|${principal}|${entry.table}|${entry.operation}`
          if (reported.has(identity)) continue
          reported.add(identity)
          const state = `${site.declaration}|${site.lexical !== 'none' ? [...reachedAs][0] : kind}`
          privilegeFindings.push({ file: site.file, line: site.line, declaration: site.declaration, principal, table: entry.table, operation: entry.operation, reason: entry.reason, via: site.lexical !== 'none' ? 'lexical' : 'reached', witness: witnessOf(state) })
        }
      }
    }
    privilegeFindings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.table.localeCompare(b.table))
  }

  return { declarations: declarations.size, edges: [...edges.values()].reduce((sum, set) => sum + set.size, 0), entries: entries.size, sites: siteCount, findings, statements, unjudged, privilegeFindings }
}
