import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import {
  standardErrorResponse,
  standardSuccessResponse,
  ErrorCode,
} from '@/lib/api/standardized-responses';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { hasMinRole } from '@/lib/api-auth-guard';
import { db } from '@/db/db';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { grievanceEvents } from '@/db/schema/domains/claims/grievance-lifecycle';
import { organizationMembers } from '@/db/schema/organization-members-schema';
import { collectiveAgreements } from '@/db/schema/domains/agreements/collective-agreements';
import {
  documents,
  documentAccessGrants,
  documentLinks,
} from '@/db/schema/documents-schema';
import {
  isDocumentVisibleByPolicy,
  normalizeDocumentTitle,
  toGovernanceLabel,
} from '@/lib/services/document-governance-service';
import { getEffectiveCaseAccess } from '@/lib/services/case-access-service';

function scoreText(value: string | null | undefined, query: string) {
  if (!value) {
    return 0;
  }
  const normalized = value.toLowerCase();
  const q = query.toLowerCase();
  if (normalized === q) {
    return 120;
  }
  if (normalized.startsWith(q)) {
    return 80;
  }
  if (normalized.includes(q)) {
    return 40;
  }
  return 0;
}

export const GET = withOrganizationAuth(async (request, context) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  const canSearch = await hasMinRole('member');
  if (!canSearch) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'Unauthorized');
  }

  const searchParams = new URL(request.url).searchParams;
  const q = (searchParams.get('q') ?? '').trim();

  if (!q || q.length < 2) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Search query must be at least 2 characters');
  }

  const isStewardPlus = await hasMinRole('steward');

  const caseRows = await db
    .select({
      id: grievances.id,
      grievanceNumber: grievances.grievanceNumber,
      title: grievances.title,
      status: grievances.status,
      priority: grievances.priority,
      updatedAt: grievances.updatedAt,
    })
    .from(grievances)
    .where(
      and(
        eq(grievances.organizationId, organizationId),
        or(
          ilike(grievances.grievanceNumber, `%${q}%`),
          ilike(grievances.title, `%${q}%`),
          ilike(grievances.description, `%${q}%`),
          ilike(grievances.employerName, `%${q}%`),
        ),
      ),
    )
    .orderBy(desc(grievances.updatedAt))
    .limit(40);

  const cases = (
    await Promise.all(
      caseRows.map(async (row) => {
        const access = await getEffectiveCaseAccess({
          organizationId,
          grievanceId: row.id,
          userId,
        });

        if (!isStewardPlus && !access.canViewCase) {
          return null;
        }

        const score =
          scoreText(row.grievanceNumber, q) +
          scoreText(row.title, q) +
          Math.max(1, Math.floor((Date.now() - new Date(row.updatedAt).getTime()) / (1000 * 60 * 60 * 24)) === 0 ? 20 : 0);

        return {
          ...row,
          score,
        };
      }),
    )
  )
    .filter(Boolean)
    .sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0))
    .slice(0, 12);

  const docRows = await db
    .select({
      id: documents.id,
      title: documents.title,
      filename: documents.filename,
      documentType: documents.documentType,
      privacyLabel: documents.privacyLabel,
      updatedAt: documents.updatedAt,
      linkedEntityType: documentLinks.linkedEntityType,
      linkedEntityId: documentLinks.linkedEntityId,
    })
    .from(documents)
    .leftJoin(documentLinks, eq(documentLinks.documentId, documents.id))
    .where(
      and(
        eq(documents.organizationId, organizationId),
        sql`${documents.deletedAt} IS NULL`,
        or(
          ilike(documents.title, `%${q}%`),
          ilike(documents.filename, `%${q}%`),
          ilike(documents.name, `%${q}%`),
          ilike(documents.documentType, `%${q}%`),
        ),
      ),
    )
    .orderBy(desc(documents.updatedAt))
    .limit(60);

  const documentsResult = (
    await Promise.all(
      docRows.map(async (row) => {
        let caseAccess = {
          isPrimaryOwner: false,
          canViewCase: false,
          canViewPrivateDocuments: false,
        };

        if (row.linkedEntityType === 'grievance' && row.linkedEntityId) {
          const effective = await getEffectiveCaseAccess({
            organizationId,
            grievanceId: row.linkedEntityId,
            userId,
          });
          caseAccess = {
            isPrimaryOwner: effective.isPrimaryOwner,
            canViewCase: effective.canViewCase,
            canViewPrivateDocuments: effective.canViewPrivateDocuments,
          };
        }

        const explicitGrant = (
          await db
            .select({ id: documentAccessGrants.id })
            .from(documentAccessGrants)
            .where(
              and(
                eq(documentAccessGrants.organizationId, organizationId),
                eq(documentAccessGrants.documentId, row.id),
                eq(documentAccessGrants.userId, userId),
                eq(documentAccessGrants.status, 'active'),
                eq(documentAccessGrants.canView, true),
                sql`${documentAccessGrants.revokedAt} IS NULL`,
                sql`(${documentAccessGrants.expiresAt} IS NULL OR ${documentAccessGrants.expiresAt} > NOW())`,
              ),
            )
            .limit(1)
        )[0];

        const allowed = isDocumentVisibleByPolicy(
          toGovernanceLabel({ privacyLabel: row.privacyLabel ?? undefined }),
          {
            isOrgMember: true,
            isStewardPlus,
            isPrimaryOwner: caseAccess.isPrimaryOwner,
            hasCaseAccess: isStewardPlus || caseAccess.canViewCase || !row.linkedEntityId,
            canViewPrivateDocuments: caseAccess.canViewPrivateDocuments,
            hasExplicitDocumentGrant: Boolean(explicitGrant),
          },
        );

        if (!allowed) {
          return null;
        }

        const title = normalizeDocumentTitle(row);
        const score =
          scoreText(title, q) +
          scoreText(row.filename, q) +
          scoreText(row.documentType, q);

        return {
          ...row,
          title,
          score,
        };
      }),
    )
  )
    .filter(Boolean)
    .sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0))
    .slice(0, 15);

  const memberRows = await db
    .select({
      id: organizationMembers.id,
      userId: organizationMembers.userId,
      name: organizationMembers.name,
      email: organizationMembers.email,
      department: organizationMembers.department,
      role: organizationMembers.role,
      status: organizationMembers.status,
      updatedAt: organizationMembers.updatedAt,
    })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        sql`${organizationMembers.deletedAt} IS NULL`,
        or(
          ilike(organizationMembers.name, `%${q}%`),
          ilike(organizationMembers.email, `%${q}%`),
          ilike(organizationMembers.membershipNumber, `%${q}%`),
          ilike(organizationMembers.department, `%${q}%`),
        ),
      ),
    )
    .orderBy(desc(organizationMembers.updatedAt))
    .limit(20);

  const members = memberRows
    .map((row) => ({
      ...row,
      score: scoreText(row.name, q) + scoreText(row.email, q),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const agreementRows = await db
    .select({
      id: collectiveAgreements.id,
      cbaNumber: collectiveAgreements.cbaNumber,
      title: collectiveAgreements.title,
      employerName: collectiveAgreements.employerName,
      status: collectiveAgreements.status,
      updatedAt: collectiveAgreements.updatedAt,
    })
    .from(collectiveAgreements)
    .where(
      and(
        eq(collectiveAgreements.organizationId, organizationId),
        or(
          ilike(collectiveAgreements.cbaNumber, `%${q}%`),
          ilike(collectiveAgreements.title, `%${q}%`),
          ilike(collectiveAgreements.employerName, `%${q}%`),
        ),
      ),
    )
    .orderBy(desc(collectiveAgreements.updatedAt))
    .limit(20);

  const agreements = agreementRows
    .map((row) => ({
      ...row,
      score: scoreText(row.cbaNumber, q) + scoreText(row.title, q),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const notesRows = await db
    .select({
      id: grievanceEvents.id,
      grievanceId: grievanceEvents.grievanceId,
      eventType: grievanceEvents.eventType,
      notes: grievanceEvents.notes,
      createdAt: grievanceEvents.createdAt,
    })
    .from(grievanceEvents)
    .innerJoin(grievances, eq(grievances.id, grievanceEvents.grievanceId))
    .where(
      and(
        eq(grievances.organizationId, organizationId),
        or(
          eq(grievanceEvents.eventType, 'note_added'),
          eq(grievanceEvents.eventType, 'deadline_set'),
          eq(grievanceEvents.eventType, 'meeting_scheduled'),
        ),
        ilike(grievanceEvents.notes, `%${q}%`),
      ),
    )
    .orderBy(desc(grievanceEvents.createdAt))
    .limit(30);

  const tasksAndNotes = (
    await Promise.all(
      notesRows.map(async (row) => {
        const access = await getEffectiveCaseAccess({
          organizationId,
          grievanceId: row.grievanceId,
          userId,
        });

        if (!isStewardPlus && !access.canViewCase) {
          return null;
        }

        return {
          ...row,
          score: scoreText(row.notes, q),
        };
      }),
    )
  )
    .filter(Boolean)
    .sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0))
    .slice(0, 12);

  return standardSuccessResponse({
    query: q,
    groups: {
      cases,
      documents: documentsResult,
      members,
      agreements,
      tasksAndNotes,
    },
    totals: {
      cases: cases.length,
      documents: documentsResult.length,
      members: members.length,
      agreements: agreements.length,
      tasksAndNotes: tasksAndNotes.length,
    },
  });
});
