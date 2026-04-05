/**
 * Vitest mock for next-auth and @nzila/platform-auth/entra/server.
 *
 * The real next-auth tries to import NextRequest from next/server at module load,
 * which fails in vitest because next/server isn't available outside Next.js runtime.
 */

// ── next-auth stub ──
export function NextAuth() {
  return { handlers: {}, auth: async () => null, signIn: async () => {}, signOut: async () => {} }
}
export default NextAuth
