/**
 * Graph Evidence Fingerprint — deterministic currentness check for verified dependency evidence
 * (DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE).
 *
 * A verified dependency attests a DIRECTED relationship between two propagation-map nodes as they were understood
 * when it was verified. If either node's meaningful classification later changes (re-categorized, or its node type
 * changed because new interview data clarified what it refers to), the attestation no longer describes the same claim
 * and must be re-verified before it can back a confirmed conclusion. The fingerprint hashes exactly the attributes
 * that constitute that claim, in order (dependent first, depends-on second, so a reversed pair never matches): each
 * node's identity key, category and node type. Frequency, isSingleSource and continuitySensitivity are excluded -
 * they fluctuate with ordinary accumulation of interview data and are not what a reviewer attested.
 *
 * Versioned with the identity key (graph-identity.ts). Version 1 is reproduced byte-for-byte so a fingerprint
 * recorded before version 2 can still be judged (and is trusted only when its legacy key is unambiguous for the
 * current graph - see graph-evidence-service.ts); version 2 records its version inside the hashed payload, so a
 * version-1 and a version-2 fingerprint can never be equal by accident.
 */
import { createHash } from 'node:crypto';
import { IDENTITY_KEY_VERSION, identityKeyFor, type IdentityKeyVersion } from './graph-identity';

export interface FingerprintableNode {
  label: string;
  category: string;
  nodeType: string;
}

/** Deterministic and side-effect free: the same ordered pair of nodes always produces the same fingerprint. */
export function computeSourceFingerprint(
  dependentNode: FingerprintableNode,
  dependsOnNode: FingerprintableNode,
  version: IdentityKeyVersion = IDENTITY_KEY_VERSION,
): string {
  const side = (node: FingerprintableNode) => ({ key: identityKeyFor(version, node.label), category: node.category, nodeType: node.nodeType });
  const payload = version === 1
    ? { dependent: side(dependentNode), dependsOn: side(dependsOnNode) }
    : { v: 2, dependent: side(dependentNode), dependsOn: side(dependsOnNode) };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 32);
}
