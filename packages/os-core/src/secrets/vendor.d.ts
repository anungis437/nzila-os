/**
 * Ambient module declarations for optional Azure SDK packages.
 *
 * These provide a safe `any`-typed fallback so TypeScript compiles even when
 * the Azure packages are not installed in the environment.  When the real
 * packages ARE installed (e.g. in production / CI), TypeScript uses their
 * bundled types instead of these declarations.
 *
 * keyvault.ts uses dynamic `await import(...)` so the packages are
 * runtime-optional; these declarations only satisfy the compile-time check.
 *
 * See: https://www.typescriptlang.org/docs/handbook/modules.html#ambient-modules
 */

declare module '@azure/keyvault-secrets' {
  export const SecretClient: any
}

declare module '@azure/identity' {
  export const DefaultAzureCredential: any
  export const ManagedIdentityCredential: any
  export const ClientSecretCredential: any
  export const WorkloadIdentityCredential: any
}
