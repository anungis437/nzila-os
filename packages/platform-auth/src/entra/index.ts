/**
 * @nzila/platform-auth — Entra Module Entry Point
 *
 * All Entra-specific exports in one place.
 *
 * Import paths:
 *   '@nzila/platform-auth/entra'          — this barrel
 *   '@nzila/platform-auth/entra/server'   — server-side auth functions
 *   '@nzila/platform-auth/entra/client'   — client hooks & provider
 *   '@nzila/platform-auth/entra/config'   — NextAuth config & handlers
 *   '@nzila/platform-auth/entra/middleware' — auth middleware
 */

// ── Config / NextAuth instance ──────────────────────────────────────────────
export { handlers, auth, signIn, signOut, authConfig } from './config'

// ── Adapter (session → identity) ────────────────────────────────────────────
export {
  resolveIdentityFromEntra,
  resolveEntraServiceIdentity,
  mapEntraRoleToOrgRole,
  hasEntraRole,
  hasAnyEntraRole,
} from './adapter'

// ── Types ───────────────────────────────────────────────────────────────────
export type {
  EntraAppRoles,
  EntraSession,
  EntraTokenClaims,
  EntraConfig,
} from './types'
