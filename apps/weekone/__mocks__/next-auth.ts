/**
 * Vitest mock for next-auth — prevents `next/server` import crash in unit tests.
 */
export function NextAuth() {
  return {
    handlers: {},
    auth: async () => null,
    signIn: async () => {},
    signOut: async () => {},
  };
}
export default NextAuth;
