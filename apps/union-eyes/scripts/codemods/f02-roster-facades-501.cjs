// F02 codemod: routes that advertise a business domain but are the generic CRUD factory over organization_members.
//
// Each of these answered GET with member roster rows under a name such as "segments", "system settings" or "update-role", and refused
// every write, so the operation the path advertises never existed. The canonical state for an absent capability is HTTP 501, so each
// file becomes a 501 handler for the methods it exported, behind the read floor it already had. The roster itself is still served by
// the routes in KEEP.
//
// Idempotent: a file that no longer names organizationMembers is left alone. Writes the list of converted paths to stdout.
const fs = require('fs')
const path = require('path')

const API = path.resolve(__dirname, '../../app/api')
const KEEP = new Set(['members/[id]'])

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.name === 'route.ts') out.push(full)
  }
  return out
}

const converted = []
for (const file of walk(API)) {
  const rel = path.relative(API, path.dirname(file)).split(path.sep).join('/')
  if (KEEP.has(rel)) continue
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  if (!/crudRoutes\(\{\s*\n\s*table: organizationMembers,/.test(text)) continue
  const methods = (text.match(/export \{ ([A-Z, ]+) \};?/) || [])[1]
  if (!methods) throw new Error(`no export list in ${rel}`)
  const readRole = (text.match(/readRole: ['"]([a-z_]+)['"]/) || [])[1] || 'member'
  const tag = (text.match(/tags: \[['"]([^'"]+)['"]\]/) || [])[1] || 'Members'
  const name = rel.replace(/\[(\w+)\]/g, ':$1')
  const list = methods.split(',').map((m) => m.trim()).filter(Boolean)
  const body = `/**
 * ${list.join(' ')} /api/${name}
 *
 * Not implemented. This path advertises an operation of its own but was the generic CRUD factory over organization_members: GET
 * returned member roster rows under this name and every write was refused, so nothing it advertises was ever done. It answers
 * HTTP 501 rather than present a roster listing as that operation. The member roster is served by /api/members/[id].
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: '${readRole}' },
    openapi: {
      tags: ['${tag}'],
      summary: '/api/${name} (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/${name} is not implemented: it performed no operation of its own and returned the member roster instead.');
  },
);

${list.map((m) => `export const ${m} = handler;`).join('\n')}
`
  fs.writeFileSync(file, body)
  converted.push(`${rel} [${list.join(',')}] floor=${readRole}`)
}
console.log(converted.join('\n'))
console.log(`converted: ${converted.length}`)
