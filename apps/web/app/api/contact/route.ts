/**
 * POST /api/contact
 *
 * Receives contact / demo-request submissions from the marketing site
 * and pushes them to HubSpot as new contacts + deals for pilot tracking.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { HubSpotClient } from '@nzila/crm-hubspot';
import { createLogger } from '@nzila/os-core/telemetry';
import { checkRateLimit } from '@nzila/os-core/rateLimit';
import { withRequestContext } from '@/lib/api-guards';

const _logger = createLogger('api:contact');
const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_API_URL ?? 'http://localhost:4000';
const ORCHESTRATOR_API_KEY = process.env.ORCHESTRATOR_API_KEY ?? '';
const SALES_SIGNAL_WEBHOOK_URL = process.env.SALES_SIGNAL_WEBHOOK_URL;
const SALES_SIGNAL_WEBHOOK_SECRET = process.env.SALES_SIGNAL_WEBHOOK_SECRET ?? '';

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

type QualificationBand = 'enterprise-ready' | 'pilot-fit' | 'nurture';

function scoreQualification(input: z.infer<typeof contactSchema>): { score: number; band: QualificationBand } {
  let score = 0;

  if (input.company && input.company.trim().length >= 3) score += 25;
  if (input.vertical && input.vertical.trim().length > 0) score += 20;
  if (input.message && input.message.trim().length >= 40) score += 20;
  if (input.utmCampaign && input.utmCampaign.trim().length > 0) score += 15;
  if (input.source && ['demo', 'pilot', 'enterprise'].some((k) => input.source?.toLowerCase().includes(k))) score += 20;

  if (score >= 70) return { score, band: 'enterprise-ready' };
  if (score >= 45) return { score, band: 'pilot-fit' };
  return { score, band: 'nurture' };
}

async function emitSalesSignalWebhook(payload: Record<string, unknown>): Promise<void> {
  if (!SALES_SIGNAL_WEBHOOK_URL) return;

  try {
    await fetch(SALES_SIGNAL_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-nzila-signal-secret': SALES_SIGNAL_WEBHOOK_SECRET,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (error) {
    _logger.warn('contact.signal_webhook_failed', {
      message: error instanceof Error ? error.message : 'unknown-error',
    });
  }
}

async function dispatchPilotIntakeWorkflow(args: {
  company: string;
  email: string;
  source: string;
  qualificationBand: QualificationBand;
  qualificationScore: number;
}): Promise<void> {
  if (!ORCHESTRATOR_API_KEY) return;

  const idempotencyKey = `sales-intake:${args.email.toLowerCase()}:${new Date().toISOString().slice(0, 10)}`;

  try {
    const response = await fetch(`${ORCHESTRATOR_URL}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-org-id': '00000000-0000-0000-0000-000000000000',
        'x-actor-id': 'web-lead-capture',
        'x-api-key': ORCHESTRATOR_API_KEY,
      },
      body: JSON.stringify({
        workflowId: 'onboarding_trigger',
        idempotencyKey,
        dryRun: false,
        executionContext: {
          environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
          triggeredBy: 'web:contact',
          priority: 'normal',
        },
        correlationEnvelope: {
          requestId: randomUUID(),
          correlationId: randomUUID(),
          workflowId: 'onboarding_trigger',
          orgId: '00000000-0000-0000-0000-000000000000',
          actorId: 'web-lead-capture',
          initiatedAt: new Date().toISOString(),
        },
        payload: {
          intakeType: 'pilot_inquiry',
          company: args.company,
          email: args.email,
          source: args.source,
          qualificationBand: args.qualificationBand,
          qualificationScore: args.qualificationScore,
        },
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      _logger.warn('contact.orchestrator_dispatch_failed', { status: response.status });
    }
  } catch (error) {
    _logger.warn('contact.orchestrator_dispatch_error', {
      message: error instanceof Error ? error.message : 'unknown-error',
    });
  }
}

export async function POST(request: NextRequest) {
  return withRequestContext(request, async () => {
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rl = checkRateLimit(`web:contact:${clientIp}`, {
      max: RATE_LIMIT_MAX_REQUESTS,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });

    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

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
    const qualification = scoreQualification(body);

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
      qualificationBand: qualification.band,
      qualificationScore: qualification.score,
    });

    const signalPayload = {
      kind: 'sales_intake',
      capturedAt: new Date().toISOString(),
      lead: {
        name,
        email,
        company: company || '',
        vertical: vertical || '',
      },
      qualification,
      source: {
        source: source || 'marketing_site',
        utmSource: utmSource || '',
        utmMedium: utmMedium || '',
        utmCampaign: utmCampaign || '',
      },
      routing: {
        crmSyncEnabled: Boolean(HUBSPOT_API_KEY),
        orchestratorDispatchEnabled: Boolean(ORCHESTRATOR_API_KEY),
      },
    };

    await Promise.all([
      emitSalesSignalWebhook(signalPayload),
      dispatchPilotIntakeWorkflow({
        company: company || name,
        email,
        source: source || 'marketing_site',
        qualificationBand: qualification.band,
        qualificationScore: qualification.score,
      }),
    ]);

    return NextResponse.json({ ok: true, qualification });
  });
}
