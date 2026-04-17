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
import { withRequestContext } from '@/lib/api-guards';

const _logger = createLogger('api:contact');
const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const rateLimitStore = new Map<string, number[]>();

const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  company: z.string().optional(),
  vertical: z.string().optional(),
  message: z.string().max(2000).optional(),
  source: z.string().max(64).optional(),
  utmSource: z.string().max(128).optional(),
  utmMedium: z.string().max(128).optional(),
  utmCampaign: z.string().max(128).optional(),
  website: z.string().max(0).optional(),
});

export async function POST(request: NextRequest) {
  return withRequestContext(request, async () => {
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const now = Date.now();
    const history = rateLimitStore.get(clientIp) ?? [];
    const recent = history.filter((ts) => now - ts <= RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
    recent.push(now);
    rateLimitStore.set(clientIp, recent);

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

    if (body.website && body.website.trim().length > 0) {
      _logger.warn('contact.spam_detected', { clientIp });
      return NextResponse.json({ ok: true });
    }

    const { name, email, company, vertical, message, source, utmSource, utmMedium, utmCampaign } = body;

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
          ...(utmSource ? { nzila_utm_source: utmSource } : {}),
          ...(utmMedium ? { nzila_utm_medium: utmMedium } : {}),
          ...(utmCampaign ? { nzila_utm_campaign: utmCampaign } : {}),
          nzila_source: source || 'marketing_site',
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
            nzila_source: source || 'marketing_site',
            nzila_utm_source: utmSource || '',
            nzila_utm_medium: utmMedium || '',
            nzila_utm_campaign: utmCampaign || '',
            description: message || '',
          },
        });
      }
    }

    _logger.info('contact.submitted', {
      vertical: vertical || 'unknown',
      source: source || 'marketing_site',
      hasCompany: Boolean(company),
    });

    return NextResponse.json({ ok: true });
  });
}
