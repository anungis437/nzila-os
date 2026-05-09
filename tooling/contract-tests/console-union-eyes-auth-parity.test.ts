import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

const CONSOLE_AUTH = {
  loginRoute: join(ROOT, 'apps', 'console', 'app', 'api', 'auth', 'login', 'route.ts'),
  meRoute: join(ROOT, 'apps', 'console', 'app', 'api', 'auth', 'me', 'route.ts'),
  nextAuthRoute: join(ROOT, 'apps', 'console', 'app', 'api', 'auth', '[...nextauth]', 'route.ts'),
  signInPage: join(ROOT, 'apps', 'console', 'app', 'sign-in', '[[...sign-in]]', 'page.tsx'),
} as const

const UNION_EYES_AUTH = {
  loginRoute: join(ROOT, 'apps', 'union-eyes', 'app', 'api', 'auth', 'login', 'route.ts'),
  meRoute: join(ROOT, 'apps', 'union-eyes', 'app', 'api', 'auth', 'me', 'route.ts'),
  nextAuthRoute: join(ROOT, 'apps', 'union-eyes', 'app', 'api', 'auth', '[...nextauth]', 'route.ts'),
  signInPage: join(ROOT, 'apps', 'union-eyes', 'app', 'sign-in', '[[...sign-in]]', 'page.tsx'),
} as const

function read(path: string): string {
  return readFileSync(path, 'utf-8')
}

describe('Console and Union Eyes auth parity', () => {
  it('both apps expose core auth route files and sign-in entrypoints', () => {
    const files = [
      CONSOLE_AUTH.loginRoute,
      CONSOLE_AUTH.meRoute,
      CONSOLE_AUTH.nextAuthRoute,
      CONSOLE_AUTH.signInPage,
      UNION_EYES_AUTH.loginRoute,
      UNION_EYES_AUTH.meRoute,
      UNION_EYES_AUTH.nextAuthRoute,
      UNION_EYES_AUTH.signInPage,
    ]

    for (const file of files) {
      expect(existsSync(file), `${file} should exist`).toBe(true)
    }
  })

  it('both apps delegate login to shared platform-auth handlers', () => {
    const expected = "export { handleLogin as POST } from '@nzila/platform-auth/password/handlers'"

    expect(read(CONSOLE_AUTH.loginRoute)).toContain(expected)
    expect(read(UNION_EYES_AUTH.loginRoute)).toContain(expected)
  })

  it('both apps delegate current-user resolution to shared platform-auth handlers', () => {
    const expected = "export { handleMe as GET } from '@nzila/platform-auth/password/handlers'"

    expect(read(CONSOLE_AUTH.meRoute)).toContain(expected)
    expect(read(UNION_EYES_AUTH.meRoute)).toContain(expected)
  })

  it('both apps retain nextauth catch-all integration routes', () => {
    for (const route of [CONSOLE_AUTH.nextAuthRoute, UNION_EYES_AUTH.nextAuthRoute]) {
      const source = read(route)
      expect(source).toMatch(/GET|POST/)
    }
  })
})