/**
 * Graph Identity — one authoritative, ambiguity-aware resolution of a node reference to a CURRENT dependency node.
 *
 * DependencyNode.id (topic-graph-builder.ts) is derived from a mutable interview tag label by replacing whitespace
 * with underscores (e.g. "Payroll System" -> "Payroll_System"). It is not a durable, assigned identity, so every
 * comparison of a stored reference (a verified dependency's node ids, an alias label) with the current graph goes
 * through resolveNodeReference below, and every consumer compares the RESOLVED current node ids it returns - never
 * raw strings and never identity keys on their own.
 *
 * Identity key, version 2 (IDENTITY_KEY_VERSION). It tolerates only the differences that cannot change what a label
 * names: underscores standing for spaces, letter case, Unicode composition form (NFC) and runs of whitespace. It does
 * NOT strip accents or punctuation: version 1 did, and that made distinct concepts collide ("C++" and "C", "Côté" and
 * "Cote", "Re-hire" and "Rehire"). Anything beyond the version-2 tolerance - a semantic rename, a merge, a split - is
 * an explicit, audited alias (node-alias-store.ts), never a guess.
 *
 * Resolution never silently picks one of several candidates: when more than one current node, or more than one
 * active alias, matches a reference, the result is 'ambiguous' and no evidence may attach to it until an authorized
 * reviewer resolves the collision with an alias.
 *
 * (DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE, Family 1 final correction)
 */

/** The identity-key rules a fingerprint or stored reference was computed under. Bumped whenever the rules change. */
export const IDENTITY_KEY_VERSION = 2 as const;
export type IdentityKeyVersion = 1 | 2;

/** Version 2 identity key: underscores -> spaces, NFC, case-folded, trimmed, whitespace runs collapsed. Nothing else. */
export function canonicalNodeIdentityKey(nodeIdOrLabel: string): string {
  if (typeof nodeIdOrLabel !== 'string' || nodeIdOrLabel.length === 0) return '';
  return nodeIdOrLabel.replace(/_/g, ' ').normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Version 1 identity key, kept ONLY to judge fingerprints recorded before version 2 existed (graph-fingerprint.ts).
 * It strips accents and punctuation and is therefore collision-prone; it must never be used to resolve identity.
 */
export function legacyIdentityKeyV1(nodeIdOrLabel: string): string {
  if (typeof nodeIdOrLabel !== 'string' || nodeIdOrLabel.length === 0) return '';
  return nodeIdOrLabel
    .replace(/_+/g, ' ')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // diacritics
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function identityKeyFor(version: IdentityKeyVersion, nodeIdOrLabel: string): string {
  return version === 1 ? legacyIdentityKeyV1(nodeIdOrLabel) : canonicalNodeIdentityKey(nodeIdOrLabel);
}

/** An active (non-superseded) alias, as consulted by resolveNodeReference. See NodeAlias in verified-dependency-models.ts. */
export interface AliasLookup {
  aliasLabel: string;
  canonicalConceptLabel: string;
}

export type NodeResolution =
  | { status: 'resolved'; nodeId: string; via: 'direct' | 'alias' }
  | { status: 'not_found' }
  | { status: 'ambiguous'; candidates: string[] };

/** Every current node id whose identity key (under `version`) equals the reference's. */
function directMatches(currentNodeIds: readonly string[], reference: string, version: IdentityKeyVersion): string[] {
  const key = identityKeyFor(version, reference);
  if (key === '') return [];
  return currentNodeIds.filter((id) => identityKeyFor(version, id) === key);
}

/**
 * Resolves a node reference (a stored node id or a label) to exactly one CURRENT node.
 *
 *  1. Direct: the current node(s) whose version-2 identity key equals the reference's. One match resolves; two or
 *     more is 'ambiguous' (two current labels that differ only by case or spacing - the graph itself must be
 *     disambiguated by an alias, never by guessing).
 *  2. Alias: only when nothing matches directly. The active alias(es) whose aliasLabel has the reference's identity
 *     key; exactly one alias must match, and its canonicalConceptLabel must then resolve DIRECTLY to exactly one
 *     current node. Aliases are one level deep by design (no alias-to-alias chains, so no cycles).
 *
 * The same function backs every evidence, lookup, currentness and consumer path in this package.
 */
export function resolveNodeReference(
  aliases: readonly AliasLookup[],
  currentNodeIds: readonly string[],
  reference: string,
): NodeResolution {
  const direct = directMatches(currentNodeIds, reference, IDENTITY_KEY_VERSION);
  if (direct.length === 1) return { status: 'resolved', nodeId: direct[0], via: 'direct' };
  if (direct.length > 1) return { status: 'ambiguous', candidates: direct };

  const key = canonicalNodeIdentityKey(reference);
  if (key === '') return { status: 'not_found' };
  const matchingAliases = aliases.filter((alias) => canonicalNodeIdentityKey(alias.aliasLabel) === key);
  if (matchingAliases.length === 0) return { status: 'not_found' };
  const targets = [...new Set(matchingAliases.map((alias) => canonicalNodeIdentityKey(alias.canonicalConceptLabel)))];
  if (targets.length > 1) return { status: 'ambiguous', candidates: matchingAliases.map((alias) => alias.canonicalConceptLabel) };
  const viaAlias = directMatches(currentNodeIds, matchingAliases[0].canonicalConceptLabel, IDENTITY_KEY_VERSION);
  if (viaAlias.length === 1) return { status: 'resolved', nodeId: viaAlias[0], via: 'alias' };
  if (viaAlias.length > 1) return { status: 'ambiguous', candidates: viaAlias };
  return { status: 'not_found' };
}

/**
 * Whether a reference resolved under the LEGACY version-1 key names exactly one current node. Used only to decide
 * whether a pre-version-2 fingerprint can still be trusted: it can when the legacy key was unambiguous for the
 * current graph (so the original attestation provably named one concept), and must be re-verified otherwise.
 */
export function legacyReferenceIsUnambiguous(currentNodeIds: readonly string[], reference: string): boolean {
  return directMatches(currentNodeIds, reference, 1).length === 1;
}

/**
 * Compatibility helper: the resolved current node id, or null when the reference is unknown OR ambiguous. Callers
 * that need to tell those two apart must use resolveNodeReference.
 */
export function resolveConceptLabel(
  aliases: readonly AliasLookup[],
  currentNodeIds: readonly string[],
  reference: string,
): string | null {
  const resolution = resolveNodeReference(aliases, currentNodeIds, reference);
  return resolution.status === 'resolved' ? resolution.nodeId : null;
}
