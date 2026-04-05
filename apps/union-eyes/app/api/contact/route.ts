/**
 * POST /api/contact
 *
 * Public endpoint for the marketing contact form.
 * Upserts the contact in HubSpot and creates a deal for tracking.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { upsertContact, createDeal } from '@/lib/services/crm-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName, email, organization, role, inquiryType, message } = body;

    if (!firstName || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    logger.info('contact_form:submitted', { email, organization, inquiryType });

    // Sync to HubSpot (fire-and-forget — gracefully skips if unconfigured)
    const contactId = await upsertContact({
      email,
      firstName,
      lastName: lastName || undefined,
      properties: {
        company: organization || undefined,
        jobtitle: role || undefined,
        ue_inquiry_type: inquiryType || undefined,
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
          ue_message: message?.slice(0, 500) || undefined,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('contact_form:error', { error: (err as Error).message });
    return NextResponse.json({ error: 'Failed to process contact form' }, { status: 500 });
  }
}
