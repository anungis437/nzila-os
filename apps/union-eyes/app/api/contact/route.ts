/**
 * POST /api/contact
 *
 * Public endpoint for the marketing contact form.
 * The submission is stored locally first (contact_submissions, system role); only then is it synchronised to HubSpot (contact and
 * deal). The visitor is acknowledged once the local record exists: an unconfigured or failing CRM no longer loses or refuses the
 * submission, and crm_status says whether the CRM has it.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { upsertContact, createDeal } from '@/lib/services/crm-service';
import { guardPublicIntake } from '@/lib/public-intake/guard';
import { eq } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { contactSubmissions } from '@/db/schema/domains/communications/contact-submissions';

export const dynamic = 'force-dynamic';

// Every field is bounded: an anonymous submission is stored as typed, so none may be unbounded.
const contactSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).optional(),
  email: z.string().trim().max(254).email(),
  organization: z.string().trim().max(200).optional(),
  role: z.string().trim().max(100).optional(),
  inquiryType: z.string().trim().max(100).optional(),
  message: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const intake = await guardPublicIntake(request, { bucket: 'write', challenge: true });
    if (!intake.ok) return intake.response;
    const raw = intake.json;
    const body = contactSchema.parse(raw);
    const { firstName, lastName, email, organization, role, inquiryType, message } = body;

    // The visitor's address is personal data and is not written to the log.
    logger.info('contact_form:submitted', { organization, inquiryType });

    // The local record comes first: the submission exists even when the CRM is not configured or is down.
    let submissionId: string;
    try {
      const [stored] = await withSystemContext(async (tx) =>
        tx
          .insert(contactSubmissions)
          .values({ firstName, lastName: lastName ?? null, email, organization: organization ?? null, role: role ?? null, inquiryType: inquiryType ?? null, message: message ?? null })
          .returning({ id: contactSubmissions.id }),
      );
      submissionId = stored.id;
    } catch (storeError) {
      logger.error('contact_form:not_stored', { error: (storeError as Error).message });
      return NextResponse.json({ error: 'Your message could not be recorded. Please try again later.' }, { status: 503 });
    }

    // Synchronise to HubSpot. A CRM that is unconfigured or failing leaves the row marked failed for a later retry; it does not
    // un-record the submission.
    let crmStatus: 'recorded' | 'failed' = 'failed';
    let crmContactId: string | null = null;
    let crmDealId: string | null = null;
    try {
      crmContactId = (await upsertContact({
        email,
        firstName,
        lastName: lastName ?? undefined,
        properties: {
          ...(organization ? { company: organization } : {}),
          ...(role ? { jobtitle: role } : {}),
          ...(inquiryType ? { ue_inquiry_type: inquiryType } : {}),
          ue_source: 'union-eyes-contact-form',
        },
      })) ?? null;
      if (crmContactId) {
        crmDealId = (await createDeal({
          name: `UE inquiry — ${organization || email}`,
          stage: 'inquiry',
          contactId: crmContactId,
          properties: {
            ue_inquiry_type: inquiryType || 'general',
            ...(message ? { ue_message: message.slice(0, 500) } : {}),
          },
        })) ?? null;
      }
      if (crmContactId && crmDealId) crmStatus = 'recorded';
    } catch (crmError) {
      logger.error('contact_form:crm_error', { error: (crmError as Error).message });
    }
    if (crmStatus === 'failed') logger.error('contact_form:crm_not_synced', { inquiryType });

    try {
      await withSystemContext(async (tx) =>
        tx
          .update(contactSubmissions)
          .set({ crmStatus, crmContactId, crmDealId, crmSyncedAt: crmStatus === 'recorded' ? new Date() : null })
          .where(eq(contactSubmissions.id, submissionId)),
      );
    } catch (statusError) {
      logger.error('contact_form:status_not_saved', { error: (statusError as Error).message });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: err.flatten().fieldErrors }, { status: 400 });
    }
    logger.error('contact_form:error', { error: (err as Error).message });
    return NextResponse.json({ error: 'Failed to process contact form' }, { status: 500 });
  }
}
