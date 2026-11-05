/**
 * Retypes declared text columns to uuid where the physical column is uuid (TYPE_MISMATCH "ORM text vs database uuid").
 * The TypeScript type stays string, so no caller changes; the declaration stops lying about the column. A primary key that the ORM
 * filled with a cuid2 (which is not a uuid and would be rejected by the column) is given the database uuid default instead.
 *
 *   node scripts/codemods/retype-text-ids-to-uuid.cjs <findings.json> [--exclude=table.column,...] [--write]
 *
 * <findings.json> is the output of `scripts/runtime/orm-physical-parity.ts --json`. Without --write it only prints what it would change.
 */
const fs = require('node:fs')
const path = require('node:path')

const [, , findingsPath, ...flags] = process.argv
if (!findingsPath) throw new Error('usage: retype-text-ids-to-uuid.cjs <findings.json> [--exclude=table.column,...] [--write]')
const write = flags.includes('--write')
const excluded = new Set((flags.find((f) => f.startsWith('--exclude=')) ?? '--exclude=').slice('--exclude='.length).split(',').filter(Boolean))
const findings = JSON.parse(fs.readFileSync(findingsPath, 'utf8')).findings.filter(
  (f) => f.kind === 'TYPE_MISMATCH' && /^ORM text vs database uuid$/.test(f.detail) && !excluded.has(`${f.table}.${f.column}`),
)
const wanted = new Map()
for (const f of findings) {
  const table = f.table.includes('.') ? f.table.split('.')[1] : f.table
  if (!wanted.has(table)) wanted.set(table, new Set())
  wanted.get(table).add(f.column)
}

const root = path.join(process.cwd(), 'db', 'schema')
const files = []
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) {
      if (name !== '__tests__') walk(p)
    } else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) files.push(p)
  }
}
walk(root)

/** The index just past the brace that closes the object literal opening at `open`, skipping strings, template literals and comments. */
function matchBrace(text, open) {
  let depth = 0
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === '/' && text[i + 1] === '/') { i = text.indexOf('\n', i); if (i < 0) return -1; continue }
    if (ch === '/' && text[i + 1] === '*') { i = text.indexOf('*/', i); if (i < 0) return -1; i += 1; continue }
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      for (i += 1; i < text.length && text[i] !== quote; i += 1) if (text[i] === '\\') i += 1
      continue
    }
    if (ch === '{') depth += 1
    if (ch === '}') { depth -= 1; if (depth === 0) return i + 1 }
  }
  return -1
}

/** The end of the property whose value starts at `from`: the first comma outside any bracket. */
function propertyEnd(body, from) {
  let depth = 0
  for (let i = from; i < body.length; i += 1) {
    const ch = body[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      for (i += 1; i < body.length && body[i] !== quote; i += 1) if (body[i] === '\\') i += 1
      continue
    }
    if ('([{'.includes(ch)) depth += 1
    else if (')]}'.includes(ch)) depth -= 1
    else if (ch === ',' && depth === 0) return i
  }
  return body.length
}

let changes = 0
let defaults = 0
const unresolved = new Map([...wanted].map(([t, cols]) => [t, new Set(cols)]))
for (const file of files) {
  let text = fs.readFileSync(file, 'utf8')
  const original = text
  for (const [table, columns] of wanted) {
    const header = new RegExp(`(?:pgTable|\\.table)\\(\\s*["']${table}["']\\s*,\\s*\\{`, 'g')
    let m
    while ((m = header.exec(text))) {
      const open = m.index + m[0].length - 1
      const close = matchBrace(text, open)
      if (close < 0) throw new Error(`unbalanced braces in ${file} for ${table}`)
      let body = text.slice(open, close)
      for (const column of columns) {
        const call = new RegExp(`\\btext\\(\\s*(["'])${column}\\1`)
        const found = call.exec(body)
        if (!found) continue
        body = body.slice(0, found.index) + found[0].replace(/^text/, 'uuid') + body.slice(found.index + found[0].length)
        changes += 1
        unresolved.get(table)?.delete(column)
        console.log(`${write ? 'retyped' : 'would retype'} ${path.relative(process.cwd(), file)} ${table}.${column}`)
        if (column === 'id') {
          const end = propertyEnd(body, found.index)
          const property = body.slice(found.index, end)
          const swapped = property.replace(/\.\$defaultFn\(\(\)\s*=>\s*createId\(\)\)/, '.defaultRandom()')
          if (swapped !== property) {
            body = body.slice(0, found.index) + swapped + body.slice(end)
            defaults += 1
          }
        }
      }
      text = text.slice(0, open) + body + text.slice(close)
      header.lastIndex = open + body.length
    }
  }
  if (text !== original) {
    if (!/import\s*\{[^}]*\buuid\b[^}]*\}\s*from\s*["']drizzle-orm\/pg-core["']/.test(text)) {
      const imp = /import\s*\{([^}]*)\}\s*from\s*(["'])drizzle-orm\/pg-core\2/
      if (!imp.test(text)) throw new Error(`${file} has no drizzle-orm/pg-core import to add uuid to`)
      text = text.replace(imp, (s, names, q) => `import {${names.replace(/\s*$/, '')}, uuid } from ${q}drizzle-orm/pg-core${q}`)
    }
    if (!/\bcreateId\(/.test(text)) text = text.replace(/^import\s*\{\s*createId\s*\}\s*from\s*["'][^"']+["'];?\r?\n/m, '')
    if (write) fs.writeFileSync(file, text)
  }
}
const left = [...unresolved].filter(([, cols]) => cols.size)
console.log(`${changes} declaration(s) ${write ? 'retyped' : 'to retype'}, ${defaults} primary key default(s) moved to the database uuid`)
for (const [table, cols] of left) console.log(`NOT FOUND ${table}: ${[...cols].join(', ')}`)