/**
 * POST /api/contact
 *
 * Receives contact / demo-request submissions from the marketing site
 * and pushes them to HubSpot as new contacts + deals for pilot tracking.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { HubSpotClient } from '@nzila/crm-hubspot';
import { createLogger } from '@nzila/os-core/telemetry';

const logger = createLogger('api:contact');
const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;

export async function POST(request: NextRequest) {
  let body: { name?: string; email?: string; company?: string; vertical?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, email, company, vertical, message } = body;

  if (!email || !name) {
    return NextResponse.json({ error: 'name and email are required' }, { status: 400 });
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }

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
