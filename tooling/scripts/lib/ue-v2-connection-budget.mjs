// Independent pools: app tenant, app alternate client, shared platform client,
// app SYSTEM, shared SYSTEM, and the two separately credentialed auth gateways.
export const POOL_MULTIPLICITY = Object.freeze({
  DB_POOL_MAX: 2,
  DATABASE_POOL_SIZE: 1,
  SYSTEM_DB_POOL_MAX: 2,
  AUTH_DB_POOL_MAX: 1,
  AUTH_SYSTEM_DB_POOL_MAX: 1,
})

export function evaluateStagingConnectionBudget({ policy, maxConnections, reservedConnections, superuserReservedConnections, maximumReplicas }) {
  const defects = []
  const positive = value => Number.isSafeInteger(value) && value > 0
  const nonnegative = value => Number.isSafeInteger(value) && value >= 0
  if (policy?.schema !== 'ue-v2-staging-connection-budget/v1') defects.push('UNKNOWN_CONNECTION_BUDGET_SCHEMA')
  if (!positive(maxConnections) || !nonnegative(reservedConnections) || !nonnegative(superuserReservedConnections) || !positive(maximumReplicas)) defects.push('INVALID_SERVER_OR_REPLICA_LIMIT')
  if (!positive(policy?.maximumActiveRevisionsDuringRollout) || policy.maximumActiveRevisionsDuringRollout !== 2 || !positive(policy?.ordinaryConnectionHeadroom)) defects.push('INVALID_ROLLOUT_OR_HEADROOM_POLICY')
  const caps = policy?.poolCaps ?? {}
  if (Object.keys(caps).sort().join(',') !== Object.keys(POOL_MULTIPLICITY).sort().join(',')) defects.push('INCOMPLETE_POOL_BUDGET')
  for (const name of Object.keys(POOL_MULTIPLICITY)) if (!positive(caps[name])) defects.push('INVALID_POOL_CAP:' + name)
  if (defects.length) return { ok: false, defects }
  const connectionsPerProcess = Object.entries(POOL_MULTIPLICITY).reduce((sum, [name, count]) => sum + caps[name] * count, 0)
  const maximumRolloutReplicas = maximumReplicas * policy.maximumActiveRevisionsDuringRollout
  const maximumApplicationConnections = maximumRolloutReplicas * connectionsPerProcess
  const ordinarySlots = maxConnections - reservedConnections - superuserReservedConnections
  if (maximumApplicationConnections + policy.ordinaryConnectionHeadroom > ordinarySlots) defects.push('APPLICATION_POOLS_EXCEED_ORDINARY_CONNECTION_BUDGET')
  return { ok: defects.length === 0, defects, maxConnections, reservedConnections, superuserReservedConnections, ordinarySlots, connectionsPerProcess, maximumRolloutReplicas, maximumApplicationConnections, ordinaryConnectionHeadroom: policy.ordinaryConnectionHeadroom }
}

/** Only zero-traffic revisions may be retired; an inactive revision stays retained. */
export function retirementTargets({ mode, traffic, revisions, expectedServingRevision }) {
  if (mode !== 'Multiple' || !Array.isArray(traffic) || traffic.some(row => row.latestRevision === true)) throw new Error('EXPLICIT_MULTIPLE_REVISION_TRAFFIC_REQUIRED')
  const serving = traffic.filter(row => row.weight > 0)
  if (serving.length !== 1 || serving[0].weight !== 100 || serving[0].revisionName !== expectedServingRevision) throw new Error('SERVING_REVISION_CHANGED')
  const known = revisions.find(row => row.name === expectedServingRevision)
  if (!known?.active || known.trafficWeight !== 100) throw new Error('HEALTHY_SERVING_REVISION_REQUIRED')
  return revisions.filter(row => row.active && row.name !== expectedServingRevision && row.trafficWeight === 0).map(row => row.name)
}

/** A partial apply can leave the exact candidate retained but inactive on retry. */
export function candidateNeedsActivation({ sourceSha, expectedImage, revision }) {
  if (!/^[a-f0-9]{40}$/.test(sourceSha) || !/^nzilaventuresacr\.azurecr\.io\/nzila-os-union-eyes-v2@sha256:[a-f0-9]{64}$/.test(expectedImage)) throw new Error('EXACT_CANDIDATE_IDENTITY_REQUIRED')
  if (revision?.name !== 'nzila-ue-v2-staging-app--rel' + sourceSha.slice(0, 10)) throw new Error('WRONG_CANDIDATE_REVISION')
  const containers = revision.properties?.template?.containers
  if (containers?.length !== 1 || containers[0].image !== expectedImage) throw new Error('WRONG_CANDIDATE_IMAGE')
  if (typeof revision.properties.active !== 'boolean') throw new Error('CANDIDATE_ACTIVE_STATE_REQUIRED')
  return !revision.properties.active
}
