/**
 * CRUD item route for userConsents
 *
 * SECURITY FIX (round 47): only the record's own subject may read/withdraw
 * their consent — org scoping alone let any org member (readRole) view, and
 * any steward mutate, ANY other member's consent record. ownerColumn
 * restricts GET/PATCH to the caller; DELETE removed entirely (consent
 * provenance must not be forgeable/erasable, and it was setting an invalid
 * enum value — 'archived' is not a member of consent_status — so it never
 * actually worked). blockedPatchFields keeps consent facts (type, legal
 * basis, purpose, version, text, grant metadata) immutable via self-service
 * PATCH; only status/withdrawnAt may change.
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { userConsents } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH } = crudRoutes({
  table: userConsents,
  pk: 'id',
  tags: ["Auth"],
  orgScoped: true,
  ownerColumn: 'userId',
  itemRoute: true,
  readRole: 'member',
  writeRole: 'member',
  blockedPatchFields: [
    'userId',
    'organizationId',
    'consentType',
    'legalBasis',
    'processingPurpose',
    'consentVersion',
    'consentText',
    'ipAddress',
    'userAgent',
    'grantedAt',
    'createdAt',
  ],
});
export { GET, PATCH };
