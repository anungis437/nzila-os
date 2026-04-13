/**
 * Services layer — orchestration services for control-plane.
 *
 * The control plane aggregates health, governance, revenue,
 * and cross-app activity into a unified system state.
 */
export { getSystemState, type SystemState } from './system-state'
export { getRevenueOverview, type RevenueOverview } from './revenue-aggregator'
