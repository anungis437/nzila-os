/**
 * Nzila OS — Org Activation Constants & Types
 *
 * Extracted from actions.ts so that the server-action file only
 * exports async functions (Next.js requirement).
 */

export const MANAGED_APPS = [
  'union-eyes',
  'zonga',
  'shop-quoter',
  'cfo',
  'nacp',
  'abr',
] as const

export type ManagedApp = (typeof MANAGED_APPS)[number]

export interface AppActivationState {
  app: ManagedApp
  enabled: boolean
}
