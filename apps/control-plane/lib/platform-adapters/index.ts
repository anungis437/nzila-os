/**
 * Platform adapter barrel — control-plane
 *
 * The control plane consumes contract data FROM other apps
 * rather than producing its own. Adapters here are for
 * transforming inbound contract data for display.
 *
 * See @nzila/platform-contracts for contract definitions.
 */
export { getSystemState, type SystemState, type DomainHealth } from '../../services/system-state'
export { getRevenueOverview, type RevenueOverview } from '../../services/revenue-aggregator'
