/**
 * Platform adapter barrel — Flow
 *
 * Implements @nzila/platform-contracts for the Flow app.
 * Import these adapters in API route handlers or background jobs.
 */
export { healthAdapter } from './health-adapter'
export { metricsAdapter } from './metrics-adapter'
export { evidenceAdapter } from './evidence-adapter'
export { governanceAdapter } from './governance-adapter'
