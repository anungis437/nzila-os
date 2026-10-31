const fs = require('fs')
const edit = (file, pairs) => {
  let t = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  for (const [from, to] of pairs) {
    if (!t.includes(from)) throw new Error(`${file}: missing ${from.slice(0, 60)}`)
    t = t.replace(from, to)
  }
  fs.writeFileSync(file, t)
}
edit('app/api/enterprise/sso/providers/route.ts', [
  [
    "    auth: { required: true, minRole: 'member' },\n    openapi: {\n      tags: ['Auth'],\n      summary: 'List SSO providers',",
    "    // The identity-provider configuration (issuer, endpoints, client id, attribute mapping) is an administrator's, not every member's.\n    auth: { required: true, minRole: 'admin' },\n    openapi: {\n      tags: ['Auth'],\n      summary: 'List SSO providers',",
  ],
])
edit('app/api/__tests__/../enterprise/sso/providers/__tests__/route.test.ts', [
  ["it('GET requires at least member role and reads org-scoped'", "it('GET requires at least admin role and reads org-scoped'"],
  ["expect(capturedGetOpts?.auth).toMatchObject({ required: true, minRole: 'member' });", "expect(capturedGetOpts?.auth).toMatchObject({ required: true, minRole: 'admin' });"],
])
edit('app/api/test-auth/route.ts', [
  ["import { auth } from '@nzila/platform-auth/entra/server';", "import { auth } from '@nzila/platform-auth/entra/server';\nimport { isPlatformAdminUser } from '@/lib/api-auth-guard';"],
  [
    "  const token = await getToken();\n",
    "  // This route forwards the caller's session token to the backend, so it is a platform operator's diagnostic. It answers statuses only: the\n  // backend's response bodies are not returned to a signed-in user of any organization.\n  if (!(await isPlatformAdminUser(userId))) {\n    return NextResponse.json({ passed: false, message: 'Platform administrator required' }, { status: 403 });\n  }\n\n  const token = await getToken();\n",
  ],
  ["  let healthBody: any = null;\n", ""],
  ["    healthStatus = r.status;\n    healthBody = await r.json();\n  } catch (e) {\n    healthBody = { error: String(e) };\n  }", "    healthStatus = r.status;\n  } catch {\n    healthStatus = 0;\n  }"],
  ["  let meBody: any = null;\n", ""],
  ["    meStatus = r.status;\n    meBody = await r.json();\n  } catch (e) {\n    meBody = { error: String(e) };\n  }", "    meStatus = r.status;\n  } catch {\n    meStatus = 0;\n  }"],
  ["      health: { status: healthStatus, body: healthBody },\n      me: { status: meStatus, body: meBody },", "      health: { status: healthStatus },\n      me: { status: meStatus },"],
])
console.log('ok')
