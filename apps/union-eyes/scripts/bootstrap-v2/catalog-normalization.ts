/** PostgreSQL 16 can reparse these lossless varchar-array casts while restoring
 * pg_dump output. Preserve literals/operators and normalize only this shape. */
export function canonicalDumpExpression(sql: string): string {
  const cast =
    /^\(ARRAY\[((?:'(?:[^']|'')*'::character varying)(?:,\s*'(?:[^']|'')*'::character varying)*)\]\)::text\[\]/
  let out = '',
    i = 0
  while (i < sql.length) {
    const start = i
    if (sql[i] === "'" || sql[i] === '"') {
      const quote = sql[i++]
      while (i < sql.length) {
        if (sql[i] === '\\') {
          i += 2
          continue
        }
        if (sql[i++] === quote) {
          if (sql[i] === quote) {
            i++
            continue
          }
          break
        }
      }
    } else if (sql.startsWith('--', i)) {
      const end = sql.indexOf('\n', i)
      i = end < 0 ? sql.length : end + 1
    } else if (sql.startsWith('/*', i)) {
      let depth = 1
      i += 2
      while (i < sql.length && depth) {
        if (sql.startsWith('/*', i)) {
          depth++
          i += 2
        } else if (sql.startsWith('*/', i)) {
          depth--
          i += 2
        } else i++
      }
    } else {
      const dollar = sql.slice(i).match(/^\$(?:[a-zA-Z_][a-zA-Z0-9_]*)?\$/)
      if (dollar) {
        const end = sql.indexOf(dollar[0], i + dollar[0].length)
        i = end < 0 ? sql.length : end + dollar[0].length
      } else {
        const match = sql.slice(i).match(cast)
        if (match) {
          out += `ARRAY[${[...match[1].matchAll(/'(?:[^']|'')*'::character varying/g)].map((m) => `(${m[0]})::text`).join(', ')}]`
          i += match[0].length
          continue
        }
        i++
      }
    }
    out += sql.slice(start, i)
  }
  return out
}

/** Parse a one-dimensional PostgreSQL ACL array without splitting quoted names.
 * Every grantee, privilege/grant option and grantor remains significant. */
function aclItems(value: string): string[] | null {
  if (!value.startsWith('{') || !value.endsWith('}')) return null
  const items: string[] = []
  let item = '',
    quoted = false,
    escaped = false
  for (const c of value.slice(1, -1)) {
    if (escaped) {
      item += c
      escaped = false
      continue
    }
    if (c === '\\') {
      escaped = true
      continue
    }
    if (c === '"') {
      quoted = !quoted
      continue
    }
    if (!quoted && c === ',') {
      if (!item) return null
      items.push(item)
      item = ''
      continue
    }
    if (!quoted && (c === '{' || c === '}')) return null
    item += c
  }
  if (quoted || escaped) return null
  if (item) items.push(item)
  else if (items.length) return null
  return items.sort()
}

export function canonicalCatalogObject(object: { kind: string; id: string; definition: unknown }) {
  if (
    !object.definition ||
    typeof object.definition !== 'object' ||
    Array.isArray(object.definition)
  )
    return object
  const definition = { ...object.definition } as Record<string, unknown>
  if (['constraint', 'index', 'policy'].includes(object.kind)) {
    for (const field of ['definition', 'check', 'using']) {
      if (typeof definition[field] === 'string')
        definition[field] = canonicalDumpExpression(definition[field])
    }
  }
  if (typeof definition.acl === 'string') {
    const entries = aclItems(definition.acl)
    if (entries) definition.acl = entries
  } else if (
    definition.acl === null &&
    object.kind === 'relation' &&
    ['r', 'p', 'v', 'm'].includes(String(definition.kind)) &&
    typeof definition.owner === 'string' &&
    /^[a-z_][a-z0-9_]*$/.test(definition.owner)
  ) {
    // PostgreSQL's default table ACL is owner=ALL, PUBLIC=none. An explicit
    // owner-only ACL and NULL are equivalent; never infer any other grant.
    definition.acl = [`${definition.owner}=arwdDxt/${definition.owner}`]
  }
  return { ...object, definition }
}
