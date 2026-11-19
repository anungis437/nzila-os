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

type AndNode = { open: boolean; parts: (string | AndNode)[] }
const AND_TOKEN = /(?<=\s)AND(?=\s)/
const OR_TOKEN = /(?<=\s)OR(?=\s)/

/** Split deparsed SQL into opaque quoted atoms and parenthesis groups. Returns null when the text
 * holds anything this reader does not fully understand (comments, dollar quotes, unbalanced parens),
 * so such text is never rewritten. */
function parseAndTree(sql: string): AndNode | null {
  const root: AndNode = { open: false, parts: [] }
  const stack: AndNode[] = [root]
  let text = ''
  const flush = () => {
    if (text) stack[stack.length - 1].parts.push(text)
    text = ''
  }
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i]
    if (c === "'" || c === '"') {
      flush()
      let j = i + 1
      for (; j < sql.length; j++) {
        if (sql[j] === c) {
          if (sql[j + 1] === c) {
            j++
            continue
          }
          break
        }
        if (c === "'" && sql[j] === '\\') return null
      }
      if (j >= sql.length) return null
      // Quoted atoms are kept as single-element groups-free strings tagged by their quote.
      stack[stack.length - 1].parts.push(`\u0000${sql.slice(i, j + 1)}`)
      i = j
      continue
    }
    if (c === '$' || sql.startsWith('--', i) || sql.startsWith('/*', i)) return null
    if (c === '(') {
      flush()
      const node: AndNode = { open: true, parts: [] }
      stack[stack.length - 1].parts.push(node)
      stack.push(node)
      continue
    }
    if (c === ')') {
      flush()
      if (stack.length === 1) return null
      stack.pop()
      continue
    }
    text += c
  }
  flush()
  return stack.length === 1 ? root : null
}

const renderAnd = (node: AndNode): string => {
  const inner = node.parts.map((p) => (typeof p === 'string' ? p.replace(/^\u0000/, '') : renderAnd(p))).join('')
  return node.open ? `(${inner})` : inner
}

/** Top-level operands of a group's boolean AND chain, or null if the group is not a pure AND chain
 * (an OR, a comma-separated argument list, or a single operand). */
function andOperands(node: AndNode): (string | AndNode)[][] | null {
  const operands: (string | AndNode)[][] = [[]]
  for (const part of node.parts) {
    if (typeof part !== 'string' || part.startsWith('\u0000')) {
      operands[operands.length - 1].push(part)
      continue
    }
    if (part.includes(',') || OR_TOKEN.test(part)) return null
    const pieces = part.split(AND_TOKEN)
    pieces.forEach((piece, index) => {
      if (index > 0) operands.push([])
      if (piece) operands[operands.length - 1].push(piece)
    })
  }
  return operands.length >= 2 ? operands : null
}

const soleGroup = (operand: (string | AndNode)[]): AndNode | null => {
  const significant = operand.filter((p) => typeof p !== 'string' || p.trim() !== '')
  return significant.length === 1 && typeof significant[0] !== 'string' ? significant[0] : null
}

function flattenAndNode(node: AndNode): AndNode {
  const parts = node.parts.map((p) => (typeof p === 'string' ? p : flattenAndNode(p)))
  const current: AndNode = { open: node.open, parts }
  const operands = andOperands(current)
  if (!operands) return current
  let changed = false
  const flattened = operands.map((operand) => {
    const group = soleGroup(operand)
    if (!group || !andOperands(group)) return operand
    changed = true
    // Keep the operand's surrounding whitespace; splice the nested chain's members in place.
    const lead = operand.filter((p, i) => i < operand.indexOf(group))
    const tail = operand.filter((p, i) => i > operand.indexOf(group))
    return [...lead, ...group.parts, ...tail]
  })
  if (!changed) return current
  const joined: (string | AndNode)[] = []
  flattened.forEach((operand, index) => {
    if (index > 0) joined.push('AND')
    joined.push(...operand)
  })
  return { open: current.open, parts: joined }
}

/** PostgreSQL deparses BETWEEN (and other analysis-time rewrites) as a nested AND inside an AND,
 * printed `((a AND b) AND c)`; pg_dump output reparses that as the flat `(a AND b AND c)`. AND is
 * associative, so flattening a parenthesized pure AND chain that is itself a direct operand of an AND
 * chain is lossless. Anything involving OR, argument lists or unparseable text is left unchanged. */
export function canonicalAndChains(sql: string): string {
  const tree = parseAndTree(sql)
  return tree ? renderAnd(flattenAndNode(tree)) : sql
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
        definition[field] = canonicalAndChains(canonicalDumpExpression(definition[field]))
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
