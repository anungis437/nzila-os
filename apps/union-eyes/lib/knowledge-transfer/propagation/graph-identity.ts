/**
 * Graph Identity — canonical node identity resolution for the dependency graph.
 *
 * DependencyNode.id (topic-graph-builder.ts) is derived from a mutable interview tag label by replacing
 * whitespace with underscores (e.g. "Payroll System" -> "Payroll_System"). That id is not a durable, assigned
 * identity: a label re-cased, re-spaced, re-punctuated, renamed or retired changes or removes the id it produces,
 * and two labels that differ only in case or spacing would otherwise be treated as two different nodes.
 *
 * This module does not replace that id (a durable, independently-assigned identity would require a schema
 * change and a migration of every existing stored reference - tracked as remaining work, not attempted here).
 * What it provides now, bounded and real: a canonical identity KEY that is tolerant of the differences a label
 * can pick up without changing its real-world meaning (case, whitespace run-length, surrounding punctuation), so
 * verified-dependency lookups and evidence matching are collision-resistant against that class of drift. Two
 * literal ids that canonicalize to the same key are treated as the same node for verification purposes; two ids
 * that canonicalize differently are never silently treated as the same node.
 *
 * (DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE)
 */

/**
 * Normalizes a DependencyNode.id (or a raw label) to a canonical identity key: underscores reversed back to
 * single spaces, lowercased, trimmed, internal whitespace collapsed, and surrounding/duplicate punctuation
 * stripped. Deterministic and side-effect free - the same input always produces the same key.
 */
export function canonicalNodeIdentityKey(nodeIdOrLabel: string): string {
  if (typeof nodeIdOrLabel !== 'string' || nodeIdOrLabel.length === 0) return '';
  return nodeIdOrLabel
    .replace(/_+/g, ' ')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // diacritics
    .replace(/[^\p{L}\p{N}\s]/gu, '') // punctuation
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Resolves a possibly-stale node id against the organization's CURRENT dependency nodes. Returns the id of the
 * current node with a matching canonical identity key, or null when no current node matches at all (the label
 * was retired, not merely re-formatted). Never guesses a "close enough" match across two DIFFERENT canonical
 * keys - that would risk attributing verified evidence to the wrong node.
 */
export function resolveCurrentNodeId(currentNodeIds: readonly string[], candidateNodeId: string): string | null {
  const candidateKey = canonicalNodeIdentityKey(candidateNodeId);
  const match = currentNodeIds.find((id) => canonicalNodeIdentityKey(id) === candidateKey);
  return match ?? null;
}
