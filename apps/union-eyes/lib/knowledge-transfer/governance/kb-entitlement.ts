import type { SQL } from 'drizzle-orm';
import { knowledgeBaseOrganizationCondition } from './kb-visibility';

/**
 * Whether the knowledge-base suite entitlement applies to a read.
 *
 * Publishing into the knowledge base needs the union_knowledge_suite entitlement, and the same table serves organizations that do not have
 * the suite. An organization's own rows are its own and are read without it. A row of a PARENT organization that the parent shared with this
 * one is that parent's content reaching a child, which is what the suite sells, so it needs the entitlement: without it the shared rows are
 * withheld, and an attempt to open one is refused and recorded.
 *
 * PROVISIONAL: which organizations without the suite may read what their parent shares is an institutional and commercial decision. This is
 * the conservative default (nothing is released that the entitlement does not cover) and carries `approvedBy: null`; the server never loosens
 * it on its own authority. A failure to determine the entitlement withholds the shared rows rather than releasing them.
 */
export const KNOWLEDGE_READ_POLICY = {
  version: 'ue-knowledge-read/provisional-1',
  approvedBy: null as string | null,
  parentSharedRowsRequireSuite: true,
  featureKey: 'union_knowledge_suite',
} as const;

export interface KnowledgeEntitlementCheck {
  (organizationId: string, featureKey: string): Promise<{ allowed: boolean }>;
}

/** Fails closed: an entitlement that cannot be determined is not held. */
export async function readerHasKnowledgeSuite(organizationId: string, check?: KnowledgeEntitlementCheck): Promise<boolean> {
  try {
    const run = check ?? (await import('@/services/platform-economics/entitlement-guard')).checkModuleEntitlement;
    return (await run(organizationId, KNOWLEDGE_READ_POLICY.featureKey)).allowed === true;
  } catch {
    return false;
  }
}

export interface KnowledgeReadScope {
  condition: SQL;
  /** True when the parent's shared rows exist in the lookup but are withheld because the reader lacks the entitlement. */
  parentSharedWithheld: boolean;
}

/** The rows a reader may see: always its own; the parent's shared rows only with the suite entitlement. */
export function knowledgeBaseReadScope(orgId: string, parentId: string | undefined, hasSuite: boolean): KnowledgeReadScope {
  if (!parentId) return { condition: knowledgeBaseOrganizationCondition(orgId, undefined), parentSharedWithheld: false };
  if (hasSuite || !KNOWLEDGE_READ_POLICY.parentSharedRowsRequireSuite) {
    return { condition: knowledgeBaseOrganizationCondition(orgId, parentId), parentSharedWithheld: false };
  }
  return { condition: knowledgeBaseOrganizationCondition(orgId, undefined), parentSharedWithheld: true };
}
