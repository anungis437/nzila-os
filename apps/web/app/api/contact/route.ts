/**
 * POST /api/contact
 *
 * Receives contact / demo-request submissions from the marketing site
 * and pushes them to HubSpot as new contacts + deals for pilot tracking.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { HubSpotClient } from '@nzila/crm-hubspot';
import { createLogger } from '@nzila/os-core/telemetry';

const _logger = createLogger('api:contact');
const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;

const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  company: z.string().optional(),
  vertical: z.string().optional(),
  message: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  let body: z.infer<typeof contactSchema>;
  try {
    const raw = await request.json();
    body = contactSchema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: err.flatten().fieldErrors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, email, company, vertical, message } = body;

  // If HubSpot is configured, sync the lead
  if (HUBSPOT_API_KEY) {
    const client = new HubSpotClient({ apiKey: HUBSPOT_API_KEY });

    const [firstName, ...rest] = name.split(' ');
    const lastName = rest.join(' ') || undefined;

    const contactResult = await client.upsertContact({
      email,
      firstName,
      lastName,
      company: company || undefined,
      properties: {
        ...(vertical ? { nzila_vertical: vertical } : {}),
        nzila_source: 'marketing_site',
      },
    });

    if (contactResult.ok) {
      // Create a deal to track the pilot inquiry
      await client.createDeal({
        name: `Pilot inquiry — ${company || name}`,
        stage: 'qualifiedtobuy',
        contactId: contactResult.id,
        properties: {
          nzila_vertical: vertical || '',
          nzila_source: 'marketing_site',
          description: message || '',
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
