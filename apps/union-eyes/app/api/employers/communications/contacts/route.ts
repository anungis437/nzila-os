/**
 * Employer Contacts API
 *
 * POST /api/employers/communications/contacts — Add employer contact
 * GET  /api/employers/communications/contacts — List contacts for employer
 */

import { z } from "zod";
import { db } from "@/db/db";
import { employerContacts } from "@/db/schema/domains/communications/employer-communications";
import { employers } from "@/db/schema/union-structure-schema";
import { withOrganizationAuth } from "@/lib/organization-middleware";
import { hasMinRole } from "@/lib/api-auth-guard";
import { auditDataMutation } from "@/lib/audit-logger";
import {
  emitCapeAuditEvent,
  CAPE_AUDIT_EVENTS,
} from "@/lib/audit/cape-audit-events";
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";
import { eq, desc, and } from "drizzle-orm";

// ── Validation ──────────────────────────────────────────────────────────────

const createContactSchema = z.object({
  employerId: z.string().uuid(),
  name: z.string().min(1).max(200),
  role: z.enum(["main", "hr", "labour_relations", "legal", "supervisor", "other"]),
  title: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  preferredMethod: z.enum(["email", "phone", "meeting", "letter", "other"]).optional(),
  isPrimary: z.boolean().default(false),
  notes: z.string().max(2000).optional(),
});

// ── POST ────────────────────────────────────────────────────────────────────

export const POST = withOrganizationAuth(async (request, context) => {
  const { organizationId, userId } = context;

  try {
    const canAccess = await hasMinRole("steward");
    if (!canAccess) {
      return standardErrorResponse(
        ErrorCode.FORBIDDEN,
        "Requires steward role or above"
      );
    }

    const body = await request.json();
    const parsed = createContactSchema.safeParse(body);
    if (!parsed.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "Invalid input",
        parsed.error.flatten()
      );
    }

    const data = parsed.data;

    // Verify the referenced employer belongs to this organization before
    // attaching a contact to it — employerId is client-supplied and has no
    // DB-level FK, so an unverified value could attach this org's contact
    // record to another organization's employer.
    const [employer] = await db
      .select({ id: employers.id })
      .from(employers)
      .where(
        and(eq(employers.id, data.employerId), eq(employers.organizationId, organizationId)),
      );
    if (!employer) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "Employer not found for this organization"
      );
    }

    const [contact] = await db
      .insert(employerContacts)
      .values({
        organizationId,
        employerId: data.employerId,
        name: data.name,
        role: data.role,
        title: data.title ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        preferredMethod: data.preferredMethod ?? "email",
        isPrimary: data.isPrimary,
        notes: data.notes ?? null,
        createdBy: userId,
      })
      .returning();

    await auditDataMutation({
      userId,
      organizationId,
      resource: "employer_contacts",
      action: "create",
      resourceId: contact.id,
      newState: contact,
    });

    await emitCapeAuditEvent({
      eventType: CAPE_AUDIT_EVENTS.EMPLOYER_CONTACT_ADDED,
      userId,
      organizationId,
      resource: "employer_contacts",
      resourceId: contact.id,
      details: {
        employerId: data.employerId,
        contactName: data.name,
        role: data.role,
      },
    });

    return standardSuccessResponse(contact);
  } catch (_error) {
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      "Failed to add employer contact"
    );
  }
});

// ── GET ─────────────────────────────────────────────────────────────────────

export const GET = withOrganizationAuth(async (request, context) => {
  const { organizationId } = context;

  try {
    const canAccess = await hasMinRole("steward");
    if (!canAccess) {
      return standardErrorResponse(
        ErrorCode.FORBIDDEN,
        "Requires steward role or above"
      );
    }

    const { searchParams } = new URL(request.url);
    const employerId = searchParams.get("employerId");

    const conditions = [eq(employerContacts.organizationId, organizationId)];
    if (employerId) {
      conditions.push(eq(employerContacts.employerId, employerId));
    }

    const rows = await db
      .select()
      .from(employerContacts)
      .where(and(...conditions))
      .orderBy(desc(employerContacts.createdAt));

    return standardSuccessResponse(rows);
  } catch (_error) {
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      "Failed to list employer contacts"
    );
  }
});
