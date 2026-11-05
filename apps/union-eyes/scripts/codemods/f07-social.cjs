const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 60)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}

edit('app/api/social-media/accounts/route.ts', [
  ["export const POST = withRoleAuth('steward',", "// Connecting or disconnecting the organization's publishing identity is an administrator's act, not a steward's.\nexport const POST = withRoleAuth('admin',"],
  ["export const DELETE = withRoleAuth('steward',", "export const DELETE = withRoleAuth('admin',"],
  ["            'instagram_content_publish',\n            'business_management',\n", "            'instagram_content_publish',\n"],
  ["            'w_organization_social',\n            'rw_organization_admin',\n", "            'w_organization_social',\n"],
])

edit('app/api/social-media/accounts/callback/route.ts', [
  ["export const GET = withRoleAuth('steward',", "export const GET = withRoleAuth('admin',"],
  [
    "        const page = pages[0];\n        if (!page) {",
    "        // The authorizing user may manage several Pages. Picking the first would publish as an arbitrary one, and there is no\n        // selection step yet, so a connection is made only when exactly one Page is available.\n        if (pages.length > 1) {\n          return standardErrorResponse(\n            ErrorCode.VALIDATION_ERROR,\n            'This account manages more than one Page. Connect an account that manages exactly the Page to publish as.'\n          );\n        }\n        const page = pages[0];\n        if (!page) {",
  ],
])
console.log('ok')
