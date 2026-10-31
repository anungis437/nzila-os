const fs = require('fs')
const f = 'app/api/extensions/[id]/route.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const swap = (a, b) => { if (!s.includes(a)) throw new Error(`missing ${a.slice(0, 60)}`); s = s.replace(a, b) }
swap(
  "export const dynamic = 'force-dynamic';\n",
  `export const dynamic = 'force-dynamic';

/**
 * An integration row holds the credentials document and the connection's SFTP host, port and path. None of that is returned: the
 * configuration an administrator needs to see is the connection's identity, its mapping and its sync state.
 */
function publicIntegration<T extends Record<string, unknown>>(row: T) {
  const { credentials: _credentials, sftpHost: _host, sftpPort: _port, sftpPath: _path, ...safe } = row;
  return safe;
}
`,
)
swap(
  "export const GET = withApi(\n  {\n    auth: { required: true, minRole: 'member' },",
  "export const GET = withApi(\n  {\n    // The connection's endpoint, mapping and sync state are an administrator's, not every member's.\n    auth: { required: true, minRole: 'admin' },",
)
swap("    if (!integration) throw ApiError.notFound('Integration');\n\n    return integration;", "    if (!integration) throw ApiError.notFound('Integration');\n\n    return publicIntegration(integration);")
swap("      return updated;\n    });", "      return publicIntegration(updated);\n    });")
fs.writeFileSync(f, s)
console.log('ok')
