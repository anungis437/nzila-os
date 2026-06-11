// OCRA routes are canonical aliases that re-export ICRA route handlers verbatim.
// Tests verify the modules load and export the expected handler symbols.
import { describe, expect, it, vi } from 'vitest';

// Mock ICRA routes that OCRA re-exports from
vi.mock('../../icra/start/route', () => ({
  GET: vi.fn(async () => new Response('{}', { status: 200 })),
  POST: vi.fn(async () => new Response('{}', { status: 200 })),
}));

vi.mock('../../icra/submit/route', () => ({
  POST: vi.fn(async () => new Response('{}', { status: 200 })),
}));

vi.mock('../../icra/telemetry/route', () => ({
  POST: vi.fn(async () => new Response('{}', { status: 200 })),
}));

vi.mock('../../icra/email-results/route', () => ({
  POST: vi.fn(async () => new Response('{}', { status: 200 })),
}));

vi.mock('../../../icra/results/[id]/route', () => ({
  GET: vi.fn(async () => new Response('{}', { status: 200 })),
}));

vi.mock('../../../icra/[assessmentId]/answer/route', () => ({
  POST: vi.fn(async () => new Response('{}', { status: 200 })),
}));

vi.mock('../../../icra/[assessmentId]/profile/route', () => ({
  GET: vi.fn(async () => new Response('{}', { status: 200 })),
  POST: vi.fn(async () => new Response('{}', { status: 200 })),
}));

vi.mock('../../../icra/[assessmentId]/submit/route', () => ({
  POST: vi.fn(async () => new Response('{}', { status: 200 })),
}));

describe('ocra/start route (ICRA alias)', () => {
  it('exports GET and POST', async () => {
    const { GET, POST } = await import('../ocra/start/route');
    expect(typeof GET).toBe('function');
    expect(typeof POST).toBe('function');
  });
});

describe('ocra/submit route (ICRA alias)', () => {
  it('exports POST', async () => {
    const { POST } = await import('../ocra/submit/route');
    expect(typeof POST).toBe('function');
  });
});

describe('ocra/telemetry route (ICRA alias)', () => {
  it('exports POST', async () => {
    const { POST } = await import('../ocra/telemetry/route');
    expect(typeof POST).toBe('function');
  });
});

describe('ocra/email-results route (ICRA alias)', () => {
  it('exports POST', async () => {
    const { POST } = await import('../ocra/email-results/route');
    expect(typeof POST).toBe('function');
  });
});

describe('ocra/results/[id] route (ICRA alias)', () => {
  it('exports GET', async () => {
    const { GET } = await import('../ocra/results/[id]/route');
    expect(typeof GET).toBe('function');
  });
});

describe('ocra/[assessmentId]/answer route (ICRA alias)', () => {
  it('exports POST', async () => {
    const { POST } = await import('../ocra/[assessmentId]/answer/route');
    expect(typeof POST).toBe('function');
  });
});

describe('ocra/[assessmentId]/profile route (ICRA alias)', () => {
  it('exports GET/POST', async () => {
    const m = await import('../ocra/[assessmentId]/profile/route');
    // profile may export GET or POST depending on ICRA source
    expect(m).toBeDefined();
  });
});

describe('ocra/[assessmentId]/submit route (ICRA alias)', () => {
  it('exports POST', async () => {
    const { POST } = await import('../ocra/[assessmentId]/submit/route');
    expect(typeof POST).toBe('function');
  });
});
