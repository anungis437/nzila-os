import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApiAuth: vi.fn(),
  hasMinRole: vi.fn(),
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
  buildPilotStatus: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: m.withApiAuth, hasMinRole: m.hasMinRole }));
vi.mock('@nzila/os-core', () => ({ createLogger: vi.fn(() => m.logger) }));
vi.mock('@/lib/pilot-admin', () => ({ buildPilotStatus: m.buildPilotStatus }));

async function loadRoute() {
  return import('../admin/pilot-status/route');
}

describe('admin/pilot-status route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApiAuth.mockImplementation((handler: any) => (request: NextRequest) => handler(request));
    m.hasMinRole.mockResolvedValue(true);
    m.buildPilotStatus.mockReturnValue({ health: { status: 'healthy' }, summary: { cases: 0 } });
  });

  it('returns 403 when caller is not platform lead', async () => {
    const { GET } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await GET(new NextRequest('http://localhost/api/admin/pilot-status'));

    expect(response.status).toBe(403);
  });

  it('returns pilot status when authorized', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/admin/pilot-status'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ health: { status: 'healthy' } });
    expect(m.buildPilotStatus).toHaveBeenCalled();
    expect(m.logger.warn).toHaveBeenCalled();
  });

  it('returns 500 when status computation throws', async () => {
    const { GET } = await loadRoute();
    m.buildPilotStatus.mockImplementationOnce(() => {
      throw new Error('boom');
    });

    const response = await GET(new NextRequest('http://localhost/api/admin/pilot-status'));

    expect(response.status).toBe(500);
  });
});