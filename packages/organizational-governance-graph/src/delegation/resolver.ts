/**
 * Delegation chain resolver — skeleton.
 *
 * Given a flat set of delegation edges (A→B, B→C, …) within a voting
 * context, walk the chains:
 *  - detect cycles (A→B→A) and mark them unresolved
 *  - preserve weights along the path (multiplicatively or by accumulation;
 *    accumulation is the safer default for democratic delegation)
 *  - return per-voter resolution states
 *
 * This is intentionally a SKELETON. It is correct enough for unit tests and
 * Phase 3 exploration; it is NOT a production vote audit. Production audit
 * must additionally consider eligibility revocation, time bounds, and
 * delegation caps per organization.
 */

export interface DelegationEdgeInput {
  readonly fromEntityId: string
  readonly toEntityId: string
  readonly votingWeight: number
  readonly votingSessionId: string
}

export type DelegationResolutionState =
  | 'resolved'
  | 'cyclic'
  | 'unresolved_dangling'

export interface DelegationResolution {
  readonly votingSessionId: string
  readonly originatorEntityId: string
  readonly terminalEntityId: string | null
  readonly path: readonly string[]
  readonly accumulatedWeight: number
  readonly state: DelegationResolutionState
  readonly cycleDetectedAt?: string
  readonly warning?: string
}

interface SessionGraph {
  readonly outgoing: Map<string, DelegationEdgeInput>
  readonly originators: ReadonlySet<string>
  readonly destinations: ReadonlySet<string>
}

function indexBySession(
  edges: readonly DelegationEdgeInput[],
): Map<string, SessionGraph> {
  const sessions = new Map<
    string,
    { outgoing: Map<string, DelegationEdgeInput>; originators: Set<string>; destinations: Set<string> }
  >()
  for (const edge of edges) {
    let g = sessions.get(edge.votingSessionId)
    if (!g) {
      g = { outgoing: new Map(), originators: new Set(), destinations: new Set() }
      sessions.set(edge.votingSessionId, g)
    }
    // Last-write-wins: a voter can only delegate to one target per session.
    g.outgoing.set(edge.fromEntityId, edge)
    g.originators.add(edge.fromEntityId)
    g.destinations.add(edge.toEntityId)
  }
  return sessions
}

/**
 * Resolve all delegation chains. Pure function; no IO.
 */
export function resolveDelegationChains(
  edges: readonly DelegationEdgeInput[],
): readonly DelegationResolution[] {
  const sessions = indexBySession(edges)
  const results: DelegationResolution[] = []

  for (const [sessionId, graph] of sessions) {
    for (const originator of graph.originators) {
      const visited = new Set<string>()
      const path: string[] = []
      let cursor: string | null = originator
      let accumulatedWeight = 0
      let state: DelegationResolutionState = 'resolved'
      let cycleAt: string | undefined
      let warning: string | undefined

      while (cursor) {
        if (visited.has(cursor)) {
          state = 'cyclic'
          cycleAt = cursor
          warning = `delegation cycle detected at ${cursor} in session ${sessionId}`
          path.push(cursor)
          break
        }
        visited.add(cursor)
        path.push(cursor)
        const next: DelegationEdgeInput | undefined = graph.outgoing.get(cursor)
        if (!next) {
          // terminal — cursor is the holder
          break
        }
        accumulatedWeight += next.votingWeight
        cursor = next.toEntityId
      }

      const terminal: string | null =
        state === 'cyclic'
          ? null
          : (path[path.length - 1] ?? null)

      // dangling = originator never reached a non-originator destination AND
      // the originator itself is also a destination of nothing — i.e. the
      // single-node trivial chain. Treat as resolved for trivial delegation
      // identity; only mark dangling when the path produced ZERO weight
      // and the originator did NOT have an outgoing edge.
      if (state !== 'cyclic' && accumulatedWeight === 0 && !graph.outgoing.has(originator)) {
        state = 'unresolved_dangling'
        warning = `${originator} has no outgoing delegation in session ${sessionId}`
      }

      results.push({
        votingSessionId: sessionId,
        originatorEntityId: originator,
        terminalEntityId: terminal,
        path,
        accumulatedWeight,
        state,
        ...(cycleAt ? { cycleDetectedAt: cycleAt } : {}),
        ...(warning ? { warning } : {}),
      })
    }
  }

  return results
}
