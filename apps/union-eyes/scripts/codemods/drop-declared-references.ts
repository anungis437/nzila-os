/**
 * Removes the declared foreign keys the foreign-key doctrine forbids (see foreignKeyDoctrineViolations in scripts/runtime/schema-convergence.ts):
 * references to an identity string (`profiles.user_id`, `user_management.users.user_id`) and every reference declared on an append-only evidence table.
 * A declaration that promises a key the platform must not enforce is a declaration that lies about the database.
 *
 *   npx tsx scripts/codemods/drop-declared-references.ts [--write]      (run from apps/union-eyes)
 *
 * A column is found through the TypeScript syntax tree: a `pgTable('name', {...})` call whose property starts a builder chain with the column's name. Every file
 * that declares the table is changed. An import that only the removed reference used is removed with it. Without --write it only reports.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import ts from 'typescript'
import { foreignKeyDoctrineViolations, loadDeclarationSources, mergeDeclarations } from '../runtime/schema-convergence'

const write = process.argv.includes('--write')
const root = path.join(process.cwd(), 'db', 'schema')

const stringValue = (node: ts.Node | undefined): string | undefined => (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined)

async function main(): Promise<void> {
  const declared = mergeDeclarations(await loadDeclarationSources())
  const violations = foreignKeyDoctrineViolations(declared)
  const targets = new Map<string, Set<string>>()
  const manual: string[] = []
  for (const table of declared) {
    for (const fk of table.foreignKeys) {
      if (!violations.some((v) => v.startsWith(`${table.label}.${fk.columns.join(',')} -> `))) continue
      if (fk.columns.length !== 1) {
        manual.push(`${table.label}.${fk.columns.join(',')} is a composite key`)
        continue
      }
      if (!targets.has(table.label)) targets.set(table.label, new Set())
      targets.get(table.label)!.add(fk.columns[0])
    }
  }

  const schemaVariables = new Map<string, string>()
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name)
      if (fs.statSync(p).isDirectory()) {
        if (name !== '__tests__') walk(p)
      } else if (name.endsWith('.ts') && !name.endsWith('.d.ts') && !name.endsWith('.test.ts')) files.push(p)
    }
  }
  walk(root)
  const parse = (file: string, text: string) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  for (const file of files) {
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isCallExpression(node.initializer) && ts.isIdentifier(node.initializer.expression) && node.initializer.expression.text === 'pgSchema') {
        const name = stringValue(node.initializer.arguments[0])
        if (name) schemaVariables.set(node.name.text, name)
      }
      ts.forEachChild(node, visit)
    }
    visit(parse(file, fs.readFileSync(file, 'utf8')))
  }

  const reached = new Set<string>()
  let removed = 0
  const changedFiles: string[] = []

  const importedUsage = (source: ts.SourceFile): Map<string, number> => {
    const counts = new Map<string, number>()
    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node)) return
      if (ts.isIdentifier(node)) counts.set(node.text, (counts.get(node.text) ?? 0) + 1)
      ts.forEachChild(node, visit)
    }
    visit(source)
    return counts
  }

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8')
    if (!text.includes('.references(')) continue
    const source = parse(file, text)
    const edits: Array<{ start: number; end: number; text: string }> = []

    const chainRoot = (initializer: ts.Expression): ts.CallExpression | undefined => {
      let node: ts.Expression = initializer
      for (;;) {
        if (ts.isParenthesizedExpression(node)) node = node.expression
        else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) node = node.expression.expression
        else return ts.isCallExpression(node) ? node : undefined
      }
    }
    const referenceCalls = (initializer: ts.Expression): ts.CallExpression[] => {
      const found: ts.CallExpression[] = []
      let node: ts.Expression = initializer
      for (;;) {
        if (ts.isParenthesizedExpression(node)) node = node.expression
        else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
          if (node.expression.name.text === 'references') found.push(node)
          node = node.expression.expression
        } else return found
      }
    }

    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        let schema: string | undefined
        if (ts.isIdentifier(node.expression) && node.expression.text === 'pgTable') schema = 'public'
        else if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'table' && ts.isIdentifier(node.expression.expression)) schema = schemaVariables.get(node.expression.expression.text)
        const tableName = schema ? stringValue(node.arguments[0]) : undefined
        const columns = node.arguments[1]
        if (tableName && columns && ts.isObjectLiteralExpression(columns)) {
          const label = schema === 'public' ? tableName : `${schema}.${tableName}`
          const wanted = targets.get(label)
          if (wanted) {
            for (const property of columns.properties) {
              if (!ts.isPropertyAssignment(property)) continue
              const start = chainRoot(property.initializer)
              const column = start ? stringValue(start.arguments[0]) : undefined
              if (!column || !wanted.has(column)) continue
              for (const call of referenceCalls(property.initializer)) {
                const access = call.expression as ts.PropertyAccessExpression
                edits.push({ start: access.expression.end, end: call.end, text: '' })
                removed += 1
                reached.add(`${label}.${column}`)
              }
            }
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
    if (edits.length === 0) continue

    let next = text
    for (const edit of edits.sort((a, b) => b.start - a.start)) next = next.slice(0, edit.start) + edit.text + next.slice(edit.end)

    // An import that only the removed references used goes with them; an import that was already unused is left alone.
    const before = importedUsage(source)
    const reparsed = parse(file, next)
    const after = importedUsage(reparsed)
    const importEdits: Array<{ start: number; end: number; text: string }> = []
    for (const statement of reparsed.statements) {
      if (!ts.isImportDeclaration(statement) || !statement.importClause?.namedBindings || !ts.isNamedImports(statement.importClause.namedBindings) || statement.importClause.name) continue
      const elements = statement.importClause.namedBindings.elements
      const keep = elements.filter((element) => !((before.get(element.name.text) ?? 0) > 0 && (after.get(element.name.text) ?? 0) === 0))
      if (keep.length === elements.length) continue
      if (keep.length === 0) {
        const lineEnd = next[statement.end] === '\n' ? statement.end + 1 : statement.end
        importEdits.push({ start: statement.getStart(), end: lineEnd, text: '' })
      } else {
        const typeOnly = statement.importClause.isTypeOnly ? 'type ' : ''
        const semicolon = next[statement.end - 1] === ';' ? ';' : ''
        importEdits.push({ start: statement.getStart(), end: statement.end, text: `import ${typeOnly}{ ${keep.map((element) => element.getText()).join(', ')} } from ${statement.moduleSpecifier.getText()}${semicolon}` })
      }
    }
    for (const edit of importEdits.sort((a, b) => b.start - a.start)) next = next.slice(0, edit.start) + edit.text + next.slice(edit.end)

    changedFiles.push(path.relative(process.cwd(), file))
    if (write) fs.writeFileSync(file, next)
  }

  const wanted = [...targets.values()].reduce((n, columns) => n + columns.size, 0)
  const unreached: string[] = []
  for (const [label, columns] of targets) for (const column of columns) if (!reached.has(`${label}.${column}`)) unreached.push(`${label}.${column}`)
  console.log(`${write ? 'removed' : 'would remove'} ${removed} references in ${changedFiles.length} files; ${wanted} (table, column) pairs wanted, ${unreached.length} not reached`)
  for (const line of manual) console.log(`manual: ${line}`)
  if (unreached.length) console.log(`not reached (declared outside a pgTable literal or through foreignKey()):\n  ${unreached.join('\n  ')}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
