// Pipeline
export { composePipeline } from "./pipeline.js";
export type {
  EnforcementContext,
  EnforcementResult,
  EnforcementLayer,
  NextFn,
} from "./pipeline.js";

// Pre-built layers
export {
  traceLayer,
  authLayer,
  rateLimitLayer,
  governanceLayer,
  auditLayer,
} from "./layers.js";
export type {
  AuthLayerConfig,
  RateLimitLayerConfig,
  GovernanceLayerConfig,
  AuditLayerConfig,
} from "./layers.js";

// Handler helpers
export { createContext, createEnforcedHandler } from "./handler.js";
export type { HandlerFn } from "./handler.js";

// Next.js adapter
export { withEnforcement, healthHandler } from "./nextjs.js";
export type { NextjsEnforcementConfig } from "./nextjs.js";

// Fastify adapter
export { enforcementPlugin } from "./fastify.js";
export type {
  FastifyEnforcementConfig,
  RouteEnforcementConfig,
} from "./fastify.js";
