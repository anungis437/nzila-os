/**
 * Declares `withTimezone: true` on every Drizzle `timestamp(...)` whose physical column is `timestamp with time zone` (TZ_MISMATCH).
 * The TypeScript type stays Date. What changes is how a value is read: a declaration without the zone parses `2026-11-01 18:51:12-05` as if it
 * were UTC, so every read is wrong by the session's offset unless the session is UTC.
 *
 *   node scripts/codemods/declare-timestamptz.cjs <findings.json> [--write]
 *
 * <findings.json> is the output of `scripts/runtime/orm-physical-parity.ts --json`. Run from apps/union-eyes. Without --write it only reports.
 * A declaration is found through the TypeScript syntax tree: a `pgTable('name', {...})` (or `<pgSchema>.table('name', {...})`) call whose column
 * property starts a `timestamp('column', ...)` chain. Every file that declares the table is changed, not only the one the finding came from.
 */
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const [, , findingsPath, ...flags] = process.argv
if (!findingsPath) throw new Error('usage: declare-timestamptz.cjs <findings.json> [--write]')
const write = flags.includes('--write')
const targets = new Map()
for (const f of JSON.parse(fs.readFileSync(findingsPath, 'utf8')).findings) {
  if (f.kind !== 'TZ_MISMATCH' || !/^ORM timestamp(?: \(\d+\))? vs database timestamp with time zone$/.test(f.detail)) continue
  if (!targets.has(f.table)) targets.set(f.table, new Set())
  targets.get(f.table).add(f.column)
}

const root = path.join(process.cwd(), 'db', 'schema')
const files = []
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) {
      if (name !== '__tests__') walk(p)
    } else if (name.endsWith('.ts') && !name.endsWith('.d.ts') && !name.endsWith('.test.ts')) files.push(p)
  }
}
walk(root)

const parse = (file, text) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
const stringValue = (node) => (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined)

// Every `const x = pgSchema('name')` in any declaration file, so `x.table(...)` resolves to a schema even when x is imported.
const schemaVariables = new Map()
for (const file of files) {
  const source = parse(file, fs.readFileSync(file, 'utf8'))
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isCallExpression(node.initializer) && ts.isIdentifier(node.initializer.expression) && node.initializer.expression.text === 'pgSchema') {
      const name = stringValue(node.initializer.arguments[0])
      if (name) schemaVariables.set(node.name.text, name)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}

const reached = new Set()
const manual = []
let changedColumns = 0
const changedFiles = []

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8')
  if (!text.includes('timestamp')) continue
  const source = parse(file, text)
  const timestampNames = new Set(['timestamp'])
  source.statements.forEach((statement) => {
    if (ts.isImportDeclaration(statement) && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)) {
      for (const element of statement.importClause.namedBindings.elements) if ((element.propertyName ?? element.name).text === 'timestamp') timestampNames.add(element.name.text)
    }
  })
  const edits = []

  const rootTimestampCall = (initializer) => {
    let node = initializer
    for (;;) {
      if (ts.isParenthesizedExpression(node)) node = node.expression
      else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && timestampNames.has(node.expression.text)) return node
      else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) node = node.expression.expression
      else return undefined
    }
  }

  const patch = (call, label, column) => {
    const [, options] = call.arguments
    if (!options) {
      edits.push({ at: call.arguments[0].end, remove: 0, text: ', { withTimezone: true }' })
    } else if (ts.isObjectLiteralExpression(options)) {
      const existing = options.properties.find((p) => ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === 'withTimezone')
      if (existing) {
        if (existing.initializer.kind === ts.SyntaxKind.TrueKeyword) return
        edits.push({ at: existing.initializer.getStart(), remove: existing.initializer.end - existing.initializer.getStart(), text: 'true' })
      } else if (options.properties.length === 0) {
        edits.push({ at: options.getStart(), remove: options.end - options.getStart(), text: '{ withTimezone: true }' })
      } else {
        const first = options.properties[0]
        const sameLine = !text.slice(options.getStart(), first.getStart()).includes('\n')
        const indent = text.slice(text.lastIndexOf('\n', first.getStart()) + 1, first.getStart())
        edits.push({ at: first.getStart(), remove: 0, text: sameLine ? 'withTimezone: true, ' : `withTimezone: true,\n${indent}` })
      }
    } else {
      manual.push(`${path.relative(process.cwd(), file)}: ${label}.${column} passes its options as a non-literal expression`)
      return
    }
    changedColumns += 1
    reached.add(`${label}.${column}`)
  }

  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      let schema
      if (ts.isIdentifier(node.expression) && node.expression.text === 'pgTable') schema = 'public'
      else if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'table' && ts.isIdentifier(node.expression.expression)) schema = schemaVariables.get(node.expression.expression.text)
      const tableName = schema ? stringValue(node.arguments[0]) : undefined
      if (tableName) {
        const label = schema === 'public' ? tableName : `${schema}.${tableName}`
        const wanted = targets.get(label)
        let columns = node.arguments[1]
        if (columns && (ts.isArrowFunction(columns) || ts.isFunctionExpression(columns))) {
          const body = ts.isArrowFunction(columns) && !ts.isBlock(columns.body) ? columns.body : undefined
          columns = body && ts.isParenthesizedExpression(body) ? body.expression : body
        }
        if (wanted && columns && ts.isObjectLiteralExpression(columns)) {
          for (const property of columns.properties) {
            if (!ts.isPropertyAssignment(property)) continue
            const call = rootTimestampCall(property.initializer)
            const column = call && stringValue(call.arguments[0])
            if (call && column && wanted.has(column)) patch(call, label, column)
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)

  if (edits.length) {
    changedFiles.push(path.relative(process.cwd(), file))
    if (write) {
      let out = text
      for (const edit of edits.sort((a, b) => b.at - a.at)) out = out.slice(0, edit.at) + edit.text + out.slice(edit.at + edit.remove)
      fs.writeFileSync(file, out)
    }
  }
}

const wantedCount = [...targets.values()].reduce((n, columns) => n + columns.size, 0)
const unreached = []
for (const [label, columns] of targets) for (const column of columns) if (!reached.has(`${label}.${column}`)) unreached.push(`${label}.${column}`)
console.log(`${write ? 'changed' : 'would change'} ${changedColumns} declarations in ${changedFiles.length} files; ${wantedCount} (table, column) pairs wanted, ${unreached.length} not found in a pgTable literal`)
for (const line of manual) console.log(`manual: ${line}`)
if (unreached.length) console.log(`not reached (helper-built or imported declarations):\n  ${unreached.join('\n  ')}`)
