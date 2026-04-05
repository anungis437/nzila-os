/**
 * POST /api/contact
 *
 * Public endpoint for the marketing contact form.
 * Upserts the contact in HubSpot and creates a deal for tracking.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { upsertContact, createDeal } from '@/lib/services/crm-service';

export const dynamic = 'force-dynamic';

const contactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  email: z.string().email(),
  organization: z.string().optional(),
  role: z.string().optional(),
  inquiryType: z.string().optional(),
  message: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const body = contactSchema.parse(raw);
    const { firstName, lastName, email, organization, role, inquiryType, message } = body;

    logger.info('contact_form:submitted', { email, organization, inquiryType });

    // Sync to HubSpot (fire-and-forget — gracefully skips if unconfigured)
    const contactId = await upsertContact({
      email,
      firstName,
      lastName: lastName ?? undefined,
      properties: {
        ...(organization ? { company: organization } : {}),
        ...(role ? { jobtitle: role } : {}),
        ...(inquiryType ? { ue_inquiry_type: inquiryType } : {}),
        ue_source: 'union-eyes-contact-form',
      },
    });

    if (contactId) {
      await createDeal({
        name: `UE inquiry — ${organization || email}`,
        stage: 'inquiry',
        contactId,
        properties: {
          ue_inquiry_type: inquiryType || 'general',
          ...(message ? { ue_message: message.slice(0, 500) } : {}),
        },
      });
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
