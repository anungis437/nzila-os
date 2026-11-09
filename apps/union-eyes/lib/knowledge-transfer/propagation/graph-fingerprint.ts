/**
 * Graph Evidence Fingerprint — deterministic currentness check for verified dependency evidence
 * (DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE, Family 1 exit).
 *
 * A verified dependency attests a directional relationship between two propagation-map nodes AS THEY WERE
 * understood at the time of verification. If either node's meaningful classification later changes (the tag was
 * re-categorized, or its node type changed because new interview data clarified what it actually refers to), the
 * original attestation no longer describes the same claim - it must be re-verified before it can back a confirmed
 * conclusion again. This module computes a short, deterministic hash of exactly the attributes that constitute
 * that claim: the canonical identity key of the label (not the raw label, so cosmetic drift alone never forces a
 * re-verification), its category and its node type. Frequency, isSingleSource and continuitySensitivity are
 * deliberately excluded - those fluctuate with ordinary accumulation of interview data and are not part of what a
 * reviewer attested; including them would force spurious re-verification on every new interview.
 */
import { createHash } from 'node:crypto';
import { canonicalNodeIdentityKey } from './graph-identity';

export interface FingerprintableNode {
  label: string;
  category: string;
  nodeType: string;
}

/** Deterministic and side-effect free: the same two nodes' meaningful attributes always produce the same fingerprint. */
export function computeSourceFingerprint(dependentNode: FingerprintableNode, dependsOnNode: FingerprintableNode): string {
  const canonical = JSON.stringify({
    dependent: { key: canonicalNodeIdentityKey(dependentNode.label), category: dependentNode.category, nodeType: dependentNode.nodeType },
    dependsOn: { key: canonicalNodeIdentityKey(dependsOnNode.label), category: dependsOnNode.category, nodeType: dependsOnNode.nodeType },
  });
  return createHash('sha256').update(canonical).digest('hex').slice(0, 32);
}
