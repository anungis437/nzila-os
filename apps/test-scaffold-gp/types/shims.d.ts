declare module '@nzila/platform-auth/entra/server' {
  export const auth: (...args: unknown[]) => unknown
}

declare module '@nzila/enforcement' {
  export type EnforcementContext = unknown
  export const composePipeline: (layers: unknown[]) => (ctx: unknown) => Promise<{ success: boolean; status: number; body?: unknown }>
  export const traceLayer: () => unknown
  export const authLayer: (config: unknown) => unknown
  export const rateLimitLayer: (config: unknown) => unknown
  export const governanceLayer: (config: unknown) => unknown
  export const auditLayer: (config: unknown) => unknown
}

declare module '@nzila/os-core/evidence' {
  export type GovernanceActionContext = unknown
  export type EvidencePackResult = unknown
  export const buildEvidencePackFromAction: (action: unknown) => Promise<unknown>
  export const processEvidencePack: (pack: unknown) => Promise<unknown>
  export const generateSeal: (...args: unknown[]) => unknown
  export const verifySeal: (...args: unknown[]) => unknown
}
