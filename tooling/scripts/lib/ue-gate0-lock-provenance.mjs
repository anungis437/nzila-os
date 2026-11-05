/**
 * Provenance rules for the independent capability lock.
 *
 * The lock lists every capability id the matrix may contain. Three sources justify an id, and nothing else does:
 *   1. the anchor matrix read from git history at `anchorCommit`;
 *   2. a checkpoint: the lock itself read from git history at a commit a reviewer accepted;
 *   3. an addition record that names a frozen route-classification tranche and a count of operations that tranche
 *      classified as owned by the capability. The validator recomputes that count from the tranche files.
 * Editing the lock by hand to add an id therefore fails unless a frozen tranche already classified operations to it.
 * No capability is added to reduce an undecided count: an addition with no classified operation is refused.
 */

/** Operations of a frozen tranche classified as owned by the capability. */
export function classifiedOperationCount(classification, capabilityId) {
  return (classification?.operations ?? []).filter((record) => record.status === 'CLASSIFIED' && record.capabilityId === capabilityId).length
}

export function lockVersionFor(lock) {
  const tranches = new Set((lock.additions ?? []).map((item) => item.tranche))
  return 1 + (lock.checkpoints ?? []).length + tranches.size
}

export function lockProvenanceProblems({ lock, byId, anchorIds, checkpointIds, tranches, deps }) {
  const problems = []
  if (!lock) return problems
  const lockIds = new Set(lock.capabilityIds ?? [])
  const checkpoints = Array.isArray(lock.checkpoints) ? lock.checkpoints : []
  const additions = Array.isArray(lock.additions) ? lock.additions : []
  const baseline = new Set(anchorIds ?? [])

  checkpoints.forEach((checkpoint, index) => {
    if (!/^[0-9a-f]{40}$/.test(checkpoint?.commit ?? '') || !deps.commitExists(checkpoint.commit)) {
      problems.push(`independent lock checkpoint ${index + 1} does not name an existing commit`)
      return
    }
    const ids = checkpointIds?.[checkpoint.commit]
    if (!Array.isArray(ids)) {
      problems.push(`independent lock checkpoint ${checkpoint.commit} cannot be read from git history`)
      return
    }
    for (const id of ids) {
      baseline.add(id)
      if (!lockIds.has(id) && !(lock.retirements ?? []).some((item) => item.capabilityId === id)) problems.push(`independent lock dropped capability ${id} accepted at checkpoint ${checkpoint.commit.slice(0, 9)}`)
    }
  })

  const seen = new Set()
  for (const addition of additions) {
    const label = `independent lock addition ${addition?.capabilityId ?? '(missing id)'}`
    if (!addition?.capabilityId || seen.has(addition.capabilityId)) {
      problems.push(`${label} is missing or duplicated`)
      continue
    }
    seen.add(addition.capabilityId)
    if (!lockIds.has(addition.capabilityId)) problems.push(`${label} is not in the lock capability list`)
    if (baseline.has(addition.capabilityId)) problems.push(`${label} duplicates a capability the anchor or a checkpoint already holds`)
    if (!byId.has(addition.capabilityId)) problems.push(`${label} is not in the engineering completion matrix`)
    if (typeof addition.reason !== 'string' || addition.reason.trim().length < 20) problems.push(`${label} has no reason`)
    const tranche = tranches.find((item) => item.tranche === addition.tranche)
    if (!tranche) {
      problems.push(`${label} names tranche ${addition.tranche}, which has no frozen classification`)
      continue
    }
    if (tranche.manifest?.operationsHash !== addition.operationsHash) problems.push(`${label} does not match the frozen operations hash of ${addition.tranche}`)
    const count = classifiedOperationCount(tranche.classification, addition.capabilityId)
    if (count < 1) problems.push(`${label} owns no operation that ${addition.tranche} classified; a capability is not added to reduce the undecided count`)
    else if (addition.classifiedOperations !== count) problems.push(`${label} records ${addition.classifiedOperations} classified operation(s) but ${addition.tranche} classified ${count}`)
    const files = byId.get(addition.capabilityId)?.sourceFiles ?? []
    if (files.length === 0 || files.some((file) => !deps.exists(file))) problems.push(`${label} has no existing implementation source file in the matrix`)
  }

  for (const id of lockIds) {
    if (baseline.has(id) || seen.has(id)) continue
    problems.push(`${id} is in the independent lock without an anchor, checkpoint or addition record that proves its provenance`)
  }
  if (Number.isInteger(lock.lockVersion) && lock.lockVersion !== lockVersionFor(lock)) {
    problems.push(`independent lock lockVersion is ${lock.lockVersion} but its checkpoints and additions require ${lockVersionFor(lock)}`)
  }
  return problems
}

/**
 * Deterministic lock update. Adds an addition record for every matrix capability the lock does not hold and returns
 * the new lock, or throws when a capability has no classified operation in any frozen tranche.
 */
export function updatedLock({ lock, matrixIds, anchorIds, checkpointIds, tranches, matrixById }) {
  const baseline = new Set([...(anchorIds ?? []), ...Object.values(checkpointIds ?? {}).flat()])
  const lockIds = new Set(lock.capabilityIds)
  const additions = [...(lock.additions ?? [])]
  for (const id of [...matrixIds].sort()) {
    if (lockIds.has(id) || baseline.has(id)) continue
    const tranche = [...tranches].reverse().find((item) => classifiedOperationCount(item.classification, id) > 0)
    if (!tranche) throw new Error(`capability ${id} is not in the lock and no frozen tranche classified an operation to it`)
    additions.push({
      capabilityId: id,
      tranche: tranche.tranche,
      operationsHash: tranche.manifest.operationsHash,
      classifiedOperations: classifiedOperationCount(tranche.classification, id),
      reason: `Created by ${tranche.tranche} as the engineering capability whose obligation covers operations that tranche classified from source evidence: ${matrixById.get(id)?.obligationKey ?? id}.`,
    })
    lockIds.add(id)
  }
  const next = { ...lock, capabilityIds: [...lockIds].sort(), additions }
  next.lockVersion = lockVersionFor(next)
  return next
}
