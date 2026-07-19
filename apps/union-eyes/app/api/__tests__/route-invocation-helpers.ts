import { readdirSync, statSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { relative, resolve } from 'node:path';
import { NextRequest } from 'next/server';

const TEST_ORG_ID = '00000000-0000-0000-0000-000000000001';

function baseJsonBody() {
  return {
    id: 'test-id',
    caseId: 'test-id',
    claimId: 'test-id',
    memberId: 'test-id',
    organizationId: TEST_ORG_ID,
    title: 'Test title',
    name: 'Test name',
    description: 'This is a sufficiently long test description for schema validation.',
    content: 'Test content',
    status: 'draft',
    action: 'classify-clause',
    email: 'test@example.com',
    amount: '100.00',
    type: 'general',
    priority: 'medium',
    claimType: 'grievance_discipline',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    incidentDate: '2026-01-01T00:00:00.000Z',
    effectiveDate: '2026-01-01T00:00:00.000Z',
    dueDate: '2026-01-31T00:00:00.000Z',
    tags: ['test'],
    metadata: {},
  };
}

export function collectRouteFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = resolve(dir, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      files.push(...collectRouteFiles(abs));
      continue;
    }
    if (entry === 'route.ts') files.push(abs);
  }
  return files;
}

export function routeSlug(apiRoot: string, absolutePath: string): string {
  // Normalize backslashes to forward slashes FIRST so this works on Windows,
  // where path.relative returns 'a\\b\\route.ts' rather than 'a/b/route.ts'.
  return relative(apiRoot, absolutePath).replace(/\\/g, '/').replace(/\/route\.ts$/, '');
}

export function routeParamsFromSlug(slug: string): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {};
  for (const part of slug.split('/')) {
    const catchAll = part.match(/^\[\.\.\.(.+)\]$/);
    if (catchAll) {
      params[catchAll[1]] = ['test', 'path'];
      continue;
    }

    const optionalCatchAll = part.match(/^\[\[\.\.\.(.+)\]\]$/);
    if (optionalCatchAll) {
      params[optionalCatchAll[1]] = ['test', 'path'];
      continue;
    }

    const single = part.match(/^\[(.+)\]$/);
    if (single) {
      params[single[1]] = 'test-id';
    }
  }
  return params;
}

export function concretePathFromSlug(slug: string): string {
  return slug
    .replace(/\[\[\.\.\.[^\]]+\]\]/g, 'test/path')
    .replace(/\[\.\.\.[^\]]+\]/g, 'test/path')
    .replace(/\[[^\]]+\]/g, 'test-id');
}

export function makeRequestForHandler(method: string, slug: string): NextRequest {
  const concretePath = concretePathFromSlug(slug);
  const url = new URL(`http://localhost:3000/api/${concretePath}`);
  url.searchParams.set('organizationId', TEST_ORG_ID);
  url.searchParams.set('limit', '10');
  url.searchParams.set('offset', '0');
  url.searchParams.set('q', 'test');
  url.searchParams.set('report', 'cases');

  const upper = method.toUpperCase();
  const init: ConstructorParameters<typeof NextRequest>[1] = {
    method: upper,
    headers: { 'content-type': 'application/json' },
  };

  const body = baseJsonBody();

  if (slug === 'grievances/import' && upper === 'POST') {
    init.body = JSON.stringify({
      format: 'json',
      payload: [
        {
          type: 'other',
          title: 'Imported grievance title',
          description: 'Imported grievance description with enough detail to pass validation.',
        },
      ],
      sourceSystem: 'test-import',
    });
    return new NextRequest(url, init);
  }

  if (slug === 'social-media/accounts' && upper === 'POST') {
    init.body = JSON.stringify({ platform: 'facebook', account_id: '00000000-0000-0000-0000-000000000002' });
    return new NextRequest(url, init);
  }

  if (slug === 'communications/webhooks/resend' && upper === 'POST') {
    init.headers = {
      'content-type': 'application/json',
      'svix-id': 'msg_test',
      'svix-timestamp': '1700000000',
      'svix-signature': 'v1,test-signature',
    };
    init.body = JSON.stringify({ type: 'email.sent', data: { email_id: 'email_test', to: ['test@example.com'] } });
    return new NextRequest(url, init);
  }

  if (slug === 'payments/webhooks/paypal' && upper === 'POST') {
    init.body = JSON.stringify({ id: 'evt_paypal', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { custom_id: TEST_ORG_ID } });
    return new NextRequest(url, init);
  }

  if (slug === 'payments/webhooks/stripe' && upper === 'POST') {
    const payload = JSON.stringify({
      id: 'evt_test_123',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_123',
          amount: 1000,
          currency: 'cad',
          metadata: { organization_id: TEST_ORG_ID },
        },
      },
    });
    const timestamp = '1700000000';
    const secret = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_test';
    const signedPayload = `${timestamp}.${payload}`;
    const signature = createHmac('sha256', secret).update(signedPayload).digest('hex');
    init.headers = {
      'content-type': 'application/json',
      'stripe-signature': `t=${timestamp},v1=${signature}`,
    };
    init.body = payload;
    return new NextRequest(url, init);
  }

  if (slug.includes('pilot/apply/') && slug.endsWith('commercial-transition') && upper === 'POST') {
    init.body = JSON.stringify({ targetState: 'contract_sent', allowSkip: true, reason: 'test transition' });
    return new NextRequest(url, init);
  }

  if (upper === 'POST' || upper === 'PUT' || upper === 'PATCH') {
    init.body = JSON.stringify(body);
  }

  return new NextRequest(url, init);
}
